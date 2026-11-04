import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { seedOrders } from './store-orders.fixture';

describe('Dashboard timeseries (migrated PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  afterAll(() => pool.end());

  it('values stock in/out at the price of the time and adds costs per period', async () => {
    try {
      await db.transaction(async (tx) => {
        const { ids } = await seedOrders(tx);
        const dashboard = new DashboardService({ db: tx } as never);

        const receipt = async (at: string, quantity: string, price: string) => {
          const id = randomUUID();
          await tx.insert(schema.stockReceipts).values({
            id,
            farmId: ids.farm,
            warehouseId: ids.warehouse,
            receiptCode: id.slice(0, 20),
            createdByMemberId: ids.member,
          });
          await tx.insert(schema.stockReceiptItems).values({
            stockReceiptId: id,
            itemId: ids.item,
            quantity,
            unitPrice: price,
          });
          await tx
            .update(schema.stockReceipts)
            .set({
              status: 'CONFIRMED',
              confirmedByMemberId: ids.member,
              confirmedAt: at,
            })
            .where(eq(schema.stockReceipts.id, id));
          await move(at, 'RECEIPT', quantity, 'STOCK_RECEIPT', id);
        };
        const move = (
          at: string,
          transactionType: (typeof schema.inventoryTransactionType.enumValues)[number],
          quantityChange: string,
          sourceType: string,
          sourceId = randomUUID(),
          warehouseId = ids.warehouse,
        ) =>
          tx.insert(schema.inventoryTransactions).values({
            farmId: ids.farm,
            warehouseId,
            itemId: ids.item,
            transactionType,
            quantityChange,
            sourceType,
            sourceId,
            createdAt: at,
          });

        await receipt('2026-10-02T03:00:00Z', '10', '1000');
        await move('2026-10-05T02:00:00Z', 'ISSUE', '-4', 'STOCK_ISSUE');
        await receipt('2026-10-10T03:00:00Z', '1', '2000');
        // Priced at 2000 now; the issue on the 5th keeps the 1000 of its time.
        await move(
          '2026-10-12T03:00:00Z',
          'MAINTENANCE_ISSUE',
          '-1',
          'STOCK_ISSUE',
        );
        const transfer = randomUUID();
        await move(
          '2026-10-15T03:00:00Z',
          'TRANSFER_OUT',
          '-2',
          'STOCK_TRANSFER',
          transfer,
        );
        await move(
          '2026-10-15T03:00:00Z',
          'TRANSFER_IN',
          '2',
          'STOCK_TRANSFER',
          transfer,
          ids.otherWarehouse,
        );
        // Equipment handed out or sent to external maintenance is not stock out.
        await move(
          '2026-10-16T03:00:00Z',
          'ASSIGNMENT_OUT',
          '-1',
          'ASSET_ASSIGNMENT',
        );
        await move(
          '2026-10-16T03:00:00Z',
          'MAINTENANCE_ISSUE',
          '-1',
          'ASSET_MAINTENANCE',
        );
        // 00:30 on the 21st in Vietnam.
        await move(
          '2026-10-20T17:30:00Z',
          'ADJUSTMENT_OUT',
          '-1',
          'STOCK_COUNT',
        );
        // Before any priced receipt in the range start: no price, still counted.
        await move(
          '2026-10-01T01:00:00Z',
          'ADJUSTMENT_IN',
          '3',
          'INVENTORY_ADJUSTMENT',
        );

        const assetItem = randomUUID();
        await tx.insert(schema.items).values({
          id: assetItem,
          farmId: ids.farm,
          categoryId: ids.category,
          unitId: ids.unit,
          code: assetItem,
          name: assetItem,
          itemType: 'EQUIPMENT',
          trackingMode: 'ASSET',
        });
        const asset = randomUUID();
        await tx.insert(schema.assets).values({
          id: asset,
          farmId: ids.farm,
          itemId: assetItem,
          assetCode: `TS-${asset.slice(0, 8)}`,
        });
        await tx.insert(schema.maintenanceRecords).values([
          {
            farmId: ids.farm,
            assetId: asset,
            maintenanceType: 'CORRECTIVE',
            status: 'FAILED',
            startedAt: '2026-10-20T01:00:00Z',
            completedAt: '2026-10-25T05:00:00Z',
            laborCost: '100000',
            materialCost: '50000',
            otherCost: '0',
          },
          {
            farmId: ids.farm,
            assetId: asset,
            maintenanceType: 'PREVENTIVE',
            status: 'IN_PROGRESS',
            startedAt: '2026-10-26T01:00:00Z',
            laborCost: '999',
          },
        ]);

        const farm = await dashboard.timeseries(
          ids.farm,
          '2026-10-01',
          '2026-10-31',
        );
        expect(farm.granularity).toBe('day');
        expect(farm.periods).toHaveLength(31);
        const day = (date: string) =>
          farm.periods.find((period) => period.period === date);
        expect(day('2026-10-01')).toMatchObject({
          inboundValue: '0',
          inboundDocuments: 1,
        });
        expect(day('2026-10-02')).toMatchObject({
          inboundValue: '10000',
          inboundDocuments: 1,
          purchaseCost: '10000',
        });
        expect(day('2026-10-05')).toMatchObject({
          outboundValue: '4000',
          outboundDocuments: 1,
        });
        expect(day('2026-10-12')).toMatchObject({ outboundValue: '2000' });
        expect(day('2026-10-15')).toMatchObject({
          inboundDocuments: 0,
          outboundDocuments: 0,
        });
        expect(day('2026-10-16')).toMatchObject({ outboundDocuments: 0 });
        expect(day('2026-10-20')).toMatchObject({ outboundDocuments: 0 });
        expect(day('2026-10-21')).toMatchObject({
          outboundValue: '2000',
          outboundDocuments: 1,
        });
        expect(day('2026-10-25')).toMatchObject({
          maintenanceLaborCost: '100000',
          maintenanceMaterialCost: '50000',
          maintenanceOtherCost: '0',
        });
        expect(day('2026-10-26')).toMatchObject({ maintenanceLaborCost: '0' });
        expect(farm.unpricedMovements).toBe(1);

        // One warehouse: its transfers count, costs of other warehouses do not.
        const sales = await dashboard.timeseries(
          ids.farm,
          '2026-10-01',
          '2026-10-31',
          ids.warehouse,
        );
        expect(
          sales.periods.find((p) => p.period === '2026-10-15'),
        ).toMatchObject({ outboundValue: '4000', outboundDocuments: 1 });
        const other = await dashboard.timeseries(
          ids.farm,
          '2026-10-01',
          '2026-10-31',
          ids.otherWarehouse,
        );
        const otherTotals = other.periods.filter(
          (p) => p.inboundDocuments > 0 || p.purchaseCost !== '0',
        );
        expect(otherTotals).toEqual([
          expect.objectContaining({
            period: '2026-10-15',
            inboundValue: '4000',
            purchaseCost: '0',
          }),
        ]);

        // Wider ranges switch to weeks (Mondays) and months.
        const weeks = await dashboard.timeseries(
          ids.farm,
          '2026-09-01',
          '2026-10-31',
        );
        expect(weeks.granularity).toBe('week');
        expect(weeks.periods[0].period).toBe('2026-08-31');
        const months = await dashboard.timeseries(
          ids.farm,
          '2026-01-01',
          '2026-10-31',
        );
        expect(months.granularity).toBe('month');
        expect(months.periods).toHaveLength(10);
        expect(
          months.periods.find((p) => p.period === '2026-10-01'),
        ).toMatchObject({
          inboundValue: '12000',
          outboundValue: '8000',
          inboundDocuments: 3,
          outboundDocuments: 3,
          purchaseCost: '12000',
          maintenanceLaborCost: '100000',
        });

        await expect(
          dashboard.timeseries(ids.farm, '2025-01-01', '2026-10-31'),
        ).rejects.toMatchObject({ status: 400 });
        await expect(
          dashboard.timeseries(
            ids.farm,
            '2026-10-01',
            '2026-10-31',
            randomUUID(),
          ),
        ).rejects.toMatchObject({ status: 404 });
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });
});

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { OrderTestDb, seedOrders } from './store-orders.fixture';

describe('Dashboard summary (migrated PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  afterAll(() => pool.end());

  const isoDay = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  it('computes stock value from the latest priced receipt and counts alerts', async () => {
    try {
      await db.transaction(async (tx) => {
        const scoped = tx as unknown as OrderTestDb;
        const { ids, service, input } = await seedOrders(scoped);
        const item = (
          id: string,
          trackingMode: 'QUANTITY' | 'LOT' | 'ASSET',
          minStockLevel = '0',
        ) => ({
          id,
          farmId: ids.farm,
          categoryId: ids.category,
          unitId: ids.unit,
          code: id,
          name: id,
          itemType: 'MATERIAL' as const,
          trackingMode,
          minStockLevel,
        });
        const unpriced = randomUUID(),
          lotItem = randomUUID(),
          assetItem = randomUUID();
        await tx
          .insert(schema.items)
          .values([
            item(unpriced, 'QUANTITY', '5'),
            item(lotItem, 'LOT'),
            { ...item(assetItem, 'ASSET'), itemType: 'EQUIPMENT' },
          ]);
        await tx.insert(schema.inventoryBalances).values({
          farmId: ids.farm,
          warehouseId: ids.warehouse,
          itemId: unpriced,
          quantityOnHand: '2',
        });

        // Two older confirmed receipts for ids.item (10 on hand), superseded below.
        for (const [day, price] of [
          ['2026-01-01T00:00:00Z', '1000'],
          ['2026-02-01T00:00:00Z', '1500'],
        ]) {
          const receipt = randomUUID();
          await tx.insert(schema.stockReceipts).values({
            id: receipt,
            farmId: ids.farm,
            warehouseId: ids.warehouse,
            receiptCode: receipt.slice(0, 20),
            createdByMemberId: ids.member,
          });
          await tx.insert(schema.stockReceiptItems).values({
            stockReceiptId: receipt,
            itemId: ids.item,
            quantity: '1',
            unitPrice: price,
          });
          await tx
            .update(schema.stockReceipts)
            .set({
              status: 'CONFIRMED',
              confirmedByMemberId: ids.member,
              confirmedAt: day,
            })
            .where(eq(schema.stockReceipts.id, receipt));
        }

        // The newest receipt has two priced lines (1 × 1000, 3 × 2000): weighted 1750.
        const latest = randomUUID();
        await tx.insert(schema.stockReceipts).values({
          id: latest,
          farmId: ids.farm,
          warehouseId: ids.warehouse,
          receiptCode: latest.slice(0, 20),
          createdByMemberId: ids.member,
        });
        await tx.insert(schema.stockReceiptItems).values([
          {
            stockReceiptId: latest,
            itemId: ids.item,
            quantity: '1',
            unitPrice: '1000',
          },
          {
            stockReceiptId: latest,
            itemId: ids.item,
            quantity: '3',
            unitPrice: '2000',
          },
        ]);
        await tx
          .update(schema.stockReceipts)
          .set({
            status: 'CONFIRMED',
            confirmedByMemberId: ids.member,
            confirmedAt: '2026-03-01T00:00:00Z',
          })
          .where(eq(schema.stockReceipts.id, latest));

        const lots = [
          [isoDay(10), '1'],
          [isoDay(-1), '1'],
          [isoDay(100), '1'],
          [isoDay(5), '0'], // expiring but out of stock: not an alert
        ] as const;
        for (const [expiryDate, quantity] of lots) {
          const lot = randomUUID();
          await tx.insert(schema.inventoryLots).values({
            id: lot,
            farmId: ids.farm,
            itemId: lotItem,
            supplierLotNumber: lot.slice(0, 8),
            expiryDate,
            initialQuantity: '1',
          });
          await tx.insert(schema.inventoryBalances).values({
            farmId: ids.farm,
            warehouseId: ids.warehouse,
            itemId: lotItem,
            lotId: lot,
            quantityOnHand: quantity,
          });
        }
        await tx.insert(schema.assets).values({
          farmId: ids.farm,
          itemId: assetItem,
          assetCode: `DASH-${assetItem.slice(0, 8)}`,
          status: 'MAINTENANCE',
        });
        await service.create(ids.customer, input(1));

        const dashboard = new DashboardService({ db: tx } as never);
        expect(await dashboard.summary(ids.farm, ['FARM_OWNER'])).toEqual({
          stockValue: '17500',
          unpricedItems: 2,
          belowMinimum: 1,
          expiringLots: 1,
          expiredLots: 1,
          assetsInMaintenance: 1,
          pendingAdjustments: 0,
          ordersToday: 1,
          ordersPending: 1,
        });
        expect(
          await dashboard.summary(ids.otherFarm, ['FARM_OWNER']),
        ).toMatchObject({
          stockValue: '0',
          ordersToday: 0,
        });
        // Each manager role only receives the figures of its own area.
        expect(
          await dashboard.summary(ids.farm, ['STORE_MANAGER']),
        ).toMatchObject({
          stockValue: null,
          assetsInMaintenance: null,
          ordersToday: 1,
          ordersPending: 1,
        });
        expect(
          await dashboard.summary(ids.farm, ['WAREHOUSE_MANAGER']),
        ).toMatchObject({
          stockValue: '17500',
          ordersToday: null,
          ordersPending: null,
        });
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });
});

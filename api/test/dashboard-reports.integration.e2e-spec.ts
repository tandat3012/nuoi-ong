import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { vietnamDate } from '../src/modules/maintenance/maintenance-dates';
import {
  MOVE_KINDS,
  type MoveKind,
} from '../src/modules/dashboard/stock-valuation';
import { type OrderTestDb as Tx, seedOrders } from './store-orders.fixture';

const OUT_KINDS: MoveKind[] = [
  'issue',
  'transferOut',
  'adjustmentOut',
  'assetAssign',
  'maintenanceOut',
];

async function scenario(tx: Tx) {
  const { ids } = await seedOrders(tx);

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
  await receipt('2026-10-10T03:00:00Z', '4', '1500');
  // Average now (6 × 1000 + 4 × 1500) / 10 = 1200; the issue on the 5th kept 1000.
  await move('2026-10-12T03:00:00Z', 'MAINTENANCE_ISSUE', '-1', 'STOCK_ISSUE');
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
  await move('2026-10-20T17:30:00Z', 'ADJUSTMENT_OUT', '-1', 'STOCK_COUNT');
  // Before any priced receipt of the item: no price, still counted.
  await move(
    '2026-10-01T01:00:00Z',
    'ADJUSTMENT_IN',
    '3',
    'INVENTORY_ADJUSTMENT',
    randomUUID(),
    ids.otherWarehouse,
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
  return { ids, dashboard: new DashboardService({ db: tx } as never) };
}

describe('Dashboard timeseries and stock report (migrated PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  afterAll(() => pool.end());
  const inRollback = async (test: (tx: Tx) => Promise<void>) => {
    try {
      await db.transaction(async (tx) => {
        await test(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };

  it('values stock in/out at the moving average and adds costs per period', () =>
    inRollback(async (tx) => {
      const { ids, dashboard } = await scenario(tx);
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
      expect(day('2026-10-12')).toMatchObject({ outboundValue: '1200' });
      expect(day('2026-10-15')).toMatchObject({
        inboundDocuments: 0,
        outboundDocuments: 0,
      });
      expect(day('2026-10-16')).toMatchObject({ outboundDocuments: 0 });
      expect(day('2026-10-20')).toMatchObject({ outboundDocuments: 0 });
      expect(day('2026-10-21')).toMatchObject({
        outboundValue: '1200',
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
      ).toMatchObject({ outboundValue: '2400', outboundDocuments: 1 });
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
        expect.objectContaining({ period: '2026-10-01', inboundValue: '0' }),
        expect.objectContaining({
          period: '2026-10-15',
          inboundValue: '2400',
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
        inboundValue: '16000',
        outboundValue: '6400',
        inboundDocuments: 3,
        outboundDocuments: 3,
        purchaseCost: '16000',
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
    }));

  it('reports opening, movements and closing per item and warehouse', () =>
    inRollback(async (tx) => {
      const { ids, dashboard } = await scenario(tx);
      const report = await dashboard.stockReport(
        ids.farm,
        '2026-10-05',
        '2026-10-31',
      );
      // Sorted by warehouse code: OTHER, then SALE.
      expect(report.rows.map((row) => row.warehouseId)).toEqual([
        ids.otherWarehouse,
        ids.warehouse,
      ]);
      const [other, sales] = report.rows;
      expect(sales).toMatchObject({
        itemId: ids.item,
        itemName: 'Honey',
        opening: { quantity: '10', value: '10000' },
        closing: { quantity: '4', value: '4800' },
        unpriced: false,
      });
      expect(sales.moves).toMatchObject({
        receipt: { quantity: '4', value: '6000' },
        // The issue on the 5th at 1000, the maintenance material at 1200.
        issue: { quantity: '5', value: '5200' },
        transferOut: { quantity: '2', value: '2400' },
        assetAssign: { quantity: '1', value: '1200' },
        maintenanceOut: { quantity: '1', value: '1200' },
        adjustmentOut: { quantity: '1', value: '1200' },
        transferIn: { quantity: '0', value: '0' },
      });
      // The unpriced adjustment of the 1st is opening stock worth 0 VND.
      expect(other).toMatchObject({
        opening: { quantity: '3', value: '0' },
        closing: { quantity: '5', value: '2400' },
        unpriced: true,
      });
      expect(other.moves.transferIn).toEqual({ quantity: '2', value: '2400' });

      for (const row of report.rows) {
        for (const field of ['quantity', 'value'] as const) {
          const moved = MOVE_KINDS.reduce(
            (sum, kind) =>
              sum +
              (OUT_KINDS.includes(kind) ? -1 : 1) *
                Number(row.moves[kind][field]),
            Number(row.opening[field]),
          );
          expect(moved).toBe(Number(row.closing[field]));
        }
      }

      const salesOnly = await dashboard.stockReport(
        ids.farm,
        '2026-10-05',
        '2026-10-31',
        ids.warehouse,
      );
      expect(salesOnly.rows).toEqual([sales]);

      const quiet = await dashboard.stockReport(
        ids.farm,
        '2026-11-01',
        '2026-11-30',
      );
      expect(quiet.rows.map((row) => [row.opening, row.closing])).toEqual([
        [
          { quantity: '5', value: '2400' },
          { quantity: '5', value: '2400' },
        ],
        [
          { quantity: '4', value: '4800' },
          { quantity: '4', value: '4800' },
        ],
      ]);
      expect(
        (await dashboard.stockReport(ids.farm, '2026-09-01', '2026-09-30'))
          .rows,
      ).toEqual([]);

      await expect(
        dashboard.stockReport(ids.farm, '2025-01-01', '2026-10-31'),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        dashboard.stockReport(
          ids.farm,
          '2026-10-01',
          '2026-10-31',
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 404 });
    }));

  it('shows the report closing value on the dashboard card (AC27)', () =>
    inRollback(async (tx) => {
      const { ids, dashboard } = await scenario(tx);
      const newItem = async () => {
        const id = randomUUID();
        await tx.insert(schema.items).values({
          id,
          farmId: ids.farm,
          categoryId: ids.category,
          unitId: ids.unit,
          code: id,
          name: id,
          itemType: 'MATERIAL',
          trackingMode: 'QUANTITY',
        });
        return id;
      };
      const ledger = (
        itemId: string,
        warehouseId: string,
        at: string,
        transactionType: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT_IN',
        quantityChange: string,
        sourceType: string,
        sourceId: string = randomUUID(),
      ) =>
        tx.insert(schema.inventoryTransactions).values({
          farmId: ids.farm,
          warehouseId,
          itemId,
          transactionType,
          quantityChange,
          sourceType,
          sourceId,
          createdAt: at,
        });
      const receipt = async (
        itemId: string,
        at: string,
        quantity: string,
        price: string,
      ) => {
        const id = randomUUID();
        await tx.insert(schema.stockReceipts).values({
          id,
          farmId: ids.farm,
          warehouseId: ids.warehouse,
          receiptCode: id.slice(0, 20),
          createdByMemberId: ids.member,
        });
        await tx
          .insert(schema.stockReceiptItems)
          .values({ stockReceiptId: id, itemId, quantity, unitPrice: price });
        await ledger(
          itemId,
          ids.warehouse,
          at,
          'RECEIPT',
          quantity,
          'STOCK_RECEIPT',
          id,
        );
      };
      // Priced in the sales warehouse, but its earlier stock in OTHER has no price.
      const mixed = await newItem();
      await ledger(
        mixed,
        ids.otherWarehouse,
        '2026-10-01T00:00:00Z',
        'ADJUSTMENT_IN',
        '2',
        'INVENTORY_ADJUSTMENT',
      );
      await receipt(mixed, '2026-10-03T03:00:00Z', '3', '500');
      // Out before in: quantity back to 0 while 1000 VND of value stays.
      const residual = await newItem();
      await ledger(
        residual,
        ids.warehouse,
        '2026-10-03T03:00:00Z',
        'ISSUE',
        '-1',
        'STOCK_ISSUE',
      );
      await receipt(residual, '2026-10-04T03:00:00Z', '1', '1000');

      const today = vietnamDate(new Date());
      const yearAgo = new Date(Date.parse(today) - 365 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const closing = async (dateFrom: string, warehouseId?: string) =>
        String(
          (
            await dashboard.stockReport(ids.farm, dateFrom, today, warehouseId)
          ).rows.reduce((sum, row) => sum + Number(row.closing.value), 0),
        );
      // Honey 4800 (SALE) + 2400 (OTHER), 1500 for `mixed`, 1000 left on `residual`.
      expect(await closing(yearAgo)).toBe('9700');
      expect(await closing(today)).toBe('9700');
      expect(await dashboard.summary(ids.farm, ['FARM_OWNER'])).toMatchObject({
        stockValue: '9700',
        unpricedItems: 1,
      });
      expect(await closing(today, ids.warehouse)).toBe('7300');
      expect(
        await dashboard.summary(
          ids.farm,
          ['WAREHOUSE_MANAGER'],
          [ids.warehouse],
        ),
      ).toMatchObject({ stockValue: '7300', unpricedItems: 0 });
      expect(
        await dashboard.summary(ids.farm, ['WAREHOUSE_MANAGER'], []),
      ).toMatchObject({ stockValue: '0', unpricedItems: 0 });

      // Store-only roles get no stock figures and never read the ledger.
      const ledgerRead = jest.spyOn(
        dashboard as unknown as { ledger: () => Promise<unknown> },
        'ledger',
      );
      expect(
        await dashboard.summary(ids.farm, ['STORE_MANAGER']),
      ).toMatchObject({ stockValue: null, unpricedItems: null });
      expect(ledgerRead).not.toHaveBeenCalled();
    }));
});

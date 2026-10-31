import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { InventoryAdjustmentsService } from '../src/modules/inventory/inventory-adjustments.service';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { OrderTestDb, seedOrders } from './store-orders.fixture';

describe('Warehouse business flow across documents and ledger', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle(pool, { schema });
  const rollback = new Error('Rollback warehouse business flow');
  afterAll(() => pool.end());

  it.each(['QUANTITY', 'LOT'] as const)(
    '%s: reconciles receipt, issue, transfer, count and adjustment, including rejected operations',
    async (trackingMode) => {
      try {
        await db.transaction(async (transaction) => {
          const tx = transaction as unknown as OrderTestDb;
          const { ids, database, issues } = await seedOrders(tx);
          await tx
            .delete(schema.inventoryBalances)
            .where(eq(schema.inventoryBalances.itemId, ids.item));
          await tx
            .update(schema.items)
            .set({ trackingMode })
            .where(eq(schema.items.id, ids.item));
          const access = new WarehousesService(database);
          const receipts = new StockReceiptsService(database, access);
          const transfers = new StockTransfersService(database, access);
          const counts = new StockCountsService(database, access);
          const adjustments = new InventoryAdjustmentsService(database, access);
          const assertStock = async (source: string, destination: string) => {
            for (const [warehouseId, expected] of [
              [ids.warehouse, source],
              [ids.otherWarehouse, destination],
            ]) {
              const [balance] = await tx
                .select({ quantity: schema.inventoryBalances.quantityOnHand })
                .from(schema.inventoryBalances)
                .where(
                  and(
                    eq(schema.inventoryBalances.warehouseId, warehouseId),
                    eq(schema.inventoryBalances.itemId, ids.item),
                  ),
                );
              expect(balance?.quantity ?? '0.000').toBe(expected);
              const [ledger] = await tx
                .select({
                  quantity: sql<string>`coalesce(sum(${schema.inventoryTransactions.quantityChange}), 0)::numeric(18,3)::text`,
                })
                .from(schema.inventoryTransactions)
                .where(
                  and(
                    eq(schema.inventoryTransactions.warehouseId, warehouseId),
                    eq(schema.inventoryTransactions.itemId, ids.item),
                  ),
                );
              expect(ledger.quantity).toBe(expected);
            }
          };

          const receipt = await receipts.createReceipt(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            receiptCode: 'DEMO-NHAP',
            items: [
              {
                itemId: ids.item,
                quantity: '100.125',
                ...(trackingMode === 'LOT'
                  ? { supplierLotNumber: 'DEMO-LOT' }
                  : {}),
              },
            ],
          });
          await assertStock('0.000', '0.000');
          const confirmed = await receipts.confirmReceipt(
            receipt.receipt.id,
            ids.farm,
            ids.admin,
          );
          await receipts.confirmReceipt(
            receipt.receipt.id,
            ids.farm,
            ids.admin,
          );
          await assertStock('100.125', '0.000');
          const line = { itemId: ids.item, lotId: confirmed.items[0].lotId };

          const issue = await issues.create(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            issueCode: 'DEMO-XUAT',
            issueType: 'CONSUMPTION',
            items: [{ ...line, quantity: '30.125' }],
          });
          await assertStock('100.125', '0.000');
          await issues.confirm(issue.issue.id, ids.farm, ids.admin);
          await assertStock('70.000', '0.000');

          const transfer = await transfers.create(ids.farm, ids.admin, {
            fromWarehouseId: ids.warehouse,
            toWarehouseId: ids.otherWarehouse,
            transferCode: 'DEMO-CHUYEN',
            items: [{ ...line, quantity: '20.000' }],
          });
          await assertStock('70.000', '0.000');
          await transfers.confirm(transfer.transfer.id, ids.farm, ids.admin);
          await transfers.confirm(transfer.transfer.id, ids.farm, ids.admin);
          await assertStock('50.000', '20.000');

          const count = await counts.create(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            countCode: 'DEMO-KIEMKE',
            items: [{ ...line, actualQuantity: '49.000' }],
          });
          expect(count.items[0].systemQuantity).toBe('50.000');
          await assertStock('50.000', '20.000');
          const counted = await counts.confirm(
            count.count.id,
            ids.farm,
            ids.admin,
          );
          expect(counted.items[0].difference).toBe('-1.000');
          await assertStock('49.000', '20.000');

          const adjustment = {
            ...line,
            warehouseId: ids.warehouse,
            quantityChange: '2.500',
            reasonCode: 'DATA_ENTRY_ERROR' as const,
            idempotencyKey: randomUUID(),
          };
          await adjustments.create(ids.farm, ids.admin, adjustment);
          await adjustments.create(ids.farm, ids.admin, adjustment);
          await assertStock('51.500', '20.000');

          const insufficient = await issues.create(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            issueCode: 'DEMO-THIEUTON',
            items: [{ ...line, quantity: '999' }],
          });
          await expect(
            issues.confirm(insufficient.issue.id, ids.farm, ids.admin),
          ).rejects.toMatchObject({ status: 409 });
          expect(
            (await issues.get(insufficient.issue.id, ids.farm, ids.admin)).issue
              .status,
          ).toBe('DRAFT');
          await assertStock('51.500', '20.000');

          const pending = await receipts.createReceipt(ids.farm, ids.staff, {
            warehouseId: ids.warehouse,
            receiptCode: 'DEMO-TUCHOI',
            items: [{ itemId: ids.item, quantity: '5' }],
          });
          await receipts.submitReceipt(pending.receipt.id, ids.farm, ids.staff);
          await receipts.rejectReceipt(
            pending.receipt.id,
            ids.farm,
            ids.admin,
            'Sai số lượng',
          );
          await assertStock('51.500', '20.000');

          const stale = await counts.create(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            countCode: 'DEMO-SNAPSHOT-CU',
            items: [{ ...line, actualQuantity: '51.000' }],
          });
          await adjustments.create(ids.farm, ids.admin, {
            ...adjustment,
            quantityChange: '1.000',
            idempotencyKey: randomUUID(),
          });
          await expect(
            counts.confirm(stale.count.id, ids.farm, ids.admin),
          ).rejects.toMatchObject({ status: 409 });
          await assertStock('52.500', '20.000');

          const empty = await counts.create(ids.farm, ids.admin, {
            warehouseId: ids.warehouse,
            countCode: 'DEMO-HETTON',
            items: [{ ...line, actualQuantity: '0' }],
          });
          await counts.confirm(empty.count.id, ids.farm, ids.admin);
          await assertStock('0.000', '20.000');
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    },
  );
});

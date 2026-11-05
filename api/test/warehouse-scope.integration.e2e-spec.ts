import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { DatabaseService } from '../src/db/database.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { seedOrders, type OrderTestDb } from './store-orders.fixture';

/** Warehouse managers and employees only see and act in the warehouses they are assigned to. */
describe('Warehouse scope (migrated PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  afterAll(() => pool.end());

  const inRollback = async (test: (tx: OrderTestDb) => Promise<void>) => {
    try {
      await db.transaction(async (tx) => {
        await test(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };

  it('limits warehouses, stock, reports and new documents to assigned warehouses', () =>
    inRollback(async (tx) => {
      const { ids } = await seedOrders(tx);
      await tx
        .insert(schema.roles)
        .values({
          code: 'WAREHOUSE_MANAGER',
          name: 'Warehouse manager',
          scope: 'FARM',
        })
        .onConflictDoNothing();
      const [managerRole] = await tx
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(eq(schema.roles.code, 'WAREHOUSE_MANAGER'));
      // `manager` works in the sales warehouse only; `idle` has no warehouse yet.
      const people = { manager: randomUUID(), idle: randomUUID() };
      const members = { manager: randomUUID(), idle: randomUUID() };
      for (const name of ['manager', 'idle'] as const) {
        await tx.insert(schema.users).values({
          id: people[name],
          authProviderUserId: people[name],
          email: `${people[name]}@scope.test`,
          fullName: name,
        });
        await tx.insert(schema.farmMembers).values({
          id: members[name],
          farmId: ids.farm,
          userId: people[name],
        });
        await tx
          .insert(schema.farmMemberRoles)
          .values({ farmMemberId: members[name], roleId: managerRole.id });
      }
      await tx
        .insert(schema.farmMemberWarehouses)
        .values({ farmMemberId: members.manager, warehouseId: ids.warehouse });

      // Stock in both warehouses, with ledger rows for the report.
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.farm,
        warehouseId: ids.otherWarehouse,
        itemId: ids.item,
        quantityOnHand: '4',
      });
      for (const [warehouseId, quantityChange] of [
        [ids.warehouse, '10'],
        [ids.otherWarehouse, '4'],
      ])
        await tx.insert(schema.inventoryTransactions).values({
          farmId: ids.farm,
          warehouseId,
          itemId: ids.item,
          transactionType: 'ADJUSTMENT_IN',
          quantityChange,
          sourceType: 'INVENTORY_ADJUSTMENT',
          sourceId: randomUUID(),
          createdAt: '2026-10-02T03:00:00Z',
        });

      const database = { db: tx } as unknown as DatabaseService;
      const warehouses = new WarehousesService(database);
      const inventory = new InventoryService(database, warehouses);
      const receipts = new StockReceiptsService(database, warehouses);
      const dashboard = new DashboardService(database);
      const page = { page: 1, pageSize: 20, offset: 0 };

      const listed = await warehouses.listWarehouses({
        farmId: ids.farm,
        clerkUserId: people.manager,
        ...page,
      });
      expect(listed.data.map((row) => row.id)).toEqual([ids.warehouse]);
      await expect(
        warehouses.getWarehouse(ids.otherWarehouse, ids.farm, people.manager),
      ).rejects.toThrow('Warehouse not found');

      const stock = await inventory.listBalances({
        farmId: ids.farm,
        clerkUserId: people.manager,
        ...page,
      });
      expect(stock.data.map((row) => row.balance.warehouseId)).toEqual([
        ids.warehouse,
      ]);

      const scope = await warehouses.warehouseScope(ids.farm, people.manager);
      expect(scope).toEqual([ids.warehouse]);
      const report = await dashboard.stockReport(
        ids.farm,
        '2026-10-01',
        '2026-10-31',
        undefined,
        scope,
      );
      expect(report.rows.map((row) => row.warehouseId)).toEqual([
        ids.warehouse,
      ]);
      // Owners keep the whole farm.
      expect(await warehouses.warehouseScope(ids.farm, ids.admin)).toBeNull();

      await expect(
        receipts.createReceipt(ids.farm, people.manager, {
          warehouseId: ids.otherWarehouse,
          items: [{ itemId: ids.item, quantity: '1' }],
        }),
      ).rejects.toThrow('assigned warehouses');

      // Not assigned anywhere: sees nothing.
      expect(await warehouses.warehouseScope(ids.farm, people.idle)).toEqual(
        [],
      );
      const idleStock = await inventory.listBalances({
        farmId: ids.farm,
        clerkUserId: people.idle,
        ...page,
      });
      expect(idleStock.data).toEqual([]);
      const idleWarehouses = await warehouses.listWarehouses({
        farmId: ids.farm,
        clerkUserId: people.idle,
        ...page,
      });
      expect(idleWarehouses.page.totalItems).toBe(0);
    }));
});

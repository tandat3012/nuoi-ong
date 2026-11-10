import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

// A store manager (no stock role) restocks the sales warehouse; the warehouse manager approves.
describe('Store manager receipts', () => {
  jest.setTimeout(30_000);
  const tag = `store-receipt-${randomUUID().slice(0, 12)}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const authorization = new WarehousesService(database);
  const receipts = new StockReceiptsService(database, authorization);
  const issues = new StockIssuesService(database, authorization);
  const farm = randomUUID();
  const sales = randomUUID(),
    working = randomUUID();
  const category = randomUUID(),
    unit = randomUUID(),
    item = randomUUID();
  const actors = {
    seller: { id: randomUUID(), member: randomUUID(), role: 'STORE_MANAGER' },
    manager: {
      id: randomUUID(),
      member: randomUUID(),
      role: 'WAREHOUSE_MANAGER',
    },
  };
  type Actor = keyof typeof actors;
  const memberIds = Object.values(actors).map((actor) => actor.member);
  const userIds = Object.values(actors).map((actor) => actor.id);
  const clerk = (actor: Actor) => `${tag}-${actor}`;
  const line = { itemId: item, quantity: '5' };
  let fixturesCreated = false;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values(
        Object.entries(actors).map(([name, actor]) => ({
          id: actor.id,
          authProviderUserId: clerk(name as Actor),
          email: `${clerk(name as Actor)}@example.local`,
        })),
      );
      await tx.insert(schema.farmMembers).values(
        Object.values(actors).map((actor) => ({
          id: actor.member,
          userId: actor.id,
          farmId: farm,
        })),
      );
      for (const actor of Object.values(actors)) {
        await tx
          .insert(schema.roles)
          .values({ code: actor.role, name: actor.role, scope: 'FARM' })
          .onConflictDoNothing();
        const [role] = await tx
          .select({ id: schema.roles.id })
          .from(schema.roles)
          .where(eq(schema.roles.code, actor.role));
        await tx
          .insert(schema.farmMemberRoles)
          .values({ farmMemberId: actor.member, roleId: role.id });
      }
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.items).values({
        id: item,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: tag,
        name: tag,
        itemType: 'MATERIAL',
        trackingMode: 'QUANTITY',
      });
      await tx.insert(schema.warehouses).values([
        { id: sales, farmId: farm, code: 'SALES', name: tag },
        { id: working, farmId: farm, code: 'WORK', name: tag },
      ]);
      await tx.insert(schema.farmMemberWarehouses).values({
        farmMemberId: actors.manager.member,
        warehouseId: sales,
      });
      await tx.insert(schema.storeSettings).values({
        farmId: farm,
        salesWarehouseId: sales,
      });
    });
    fixturesCreated = true;
  });

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await pool.query('DELETE FROM notifications WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farm]);
        await pool.query(
          'DELETE FROM inventory_transactions WHERE farm_id=$1',
          [farm],
        );
        await pool.query('DELETE FROM stock_receipts WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
          farm,
        ]);
        await pool.query('DELETE FROM store_settings WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM items WHERE id=$1', [item]);
        await pool.query(
          'DELETE FROM farm_member_warehouses WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM warehouses WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM categories WHERE id=$1', [category]);
        await pool.query('DELETE FROM units WHERE id=$1', [unit]);
        await pool.query(
          'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM farm_members WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
          userIds,
        ]);
        await pool.query(
          'DELETE FROM stock_document_counters WHERE farm_id=$1',
          [farm],
        );
        await pool.query('DELETE FROM farms WHERE id=$1', [farm]);
      }
    } finally {
      await pool.end();
    }
  });

  it('drafts, submits and cancels receipts of the sales warehouse only', async () => {
    const id = (
      await receipts.createReceipt(farm, clerk('seller'), {
        warehouseId: sales,
        items: [line],
      })
    ).receipt.id;
    await receipts.submitReceipt(id, farm, clerk('seller'));
    const { receipt } = await receipts.getReceipt(id, farm, clerk('seller'));
    expect(receipt.status).toBe('PENDING_APPROVAL');
    // The seller can neither approve nor reach another warehouse.
    await expect(
      receipts.confirmReceipt(id, farm, clerk('seller')),
    ).rejects.toThrow();
    await expect(
      receipts.createReceipt(farm, clerk('seller'), {
        warehouseId: working,
        items: [line],
      }),
    ).rejects.toThrow('assigned warehouses');
    const listed = await receipts.listReceipts({
      farmId: farm,
      clerkUserId: clerk('seller'),
      page: 1,
      pageSize: 20,
      offset: 0,
    });
    expect(listed.data.map((row: { id: string }) => row.id)).toEqual([id]);
    // The warehouse manager approves, and stock lands in the sales warehouse.
    await receipts.confirmReceipt(id, farm, clerk('manager'));
    const balance = await pool.query<{ quantity_on_hand: string }>(
      'SELECT quantity_on_hand FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2',
      [sales, item],
    );
    expect(balance.rows[0].quantity_on_hand).toBe('5.000');
  });

  it('still cannot write other stock documents', async () => {
    await expect(
      issues.create(farm, clerk('seller'), {
        warehouseId: sales,
        items: [line],
      }),
    ).rejects.toThrow('Stock document permission is required');
  });
});

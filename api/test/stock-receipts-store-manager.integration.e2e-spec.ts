import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
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
  const transfers = new StockTransfersService(database, authorization);
  const farm = randomUUID();
  const sales = randomUUID(),
    working = randomUUID(),
    other = randomUUID();
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
        { id: other, farmId: farm, code: 'OTHER', name: tag },
      ]);
      await tx.insert(schema.farmMemberWarehouses).values(
        [sales, working].map((warehouseId) => ({
          farmMemberId: actors.manager.member,
          warehouseId,
        })),
      );
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
        await pool.query('DELETE FROM stock_transfers WHERE farm_id=$1', [
          farm,
        ]);
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

  it('lists only the sales warehouse for the receipt form', async () => {
    const listed = await authorization.listWarehouses({
      farmId: farm,
      clerkUserId: clerk('seller'),
      page: 1,
      pageSize: 20,
      offset: 0,
    });
    expect(listed.data.map((row: { id: string }) => row.id)).toEqual([sales]);
  });

  it('restocks the sales warehouse from a source warehouse, approved by the source manager', async () => {
    await pool.query(
      'INSERT INTO inventory_balances (farm_id, warehouse_id, item_id, quantity_on_hand) VALUES ($1,$2,$3,10)',
      [farm, working, item],
    );
    const quantity = async (warehouse: string) =>
      Number(
        (
          await pool.query<{ q: string | null }>(
            'SELECT SUM(quantity_on_hand) q FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2',
            [warehouse, item],
          )
        ).rows[0].q ?? 0,
      );
    const before = await quantity(sales);
    const lines = [{ itemId: item, quantity: '4' }];
    const id = (
      await transfers.create(farm, clerk('seller'), {
        fromWarehouseId: working,
        toWarehouseId: sales,
        items: lines,
      })
    ).transfer.id;
    // Out of the sales warehouse, or into any other warehouse: refused.
    for (const [fromWarehouseId, toWarehouseId] of [
      [sales, working],
      [other, working],
    ])
      await expect(
        transfers.create(farm, clerk('seller'), {
          fromWarehouseId,
          toWarehouseId,
          items: lines,
        }),
      ).rejects.toThrow(ForbiddenException);
    await transfers.submit(id, farm, clerk('seller'));
    await expect(
      transfers.confirm(id, farm, clerk('seller')),
    ).rejects.toThrow();
    await transfers.confirm(id, farm, clerk('manager'));
    expect(await quantity(working)).toBe(6);
    await transfers.receive(id, farm, clerk('manager'));
    expect(await quantity(sales)).toBe(before + 4);
    // The form lists the source warehouses as sources and only the sales warehouse as destination.
    const page = { page: 1, pageSize: 20, offset: 0 };
    const ids = async (extra: { source?: boolean; destination?: boolean }) =>
      (
        await authorization.listWarehouses({
          farmId: farm,
          clerkUserId: clerk('seller'),
          ...page,
          ...extra,
        })
      ).data.map((row: { id: string }) => row.id);
    expect((await ids({ source: true })).sort()).toEqual(
      [working, other].sort(),
    );
    expect(await ids({ destination: true })).toEqual([sales]);
    // Stock of another warehouse of the farm is readable for the transfer form.
    expect(
      await authorization.warehouseScope(farm, clerk('seller'), working),
    ).toEqual([sales, working]);
    expect(
      await authorization.warehouseScope(farm, clerk('seller'), other),
    ).toEqual([sales, other]);
    // A warehouse outside the farm is never readable.
    expect(
      await authorization.warehouseScope(farm, clerk('seller'), randomUUID()),
    ).toEqual([sales]);
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

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type Detail = {
  issue: { id: string; status: string };
  items: { quantity: string }[];
};

// Real PostgreSQL transactions on separate connections; only farm authorization
// is stubbed. Fixtures belong to a unique farm and are removed after the suite.
describe('Stock Issue HTTP and PostgreSQL consistency', () => {
  const tag = `issue-test-${randomUUID().slice(0, 8)}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const farm = randomUUID(),
    user = randomUUID(),
    member = randomUUID();
  const category = randomUUID(),
    unit = randomUUID();
  const warehouse = randomUUID(),
    otherWarehouse = randomUUID();
  const location = randomUUID(),
    otherLocation = randomUUID();
  const quantityItem = randomUUID(),
    lotItem = randomUUID(),
    assetItem = randomUUID();
  const lot = randomUUID();
  const assetIds = [randomUUID(), randomUUID(), randomUUID()];
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const line = (quantity = '1') => ({ itemId: quantityItem, quantity });
  const assetLine = (assetId = assetIds[0]) => ({
    itemId: assetItem,
    assetId,
    quantity: '1',
  });
  const input = (lines: unknown[], extra = {}) => ({
    warehouseId: warehouse,
    issueCode: randomUUID(),
    items: lines,
    ...extra,
  });
  const create = async (lines: unknown[], extra = {}) => {
    const response = await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(input(lines, extra))
      .expect(201);
    return (response.body as { data: Detail }).data;
  };
  const confirm = (id: string) =>
    http().post(`/stock-issues/${id}/confirm`).query({ farmId: farm });
  const balance = async (itemId = quantityItem) => {
    const result = await pool.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farm, itemId],
    );
    return result.rows[0].quantity;
  };
  const state = async (id: string) => {
    const result = await pool.query<{
      status: string;
      transactions: number;
      confirmed_at: string | null;
    }>(
      'SELECT status, confirmed_at, (SELECT count(*)::int FROM inventory_transactions WHERE source_id=$1) AS transactions FROM stock_issues WHERE id=$1',
      [id],
    );
    return result.rows[0];
  };

  beforeAll(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values({
        id: user,
        authProviderUserId: tag,
        email: `${tag}@example.local`,
      });
      await tx
        .insert(schema.farmMembers)
        .values({ id: member, farmId: farm, userId: user });
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.warehouses).values(
        [warehouse, otherWarehouse].map((id, i) => ({
          id,
          farmId: farm,
          code: `W${i}`,
          name: tag,
          status: 'ACTIVE' as const,
        })),
      );
      await tx.insert(schema.locations).values(
        [location, otherLocation].map((id, i) => ({
          id,
          farmId: farm,
          warehouseId: i ? otherWarehouse : warehouse,
          type: 'WAREHOUSE_ZONE' as const,
          code: `L${i}`,
          name: tag,
        })),
      );
      await tx.insert(schema.items).values(
        [quantityItem, lotItem, assetItem].map((id, i) => ({
          id,
          farmId: farm,
          categoryId: category,
          unitId: unit,
          code: `I${i}`,
          name: tag,
          itemType: i === 2 ? ('EQUIPMENT' as const) : ('MATERIAL' as const),
          trackingMode: (['QUANTITY', 'LOT', 'ASSET'] as const)[i],
        })),
      );
      await tx.insert(schema.inventoryLots).values({
        id: lot,
        farmId: farm,
        itemId: lotItem,
        lotNumber: tag,
        initialQuantity: '10',
      });
      await tx.insert(schema.assets).values(
        assetIds.map((id, i) => ({
          id,
          farmId: farm,
          itemId: assetItem,
          assetCode: `A${i}`,
          currentLocationId: location,
        })),
      );
    });
    const module = await Test.createTestingModule({
      controllers: [StockIssuesController],
      providers: [
        StockIssuesService,
        { provide: DatabaseService, useValue: { db } },
        {
          provide: WarehousesService,
          useValue: { assertFarmAccess: jest.fn().mockResolvedValue(member) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards({
      canActivate(context) {
        context
          .switchToHttp()
          .getRequest<{ auth: { clerkUserId: string } }>().auth = {
          clerkUserId: tag,
        };
        return true;
      },
    });
    await app.init();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM stock_issues WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
    await pool.query(
      "UPDATE assets SET status='AVAILABLE',current_location_id=$2 WHERE farm_id=$1",
      [farm, location],
    );
    await pool.query('UPDATE inventory_lots SET expiry_date=NULL WHERE id=$1', [
      lot,
    ]);
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: quantityItem,
        quantityOnHand: '10',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: lotItem,
        lotId: lot,
        quantityOnHand: '10',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: assetItem,
        quantityOnHand: '3',
      },
    ]);
  });

  afterAll(async () => {
    try {
      await app?.close();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const table of [
          'inventory_transactions',
          'stock_issues',
          'inventory_balances',
          'assets',
          'inventory_lots',
          'items',
          'locations',
          'warehouses',
          'farm_members',
        ]) {
          await client.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
        }
        for (const [table, id] of [
          ['users', user],
          ['categories', category],
          ['units', unit],
          ['farms', farm],
        ]) {
          await client.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  it('confirms QUANTITY once and rejects repeat confirmation, editing, and cancellation', async () => {
    const draft = await create([line('1.250')]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance()).toBe('8.750');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CONFIRMED',
      transactions: 1,
    });
    await confirm(draft.issue.id).expect(409);
    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ items: [line('2')] })
      .expect(409);
    await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(409);
    expect(await balance()).toBe('8.750');
  });

  it('confirms LOT and deducts its warehouse balance without changing initial quantity', async () => {
    const draft = await create([
      { itemId: lotItem, lotId: lot, quantity: '0.001' },
    ]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance(lotItem)).toBe('9.999');
    const result = await pool.query<{ initial_quantity: string }>(
      'SELECT initial_quantity FROM inventory_lots WHERE id=$1',
      [lot],
    );
    expect(result.rows[0].initial_quantity).toBe('10.000');
  });

  it('issues multiple individually traceable ASSET lines in one issue, accepting stored 1.000', async () => {
    const draft = await create(assetIds.map(assetLine));
    expect(draft.items.map((item) => item.quantity)).toEqual([
      '1.000',
      '1.000',
      '1.000',
    ]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance(assetItem)).toBe('0.000');
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE farm_id=$1',
      [farm],
    );
    expect(result.rows.map((asset) => asset.status)).toEqual([
      'IN_USE',
      'IN_USE',
      'IN_USE',
    ]);
    const transactions = await pool.query<{ asset_id: string }>(
      'SELECT asset_id FROM inventory_transactions WHERE source_id=$1',
      [draft.issue.id],
    );
    expect(transactions.rows.map((row) => row.asset_id).sort()).toEqual(
      [...assetIds].sort(),
    );
  });

  it.each([
    ['DAMAGE', 'MAINTENANCE'],
    ['DISPOSAL', 'RETIRED'],
    ['OTHER', 'IN_USE'],
  ])('maps ASSET %s issues to %s', async (issueType, status) => {
    const draft = await create([assetLine()], { issueType });
    await confirm(draft.issue.id).expect(201);
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe(status);
    expect(await balance(assetItem)).toBe('2.000');
  });

  it('returns insufficient stock when no balance exists', async () => {
    const draft = await create([line()]);
    await pool.query(
      'DELETE FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farm, quantityItem],
    );
    const response = await confirm(draft.issue.id).expect(409);
    expect((response.body as { message: string }).message).toBe(
      'Insufficient inventory',
    );
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it.each(['11', '10.001'])(
    'returns insufficient stock without mutations for quantity %s',
    async (quantity) => {
      const draft = await create([line(quantity)]);
      const result = await confirm(draft.issue.id).expect(409);
      expect((result.body as { message: string }).message).toBe(
        'Insufficient inventory',
      );
      expect(await balance()).toBe('10.000');
      expect(await state(draft.issue.id)).toEqual({
        status: 'DRAFT',
        transactions: 0,
        confirmed_at: null,
      });
    },
  );

  it.each(['0', '0.000', '-1', '-0.001', '0.0001'])(
    'rejects invalid quantity %s at create and update HTTP validation',
    async (quantity) => {
      await http()
        .post('/stock-issues')
        .query({ farmId: farm })
        .send(input([line(quantity)]))
        .expect(400);
      const draft = await create([line()]);
      await http()
        .patch(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: farm })
        .send({ items: [line(quantity)] })
        .expect(400);
    },
  );

  const invalidLines = [
    ['QUANTITY + lotId', () => ({ ...line(), lotId: lot })],
    ['QUANTITY + assetId', () => ({ ...line(), assetId: assetIds[0] })],
    ['LOT without lotId', () => ({ itemId: lotItem, quantity: '1' })],
    [
      'LOT + assetId',
      () => ({
        itemId: lotItem,
        quantity: '1',
        lotId: lot,
        assetId: assetIds[0],
      }),
    ],
    ['ASSET without assetId', () => ({ itemId: assetItem, quantity: '1' })],
    ['ASSET + lotId', () => ({ ...assetLine(), lotId: lot })],
    ['ASSET quantity 2', () => ({ ...assetLine(), quantity: '2' })],
    ['ASSET quantity 0.5', () => ({ ...assetLine(), quantity: '0.5' })],
  ] as const;
  it.each(invalidLines)(
    'rejects %s on creation and editing',
    async (_name, invalid) => {
      await http()
        .post('/stock-issues')
        .query({ farmId: farm })
        .send(input([invalid()]))
        .expect(400);
      const draft = await create([line()]);
      await http()
        .patch(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: farm })
        .send({ items: [invalid()] })
        .expect(400);
    },
  );

  it.each(invalidLines.slice(0, 6))(
    'revalidates legacy persisted %s at confirmation',
    async (_name, invalid) => {
      const draft = await create([line()]);
      await pool.query(
        'DELETE FROM stock_issue_items WHERE stock_issue_id=$1',
        [draft.issue.id],
      );
      await db
        .insert(schema.stockIssueItems)
        .values({ stockIssueId: draft.issue.id, ...invalid() });
      await confirm(draft.issue.id).expect(400);
      expect(await balance()).toBe('10.000');
      expect(await state(draft.issue.id)).toMatchObject({
        status: 'DRAFT',
        transactions: 0,
      });
    },
  );

  it.each([otherLocation, null])(
    'rejects an asset outside the source warehouse (location %s)',
    async (currentLocation) => {
      const draft = await create([assetLine()]);
      await pool.query('UPDATE assets SET current_location_id=$2 WHERE id=$1', [
        assetIds[0],
        currentLocation,
      ]);
      await confirm(draft.issue.id).expect(409);
      expect(await balance(assetItem)).toBe('3.000');
      expect(await state(draft.issue.id)).toMatchObject({
        status: 'DRAFT',
        transactions: 0,
      });
    },
  );

  it.each(['ASSIGNED', 'IN_USE', 'MAINTENANCE', 'LOST', 'RETIRED'])(
    'rejects unavailable ASSET status %s',
    async (status) => {
      const draft = await create([assetLine()]);
      await pool.query('UPDATE assets SET status=$2 WHERE id=$1', [
        assetIds[0],
        status,
      ]);
      await confirm(draft.issue.id).expect(409);
      expect(await balance(assetItem)).toBe('3.000');
    },
  );

  it('rolls back previous lines when one physical asset is listed twice', async () => {
    const draft = await create([assetLine(), assetLine()]);
    await confirm(draft.issue.id).expect(409);
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe('AVAILABLE');
  });

  it('rejects an expired LOT without inventory mutations', async () => {
    const draft = await create([
      { itemId: lotItem, lotId: lot, quantity: '1' },
    ]);
    await pool.query(
      "UPDATE inventory_lots SET expiry_date='2000-01-01' WHERE id=$1",
      [lot],
    );
    await confirm(draft.issue.id).expect(409);
    expect(await balance(lotItem)).toBe('10.000');
  });

  it('rolls back balance and asset changes when transaction creation fails', async () => {
    const draft = await create([assetLine()]);
    const actualDb = drizzle(pool, { schema });
    const spy = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce((callback) =>
        actualDb.transaction(async (tx) => {
          jest.spyOn(tx, 'insert').mockImplementation(() => {
            throw new Error('Forced transaction creation failure');
          });
          return callback(tx);
        }),
      );
    try {
      await confirm(draft.issue.id).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toEqual({
      status: 'DRAFT',
      transactions: 0,
      confirmed_at: null,
    });
    const result = await pool.query<{
      status: string;
      current_location_id: string;
    }>('SELECT status,current_location_id FROM assets WHERE id=$1', [
      assetIds[0],
    ]);
    expect(result.rows[0]).toEqual({
      status: 'AVAILABLE',
      current_location_id: location,
    });
  });

  it('rolls back all writes, including ledger and status, on a late failure', async () => {
    const draft = await create([
      line(),
      { itemId: lotItem, lotId: lot, quantity: '1' },
      assetLine(),
    ]);
    const actualDb = drizzle(pool, { schema });
    const spy = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce((callback) =>
        actualDb.transaction(async (tx) => {
          await callback(tx);
          throw new Error('Forced failure before commit');
        }),
      );
    try {
      await confirm(draft.issue.id).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await balance()).toBe('10.000');
    expect(await balance(lotItem)).toBe('10.000');
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toEqual({
      status: 'DRAFT',
      transactions: 0,
      confirmed_at: null,
    });
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe('AVAILABLE');
  });

  // Hold a real row lock until both HTTP requests are waiting inside PostgreSQL.
  // This makes races reproducible rather than relying on Promise.all timing.
  const race = async (
    lockSql: string,
    params: string[],
    operations: (() => PromiseLike<request.Response>)[],
  ) => {
    const blocker = await pool.connect();
    const pending: Promise<request.Response>[] = [];
    let waiting = 0;
    try {
      await blocker.query('BEGIN');
      await blocker.query(lockSql, params);
      pending.push(
        ...operations.map((operation) => Promise.resolve(operation())),
      );
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = await pool.query<{ count: number }>(
          "SELECT count(*)::int FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [tag],
        );
        waiting = result.rows[0].count;
        if (waiting >= operations.length) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const results = await Promise.all(pending);
    expect(waiting).toBeGreaterThanOrEqual(operations.length);
    return results;
  };

  it('allows exactly one of two concurrent confirmations of the same issue', async () => {
    const draft = await create([line('7')]);
    const results = await race(
      'SELECT id FROM stock_issues WHERE id=$1 FOR UPDATE',
      [draft.issue.id],
      [() => confirm(draft.issue.id), () => confirm(draft.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance()).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CONFIRMED',
      transactions: 1,
    });
  });

  it('returns insufficient stock when two issues compete for 10 units with requests of 7 and 6', async () => {
    const a = await create([line('7')]),
      b = await create([line('6')]);
    const results = await race(
      'SELECT id FROM inventory_balances WHERE farm_id=$1 AND item_id=$2 FOR UPDATE',
      [farm, quantityItem],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      (
        results.find((result) => result.status === 409)!.body as {
          message: string;
        }
      ).message,
    ).toBe('Insufficient inventory');
    expect(await balance()).toBe(results[0].status === 201 ? '3.000' : '4.000');
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.map((result) => result.status).sort()).toEqual([
      'CONFIRMED',
      'DRAFT',
    ]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      1,
    );
  });

  it('prevents two different issues from consuming the same asset', async () => {
    const a = await create([assetLine()]),
      b = await create([assetLine()]);
    const results = await race(
      'SELECT id FROM assets WHERE id=$1 FOR UPDATE',
      [assetIds[0]],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance(assetItem)).toBe('2.000');
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      1,
    );
  });

  it('serializes overlapping multi-asset issues without a deadlock or partial issue', async () => {
    const a = await create(assetIds.map(assetLine));
    const b = await create([assetLine([...assetIds].sort()[2])]);
    const results = await race(
      'SELECT id FROM inventory_balances WHERE farm_id=$1 AND item_id=$2 FOR UPDATE',
      [farm, assetItem],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance(assetItem)).toBe(
      results[0].status === 201 ? '0.000' : '2.000',
    );
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.map((result) => result.status).sort()).toEqual([
      'CONFIRMED',
      'DRAFT',
    ]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      results[0].status === 201 ? 3 : 1,
    );
  });

  it.each(['edit', 'cancel'])(
    'serializes confirmation against a concurrent %s',
    async (operation) => {
      const draft = await create([line('2')]);
      const results = await race(
        'SELECT id FROM stock_issues WHERE id=$1 FOR UPDATE',
        [draft.issue.id],
        [
          () => confirm(draft.issue.id),
          () =>
            operation === 'edit'
              ? http()
                  .patch(`/stock-issues/${draft.issue.id}`)
                  .query({ farmId: farm })
                  .send({ items: [line('4')] })
              : http()
                  .post(`/stock-issues/${draft.issue.id}/cancel`)
                  .query({ farmId: farm }),
        ],
      );
      if (operation === 'cancel') {
        expect(results.map((result) => result.status).sort()).toEqual([
          201, 409,
        ]);
        expect(await balance()).toBe(
          results[0].status === 201 ? '8.000' : '10.000',
        );
        expect(await state(draft.issue.id)).toMatchObject({
          status: results[0].status === 201 ? 'CONFIRMED' : 'CANCELLED',
          transactions: results[0].status === 201 ? 1 : 0,
        });
      } else {
        expect(results[0].status).toBe(201);
        expect([200, 409]).toContain(results[1].status);
        expect(await balance()).toBe(
          results[1].status === 200 ? '6.000' : '8.000',
        );
        expect(await state(draft.issue.id)).toMatchObject({
          status: 'CONFIRMED',
          transactions: 1,
        });
      }
    },
  );
});

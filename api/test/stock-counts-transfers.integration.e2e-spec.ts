import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { StockCountsController } from '../src/modules/warehouses/stock-counts.controller';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { StockTransfersController } from '../src/modules/warehouses/stock-transfers.controller';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

import { numberingYear } from '../src/modules/warehouses/stock-document-code';
describe('Warehouse count and transfer UI HTTP contracts', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const tag = `WH-FLOW-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const farm = randomUUID(),
    user = randomUUID(),
    member = randomUUID();
  const source = randomUUID(),
    destination = randomUUID(),
    item = randomUUID();
  const assetItem = randomUUID();
  const assetId = randomUUID();
  const lotItem = randomUUID(),
    lot = randomUUID(),
    otherLot = randomUUID();
  const category = randomUUID(),
    unit = randomUUID();
  let canWrite = true;
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const create = async (kind: 'counts' | 'transfers', quantity: string) => {
    const response = await http()
      .post(`/api/v1/stock-${kind}`)
      .query({ farmId: farm })
      .send(
        kind === 'counts'
          ? {
              warehouseId: source,
              countCode: randomUUID(),
              items: [{ itemId: item, actualQuantity: quantity }],
            }
          : {
              fromWarehouseId: source,
              toWarehouseId: destination,
              transferCode: randomUUID(),
              items: [{ itemId: item, quantity }],
            },
      )
      .expect(201);
    const body = response.body as {
      data: { count?: { id: string }; transfer?: { id: string } };
    };
    return (body.data.count ?? body.data.transfer)!.id;
  };
  const confirm = (kind: string, id: string) =>
    http().post(`/api/v1/stock-${kind}/${id}/confirm`).query({ farmId: farm });
  const balances = async () =>
    (
      await pool.query<{ warehouse_id: string; quantity_on_hand: string }>(
        'SELECT warehouse_id, quantity_on_hand FROM inventory_balances WHERE farm_id=$1 ORDER BY warehouse_id',
        [farm],
      )
    ).rows;
  const ledger = async () =>
    (
      await pool.query<{ quantity_change: string }>(
        'SELECT quantity_change FROM inventory_transactions WHERE farm_id=$1 ORDER BY quantity_change',
        [farm],
      )
    ).rows.map((row) => row.quantity_change);

  beforeAll(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values({
        id: user,
        authProvider: 'CLERK',
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
      await tx.insert(schema.warehouses).values([
        { id: source, farmId: farm, code: 'SRC', name: 'Source' },
        { id: destination, farmId: farm, code: 'DST', name: 'Destination' },
      ]);
      await tx.insert(schema.items).values({
        id: item,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: tag,
        name: tag,
        itemType: 'TOOL',
        trackingMode: 'QUANTITY',
      });
      await tx.insert(schema.items).values({
        id: assetItem,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: `${tag}-asset`,
        name: `${tag}-asset`,
        itemType: 'TOOL',
        trackingMode: 'ASSET',
      });
      await tx.insert(schema.items).values({
        id: lotItem,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: `${tag}-lot`,
        name: `${tag}-lot`,
        itemType: 'MATERIAL',
        trackingMode: 'LOT',
      });
      await tx.insert(schema.inventoryLots).values([
        {
          id: lot,
          farmId: farm,
          itemId: lotItem,
          lotNumber: 'L-1',
          initialQuantity: '5',
        },
        // Belongs to a different item, so it must never match lotItem lines.
        {
          id: otherLot,
          farmId: farm,
          itemId: item,
          lotNumber: 'L-X',
          initialQuantity: '1',
        },
      ]);
      await tx.insert(schema.assets).values({
        id: assetId,
        farmId: farm,
        itemId: assetItem,
        assetCode: `${tag}-asset-1`,
      });
    });
    const module = await Test.createTestingModule({
      controllers: [
        StockCountsController,
        StockTransfersController,
        CatalogController,
      ],
      providers: [
        StockCountsService,
        StockTransfersService,
        CatalogService,
        { provide: DatabaseService, useValue: { db } },
        {
          provide: WarehousesService,
          useValue: {
            assertFarmAccess(farmId: string, _user: string, write: boolean) {
              if (farmId !== farm || (write && !canWrite))
                throw new ForbiddenException();
              return Promise.resolve(member);
            },
            assertDocumentWriter(farmId: string) {
              if (farmId !== farm || !canWrite) throw new ForbiddenException();
              return Promise.resolve({ memberId: member, canApprove: true });
            },
          },
        },
      ],
    })
      .overrideGuard(FarmAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
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
    canWrite = true;
    for (const table of [
      'inventory_transactions',
      'stock_counts',
      'stock_transfers',
      'stock_document_counters',
      'inventory_balances',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
    }
    await db.insert(schema.inventoryBalances).values({
      farmId: farm,
      warehouseId: source,
      itemId: item,
      quantityOnHand: '10',
    });
  });

  const lotBalances = async () =>
    (
      await pool.query<{ warehouse_id: string; quantity_on_hand: string }>(
        'SELECT warehouse_id, quantity_on_hand FROM inventory_balances WHERE farm_id=$1 AND lot_id=$2 ORDER BY warehouse_id',
        [farm, lot],
      )
    ).rows;
  const seedLotBalance = () =>
    db.insert(schema.inventoryBalances).values({
      farmId: farm,
      warehouseId: source,
      itemId: lotItem,
      lotId: lot,
      quantityOnHand: '5',
    });

  it('counts a LOT item against the balance of the selected lot', async () => {
    await seedLotBalance();
    const response = await http()
      .post('/api/v1/stock-counts')
      .query({ farmId: farm })
      .send({
        warehouseId: source,
        countCode: randomUUID(),
        items: [{ itemId: lotItem, lotId: lot, actualQuantity: '4.5' }],
      })
      .expect(201);
    const body = response.body as {
      data: { count: { id: string }; items: { systemQuantity: string }[] };
    };
    expect(body.data.items[0].systemQuantity).toBe('5.000');
    await confirm('counts', body.data.count.id).expect(201);
    expect(await lotBalances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '4.500' },
    ]);
    // The lot-less balance of the QUANTITY item is untouched.
    expect(await balances()).toEqual(
      expect.arrayContaining([
        { warehouse_id: source, quantity_on_hand: '10.000' },
      ]),
    );
  });

  it.each([
    ['a LOT item without lotId', { itemId: lotItem }, 400],
    ['a QUANTITY item with lotId', { itemId: item, lotId: lot }, 400],
    ['a lot of another item', { itemId: lotItem, lotId: otherLot }, 404],
    ['an ASSET item', { itemId: assetItem }, 400],
    ['an assetId', { itemId: assetItem, assetId }, 400],
  ])('rejects counting %s', async (_label, line, status) => {
    await http()
      .post('/api/v1/stock-counts')
      .query({ farmId: farm })
      .send({
        warehouseId: source,
        countCode: randomUUID(),
        items: [{ ...line, actualQuantity: '1' }],
      })
      .expect(status);
  });

  it('refuses to confirm a legacy count draft with an ASSET line', async () => {
    const legacyDraft = randomUUID();
    await pool.query(
      'INSERT INTO stock_counts (id,farm_id,warehouse_id,count_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5)',
      [legacyDraft, farm, source, randomUUID(), member],
    );
    await pool.query(
      'INSERT INTO stock_count_items (stock_count_id,item_id,asset_id,system_quantity,actual_quantity) VALUES ($1,$2,$3,0,1)',
      [legacyDraft, assetItem, assetId],
    );
    await confirm('counts', legacyDraft).expect(409);
    expect(await ledger()).toEqual([]);
  });

  it('transfers a LOT item between warehouses by lot', async () => {
    await seedLotBalance();
    const response = await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farm })
      .send({
        fromWarehouseId: source,
        toWarehouseId: destination,
        transferCode: randomUUID(),
        items: [{ itemId: lotItem, lotId: lot, quantity: '2' }],
      })
      .expect(201);
    const body = response.body as { data: { transfer: { id: string } } };
    await confirm('transfers', body.data.transfer.id).expect(201);
    expect(await lotBalances()).toEqual(
      expect.arrayContaining([
        { warehouse_id: source, quantity_on_hand: '3.000' },
        { warehouse_id: destination, quantity_on_hand: '2.000' },
      ]),
    );
  });

  it.each([
    ['a LOT item without lotId', { itemId: lotItem }],
    ['a QUANTITY item with lotId', { itemId: item, lotId: lot }],
  ])('rejects transferring %s', async (_label, line) => {
    await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farm })
      .send({
        fromWarehouseId: source,
        toWarehouseId: destination,
        transferCode: randomUUID(),
        items: [{ ...line, quantity: '1' }],
      })
      .expect(400);
  });

  afterAll(async () => {
    await app?.close();
    try {
      for (const table of [
        'audit_logs',
        'inventory_transactions',
        'stock_counts',
        'stock_transfers',
        'stock_document_counters',
        'inventory_balances',
        'assets',
        'inventory_lots',
        'items',
        'warehouses',
        'farm_members',
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
      }
      for (const [table, id] of [
        ['farms', farm],
        ['users', user],
        ['categories', category],
        ['units', unit],
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
      }
    } finally {
      await pool.end();
    }
  });

  it('provides the nested catalog items consumed by count and transfer selectors', async () => {
    const response = await http()
      .get('/api/v1/items')
      .query({ farmId: farm, status: 'ACTIVE', trackingMode: 'QUANTITY' })
      .expect(200);
    expect(response.body).toMatchObject({
      data: [{ item: { id: item, trackingMode: 'QUANTITY' } }],
      page: { totalItems: 1 },
    });
  });

  it('transfers exact quantities and creates one balanced ledger pair on repeated confirmation', async () => {
    const id = await create('transfers', '3.125');
    await confirm('transfers', id).expect(201);
    await confirm('transfers', id).expect(201);
    expect(await balances()).toEqual(
      expect.arrayContaining([
        { warehouse_id: source, quantity_on_hand: '6.875' },
        { warehouse_id: destination, quantity_on_hand: '3.125' },
      ]),
    );
    expect(await ledger()).toEqual(['-3.125', '3.125']);
  });

  const createTransfer = async (from: string, to: string, quantity: string) => {
    const response = await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farm })
      .send({
        fromWarehouseId: from,
        toWarehouseId: to,
        transferCode: randomUUID(),
        items: [{ itemId: item, quantity }],
      })
      .expect(201);
    return (response.body as { data: { transfer: { id: string } } }).data
      .transfer.id;
  };

  it('confirms concurrent first-time transfers into a missing destination balance', async () => {
    const ids = await Promise.all(
      [1, 2, 3, 4].map(() => createTransfer(source, destination, '1')),
    );
    const statuses = await Promise.all(
      ids.map(async (id) => (await confirm('transfers', id)).status),
    );
    expect(statuses).toEqual([201, 201, 201, 201]);
    expect(await balances()).toEqual(
      expect.arrayContaining([
        { warehouse_id: source, quantity_on_hand: '6.000' },
        { warehouse_id: destination, quantity_on_hand: '4.000' },
      ]),
    );
  });

  it('confirms concurrent opposite-direction transfers without deadlock', async () => {
    await db.insert(schema.inventoryBalances).values({
      farmId: farm,
      warehouseId: destination,
      itemId: item,
      quantityOnHand: '10',
    });
    const ids = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
        n % 2
          ? createTransfer(destination, source, '1')
          : createTransfer(source, destination, '1'),
      ),
    );
    const statuses = await Promise.all(
      ids.map(async (id) => (await confirm('transfers', id)).status),
    );
    expect(statuses).toEqual(Array(8).fill(201));
    expect(await balances()).toEqual(
      expect.arrayContaining([
        { warehouse_id: source, quantity_on_hand: '10.000' },
        { warehouse_id: destination, quantity_on_hand: '10.000' },
      ]),
    );
  });

  it.each([
    ['transfers', 'stock_transfers', 'transfer_code', 'CK'],
    ['counts', 'stock_counts', 'count_code', 'KK'],
  ])(
    'assigns the next code to an uncoded %s draft on confirmation',
    async (kind, table, column, prefix) => {
      const id = await create(kind as 'transfers' | 'counts', '1');
      await pool.query(`UPDATE ${table} SET ${column} = NULL WHERE id = $1`, [
        id,
      ]);
      await confirm(kind, id).expect(201);
      await confirm(kind, id).expect(201);
      const row = await pool.query<{ code: string }>(
        `SELECT ${column} AS code FROM ${table} WHERE id = $1`,
        [id],
      );
      expect(row.rows[0].code).toBe(
        `${prefix}-${numberingYear(new Date())}-000001`,
      );
    },
  );

  it('rejects a whitespace-only transfer code instead of storing it', async () => {
    await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farm })
      .send({
        fromWarehouseId: source,
        toWarehouseId: destination,
        transferCode: '   ',
        items: [{ itemId: item, quantity: '1' }],
      })
      .expect(400);
  });

  it('rejects a null transfer code on draft update and keeps the existing code', async () => {
    const id = await create('transfers', '1');
    const before = await pool.query<{ transfer_code: string }>(
      'SELECT transfer_code FROM stock_transfers WHERE id=$1',
      [id],
    );
    await http()
      .patch(`/api/v1/stock-transfers/${id}`)
      .query({ farmId: farm })
      .send({ transferCode: null })
      .expect(400);
    await http()
      .patch(`/api/v1/stock-transfers/${id}`)
      .query({ farmId: farm })
      .send({ note: 'code untouched' })
      .expect(200);
    const after = await pool.query<{ transfer_code: string; note: string }>(
      'SELECT transfer_code, note FROM stock_transfers WHERE id=$1',
      [id],
    );
    expect(after.rows[0]).toEqual({
      transfer_code: before.rows[0].transfer_code,
      note: 'code untouched',
    });
  });

  it('rejects ASSET items on create, update, and confirmation of legacy drafts', async () => {
    await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farm })
      .send({
        fromWarehouseId: source,
        toWarehouseId: destination,
        transferCode: randomUUID(),
        items: [{ itemId: assetItem, assetId, quantity: '1' }],
      })
      .expect(400);

    const normalDraft = await create('transfers', '1');
    await http()
      .patch(`/api/v1/stock-transfers/${normalDraft}`)
      .query({ farmId: farm })
      .send({ items: [{ itemId: assetItem, assetId, quantity: '1' }] })
      .expect(400);

    const legacyDraft = randomUUID();
    await pool.query(
      'INSERT INTO stock_transfers (id,farm_id,from_warehouse_id,to_warehouse_id,transfer_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [legacyDraft, farm, source, destination, randomUUID(), member],
    );
    await pool.query(
      'INSERT INTO stock_transfer_items (stock_transfer_id,item_id,asset_id,quantity) VALUES ($1,$2,$3,1)',
      [legacyDraft, assetItem, assetId],
    );
    await http()
      .patch(`/api/v1/stock-transfers/${legacyDraft}`)
      .query({ farmId: farm })
      .send({ note: 'metadata only update' })
      .expect(400);
    const response = await http()
      .post(`/api/v1/stock-transfers/${legacyDraft}/confirm`)
      .query({ farmId: farm })
      .expect(409);
    expect(response.body).toMatchObject({
      message: 'ASSET items must be moved using the asset transfer endpoint',
    });
    expect(await balances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '10.000' },
    ]);
    expect(await ledger()).toEqual([]);
  });

  it.each(['0', '0.000'])(
    'rejects a zero transfer quantity %s before creating a document',
    async (quantity) => {
      await http()
        .post('/api/v1/stock-transfers')
        .query({ farmId: farm })
        .send({
          fromWarehouseId: source,
          toWarehouseId: destination,
          transferCode: randomUUID(),
          items: [{ itemId: item, quantity }],
        })
        .expect(400);
      expect(
        (
          await pool.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM stock_transfers WHERE farm_id=$1',
            [farm],
          )
        ).rows[0].count,
      ).toBe(0);
    },
  );

  it('returns item, unit and lot names on count and transfer lines', async () => {
    for (const kind of ['transfers', 'counts'] as const) {
      const id = await create(kind, '1');
      const response = await http()
        .get(`/api/v1/stock-${kind}/${id}`)
        .query({ farmId: farm })
        .expect(200);
      const body = response.body as { data: { items: unknown[] } };
      expect(body.data.items).toEqual([
        expect.objectContaining({
          itemId: item,
          itemCode: tag,
          itemName: tag,
          trackingMode: 'QUANTITY',
          unitName: tag,
          lotNumber: null,
        }),
      ]);
    }
  });

  it('rolls back a transfer with insufficient stock', async () => {
    const id = await create('transfers', '11');
    await confirm('transfers', id).expect(409);
    expect(await balances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '10.000' },
    ]);
    expect(await ledger()).toEqual([]);
  });

  it('confirms a count once and records the exact difference', async () => {
    const id = await create('counts', '7.125');
    await confirm('counts', id).expect(201);
    await confirm('counts', id).expect(201);
    expect(await balances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '7.125' },
    ]);
    expect(await ledger()).toEqual(['-2.875']);
  });

  it('preserves a 0.001 count difference at large quantities', async () => {
    await pool.query(
      'UPDATE inventory_balances SET quantity_on_hand=$1 WHERE farm_id=$2',
      ['100000000000000.001', farm],
    );
    const id = await create('counts', '100000000000000.002');
    await confirm('counts', id).expect(201);
    expect(await balances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '100000000000000.002' },
    ]);
    expect(await ledger()).toEqual(['0.001']);
  });

  it.each(['counts', 'transfers'] as const)(
    'confirms the same %s document concurrently without duplicate stock movements',
    async (kind) => {
      const id = await create(kind, '2');
      await Promise.all([
        confirm(kind, id).expect(201),
        confirm(kind, id).expect(201),
      ]);
      expect(await ledger()).toEqual(
        kind === 'counts' ? ['-8.000'] : ['-2.000', '2.000'],
      );
    },
  );

  it('rejects a stale count without overwriting the current stock', async () => {
    const id = await create('counts', '8');
    await pool.query(
      'UPDATE inventory_balances SET quantity_on_hand=9 WHERE farm_id=$1',
      [farm],
    );
    await confirm('counts', id).expect(409);
    expect(await balances()).toEqual([
      { warehouse_id: source, quantity_on_hand: '9.000' },
    ]);
    expect(await ledger()).toEqual([]);
  });

  it.each(['counts', 'transfers'] as const)(
    'accepts migrated status filters and isolates farms for %s',
    async (kind) => {
      const response = await http()
        .get(`/api/v1/stock-${kind}`)
        .query({ farmId: farm, status: 'PENDING_APPROVAL' })
        .expect(200);
      expect(response.body).toMatchObject({
        data: [],
        page: { totalItems: 0 },
      });
      await http()
        .get(`/api/v1/stock-${kind}`)
        .query({ farmId: randomUUID() })
        .expect(403);
      const id = await create(kind, '1');
      canWrite = false;
      await confirm(kind, id).expect(403);
      expect(await ledger()).toEqual([]);
    },
  );
});

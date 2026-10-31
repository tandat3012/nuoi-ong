import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type BalanceRow = {
  id: string;
  quantityOnHand: string;
  updatedAt: string;
  item: {
    id: string;
    code: string;
    name: string;
    trackingMode: 'QUANTITY' | 'LOT' | 'ASSET';
    unit: { id: string; name: string; symbol: string | null };
  };
  warehouse: { id: string; code: string; name: string };
  lot: {
    id: string;
    supplierLotNumber: string | null;
    expiryDate: string | null;
  } | null;
};
type ListResponse = {
  data: BalanceRow[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

describe('Current inventory HTTP and PostgreSQL contract', () => {
  const tag = `INV-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const farmA = randomUUID();
  const farmB = randomUUID();
  const category = randomUUID();
  const unit = randomUUID();
  const warehouseA = randomUUID();
  const warehouseB = randomUUID();
  const warehouseOtherFarm = randomUUID();
  const quantityItem = randomUUID();
  const lotItem = randomUUID();
  const assetItem = randomUUID();
  const otherFarmItem = randomUUID();
  const lotEarly = randomUUID();
  const lotLate = randomUUID();
  const lotNoExpiry = randomUUID();
  const lotOtherFarm = randomUUID();
  const balanceQuantity = randomUUID();
  const balanceAsset = randomUUID();
  const balanceEarly = randomUUID();
  const balanceEarlyWarehouseB = randomUUID();
  const balanceLate = randomUUID();
  const balanceNoExpiry = randomUUID();
  const balanceZero = randomUUID();
  const balanceOtherFarm = randomUUID();
  const owner = `${tag}-owner`;
  const reader = `${tag}-reader`;
  const outsider = `${tag}-outsider`;
  let identity = owner;
  let client: PoolClient | undefined;
  let app: INestApplication<App> | undefined;
  const base = '/api/v1/inventory';
  const http = () => request(app!.getHttpServer());

  beforeAll(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO farms (id,code,name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    for (const [subject, farmIds, role] of [
      [owner, [farmA, farmB], 'FARM_OWNER'],
      [reader, [farmA], 'GUEST'],
      [outsider, [], 'GUEST'],
    ] as const) {
      const userId = randomUUID();
      await client.query(
        'INSERT INTO users (id,auth_provider,auth_provider_user_id,email) VALUES ($1,$2,$3,$4)',
        [userId, 'CLERK', subject, `${subject}@example.local`],
      );
      for (const farmId of farmIds) {
        const memberId = randomUUID();
        await client.query(
          'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
          [memberId, farmId, userId],
        );
        await client.query(
          'INSERT INTO farm_member_roles (farm_member_id,role_id) SELECT $1,id FROM roles WHERE code=$2',
          [memberId, role],
        );
      }
    }
    await client.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [category, tag],
    );
    await client.query(
      'INSERT INTO units (id,code,name,symbol) VALUES ($1,$2,$3,$4)',
      [unit, tag, 'Kilogram', null],
    );
    await client.query(
      'INSERT INTO warehouses (id,farm_id,code,name,status) VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$8,$9),($10,$11,$12,$13,$14)',
      [
        warehouseA,
        farmA,
        'A-WH',
        `${tag} Warehouse A`,
        'INACTIVE',
        warehouseB,
        'B-WH',
        `${tag} Warehouse B`,
        'ACTIVE',
        warehouseOtherFarm,
        farmB,
        'X-WH',
        `${tag} Other Farm Warehouse`,
        'ACTIVE',
      ],
    );
    await client.query(
      'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9),($10,$2,$3,$4,$11,$12,$13,$14,$15),($16,$2,$3,$4,$17,$18,$19,$20,$21),($22,$23,$3,$4,$24,$25,$26,$27,$28)',
      [
        quantityItem,
        farmA,
        category,
        unit,
        'C-QTY',
        `${tag} Quantity`,
        'MATERIAL',
        'QUANTITY',
        'ACTIVE',
        lotItem,
        'B-LOT',
        `${tag} Lot`,
        'MATERIAL',
        'LOT',
        'ACTIVE',
        assetItem,
        'A-ASSET',
        `${tag} Asset`,
        'EQUIPMENT',
        'ASSET',
        'INACTIVE',
        otherFarmItem,
        farmB,
        'X-QTY',
        `${tag} Other Farm Item`,
        'MATERIAL',
        'QUANTITY',
        'ACTIVE',
      ],
    );
    await client.query(
      'INSERT INTO inventory_lots (id,farm_id,item_id,supplier_lot_number,initial_quantity,expiry_date) VALUES ($1,$2,$3,$4,10,$5),($6,$2,$3,$7,10,$8),($9,$2,$3,$10,10,NULL),($11,$12,$13,$14,10,$15)',
      [
        lotEarly,
        farmA,
        lotItem,
        `${tag}-EARLY`,
        '2025-01-01',
        lotLate,
        `${tag}-LATE`,
        '2025-04-01',
        lotNoExpiry,
        `${tag}-NO-EXPIRY`,
        lotOtherFarm,
        farmB,
        otherFarmItem,
        `${tag}-OTHER-FARM`,
        '2025-02-01',
      ],
    );
    await client.query(
      'INSERT INTO inventory_balances (id,farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,$4,NULL,$5),($6,$2,$3,$7,NULL,2),($8,$2,$3,$9,$10,3),($11,$2,$3,$9,$12,4),($13,$2,$3,$9,$14,5),($15,$2,$16,$9,$10,8),($17,$2,$18,$4,NULL,0),($19,$20,$21,$22,NULL,6)',
      [
        balanceQuantity,
        farmA,
        warehouseA,
        quantityItem,
        '123456789012345.678',
        balanceAsset,
        assetItem,
        balanceEarly,
        lotItem,
        lotEarly,
        balanceLate,
        lotLate,
        balanceNoExpiry,
        lotNoExpiry,
        balanceEarlyWarehouseB,
        warehouseB,
        balanceZero,
        warehouseB,
        balanceOtherFarm,
        farmB,
        warehouseOtherFarm,
        otherFarmItem,
      ],
    );

    const db = drizzle({ client, schema });
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        WarehousesService,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
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
          clerkUserId: identity,
        };
        return true;
      },
    });
    await app.init();
  });

  beforeEach(async () => {
    identity = owner;
    await client?.query('SAVEPOINT inventory_case');
  });
  afterEach(async () => {
    await client?.query('ROLLBACK TO SAVEPOINT inventory_case');
    await client?.query('RELEASE SAVEPOINT inventory_case');
  });
  afterAll(async () => {
    await app?.close();
    try {
      if (client) {
        await client.query('ROLLBACK');
        const remaining = await client.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM farms WHERE id IN ($1,$2)',
          [farmA, farmB],
        );
        expect(remaining.rows[0].count).toBe(0);
      }
    } finally {
      client?.release();
      await pool.end();
    }
  });

  it('returns a QR image and preserves farm isolation', async () => {
    const response = await http()
      .get(`${base}/${balanceQuantity}/qr`)
      .query({ farmId: farmA })
      .expect(200);
    const { data } = response.body as {
      data: {
        balanceId: string;
        qrUrl: string;
        imageDataUrl: string;
        format: string;
      };
    };
    expect(data.balanceId).toBe(balanceQuantity);
    expect(new URL(data.qrUrl).pathname).toBe(
      `/scan/inventory/${balanceQuantity}`,
    );
    expect(data.format).toBe('svg');
    expect(data.imageDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(
      Buffer.from(data.imageDataUrl.split(',')[1], 'base64').toString(),
    ).toContain('<svg');
    await http()
      .get(`${base}/${balanceQuantity}/qr`)
      .query({ farmId: farmB })
      .expect(404);
    await http().get(`${base}/invalid/qr`).query({ farmId: farmA }).expect(400);
  });

  it('returns only positive balances with a nested exact-string read model', async () => {
    const response = await http()
      .get(base)
      .query({ farmId: farmA })
      .expect(200);
    const body = response.body as ListResponse;
    expect(body.page).toEqual({
      number: 1,
      size: 20,
      totalItems: 6,
      totalPages: 1,
    });
    expect(body.data.map(({ id }) => id)).not.toContain(balanceZero);
    const quantity = body.data.find(({ id }) => id === balanceQuantity)!;
    expect(quantity).toMatchObject({
      id: balanceQuantity,
      quantityOnHand: '123456789012345.678',
      item: {
        id: quantityItem,
        code: 'C-QTY',
        name: `${tag} Quantity`,
        trackingMode: 'QUANTITY',
        unit: { id: unit, name: 'Kilogram', symbol: null },
      },
      warehouse: { id: warehouseA, code: 'A-WH', name: `${tag} Warehouse A` },
      lot: null,
    });
    expect(typeof quantity.quantityOnHand).toBe('string');
    expect(typeof quantity.updatedAt).toBe('string');
    expect(body.data.find(({ id }) => id === balanceAsset)).toMatchObject({
      item: { name: `${tag} Asset`, trackingMode: 'ASSET' },
      lot: null,
    });
  });

  it('orders separate LOT balances by expiry and leaves undated lots last', async () => {
    const response = await http()
      .get(base)
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: lotItem })
      .expect(200);
    const body = response.body as ListResponse;
    expect(body.page.totalItems).toBe(3);
    expect(body.data.map(({ id }) => id)).toEqual([
      balanceEarly,
      balanceLate,
      balanceNoExpiry,
    ]);
    expect(body.data.map(({ lot }) => lot?.expiryDate ?? null)).toEqual([
      '2025-01-01',
      '2025-04-01',
      null,
    ]);
    expect(body.data[0]).toMatchObject({
      item: { name: `${tag} Lot` },
      warehouse: { name: `${tag} Warehouse A` },
      lot: { id: lotEarly, supplierLotNumber: `${tag}-EARLY` },
    });
  });

  it('combines all filters and returns empty for valid but unknown farm rows', async () => {
    const byWarehouse = await http()
      .get(base)
      .query({ farmId: farmA, warehouseId: warehouseA })
      .expect(200);
    expect((byWarehouse.body as ListResponse).page.totalItems).toBe(5);

    const byItem = await http()
      .get(base)
      .query({ farmId: farmA, itemId: lotItem })
      .expect(200);
    expect((byItem.body as ListResponse).data).toHaveLength(4);

    const byLot = await http()
      .get(base)
      .query({ farmId: farmA, lotId: lotEarly })
      .expect(200);
    expect((byLot.body as ListResponse).data.map(({ id }) => id)).toEqual([
      balanceEarly,
      balanceEarlyWarehouseB,
    ]);

    const warehouseAndItem = await http()
      .get(base)
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: lotItem })
      .expect(200);
    expect((warehouseAndItem.body as ListResponse).data).toHaveLength(3);

    const exact = await http()
      .get(base)
      .query({
        farmId: farmA,
        warehouseId: warehouseA,
        itemId: lotItem,
        lotId: lotLate,
      })
      .expect(200);
    expect((exact.body as ListResponse).data.map(({ id }) => id)).toEqual([
      balanceLate,
    ]);
    for (const query of [
      { farmId: farmA, warehouseId: warehouseOtherFarm },
      { farmId: farmA, itemId: otherFarmItem },
      { farmId: farmA, lotId: lotOtherFarm },
      { farmId: farmA, lotId: randomUUID() },
    ]) {
      const response = await http().get(base).query(query).expect(200);
      expect((response.body as ListResponse).data).toEqual([]);
      expect((response.body as ListResponse).page.totalItems).toBe(0);
    }
  });

  it('paginates, caps page size, and rejects malformed page parameters', async () => {
    const explicit = await http()
      .get(base)
      .query({ farmId: farmA, page: 2, pageSize: 1 })
      .expect(200);
    expect((explicit.body as ListResponse).page).toEqual({
      number: 2,
      size: 1,
      totalItems: 6,
      totalPages: 6,
    });
    expect((explicit.body as ListResponse).data).toHaveLength(1);

    const capped = await http()
      .get(base)
      .query({ farmId: farmA, pageSize: 500 })
      .expect(200);
    expect((capped.body as ListResponse).page.size).toBe(100);

    await http().get(base).query({ farmId: farmA, page: 0 }).expect(400);
    await http().get(base).query({ farmId: farmA, page: 'one' }).expect(400);
    await http().get(base).query({ farmId: 'not-a-uuid' }).expect(400);
    await http()
      .get(base)
      .query({ farmId: farmA, itemId: 'not-a-uuid' })
      .expect(400);
  });

  it('scopes farm rows and allows active guest members to read balances', async () => {
    identity = reader;
    const readable = await http()
      .get(base)
      .query({ farmId: farmA })
      .expect(200);
    expect((readable.body as ListResponse).page.totalItems).toBe(6);

    identity = owner;
    const otherFarm = await http()
      .get(base)
      .query({ farmId: farmB })
      .expect(200);
    expect((otherFarm.body as ListResponse).data.map(({ id }) => id)).toEqual([
      balanceOtherFarm,
    ]);

    identity = reader;
    await http().get(base).query({ farmId: farmB }).expect(403);
    identity = outsider;
    await http().get(base).query({ farmId: farmA }).expect(403);
  });
});

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
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { FarmAccessGuard } from '../src/modules/auth/farm-access.guard';
import { StockReceiptsController } from '../src/modules/warehouses/stock-receipts.controller';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type Receipt = {
  id: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  receiptCode: string;
};
type ReceiptItem = {
  id: string;
  itemId: string;
  quantity: string;
  lotId: string | null;
  locationId: string | null;
};
type ReceiptResponse = { data: { receipt: Receipt; items: ReceiptItem[] } };
type ReceiptListResponse = {
  data: Receipt[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

async function removeConcurrentReceiptFixtures(
  pool: Pool,
  farmId: string,
  userIdentity: string,
  categoryId: string,
  unitId: string,
) {
  const cleanup = await pool.connect();
  try {
    await cleanup.query('BEGIN');
    await cleanup.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farmId,
    ]);
    await cleanup.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
      farmId,
    ]);
    await cleanup.query('DELETE FROM inventory_lots WHERE farm_id=$1', [
      farmId,
    ]);
    await cleanup.query('DELETE FROM assets WHERE farm_id=$1', [farmId]);
    await cleanup.query('DELETE FROM stock_receipts WHERE farm_id=$1', [
      farmId,
    ]);
    await cleanup.query('DELETE FROM locations WHERE farm_id=$1', [farmId]);
    await cleanup.query('DELETE FROM warehouses WHERE farm_id=$1', [farmId]);
    await cleanup.query('DELETE FROM suppliers WHERE farm_id=$1', [farmId]);
    await cleanup.query('DELETE FROM items WHERE farm_id=$1', [farmId]);
    await cleanup.query(
      'DELETE FROM farm_member_roles USING farm_members WHERE farm_member_roles.farm_member_id=farm_members.id AND farm_members.farm_id=$1',
      [farmId],
    );
    await cleanup.query('DELETE FROM farm_members WHERE farm_id=$1', [farmId]);
    await cleanup.query('DELETE FROM users WHERE auth_provider_user_id=$1', [
      userIdentity,
    ]);
    await cleanup.query('DELETE FROM categories WHERE id=$1', [categoryId]);
    await cleanup.query('DELETE FROM units WHERE id=$1', [unitId]);
    await cleanup.query('DELETE FROM farms WHERE id=$1', [farmId]);
    await cleanup.query('COMMIT');
  } catch (error: unknown) {
    await cleanup.query('ROLLBACK');
    throw error;
  } finally {
    cleanup.release();
  }
}

// Exercises the real controller, DTOs, services, and PostgreSQL. All writes are
// inside one transaction that is rolled back after the suite.
describe('Stock receipts HTTP contract with local PostgreSQL', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const tag = `RECEIPT-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const farmA = randomUUID();
  const farmB = randomUUID();
  const warehouseA = randomUUID();
  const inactiveWarehouseA = randomUUID();
  const warehouseB = randomUUID();
  const supplierA = randomUUID();
  const supplierB = randomUUID();
  const categoryId = randomUUID();
  const unitId = randomUUID();
  const quantityItemId = randomUUID();
  const lotItemId = randomUUID();
  const quantityItemBId = randomUUID();
  const assetItemId = randomUUID();
  const locationA = randomUUID();
  const locationB = randomUUID();
  const ownerIdentity = `${tag}-owner`;
  const readerIdentity = `${tag}-reader`;
  let client: PoolClient | undefined;
  let app: INestApplication<App> | undefined;
  let finishTransaction: (() => void) | undefined;
  let transactionDone: Promise<void> | undefined;
  let currentIdentity = ownerIdentity;

  const post = () => request(app!.getHttpServer());
  const receiptInput = (
    receiptCode: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    warehouseId: warehouseA,
    supplierId: supplierA,
    receiptCode,
    items: [{ itemId: quantityItemId, quantity: '1.250', unitPrice: '2.50' }],
    ...overrides,
  });
  const createReceipt = async (
    farmId: string,
    input: Record<string, unknown>,
  ) => {
    const response = await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId })
      .send(input)
      .expect(201);
    return (response.body as ReceiptResponse).data;
  };

  beforeAll(async () => {
    client = await pool.connect();
    const rollback = new Error('Rollback stock receipt test fixtures');
    let ready!: (db: DatabaseService['db']) => void;
    let failed!: (error: unknown) => void;
    const transactionReady = new Promise<DatabaseService['db']>(
      (resolve, reject) => {
        ready = resolve;
        failed = reject;
      },
    );
    const finish = new Promise<void>((resolve) => {
      finishTransaction = resolve;
    });
    transactionDone = drizzle({ client, schema })
      .transaction(async (transaction) => {
        ready(transaction);
        await finish;
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) {
          failed(error);
          throw error;
        }
      });
    const database = await transactionReady;
    const roles = await client.query<{ id: string; code: string }>(
      "SELECT id, code FROM roles WHERE code IN ('FARM_OWNER', 'GUEST')",
    );
    const ownerRoleId = roles.rows.find(
      (role) => role.code === 'FARM_OWNER',
    )?.id;
    const guestRoleId = roles.rows.find((role) => role.code === 'GUEST')?.id;
    expect(ownerRoleId).toBeDefined();
    expect(guestRoleId).toBeDefined();

    await client.query(
      'INSERT INTO farms (id, code, name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    await client.query(
      'INSERT INTO users (auth_provider_user_id, email) VALUES ($1,$2),($3,$4)',
      [
        ownerIdentity,
        `${ownerIdentity}@example.local`,
        readerIdentity,
        `${readerIdentity}@example.local`,
      ],
    );
    const ownerUser = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE auth_provider_user_id = $1',
      [ownerIdentity],
    );
    const readerUser = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE auth_provider_user_id = $1',
      [readerIdentity],
    );
    const addMember = async (
      farmId: string,
      userId: string,
      roleId: string,
    ) => {
      const memberId = randomUUID();
      await client!.query(
        'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
        [memberId, farmId, userId],
      );
      await client!.query(
        'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
        [memberId, roleId],
      );
      return memberId;
    };
    await addMember(farmA, ownerUser.rows[0].id, ownerRoleId!);
    await addMember(farmB, ownerUser.rows[0].id, ownerRoleId!);
    await addMember(farmA, readerUser.rows[0].id, guestRoleId!);

    await client.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, tag],
    );
    await client.query('INSERT INTO units (id,code,name) VALUES ($1,$2,$2)', [
      unitId,
      `U-${unitId.slice(0, 8)}`,
    ]);
    await client.query(
      "INSERT INTO warehouses (id,farm_id,code,name,status) VALUES ($1,$4,$5,$5,'ACTIVE'),($2,$4,$6,$6,'INACTIVE'),($3,$7,$8,$8,'ACTIVE')",
      [
        warehouseA,
        inactiveWarehouseA,
        warehouseB,
        farmA,
        `${tag}-WA`,
        `${tag}-WI`,
        farmB,
        `${tag}-WB`,
      ],
    );
    await client.query(
      "INSERT INTO locations (id,farm_id,warehouse_id,code,name,type,status) VALUES ($1,$3,$4,$5,$5,'WAREHOUSE_ZONE','ACTIVE'),($2,$6,$7,$8,$8,'WAREHOUSE_ZONE','ACTIVE')",
      [
        locationA,
        locationB,
        farmA,
        warehouseA,
        `${tag}-LA`,
        farmB,
        warehouseB,
        `${tag}-LB`,
      ],
    );
    await client.query(
      'INSERT INTO suppliers (id,farm_id,code,name) VALUES ($1,$3,$4,$4),($2,$5,$6,$6)',
      [supplierA, supplierB, farmA, `${tag}-SA`, farmB, `${tag}-SB`],
    );
    for (const [id, farmId, code, itemType, trackingMode] of [
      [quantityItemId, farmA, 'QTY', 'MATERIAL', 'QUANTITY'],
      [lotItemId, farmA, 'LOT', 'MATERIAL', 'LOT'],
      [quantityItemBId, farmB, 'QTY-B', 'MATERIAL', 'QUANTITY'],
      [assetItemId, farmA, 'ASSET', 'EQUIPMENT', 'ASSET'],
    ]) {
      await client.query(
        'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode) VALUES ($1,$2,$3,$4,$5,$5,$6,$7)',
        [
          id,
          farmId,
          categoryId,
          unitId,
          `${tag}-${code}`,
          itemType,
          trackingMode,
        ],
      );
    }
    const module = await Test.createTestingModule({
      controllers: [StockReceiptsController, CatalogController],
      providers: [
        StockReceiptsService,
        WarehousesService,
        CatalogService,
        FarmAccessGuard,
        { provide: DatabaseService, useValue: { db: database } },
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
          clerkUserId: currentIdentity,
        };
        return true;
      },
    });
    await app.init();
  });

  beforeEach(async () => {
    currentIdentity = ownerIdentity;
    await client!.query('SAVEPOINT stock_receipt_case');
  });

  afterEach(async () => {
    currentIdentity = ownerIdentity;
    if (!client) return;
    await client.query('ROLLBACK TO SAVEPOINT stock_receipt_case');
    await client.query('RELEASE SAVEPOINT stock_receipt_case');
  });

  afterAll(async () => {
    await app?.close();
    if (client) {
      finishTransaction?.();
      try {
        await transactionDone;
      } finally {
        client.release();
      }
    }
    try {
      if (client) {
        const result = await pool.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM farms WHERE id IN ($1,$2)',
          [farmA, farmB],
        );
        expect(result.rows[0].count).toBe(0);
      }
    } finally {
      await pool.end();
    }
  });

  it('creates and updates a DRAFT, lists by status with pagination, and reads detail', async () => {
    const first = await createReceipt(farmA, receiptInput(`${tag}-CRUD-1`));
    const second = await createReceipt(farmA, receiptInput(`${tag}-CRUD-2`));
    expect(first.receipt.status).toBe('DRAFT');
    expect(first.items).toHaveLength(1);

    const page1 = await post()
      .get('/api/v1/stock-receipts')
      .query({ farmId: farmA, status: 'DRAFT', page: 1, pageSize: 1 })
      .expect(200);
    expect((page1.body as ReceiptListResponse).page).toMatchObject({
      number: 1,
      size: 1,
      totalItems: 2,
      totalPages: 2,
    });
    const page2 = await post()
      .get('/api/v1/stock-receipts')
      .query({ farmId: farmA, status: 'DRAFT', page: 2, pageSize: 1 })
      .expect(200);
    expect((page2.body as ReceiptListResponse).data).toHaveLength(1);
    const filtered = await post()
      .get('/api/v1/stock-receipts')
      .query({ farmId: farmA, warehouseId: warehouseA, page: 1, pageSize: 10 })
      .expect(200);
    expect((filtered.body as ReceiptListResponse).data).toHaveLength(2);
    expect((filtered.body as ReceiptListResponse).data[0]).toMatchObject({
      warehouseCode: `${tag}-WA`,
      warehouseName: `${tag}-WA`,
      supplierCode: `${tag}-SA`,
      supplierName: `${tag}-SA`,
    });
    await post()
      .get('/api/v1/stock-receipts')
      .query({ farmId: farmA, warehouseId: warehouseB })
      .expect(200)
      .expect(({ body }) =>
        expect((body as ReceiptListResponse).data).toHaveLength(0),
      );

    const updated = await post()
      .patch(`/api/v1/stock-receipts/${first.receipt.id}`)
      .query({ farmId: farmA })
      .send({
        receiptCode: `${tag}-UPDATED`,
        supplierId: null,
        note: 'updated draft',
        items: [
          { itemId: quantityItemId, quantity: '2.500', unitPrice: '3.25' },
        ],
      })
      .expect(200);
    const updatedData = (updated.body as ReceiptResponse).data;
    expect(updatedData.receipt.receiptCode).toBe(`${tag}-UPDATED`);
    expect(updatedData.items).toHaveLength(1);
    expect(updatedData.items[0].quantity).toBe('2.500');
    const detail = await post()
      .get(`/api/v1/stock-receipts/${first.receipt.id}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((detail.body as ReceiptResponse).data.items[0].quantity).toBe(
      '2.500',
    );
    expect(second.receipt.status).toBe('DRAFT');
  });

  it('serves supplier and location dropdowns only for the selected member farm', async () => {
    const supplierList = await post()
      .get('/api/v1/suppliers')
      .query({ farmId: farmA, status: 'ACTIVE', page: 1, pageSize: 10 })
      .expect(200);
    const supplierBody = supplierList.body as {
      data: { id: string; farmId: string }[];
    };
    expect(supplierBody.data).toEqual([
      expect.objectContaining({ id: supplierA, farmId: farmA }),
    ]);

    const locationList = await post()
      .get('/api/v1/locations')
      .query({
        farmId: farmA,
        warehouseId: warehouseA,
        status: 'ACTIVE',
        page: 1,
        pageSize: 10,
      })
      .expect(200);
    const locationBody = locationList.body as {
      data: { id: string; farmId: string }[];
    };
    expect(locationBody.data).toEqual([
      expect.objectContaining({ id: locationA, farmId: farmA }),
    ]);
    await post()
      .get(`/api/v1/suppliers/${supplierB}`)
      .query({ farmId: farmA })
      .expect(404);

    currentIdentity = readerIdentity;
    await post().get('/api/v1/locations').query({ farmId: farmB }).expect(403);
  });

  it('maps duplicate receipt codes on draft update to a conflict', async () => {
    const first = await createReceipt(farmA, receiptInput(`${tag}-DUP-PATCH`));
    const second = await createReceipt(farmA, receiptInput(`${tag}-PATCH-ME`));
    await post()
      .patch(`/api/v1/stock-receipts/${second.receipt.id}`)
      .query({ farmId: farmA })
      .send({ receiptCode: first.receipt.receiptCode })
      .expect(409);
  });

  it('rejects invalid payloads and cross-farm warehouse, supplier, and item references', async () => {
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-EMPTY`, { items: [] }))
      .expect(400);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-BAD-ID`, { warehouseId: 'not-a-uuid' }))
      .expect(400);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-BAD-FIELD`, { unexpected: true }))
      .expect(400);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(
        receiptInput(`${tag}-INACTIVE`, { warehouseId: inactiveWarehouseA }),
      )
      .expect(409);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-WRONG-WH`, { warehouseId: warehouseB }))
      .expect(409);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-WRONG-SUPPLIER`, { supplierId: supplierB }))
      .expect(404);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(
        receiptInput(`${tag}-WRONG-ITEM`, {
          items: [{ itemId: quantityItemBId, quantity: '1' }],
        }),
      )
      .expect(404);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(
        receiptInput(`${tag}-WRONG-LOCATION`, {
          items: [
            {
              itemId: assetItemId,
              quantity: '1',
              assetCode: `${tag}-BAD-ASSET`,
              locationId: locationB,
            },
          ],
        }),
      )
      .expect(404);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(
        receiptInput(`${tag}-WRONG-LOCATION-MODE`, {
          items: [
            {
              itemId: quantityItemId,
              quantity: '1',
              locationId: locationA,
            },
          ],
        }),
      )
      .expect(400);
  });

  it('keeps drafts out of inventory, confirms QUANTITY once, and makes repeat confirmation idempotent', async () => {
    const draft = await createReceipt(farmA, receiptInput(`${tag}-QUANTITY`));
    const before = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id = $1',
      [draft.receipt.id],
    );
    expect(before.rows[0].count).toBe(0);

    await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(201);
    await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(201);

    const balance = await client!.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND warehouse_id=$2 AND item_id=$3 AND lot_id IS NULL',
      [farmA, warehouseA, quantityItemId],
    );
    expect(balance.rows[0].quantity).toBe('1.250');
    const transactions = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1 AND source_type=$2',
      [draft.receipt.id, 'STOCK_RECEIPT'],
    );
    expect(transactions.rows[0].count).toBe(1);
  });

  it('creates the inventory LOT, links it to the receipt line, and updates its balance on confirmation', async () => {
    const lotNumber = `${tag}-NEW-LOT`;
    const draft = await createReceipt(
      farmA,
      receiptInput(`${tag}-LOT`, {
        items: [
          {
            itemId: lotItemId,
            quantity: '3.125',
            lotNumber,
            manufacturedDate: '2026-01-01',
            expiryDate: '2027-01-01',
          },
        ],
      }),
    );
    const confirmed = await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(201);
    const receipt = (confirmed.body as ReceiptResponse).data;
    expect(receipt.receipt.status).toBe('CONFIRMED');
    const lot = await client!.query<{
      id: string;
      initial_quantity: string;
      source_receipt_item_id: string;
    }>(
      'SELECT id, initial_quantity::text, source_receipt_item_id FROM inventory_lots WHERE farm_id=$1 AND item_id=$2 AND lot_number=$3',
      [farmA, lotItemId, lotNumber],
    );
    expect(lot.rows).toHaveLength(1);
    expect(lot.rows[0].initial_quantity).toBe('3.125');
    expect(lot.rows[0].source_receipt_item_id).toBe(receipt.items[0].id);
    expect(receipt.items[0].lotId).toBe(lot.rows[0].id);
    const balance = await client!.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2 AND lot_id=$3',
      [warehouseA, lotItemId, lot.rows[0].id],
    );
    expect(balance.rows[0].quantity).toBe('3.125');
  });

  it('blocks cancel/edit/confirm after the receipt leaves DRAFT', async () => {
    const draft = await createReceipt(farmA, receiptInput(`${tag}-CANCEL`));
    const cancelled = await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/cancel`)
      .query({ farmId: farmA })
      .expect(201);
    expect((cancelled.body as ReceiptResponse).data.receipt.status).toBe(
      'CANCELLED',
    );
    await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(409);
    await post()
      .patch(`/api/v1/stock-receipts/${draft.receipt.id}`)
      .query({ farmId: farmA })
      .send({ note: 'not allowed' })
      .expect(409);
    await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/cancel`)
      .query({ farmId: farmA })
      .expect(409);
  });

  it('allows member reads, denies guest writes, and does not reveal another farm receipt', async () => {
    const local = await createReceipt(farmA, receiptInput(`${tag}-LOCAL`));
    const remote = await createReceipt(farmB, {
      warehouseId: warehouseB,
      receiptCode: `${tag}-REMOTE`,
      items: [{ itemId: quantityItemBId, quantity: '1' }],
    });

    currentIdentity = readerIdentity;
    await post()
      .get('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .expect(200);
    await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-GUEST`))
      .expect(403);
    await post()
      .patch(`/api/v1/stock-receipts/${local.receipt.id}`)
      .query({ farmId: farmA })
      .send({ note: 'not allowed' })
      .expect(403);
    await post()
      .post(`/api/v1/stock-receipts/${local.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(403);
    currentIdentity = ownerIdentity;
    await post()
      .get(`/api/v1/stock-receipts/${remote.receipt.id}`)
      .query({ farmId: farmA })
      .expect(404);
  });

  it('returns a conflict for duplicate receipt codes', async () => {
    await createReceipt(farmA, receiptInput(`${tag}-DUP-CODE`));
    const response = await post()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send(receiptInput(`${tag}-DUP-CODE`));
    const stored = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM stock_receipts WHERE farm_id=$1 AND receipt_code=$2',
      [farmA, `${tag}-DUP-CODE`],
    );
    expect(stored.rows[0].count).toBe(1);
    expect(response.status).toBe(409);
  });

  it('returns a conflict for duplicate LOT numbers without partially confirming', async () => {
    const draft = await createReceipt(
      farmA,
      receiptInput(`${tag}-DUP-LOT`, {
        items: [
          { itemId: quantityItemId, quantity: '2.000' },
          {
            itemId: lotItemId,
            quantity: '1.000',
            lotNumber: `${tag}-EXISTING-LOT`,
          },
        ],
      }),
    );
    await client!.query(
      'INSERT INTO inventory_lots (farm_id,item_id,lot_number,initial_quantity) VALUES ($1,$2,$3,1)',
      [farmA, lotItemId, `${tag}-EXISTING-LOT`],
    );
    const response = await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA });
    const persisted = await post()
      .get(`/api/v1/stock-receipts/${draft.receipt.id}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((persisted.body as ReceiptResponse).data.receipt.status).toBe(
      'DRAFT',
    );
    const transactions = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1',
      [draft.receipt.id],
    );
    expect(transactions.rows[0].count).toBe(0);
    expect(response.status).toBe(409);
    const balances = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farmA, quantityItemId],
    );
    expect(balances.rows[0].count).toBe(0);
  });

  it('confirms ASSET receipt quantity 1 and creates one linked asset', async () => {
    const draft = await createReceipt(
      farmA,
      receiptInput(`${tag}-ASSET`, {
        items: [
          {
            itemId: assetItemId,
            quantity: '1',
            assetCode: `${tag}-ASSET-1`,
            serialNumber: `${tag}-SERIAL-1`,
            locationId: locationA,
          },
        ],
      }),
    );
    expect(draft.items[0].quantity).toBe('1.000');
    const confirmed = await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA });
    const assetRows = await client!.query<{
      id: string;
      current_location_id: string;
      serial_number: string;
    }>(
      'SELECT id, current_location_id, serial_number FROM assets WHERE farm_id=$1 AND asset_code=$2',
      [farmA, `${tag}-ASSET-1`],
    );
    expect(assetRows.rows).toHaveLength(1);
    expect(assetRows.rows[0]).toMatchObject({
      current_location_id: locationA,
      serial_number: `${tag}-SERIAL-1`,
    });
    expect((confirmed.body as ReceiptResponse).data.items[0].locationId).toBe(
      locationA,
    );
    expect(confirmed.status).toBe(201);

    const duplicateCodeDraft = await createReceipt(
      farmA,
      receiptInput(`${tag}-ASSET-DUP-CODE`, {
        items: [
          {
            itemId: assetItemId,
            quantity: '1',
            assetCode: `${tag}-ASSET-1`,
          },
        ],
      }),
    );
    await post()
      .post(`/api/v1/stock-receipts/${duplicateCodeDraft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(409);
    const duplicateTransactions = await client!.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1',
      [duplicateCodeDraft.receipt.id],
    );
    expect(duplicateTransactions.rows[0].count).toBe(0);

    const duplicateSerialDraft = await createReceipt(
      farmA,
      receiptInput(`${tag}-ASSET-DUP-SERIAL`, {
        items: [
          {
            itemId: assetItemId,
            quantity: '1',
            assetCode: `${tag}-ASSET-2`,
            serialNumber: `${tag}-SERIAL-1`,
          },
        ],
      }),
    );
    await post()
      .post(`/api/v1/stock-receipts/${duplicateSerialDraft.receipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(409);
  });

  it('rejects zero quantities and still accepts the smallest positive precision', async () => {
    for (const [code, quantity] of [
      [`${tag}-ZERO`, '0'],
      [`${tag}-ZERO-DECIMAL`, '0.000'],
    ]) {
      await post()
        .post('/api/v1/stock-receipts')
        .query({ farmId: farmA })
        .send(
          receiptInput(code, {
            items: [{ itemId: quantityItemId, quantity }],
          }),
        )
        .expect(400);
      const stored = await client!.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM stock_receipts WHERE farm_id=$1 AND receipt_code=$2',
        [farmA, code],
      );
      expect(stored.rows[0].count).toBe(0);
    }

    const positive = await createReceipt(
      farmA,
      receiptInput(`${tag}-MIN-POSITIVE`, {
        items: [{ itemId: quantityItemId, quantity: '0.001' }],
      }),
    );
    expect(positive.items[0].quantity).toBe('0.001');

    const draft = await createReceipt(farmA, receiptInput(`${tag}-PATCH-ZERO`));
    await post()
      .patch(`/api/v1/stock-receipts/${draft.receipt.id}`)
      .query({ farmId: farmA })
      .send({ items: [{ itemId: quantityItemId, quantity: '0' }] })
      .expect(400);
    const unchanged = await post()
      .get(`/api/v1/stock-receipts/${draft.receipt.id}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((unchanged.body as ReceiptResponse).data.items[0].quantity).toBe(
      '1.250',
    );
  });

  it('requires LOT metadata at confirmation and leaves an invalid draft unchanged', async () => {
    const draft = await createReceipt(
      farmA,
      receiptInput(`${tag}-LOT-NO-NUMBER`, {
        items: [{ itemId: lotItemId, quantity: '1.000' }],
      }),
    );
    const response = await post()
      .post(`/api/v1/stock-receipts/${draft.receipt.id}/confirm`)
      .query({ farmId: farmA });
    const detail = await post()
      .get(`/api/v1/stock-receipts/${draft.receipt.id}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((detail.body as ReceiptResponse).data.receipt.status).toBe('DRAFT');
    expect(response.status).toBe(400);
  });

  it.each([false, true])(
    'confirms different receipts and retries atomically (existing balance: %s)',
    async (hasBalance) => {
      const concurrentFarm = randomUUID();
      const concurrentUser = `${tag}-concurrent-owner`;
      const concurrentCategory = randomUUID();
      const concurrentUnit = randomUUID();
      const concurrentWarehouse = randomUUID();
      const concurrentItem = randomUUID();
      const concurrentCode = `${tag}-CONCURRENT`;
      const seedClient = await pool.connect();
      let concurrentApp: INestApplication<App> | undefined;
      let seedCommitted = false;

      try {
        await seedClient.query('BEGIN');
        const role = await seedClient.query<{ id: string }>(
          "SELECT id FROM roles WHERE code = 'FARM_OWNER'",
        );
        expect(role.rows[0]?.id).toBeDefined();
        await seedClient.query(
          'INSERT INTO farms (id,code,name) VALUES ($1,$2,$2)',
          [concurrentFarm, concurrentCode],
        );
        await seedClient.query(
          'INSERT INTO users (auth_provider_user_id,email) VALUES ($1,$2)',
          [concurrentUser, `${concurrentUser}@example.local`],
        );
        const user = await seedClient.query<{ id: string }>(
          'SELECT id FROM users WHERE auth_provider_user_id=$1',
          [concurrentUser],
        );
        const memberId = randomUUID();
        await seedClient.query(
          'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
          [memberId, concurrentFarm, user.rows[0].id],
        );
        await seedClient.query(
          'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
          [memberId, role.rows[0].id],
        );
        await seedClient.query(
          'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
          [concurrentCategory, concurrentCode],
        );
        await seedClient.query(
          'INSERT INTO units (id,code,name) VALUES ($1,$2,$2)',
          [concurrentUnit, `U-${concurrentUnit.slice(0, 8)}`],
        );
        await seedClient.query(
          "INSERT INTO warehouses (id,farm_id,code,name,status) VALUES ($1,$2,$3,$3,'ACTIVE')",
          [concurrentWarehouse, concurrentFarm, concurrentCode],
        );
        await seedClient.query(
          "INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode) VALUES ($1,$2,$3,$4,$5,$5,'MATERIAL','QUANTITY')",
          [
            concurrentItem,
            concurrentFarm,
            concurrentCategory,
            concurrentUnit,
            concurrentCode,
          ],
        );
        await seedClient.query('COMMIT');
        seedCommitted = true;
        if (hasBalance) {
          await pool.query(
            'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,quantity_on_hand) VALUES ($1,$2,$3,5)',
            [concurrentFarm, concurrentWarehouse, concurrentItem],
          );
        }

        const module = await Test.createTestingModule({
          controllers: [StockReceiptsController],
          providers: [
            StockReceiptsService,
            WarehousesService,
            {
              provide: DatabaseService,
              useValue: { db: drizzle(pool, { schema }) },
            },
          ],
        }).compile();
        concurrentApp = module.createNestApplication();
        concurrentApp.useLogger(false);
        concurrentApp.setGlobalPrefix('api/v1');
        concurrentApp.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        concurrentApp.useGlobalGuards({
          canActivate(context) {
            context
              .switchToHttp()
              .getRequest<{ auth: { clerkUserId: string } }>().auth = {
              clerkUserId: concurrentUser,
            };
            return true;
          },
        });
        await concurrentApp.init();

        const concurrentPost = () => request(concurrentApp!.getHttpServer());
        const created = await concurrentPost()
          .post('/api/v1/stock-receipts')
          .query({ farmId: concurrentFarm })
          .send({
            warehouseId: concurrentWarehouse,
            receiptCode: concurrentCode,
            items: [{ itemId: concurrentItem, quantity: '1' }],
          })
          .expect(201);
        const receiptId = (created.body as ReceiptResponse).data.receipt.id;
        const second = await concurrentPost()
          .post('/api/v1/stock-receipts')
          .query({ farmId: concurrentFarm })
          .send({
            warehouseId: concurrentWarehouse,
            receiptCode: `${concurrentCode}-2`,
            items: [{ itemId: concurrentItem, quantity: '2' }],
          })
          .expect(201);
        const secondId = (second.body as ReceiptResponse).data.receipt.id;
        const confirmations = await Promise.all([
          concurrentPost()
            .post(`/api/v1/stock-receipts/${secondId}/confirm`)
            .query({ farmId: concurrentFarm })
            .expect(201),
          concurrentPost()
            .post(`/api/v1/stock-receipts/${receiptId}/confirm`)
            .query({ farmId: concurrentFarm })
            .expect(201),
          concurrentPost()
            .post(`/api/v1/stock-receipts/${receiptId}/confirm`)
            .query({ farmId: concurrentFarm })
            .expect(201),
        ]);
        expect(confirmations).toHaveLength(3);

        const balance = await pool.query<{ quantity: string }>(
          'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND warehouse_id=$2 AND item_id=$3 AND lot_id IS NULL',
          [concurrentFarm, concurrentWarehouse, concurrentItem],
        );
        const transactions = await pool.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1 AND source_type=$2',
          [receiptId, 'STOCK_RECEIPT'],
        );
        expect(balance.rows).toHaveLength(1);
        expect(balance.rows[0].quantity).toBe(hasBalance ? '8.000' : '3.000');
        expect(transactions.rows[0].count).toBe(1);
        const secondTransactions = await pool.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1',
          [secondId],
        );
        expect(secondTransactions.rows[0].count).toBe(1);
        await expect(
          pool.query(
            'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,quantity_on_hand) VALUES ($1,$2,$3,1)',
            [concurrentFarm, concurrentWarehouse, concurrentItem],
          ),
        ).rejects.toMatchObject({
          code: '23505',
          constraint: 'uq_inventory_balance',
        });
      } finally {
        try {
          await concurrentApp?.close();
        } finally {
          if (!seedCommitted) {
            await seedClient.query('ROLLBACK').catch(() => {});
          }
          seedClient.release();
          await removeConcurrentReceiptFixtures(
            pool,
            concurrentFarm,
            concurrentUser,
            concurrentCategory,
            concurrentUnit,
          );
          const remaining = await pool.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM farms WHERE id=$1',
            [concurrentFarm],
          );
          expect(remaining.rows[0].count).toBe(0);
        }
      }
    },
    30000,
  );
});

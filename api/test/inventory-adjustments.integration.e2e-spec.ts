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
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryAdjustmentsController } from '../src/modules/inventory/inventory-adjustments.controller';
import { InventoryAdjustmentsService } from '../src/modules/inventory/inventory-adjustments.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsController } from '../src/modules/warehouses/stock-receipts.controller';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type AdjustmentResponse = {
  data: {
    adjustment: {
      id: string;
      status: string;
      requestedByMemberId: string;
      reviewedByMemberId: string | null;
      rejectionReason: string | null;
    };
    transaction: {
      transactionType: string;
      quantityChange: string;
      reason: string | null;
      sourceType: string;
      sourceId: string;
      performedByMemberId: string | null;
      lotId: string | null;
    };
  };
};

describe('Inventory adjustment HTTP and PostgreSQL contract', () => {
  const tag = `ADJUST-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  const farmId = randomUUID();
  const otherFarmId = randomUUID();
  const categoryId = randomUUID();
  const unitId = randomUUID();
  const warehouseId = randomUUID();
  const inactiveWarehouseId = randomUUID();
  const otherFarmWarehouseId = randomUUID();
  const quantityItemId = randomUUID();
  const maximumItemId = randomUUID();
  const receiptIssueItemId = randomUUID();
  const lotItemId = randomUUID();
  const differentLotItemId = randomUUID();
  const assetItemId = randomUUID();
  const inactiveQuantityItemId = randomUUID();
  const assetId = randomUUID();
  const otherFarmItemId = randomUUID();
  const expiredLotId = randomUUID();
  const otherLotId = randomUUID();
  const differentItemLotId = randomUUID();
  const otherFarmLotId = randomUUID();
  const negativeRaceItemId = randomUUID();
  const positiveRaceItemId = randomUUID();
  const firstInsertRaceItemId = randomUUID();
  const overflowItemId = randomUUID();
  const rollbackItemId = randomUUID();
  const ownerIdentity = `${tag}-owner`;
  const guestIdentity = `${tag}-guest`;
  const outsiderIdentity = `${tag}-outsider`;
  const inactiveUserIdentity = `${tag}-inactive-user`;
  const employeeIdentity = `${tag}-employee`;
  const employeeMemberId = randomUUID();
  const freshLotId = randomUUID();
  let ownerMemberId = '';
  let currentIdentity = ownerIdentity;
  let app: INestApplication<App> | undefined;

  const endpoint = '/api/v1/inventory/adjustments';
  const http = () => request(app!.getHttpServer());
  const submitRaw = (
    body: Record<string, unknown>,
    requestedFarmId: string = farmId,
  ) => http().post(endpoint).query({ farmId: requestedFarmId }).send(body);
  const validBody = (body: Record<string, unknown>) => ({
    idempotencyKey: randomUUID(),
    warehouseId,
    itemId: quantityItemId,
    quantityChange: '1',
    reasonCode: 'STOCK_COUNT',
    ...body,
  });
  const submit = (
    itemId: string,
    quantityChange: string,
    options: {
      warehouseId?: string;
      lotId?: string;
      note?: string;
      reasonCode?: string;
      idempotencyKey?: string;
    } = {},
  ) =>
    http()
      .post(endpoint)
      .query({ farmId })
      .send({
        idempotencyKey: options.idempotencyKey ?? randomUUID(),
        warehouseId: options.warehouseId ?? warehouseId,
        itemId,
        ...(options.lotId ? { lotId: options.lotId } : {}),
        quantityChange,
        reasonCode: options.reasonCode ?? 'STOCK_COUNT',
        ...(options.note !== undefined ? { note: options.note } : {}),
      });
  const review = (id: string, action: 'approve' | 'reject', reason?: string) =>
    http()
      .post(`${endpoint}/${id}/${action}`)
      .query({ farmId })
      .send(reason === undefined ? {} : { reason });
  const asIdentity = async <T>(identity: string, run: () => Promise<T>) => {
    currentIdentity = identity;
    try {
      return await run();
    } finally {
      currentIdentity = ownerIdentity;
    }
  };

  const readBalance = async (itemId: string, lotId: string | null = null) => {
    const result = await pool.query<{ quantity_on_hand: string }>(
      'SELECT quantity_on_hand FROM inventory_balances WHERE farm_id=$1 AND warehouse_id=$2 AND item_id=$3 AND lot_id IS NOT DISTINCT FROM $4::uuid',
      [farmId, warehouseId, itemId, lotId],
    );
    return result.rows[0]?.quantity_on_hand ?? null;
  };

  const countAdjustments = async (itemId: string) => {
    const result = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM inventory_transactions WHERE farm_id=$1 AND item_id=$2 AND source_type='INVENTORY_ADJUSTMENT'",
      [farmId, itemId],
    );
    return Number(result.rows[0]?.count ?? 0);
  };

  async function insertItem(id: string, code: string, trackingMode: string) {
    await pool.query(
      'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        farmId,
        categoryId,
        unitId,
        code,
        `${tag} ${code}`,
        trackingMode === 'ASSET' ? 'EQUIPMENT' : 'MATERIAL',
        trackingMode,
        'ACTIVE',
      ],
    );
  }

  beforeAll(async () => {
    await pool.query(
      'INSERT INTO farms (id,code,name) VALUES ($1,$2,$3),($4,$5,$6)',
      [
        farmId,
        `${tag}-A`,
        `${tag} Farm`,
        otherFarmId,
        `${tag}-B`,
        `${tag} Other Farm`,
      ],
    );
    const users = await pool.query<{
      id: string;
      auth_provider_user_id: string;
    }>(
      'INSERT INTO users (auth_provider,auth_provider_user_id,email,full_name) VALUES ($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10),($1,$11,$12,$13) RETURNING id,auth_provider_user_id',
      [
        'CLERK',
        ownerIdentity,
        `${ownerIdentity}@example.local`,
        `${tag} Owner`,
        guestIdentity,
        `${guestIdentity}@example.local`,
        `${tag} Guest`,
        outsiderIdentity,
        `${outsiderIdentity}@example.local`,
        `${tag} Outsider`,
        inactiveUserIdentity,
        `${inactiveUserIdentity}@example.local`,
        `${tag} Inactive User`,
      ],
    );
    const ownerUserId = users.rows.find(
      ({ auth_provider_user_id }) => auth_provider_user_id === ownerIdentity,
    )!.id;
    const guestUserId = users.rows.find(
      ({ auth_provider_user_id }) => auth_provider_user_id === guestIdentity,
    )!.id;
    const inactiveUserId = users.rows.find(
      ({ auth_provider_user_id }) =>
        auth_provider_user_id === inactiveUserIdentity,
    )!.id;
    await pool.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [
      inactiveUserId,
    ]);
    const roleRows = await pool.query<{ id: string; code: string }>(
      "SELECT id,code FROM roles WHERE code IN ('FARM_OWNER','GUEST')",
    );
    const ownerRoleId = roleRows.rows.find(
      ({ code }) => code === 'FARM_OWNER',
    )!.id;
    const guestRoleId = roleRows.rows.find(({ code }) => code === 'GUEST')!.id;
    ownerMemberId = randomUUID();
    const guestMemberId = randomUUID();
    const inactiveUserMemberId = randomUUID();
    await pool.query(
      'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3),($4,$2,$5),($6,$2,$7)',
      [
        ownerMemberId,
        farmId,
        ownerUserId,
        guestMemberId,
        guestUserId,
        inactiveUserMemberId,
        inactiveUserId,
      ],
    );
    await pool.query(
      'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2),($3,$4),($5,$2)',
      [
        ownerMemberId,
        ownerRoleId,
        guestMemberId,
        guestRoleId,
        inactiveUserMemberId,
      ],
    );
    const employee = await pool.query<{ id: string }>(
      'INSERT INTO users (auth_provider,auth_provider_user_id,email,full_name) VALUES ($1,$2,$3,$4) RETURNING id',
      [
        'CLERK',
        employeeIdentity,
        `${employeeIdentity}@example.local`,
        `${tag} Employee`,
      ],
    );
    await pool.query(
      'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
      [employeeMemberId, farmId, employee.rows[0].id],
    );
    await pool.query(
      "INSERT INTO farm_member_roles (farm_member_id,role_id) SELECT $1,id FROM roles WHERE code='EMPLOYEE'",
      [employeeMemberId],
    );
    await pool.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, tag],
    );
    await pool.query(
      'INSERT INTO units (id,code,name,symbol) VALUES ($1,$2,$3,$4)',
      [unitId, `${tag}-UNIT`, 'Kilogram', 'kg'],
    );
    await pool.query(
      'INSERT INTO warehouses (id,farm_id,code,name,status) VALUES ($1,$2,$3,$4,$5),($6,$2,$7,$8,$9),($10,$11,$12,$13,$14)',
      [
        warehouseId,
        farmId,
        `${tag}-WH`,
        `${tag} Warehouse`,
        'ACTIVE',
        inactiveWarehouseId,
        `${tag}-INACTIVE`,
        `${tag} Inactive Warehouse`,
        'INACTIVE',
        otherFarmWarehouseId,
        otherFarmId,
        `${tag}-OTHER-WH`,
        `${tag} Other Warehouse`,
        'ACTIVE',
      ],
    );
    await insertItem(quantityItemId, `${tag}-QTY`, 'QUANTITY');
    await insertItem(maximumItemId, `${tag}-MAX`, 'QUANTITY');
    await insertItem(receiptIssueItemId, `${tag}-FLOW`, 'QUANTITY');
    await insertItem(lotItemId, `${tag}-LOT`, 'LOT');
    await insertItem(differentLotItemId, `${tag}-LOT-OTHER-ITEM`, 'LOT');
    await insertItem(assetItemId, `${tag}-ASSET`, 'ASSET');
    await insertItem(
      inactiveQuantityItemId,
      `${tag}-INACTIVE-ITEM`,
      'QUANTITY',
    );
    await pool.query("UPDATE items SET status='INACTIVE' WHERE id=$1", [
      inactiveQuantityItemId,
    ]);
    await insertItem(negativeRaceItemId, `${tag}-RACE-NEG`, 'QUANTITY');
    await insertItem(positiveRaceItemId, `${tag}-RACE-POS`, 'QUANTITY');
    await insertItem(firstInsertRaceItemId, `${tag}-RACE-NEW`, 'QUANTITY');
    await insertItem(overflowItemId, `${tag}-OVERFLOW`, 'QUANTITY');
    await insertItem(rollbackItemId, `${tag}-ROLLBACK`, 'QUANTITY');
    await pool.query(
      'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        otherFarmItemId,
        otherFarmId,
        categoryId,
        unitId,
        `${tag}-OTHER-ITEM`,
        `${tag} Other Farm Item`,
        'MATERIAL',
        'LOT',
        'ACTIVE',
      ],
    );
    await pool.query(
      'INSERT INTO inventory_lots (id,farm_id,item_id,lot_number,initial_quantity,expiry_date) VALUES ($1,$2,$3,$4,1,$5),($6,$2,$3,$7,1,$8),($9,$10,$11,$12,1,$13),($14,$2,$15,$16,1,$17)',
      [
        expiredLotId,
        farmId,
        lotItemId,
        `${tag}-EXPIRED`,
        '2020-01-01',
        otherLotId,
        `${tag}-OTHER-LOT`,
        '2020-01-01',
        otherFarmLotId,
        otherFarmId,
        otherFarmItemId,
        `${tag}-OTHER-LOT`,
        '2020-01-01',
        differentItemLotId,
        differentLotItemId,
        `${tag}-DIFFERENT-ITEM-LOT`,
        '2020-01-01',
      ],
    );
    await pool.query(
      'INSERT INTO inventory_lots (id,farm_id,item_id,lot_number,initial_quantity,expiry_date) VALUES ($1,$2,$3,$4,1,$5)',
      [freshLotId, farmId, lotItemId, `${tag}-FRESH`, '2099-12-31'],
    );
    await pool.query(
      'INSERT INTO assets (id,farm_id,item_id,asset_code,serial_number) VALUES ($1,$2,$3,$4,$5)',
      [assetId, farmId, assetItemId, `${tag}-ASSET-1`, `${tag}-SERIAL-1`],
    );
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,3)',
      [farmId, warehouseId, assetItemId],
    );

    const db = drizzle(pool, { schema });
    const module = await Test.createTestingModule({
      controllers: [
        InventoryAdjustmentsController,
        InventoryController,
        StockReceiptsController,
        StockIssuesController,
      ],
      providers: [
        InventoryAdjustmentsService,
        InventoryService,
        StockReceiptsService,
        StockIssuesService,
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
        context.switchToHttp().getRequest<{
          auth: { clerkUserId: string };
        }>().auth = { clerkUserId: currentIdentity };
        return true;
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    const cleanup = await pool.connect();
    try {
      await cleanup.query('BEGIN');
      await cleanup.query(
        'DELETE FROM inventory_transactions WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM inventory_adjustments WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM inventory_balances WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM stock_issues WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM stock_receipts WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM inventory_lots WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM assets WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM farm_member_roles WHERE farm_member_id IN (SELECT id FROM farm_members WHERE farm_id = ANY($1::uuid[]))',
        [[farmId, otherFarmId]],
      );
      await cleanup.query(
        'DELETE FROM farm_members WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query('DELETE FROM items WHERE farm_id = ANY($1::uuid[])', [
        [farmId, otherFarmId],
      ]);
      await cleanup.query(
        'DELETE FROM warehouses WHERE farm_id = ANY($1::uuid[])',
        [[farmId, otherFarmId]],
      );
      await cleanup.query('DELETE FROM categories WHERE id = $1', [categoryId]);
      await cleanup.query('DELETE FROM units WHERE id = $1', [unitId]);
      await cleanup.query(
        'DELETE FROM users WHERE auth_provider_user_id = ANY($1::text[])',
        [
          [
            ownerIdentity,
            guestIdentity,
            outsiderIdentity,
            inactiveUserIdentity,
            employeeIdentity,
          ],
        ],
      );
      await cleanup.query('DELETE FROM farms WHERE id = ANY($1::uuid[])', [
        [farmId, otherFarmId],
      ]);
      await cleanup.query('COMMIT');
    } catch (error) {
      await cleanup.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cleanup.release();
      await pool.end();
    }
  });

  beforeEach(async () => {
    currentIdentity = ownerIdentity;
    await pool.query(
      'DELETE FROM inventory_transactions WHERE farm_id=$1 AND item_id=$2',
      [farmId, quantityItemId],
    );
    await pool.query(
      'DELETE FROM inventory_adjustments WHERE farm_id=$1 AND item_id=$2',
      [farmId, quantityItemId],
    );
    await pool.query(
      'DELETE FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farmId, quantityItemId],
    );
  });

  it('applies positive and negative decimal strings and stores one matching ledger row each', async () => {
    const positive = await submit(quantityItemId, '+10.125', {
      note: '  Physical count  ',
    }).expect(201);
    const positiveBody = positive.body as AdjustmentResponse;
    expect(positiveBody.data.adjustment).toMatchObject({
      status: 'CONFIRMED',
      requestedByMemberId: ownerMemberId,
      reviewedByMemberId: ownerMemberId,
    });
    expect(positiveBody.data.transaction).toMatchObject({
      transactionType: 'ADJUSTMENT_IN',
      quantityChange: '10.125',
      reason: 'Chênh lệch kiểm kê: Physical count',
      sourceType: 'INVENTORY_ADJUSTMENT',
      sourceId: positiveBody.data.adjustment.id,
      performedByMemberId: ownerMemberId,
    });

    const negative = await submit(quantityItemId, '-3.125').expect(201);
    const negativeBody = negative.body as AdjustmentResponse;
    expect(negativeBody.data.transaction).toMatchObject({
      transactionType: 'ADJUSTMENT_OUT',
      quantityChange: '-3.125',
    });
    expect(await readBalance(quantityItemId)).toBe('7.000');
    expect(await countAdjustments(quantityItemId)).toBe(2);
  });

  it('keeps the receipt, issue, adjustment, balance, and ledger views in sync', async () => {
    const empty = await http()
      .get('/api/v1/inventory')
      .query({
        farmId,
        warehouseId,
        itemId: receiptIssueItemId,
      })
      .expect(200);
    expect((empty.body as { data: unknown[] }).data).toEqual([]);

    const receiptResponse = await http()
      .post('/api/v1/stock-receipts')
      .query({ farmId })
      .send({
        warehouseId,
        receiptCode: `${tag}-FLOW-PN`,
        items: [{ itemId: receiptIssueItemId, quantity: '10', unitPrice: '0' }],
      })
      .expect(201);
    const receiptId = (
      receiptResponse.body as { data: { receipt: { id: string } } }
    ).data.receipt.id;
    await http()
      .post(`/api/v1/stock-receipts/${receiptId}/confirm`)
      .query({ farmId })
      .expect(201);

    const afterReceipt = await http()
      .get('/api/v1/inventory')
      .query({ farmId, warehouseId, itemId: receiptIssueItemId })
      .expect(200);
    expect(
      (afterReceipt.body as { data: Array<{ quantityOnHand: string }> }).data,
    ).toEqual([expect.objectContaining({ quantityOnHand: '10.000' })]);

    const issueResponse = await http()
      .post('/api/v1/stock-issues')
      .query({ farmId })
      .send({
        warehouseId,
        issueCode: `${tag}-FLOW-PX`,
        items: [{ itemId: receiptIssueItemId, quantity: '3' }],
      })
      .expect(201);
    const issueId = (issueResponse.body as { data: { issue: { id: string } } })
      .data.issue.id;
    await http()
      .post(`/api/v1/stock-issues/${issueId}/confirm`)
      .query({ farmId })
      .expect(201);

    const adjustmentResponse = await submit(receiptIssueItemId, '-1', {
      note: '  Final count correction  ',
    }).expect(201);
    const adjustment = (adjustmentResponse.body as AdjustmentResponse).data
      .transaction;

    const balances = await http()
      .get('/api/v1/inventory')
      .query({ farmId, warehouseId, itemId: receiptIssueItemId })
      .expect(200);
    expect(
      (balances.body as { data: Array<{ quantityOnHand: string }> }).data,
    ).toEqual([expect.objectContaining({ quantityOnHand: '6.000' })]);

    const ledger = await http()
      .get('/api/v1/inventory/transactions')
      .query({ farmId, warehouseId, itemId: receiptIssueItemId })
      .expect(200);
    const movements = (
      ledger.body as {
        data: Array<{
          transactionType: string;
          quantityChange: string;
          reason: string | null;
          source: { type: string; id: string; code: string | null };
          performer: { displayName: string } | null;
        }>;
      }
    ).data;
    expect(movements).toHaveLength(3);
    const receiptMovement = movements.find(
      ({ source }) => source.id === receiptId,
    );
    expect(receiptMovement?.transactionType).toBe('RECEIPT');
    expect(receiptMovement?.quantityChange).toBe('10.000');
    expect(receiptMovement?.source).toEqual({
      type: 'STOCK_RECEIPT',
      id: receiptId,
      code: `${tag}-FLOW-PN`,
    });

    const issueMovement = movements.find(({ source }) => source.id === issueId);
    expect(issueMovement?.transactionType).toBe('ISSUE');
    expect(issueMovement?.quantityChange).toBe('-3.000');
    expect(issueMovement?.source).toEqual({
      type: 'STOCK_ISSUE',
      id: issueId,
      code: `${tag}-FLOW-PX`,
    });

    const adjustmentMovement = movements.find(
      ({ source }) => source.id === adjustment.sourceId,
    );
    expect(adjustmentMovement?.transactionType).toBe('ADJUSTMENT_OUT');
    expect(adjustmentMovement?.quantityChange).toBe('-1.000');
    expect(adjustmentMovement?.reason).toBe(
      'Chênh lệch kiểm kê: Final count correction',
    );
    expect(adjustmentMovement?.source).toEqual({
      type: 'INVENTORY_ADJUSTMENT',
      id: adjustment.sourceId,
      code: null,
    });
    expect(adjustmentMovement?.performer).toEqual({
      id: ownerMemberId,
      displayName: `${tag} Owner`,
    });
  });

  it('only lets expired lots and inactive items be decreased, and rejects invalid tracking combinations', async () => {
    const lotAdjustment = await submit(lotItemId, '2.500', {
      lotId: freshLotId,
    }).expect(201);
    const lotBody = lotAdjustment.body as AdjustmentResponse;
    expect(lotBody.data.transaction.lotId).toBe(freshLotId);
    expect(await readBalance(lotItemId, freshLotId)).toBe('2.500');

    await submit(lotItemId, '2.500', { lotId: expiredLotId }).expect(409);
    expect(await readBalance(lotItemId, expiredLotId)).toBeNull();
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,$4,2.5)',
      [farmId, warehouseId, lotItemId, expiredLotId],
    );
    await submit(lotItemId, '-1.250', {
      lotId: expiredLotId,
      reasonCode: 'EXPIRED',
    }).expect(201);
    expect(await readBalance(lotItemId, expiredLotId)).toBe('1.250');

    await submit(quantityItemId, '1', { lotId: expiredLotId }).expect(400);
    await submit(lotItemId, '1').expect(400);
    await submit(lotItemId, '1', { lotId: otherFarmLotId }).expect(404);
    await submit(lotItemId, '-1', { lotId: otherLotId }).expect(409);
    expect(await readBalance(lotItemId, otherLotId)).toBeNull();
    await submit(lotItemId, '1', { lotId: differentItemLotId }).expect(404);
    await submit(assetItemId, '1').expect(409);
    await submit(assetItemId, '-1').expect(409);
    expect(await readBalance(assetItemId)).toBe('3.000');
    expect(await countAdjustments(assetItemId)).toBe(0);
    const assets = await pool.query<{
      asset_code: string;
      serial_number: string;
    }>('SELECT asset_code,serial_number FROM assets WHERE id=$1', [assetId]);
    expect(assets.rows).toEqual([
      { asset_code: `${tag}-ASSET-1`, serial_number: `${tag}-SERIAL-1` },
    ]);
    await submit(otherFarmItemId, '1').expect(404);
    await submit(quantityItemId, '1', {
      warehouseId: inactiveWarehouseId,
    }).expect(409);
    await submit(quantityItemId, '1', {
      warehouseId: otherFarmWarehouseId,
    }).expect(409);
    await submit(inactiveQuantityItemId, '1').expect(409);
    expect(await readBalance(inactiveQuantityItemId)).toBeNull();
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,3)',
      [farmId, warehouseId, inactiveQuantityItemId],
    );
    await submit(inactiveQuantityItemId, '-3').expect(201);
    expect(await readBalance(inactiveQuantityItemId)).toBe('0.000');
  });

  it('rejects malformed, zero, out-of-range, and invalid-reason input', async () => {
    await submit(quantityItemId, '0.000').expect(400);
    await submit(quantityItemId, '+0').expect(400);
    await submit(quantityItemId, '1e3').expect(400);
    await submit(quantityItemId, 'NaN').expect(400);
    await submit(quantityItemId, 'Infinity').expect(400);
    await submit(quantityItemId, '').expect(400);
    await submit(quantityItemId, ' 1').expect(400);
    await submit(quantityItemId, '1\n').expect(400);
    await submit(quantityItemId, '.5').expect(400);
    await submit(quantityItemId, '1000000000000000').expect(400);
    await submit(quantityItemId, '1.0001').expect(400);
    await submit(quantityItemId, '1', { reasonCode: 'OTHER' }).expect(400);
    await submit(quantityItemId, '1', {
      reasonCode: 'OTHER',
      note: '   ',
    }).expect(400);
    await submit(quantityItemId, '1', { reasonCode: 'BOGUS' }).expect(400);
    await submit(quantityItemId, '1', { note: 'r'.repeat(4001) }).expect(400);
    await submitRaw(validBody({ quantityChange: 5 })).expect(400);
    await submitRaw(validBody({ warehouseId: 'not-a-uuid' })).expect(400);
    await submitRaw(validBody({ idempotencyKey: undefined })).expect(400);
    await submitRaw(validBody({ idempotencyKey: 'not-a-uuid' })).expect(400);
    await submitRaw(validBody({ reasonCode: undefined })).expect(400);
    await submitRaw(validBody({}), 'not-a-farm-uuid').expect(400);
    expect(await readBalance(quantityItemId)).toBeNull();
    expect(await countAdjustments(quantityItemId)).toBe(0);
  });

  it('accepts the numeric precision boundary and a 4000-character note', async () => {
    const note = 'r'.repeat(4000);
    const response = await submit(maximumItemId, '999999999999999.999', {
      reasonCode: 'OTHER',
      note,
    }).expect(201);
    const body = response.body as AdjustmentResponse;
    expect(body.data.transaction.quantityChange).toBe('999999999999999.999');
    expect(body.data.transaction.reason).toBe(`Khác: ${note}`);
    expect(await readBalance(maximumItemId)).toBe('999999999999999.999');
  });

  it('rejects insufficient stock and maps numeric overflow without a ledger row', async () => {
    await submit(quantityItemId, '-0.001').expect(409);
    expect(await readBalance(quantityItemId)).toBeNull();
    expect(await countAdjustments(quantityItemId)).toBe(0);

    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,$4)',
      [farmId, warehouseId, overflowItemId, '999999999999999.999'],
    );
    await submit(overflowItemId, '0.001').expect(409);
    expect(await readBalance(overflowItemId)).toBe('999999999999999.999');
    expect(await countAdjustments(overflowItemId)).toBe(0);
  });

  it('requires an active owner or employee role for writes', async () => {
    currentIdentity = guestIdentity;
    await submit(quantityItemId, '1').expect(403);
    currentIdentity = outsiderIdentity;
    await submit(quantityItemId, '1').expect(403);
    currentIdentity = inactiveUserIdentity;
    await submit(quantityItemId, '1').expect(403);
    currentIdentity = ownerIdentity;
    await submitRaw(
      validBody({
        warehouseId: otherFarmWarehouseId,
        itemId: otherFarmItemId,
      }),
      otherFarmId,
    ).expect(403);

    await pool.query("UPDATE farm_members SET status='INACTIVE' WHERE id=$1", [
      ownerMemberId,
    ]);
    try {
      await submit(quantityItemId, '1').expect(403);
    } finally {
      await pool.query("UPDATE farm_members SET status='ACTIVE' WHERE id=$1", [
        ownerMemberId,
      ]);
    }
    expect(await readBalance(quantityItemId)).toBeNull();
  });

  it('serializes concurrent decrements and never lets the balance become negative', async () => {
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,5)',
      [farmId, warehouseId, negativeRaceItemId],
    );
    const responses = await Promise.all([
      submit(negativeRaceItemId, '-4'),
      submit(negativeRaceItemId, '-3'),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(['1.000', '2.000']).toContain(await readBalance(negativeRaceItemId));
    expect(await countAdjustments(negativeRaceItemId)).toBe(1);
  });

  it('preserves concurrent positive updates to an existing balance', async () => {
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,5)',
      [farmId, warehouseId, positiveRaceItemId],
    );
    const responses = await Promise.all([
      submit(positiveRaceItemId, '2'),
      submit(positiveRaceItemId, '3'),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(await readBalance(positiveRaceItemId)).toBe('10.000');
    expect(await countAdjustments(positiveRaceItemId)).toBe(2);
  });

  it('creates one balance when positive updates race on a missing row', async () => {
    const responses = await Promise.all([
      submit(firstInsertRaceItemId, '2'),
      submit(firstInsertRaceItemId, '3'),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(await readBalance(firstInsertRaceItemId)).toBe('5.000');
    expect(await countAdjustments(firstInsertRaceItemId)).toBe(2);
    const rows = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM inventory_balances WHERE farm_id=$1 AND warehouse_id=$2 AND item_id=$3 AND lot_id IS NULL',
      [farmId, warehouseId, firstInsertRaceItemId],
    );
    expect(rows.rows[0].count).toBe('1');
  });

  it('rolls back the adjustment, balance and ledger when a later step fails', async () => {
    // applyStock is private; reach it through the prototype to fail after its writes.
    const prototype = InventoryAdjustmentsService.prototype as unknown as {
      applyStock: (...args: unknown[]) => Promise<unknown>;
    };
    const original = prototype.applyStock;
    const failing = jest
      .spyOn(prototype, 'applyStock')
      .mockImplementation(async function (this: unknown, ...args: unknown[]) {
        await original.apply(this, args);
        throw new Error('simulated failure after the ledger insert');
      });
    try {
      await submit(rollbackItemId, '7').expect(500);
    } finally {
      failing.mockRestore();
    }
    expect(await readBalance(rollbackItemId)).toBeNull();
    expect(await countAdjustments(rollbackItemId)).toBe(0);
    const rows = await pool.query(
      'SELECT 1 FROM inventory_adjustments WHERE farm_id=$1 AND item_id=$2',
      [farmId, rollbackItemId],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('replays a retried idempotency key instead of adjusting twice', async () => {
    const idempotencyKey = randomUUID();
    const first = await submit(quantityItemId, '4', { idempotencyKey }).expect(
      201,
    );
    const retry = await submit(quantityItemId, '4', { idempotencyKey }).expect(
      201,
    );
    expect((retry.body as AdjustmentResponse).data).toEqual(
      (first.body as AdjustmentResponse).data,
    );
    expect(await readBalance(quantityItemId)).toBe('4.000');
    expect(await countAdjustments(quantityItemId)).toBe(1);

    await submit(maximumItemId, '4', { idempotencyKey }).expect(409);
    await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '4', { idempotencyKey }).expect(409),
    );
  });

  it('applies a concurrent retry of the same key exactly once', async () => {
    const idempotencyKey = randomUUID();
    const responses = await Promise.all([
      submit(quantityItemId, '2', { idempotencyKey }),
      submit(quantityItemId, '2', { idempotencyKey }),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(await readBalance(quantityItemId)).toBe('2.000');
    expect(await countAdjustments(quantityItemId)).toBe(1);
  });

  it('keeps employee adjustments pending until an owner approves them', async () => {
    const pending = await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '5', { reasonCode: 'DAMAGE', note: 'Thùng vỡ' }),
    );
    expect(pending.status).toBe(201);
    const pendingBody = pending.body as AdjustmentResponse;
    expect(pendingBody.data.adjustment).toMatchObject({
      status: 'PENDING_APPROVAL',
      requestedByMemberId: employeeMemberId,
      reviewedByMemberId: null,
    });
    expect(pendingBody.data.transaction).toBeNull();
    expect(await readBalance(quantityItemId)).toBeNull();

    const id = pendingBody.data.adjustment.id;
    await asIdentity(employeeIdentity, () => review(id, 'approve').expect(403));
    await asIdentity(guestIdentity, () => review(id, 'approve').expect(403));

    const listed = await asIdentity(employeeIdentity, () =>
      http()
        .get(endpoint)
        .query({ farmId, status: 'PENDING_APPROVAL' })
        .expect(200),
    );
    expect(
      (listed.body as { data: Array<Record<string, unknown>> }).data,
    ).toContainEqual(
      expect.objectContaining({
        id,
        reasonCode: 'DAMAGE',
        note: 'Thùng vỡ',
        requester: { id: employeeMemberId, displayName: `${tag} Employee` },
        reviewer: null,
      }),
    );

    const approved = await review(id, 'approve').expect(201);
    const approvedBody = approved.body as AdjustmentResponse;
    expect(approvedBody.data.adjustment).toMatchObject({
      status: 'CONFIRMED',
      reviewedByMemberId: ownerMemberId,
    });
    expect(approvedBody.data.transaction).toMatchObject({
      transactionType: 'ADJUSTMENT_IN',
      reason: 'Hư hỏng: Thùng vỡ',
      sourceId: id,
      performedByMemberId: employeeMemberId,
    });
    expect(await readBalance(quantityItemId)).toBe('5.000');

    await review(id, 'approve').expect(409);
    await review(id, 'reject', 'late').expect(409);
    await review(randomUUID(), 'approve').expect(404);
    expect(await countAdjustments(quantityItemId)).toBe(1);
  });

  it('applies a pending approval at most once under concurrent clicks', async () => {
    const pending = await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '3').expect(201),
    );
    const id = (pending.body as AdjustmentResponse).data.adjustment.id;
    const responses = await Promise.all([
      review(id, 'approve'),
      review(id, 'approve'),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await readBalance(quantityItemId)).toBe('3.000');
    expect(await countAdjustments(quantityItemId)).toBe(1);
  });

  it('rejects pending adjustments without touching stock', async () => {
    const pending = await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '5').expect(201),
    );
    const id = (pending.body as AdjustmentResponse).data.adjustment.id;
    await review(id, 'reject', '   ').expect(400);
    await asIdentity(employeeIdentity, () =>
      review(id, 'reject', 'no').expect(403),
    );
    const rejected = await review(id, 'reject', '  Đếm lại  ').expect(201);
    expect((rejected.body as AdjustmentResponse).data.adjustment).toMatchObject(
      {
        status: 'REJECTED',
        rejectionReason: 'Đếm lại',
        reviewedByMemberId: ownerMemberId,
      },
    );
    await review(id, 'approve').expect(409);
    expect(await readBalance(quantityItemId)).toBeNull();
    expect(await countAdjustments(quantityItemId)).toBe(0);
  });

  it('re-checks stock at approval and leaves the request pending when it no longer fits', async () => {
    await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '-1').expect(409),
    );
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,5)',
      [farmId, warehouseId, quantityItemId],
    );
    const pending = await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '-4').expect(201),
    );
    const id = (pending.body as AdjustmentResponse).data.adjustment.id;
    await submit(quantityItemId, '-3').expect(201);

    await review(id, 'approve').expect(409);
    expect(await readBalance(quantityItemId)).toBe('2.000');
    const status = await pool.query<{ status: string }>(
      'SELECT status FROM inventory_adjustments WHERE id=$1',
      [id],
    );
    expect(status.rows[0].status).toBe('PENDING_APPROVAL');
  });

  it('filters the adjustment list by warehouse, item and requester', async () => {
    const ownerAdjustment = await submit(quantityItemId, '1').expect(201);
    const employeeAdjustment = await asIdentity(employeeIdentity, () =>
      submit(quantityItemId, '2').expect(201),
    );
    const ownerId = (ownerAdjustment.body as AdjustmentResponse).data.adjustment
      .id;
    const employeeId = (employeeAdjustment.body as AdjustmentResponse).data
      .adjustment.id;
    const listIds = async (
      query: Record<string, string>,
      identity = ownerIdentity,
    ) => {
      const response = await asIdentity(identity, () =>
        http()
          .get(endpoint)
          .query({ farmId, pageSize: '100', ...query })
          .expect(200),
      );
      return (response.body as { data: Array<{ id: string }> }).data.map(
        ({ id }) => id,
      );
    };

    const byItem = await listIds({ itemId: quantityItemId });
    expect(byItem).toEqual(expect.arrayContaining([ownerId, employeeId]));
    expect(await listIds({ itemId: maximumItemId })).not.toContain(ownerId);
    expect(
      await listIds({
        itemId: quantityItemId,
        warehouseId: inactiveWarehouseId,
      }),
    ).toEqual([]);
    expect(
      await listIds({ itemId: quantityItemId, mine: 'true' }, employeeIdentity),
    ).toEqual([employeeId]);
    expect(
      await listIds(
        { itemId: quantityItemId, mine: 'false' },
        employeeIdentity,
      ),
    ).toEqual(expect.arrayContaining([ownerId, employeeId]));

    await http()
      .get(endpoint)
      .query({ farmId, itemId: 'not-a-uuid' })
      .expect(400);
    await http().get(endpoint).query({ farmId, mine: 'yes' }).expect(400);
  });
});

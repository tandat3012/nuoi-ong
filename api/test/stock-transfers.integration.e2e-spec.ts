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
import { StockTransfersController } from '../src/modules/warehouses/stock-transfers.controller';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { StockCountsController } from '../src/modules/warehouses/stock-counts.controller';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { AuditLogsController } from '../src/modules/audit-logs/audit-logs.controller';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';

type TransferDetail = {
  data: {
    transfer: {
      id: string;
      status: string;
      rejectionReason?: string | null;
      rejectedByMemberId?: string | null;
    };
    items: Array<{ quantity: string }>;
  };
};

describe('Stock transfer approval workflow with local PostgreSQL', () => {
  const tag = `TRANSFER-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const farmId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  const unitCodePrefix = `U-${tag.slice(-10)}`;
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  async function cleanCaseData() {
    await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query('DELETE FROM stock_transfers WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM stock_counts WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM items WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM warehouses WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM categories WHERE code LIKE $1', [
      `${tag}-CAT-%`,
    ]);
    await pool.query('DELETE FROM units WHERE code LIKE $1', [
      `${unitCodePrefix}-%`,
    ]);
  }

  async function seedCase() {
    const categoryId = randomUUID();
    const unitId = randomUUID();
    const sourceWarehouseId = randomUUID();
    const destinationWarehouseId = randomUUID();
    const itemId = randomUUID();

    await db.insert(schema.categories).values({
      id: categoryId,
      code: `${tag}-CAT-${itemId.slice(0, 6)}`,
      name: `${tag} category`,
    });
    await db.insert(schema.units).values({
      id: unitId,
      code: `${unitCodePrefix}-${unitId.slice(0, 8)}`,
      name: 'Unit',
    });
    await db.insert(schema.warehouses).values([
      {
        id: sourceWarehouseId,
        farmId,
        code: `SRC-${sourceWarehouseId.slice(0, 6)}`,
        name: 'Source warehouse',
        status: 'ACTIVE',
      },
      {
        id: destinationWarehouseId,
        farmId,
        code: `DST-${destinationWarehouseId.slice(0, 6)}`,
        name: 'Destination warehouse',
        status: 'ACTIVE',
      },
    ]);
    await db.insert(schema.items).values({
      id: itemId,
      farmId,
      categoryId,
      unitId,
      code: `ITEM-${itemId.slice(0, 8)}`,
      name: 'Transfer item',
      itemType: 'MATERIAL',
      trackingMode: 'QUANTITY',
    });
    await db.insert(schema.inventoryBalances).values({
      farmId,
      warehouseId: sourceWarehouseId,
      itemId,
      quantityOnHand: '10',
    });

    return { itemId, sourceWarehouseId, destinationWarehouseId };
  }

  function transferInput(
    ids: Awaited<ReturnType<typeof seedCase>>,
    code: string,
  ) {
    return {
      fromWarehouseId: ids.sourceWarehouseId,
      toWarehouseId: ids.destinationWarehouseId,
      transferCode: code,
      items: [{ itemId: ids.itemId, quantity: '3' }],
    };
  }

  beforeAll(async () => {
    await db.insert(schema.farms).values({
      id: farmId,
      code: tag,
      name: tag,
    });
    await db.insert(schema.users).values({
      id: userId,
      authProviderUserId: tag,
      email: `${tag}@example.local`,
    });
    await db.insert(schema.farmMembers).values({
      id: memberId,
      farmId,
      userId,
    });

    const module = await Test.createTestingModule({
      controllers: [
        StockTransfersController,
        StockCountsController,
        AuditLogsController,
      ],
      providers: [
        StockTransfersService,
        StockCountsService,
        AuditLogsService,
        { provide: DatabaseService, useValue: { db } },
        {
          provide: WarehousesService,
          useValue: { assertFarmAccess: jest.fn().mockResolvedValue(memberId) },
        },
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
          clerkUserId: tag,
        };
        return true;
      },
    });
    await app.init();
  });

  afterEach(async () => {
    await cleanCaseData();
  });

  afterAll(async () => {
    await app.close();
    await cleanCaseData();
    await pool.query('DELETE FROM farm_members WHERE id=$1', [memberId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM farms WHERE id=$1', [farmId]);
    await pool.end();
  });

  it('submits and confirms a transfer, moving stock and writing both ledger entries', async () => {
    const ids = await seedCase();
    const created = await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farmId })
      .send(transferInput(ids, `${tag}-CONFIRM`))
      .expect(201);
    const transferId = (created.body as TransferDetail).data.transfer.id;

    await http()
      .post(`/api/v1/stock-transfers/${transferId}/submit`)
      .query({ farmId: farmId })
      .expect(201);
    const pending = await http()
      .get(`/api/v1/stock-transfers/${transferId}`)
      .query({ farmId: farmId })
      .expect(200);
    expect((pending.body as TransferDetail).data.transfer.status).toBe(
      'PENDING_APPROVAL',
    );

    const confirmed = await http()
      .post(`/api/v1/stock-transfers/${transferId}/confirm`)
      .query({ farmId: farmId })
      .expect(201);
    expect((confirmed.body as TransferDetail).data.transfer.status).toBe(
      'CONFIRMED',
    );

    const balances = await pool.query<{
      warehouse_id: string;
      quantity: string;
    }>(
      'SELECT warehouse_id, quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2 ORDER BY warehouse_id',
      [farmId, ids.itemId],
    );
    expect(balances.rows).toHaveLength(2);
    expect(
      balances.rows.find((row) => row.warehouse_id === ids.sourceWarehouseId)
        ?.quantity,
    ).toBe('7.000');
    expect(
      balances.rows.find(
        (row) => row.warehouse_id === ids.destinationWarehouseId,
      )?.quantity,
    ).toBe('3.000');

    const transactions = await pool.query<{ transaction_type: string }>(
      'SELECT transaction_type FROM inventory_transactions WHERE source_id=$1 ORDER BY transaction_type',
      [transferId],
    );
    expect(transactions.rows.map((row) => row.transaction_type)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
  });

  it('rejects a submitted transfer with a reason and leaves inventory unchanged', async () => {
    const ids = await seedCase();
    const created = await http()
      .post('/api/v1/stock-transfers')
      .query({ farmId: farmId })
      .send(transferInput(ids, `${tag}-REJECT`))
      .expect(201);
    const transferId = (created.body as TransferDetail).data.transfer.id;

    await http()
      .post(`/api/v1/stock-transfers/${transferId}/submit`)
      .query({ farmId: farmId })
      .expect(201);
    const rejected = await http()
      .post(`/api/v1/stock-transfers/${transferId}/reject`)
      .query({ farmId: farmId })
      .send({ rejectionReason: 'Kho dich dang tam khoa' })
      .expect(201);
    const transfer = (rejected.body as TransferDetail).data.transfer;
    expect(transfer.status).toBe('REJECTED');
    expect(transfer.rejectionReason).toBe('Kho dich dang tam khoa');
    expect(transfer.rejectedByMemberId).toBe(memberId);

    const balances = await pool.query<{
      warehouse_id: string;
      quantity: string;
    }>(
      'SELECT warehouse_id, quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farmId, ids.itemId],
    );
    expect(balances.rows).toEqual([
      { warehouse_id: ids.sourceWarehouseId, quantity: '10.000' },
    ]);
    const transactions = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1',
      [transferId],
    );
    expect(transactions.rows[0].count).toBe(0);
    const audit = await pool.query<{
      action: string;
      user_id: string;
      old_data: { status: string } | null;
      new_data: { status: string; rejection_reason: string; items: unknown[] };
    }>(
      'SELECT action,user_id,old_data,new_data FROM audit_logs WHERE farm_id=$1 AND entity_id=$2 ORDER BY created_at,id',
      [farmId, transferId],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'CREATE',
      'SUBMIT',
      'REJECT',
    ]);
    const rejection = audit.rows[2];
    expect(rejection.user_id).toBe(userId);
    expect(rejection.old_data?.status).toBe('PENDING_APPROVAL');
    expect(rejection.new_data.status).toBe('REJECTED');
    expect(rejection.new_data.rejection_reason).toBe('Kho dich dang tam khoa');
    expect(rejection.new_data.items).toHaveLength(1);
    await http()
      .post(`/api/v1/stock-transfers/${transferId}/confirm`)
      .query({ farmId: farmId })
      .expect(409);
    const auditCount = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM audit_logs WHERE farm_id=$1 AND entity_id=$2',
      [farmId, transferId],
    );
    expect(auditCount.rows[0].count).toBe(3);
    const listed = await http()
      .get('/api/v1/audit-logs')
      .query({
        farmId,
        entityType: 'stock_transfer',
        action: 'REJECT',
        pageSize: 1,
      })
      .expect(200);
    const entries = listed.body as {
      data: Array<{ id: string; entityId: string }>;
      page: { totalItems: number };
    };
    expect(entries.page.totalItems).toBe(1);
    expect(entries.data[0].entityId).toBe(transferId);
    const detail = await http()
      .get(`/api/v1/audit-logs/${entries.data[0].id}`)
      .query({ farmId })
      .expect(200);
    expect(
      (detail.body as { data: { newData: unknown } }).data.newData,
    ).toMatchObject({
      status: 'REJECTED',
      rejection_reason: 'Kho dich dang tam khoa',
    });
    await http()
      .get(`/api/v1/audit-logs/${entries.data[0].id}`)
      .query({ farmId: randomUUID() })
      .expect(404);
  });

  it.each(['REJECT', 'CONFIRM', 'CANCEL'] as const)(
    'records count %s snapshots without duplicate or failed-operation logs',
    async (action) => {
      const ids = await seedCase();
      const created = await http()
        .post('/api/v1/stock-counts')
        .query({ farmId })
        .send({
          warehouseId: ids.sourceWarehouseId,
          countCode: `${tag}-${action}`,
          items: [{ itemId: ids.itemId, actualQuantity: '8' }],
        })
        .expect(201);
      const countId = (created.body as { data: { count: { id: string } } }).data
        .count.id;
      await http()
        .patch(`/api/v1/stock-counts/${countId}`)
        .query({ farmId })
        .send({ note: 'Audit test' })
        .expect(200);
      if (action !== 'CANCEL')
        await http()
          .post(`/api/v1/stock-counts/${countId}/submit`)
          .query({ farmId })
          .expect(201);
      await http()
        .post(`/api/v1/stock-counts/${countId}/${action.toLowerCase()}`)
        .query({ farmId })
        .send(action === 'REJECT' ? { rejectionReason: 'Need recount' } : {})
        .expect(201);
      const result = await pool.query<{ quantity: string }>(
        'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
        [farmId, ids.itemId],
      );
      expect(result.rows[0].quantity).toBe(
        action === 'CONFIRM' ? '8.000' : '10.000',
      );
      const ledger = await pool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM inventory_transactions WHERE source_id=$1',
        [countId],
      );
      expect(ledger.rows[0].count).toBe(action === 'CONFIRM' ? 1 : 0);
      if (action === 'CONFIRM')
        await http()
          .post(`/api/v1/stock-counts/${countId}/confirm`)
          .query({ farmId })
          .expect(201);
      else
        await http()
          .post(`/api/v1/stock-counts/${countId}/confirm`)
          .query({ farmId })
          .expect(409);
      const history = await pool.query<{ action: string; user_id: string }>(
        'SELECT action,user_id FROM audit_logs WHERE farm_id=$1 AND entity_id=$2 ORDER BY created_at,id',
        [farmId, countId],
      );
      expect(history.rows.map((row) => row.action)).toEqual(
        action === 'CANCEL'
          ? ['CREATE', 'UPDATE', 'CANCEL']
          : ['CREATE', 'UPDATE', 'SUBMIT', action],
      );
      expect(history.rows.every((row) => row.user_id === userId)).toBe(true);
    },
  );
});

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
import { WarehousesController } from '../src/modules/warehouses/warehouses.controller';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type WarehouseResponse = {
  data: Awaited<ReturnType<WarehousesService['getWarehouse']>>;
};
type WarehouseListResponse = Awaited<
  ReturnType<WarehousesService['listWarehouses']>
>;
type ErrorResponse = { message: string };

// Real HTTP/DTO/service/Postgres. Only Clerk identity is supplied by the test.
// Warehouse methods do not open transactions: all writes use this rolled-back client.
describe('Warehouse management HTTP contract', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const tag = `WH-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const farmA = randomUUID();
  const farmB = randomUUID();
  const warehouseId = randomUUID();
  const otherWarehouseId = randomUUID();
  const memberId = randomUUID();
  const owner = `${tag}-owner`;
  const reader = `${tag}-reader`;
  let identity = owner;
  let client: PoolClient | undefined;
  // Services open their own transactions: run the suite inside a drizzle
  // transaction so they become savepoints instead of committing fixtures.
  let finish: (() => void) | undefined;
  let done: Promise<void> | undefined;
  let app: INestApplication<App> | undefined;
  const base = '/api/v1/warehouses';

  beforeAll(async () => {
    client = await pool.connect();
    const rollback = new Error('Rollback warehouse fixtures');
    let ready!: (db: unknown) => void;
    const transaction = new Promise<unknown>((resolve) => (ready = resolve));
    const finished = new Promise<void>((resolve) => (finish = resolve));
    done = drizzle({ client, schema })
      .transaction(async (tx) => {
        ready(tx);
        await finished;
        throw rollback;
      })
      .catch((error: unknown) => {
        if (error !== rollback) throw error;
      });
    const db = await transaction;
    await client.query(
      'INSERT INTO farms (id, code, name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    for (const [subject, role] of [
      [owner, 'FARM_OWNER'],
      [reader, 'GUEST'],
    ]) {
      const userId = randomUUID();
      await client.query(
        'INSERT INTO users (id,auth_provider,auth_provider_user_id,email) VALUES ($1,$2,$3,$4)',
        [userId, 'CLERK', subject, `${subject}@example.local`],
      );
      for (const farmId of subject === owner ? [farmA, farmB] : [farmA]) {
        const membership =
          subject === owner && farmId === farmA ? memberId : randomUUID();
        await client.query(
          'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
          [membership, farmId, userId],
        );
        await client.query(
          'INSERT INTO farm_member_roles (farm_member_id,role_id) SELECT $1,id FROM roles WHERE code=$2',
          [membership, role],
        );
      }
    }
    await client.query(
      'INSERT INTO warehouses (id,farm_id,code,name,address,description) VALUES ($1,$2,$3,$4,$5,$6),($7,$8,$3,$4,NULL,NULL)',
      [
        warehouseId,
        farmA,
        tag,
        'Warehouse needle',
        'Original address',
        'Original description',
        otherWarehouseId,
        farmB,
      ],
    );
    const module = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [
        WarehousesService,
        {
          provide: DatabaseService,
          useValue: { db },
        },
      ],
    }).compile();
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
          clerkUserId: identity,
        };
        return true;
      },
    });
    await app.init();
  });

  beforeEach(async () => {
    identity = owner;
    await client?.query('SAVEPOINT warehouse_case');
  });
  afterEach(async () => {
    await client?.query('ROLLBACK TO SAVEPOINT warehouse_case');
    await client?.query('RELEASE SAVEPOINT warehouse_case');
  });
  afterAll(async () => {
    await app?.close();
    try {
      if (client) {
        finish?.();
        await done;
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

  it('lists only the selected farm, searches code/name, filters status and paginates', async () => {
    for (let index = 0; index < 21; index++) {
      await client!.query(
        'INSERT INTO warehouses (farm_id,code,name,status) VALUES ($1,$2,$3,$4)',
        [
          farmA,
          `${tag}-${index}`,
          `Warehouse ${index}`,
          index === 0 ? 'INACTIVE' : 'ACTIVE',
        ],
      );
    }
    const response = await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, page: 2, pageSize: 20 })
      .expect(200);
    const body = response.body as WarehouseListResponse;
    expect(body.page).toEqual({
      number: 2,
      size: 20,
      totalItems: 22,
      totalPages: 2,
    });
    expect(body.data).toHaveLength(2);
    expect(
      body.data.every((row: { farmId: string }) => row.farmId === farmA),
    ).toBe(true);
    const byName = await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, search: 'needle', status: 'ACTIVE' })
      .expect(200);
    expect(
      (byName.body as WarehouseListResponse).data.map((row) => row.id),
    ).toEqual([warehouseId]);
    const inactive = await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, search: `${tag}-0`, status: 'INACTIVE' })
      .expect(200);
    expect((inactive.body as WarehouseListResponse).page.totalItems).toBe(1);
    const empty = await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, search: 'not-found' })
      .expect(200);
    expect((empty.body as WarehouseListResponse).data).toEqual([]);
  });

  it('returns detail and creates normalized master data', async () => {
    const detail = await request(app!.getHttpServer())
      .get(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((detail.body as WarehouseResponse).data).toMatchObject({
      id: warehouseId,
      farmId: farmA,
      code: tag,
      status: 'ACTIVE',
    });
    const created = await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({
        code: ' new-code ',
        name: ' New warehouse ',
        address: ' Address ',
        description: ' Description ',
      })
      .expect(201);
    expect((created.body as WarehouseResponse).data).toMatchObject({
      farmId: farmA,
      code: 'NEW-CODE',
      name: 'New warehouse',
      address: 'Address',
      description: 'Description',
      status: 'ACTIVE',
    });
  });

  it('updates only provided fields and clears nullable fields', async () => {
    const response = await request(app!.getHttpServer())
      .patch(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .send({ name: 'Renamed', address: null, description: null })
      .expect(200);
    expect((response.body as WarehouseResponse).data).toMatchObject({
      code: tag,
      name: 'Renamed',
      address: null,
      description: null,
      status: 'ACTIVE',
    });
    await request(app!.getHttpServer())
      .patch(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .send({})
      .expect(400);
  });

  it.each(['post', 'patch'] as const)(
    'returns an actionable duplicate-code conflict on %s',
    async (method) => {
      if (method === 'patch')
        await client!.query(
          'INSERT INTO warehouses (farm_id,code,name) VALUES ($1,$2,$2)',
          [farmA, `${tag}-DUPLICATE`],
        );
      const response = await request(app!.getHttpServer())
        [method](method === 'post' ? base : `${base}/${warehouseId}`)
        .query({ farmId: farmA })
        .send({
          code: method === 'post' ? tag : `${tag}-DUPLICATE`,
          name: 'Duplicate',
        });
      expect(response.status).toBe(409);
      expect((response.body as ErrorResponse).message).toBe(
        'Warehouse code already exists',
      );
    },
  );

  it('deactivates an empty warehouse without deleting it', async () => {
    const result = await request(app!.getHttpServer())
      .delete(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((result.body as WarehouseResponse).data.status).toBe('INACTIVE');
    const detail = await request(app!.getHttpServer())
      .get(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .expect(200);
    expect((detail.body as WarehouseResponse).data.id).toBe(warehouseId);
    expect((detail.body as WarehouseResponse).data.status).toBe('INACTIVE');
  });

  it.each(['inventory', 'asset'])(
    'rejects DELETE and status PATCH when holding %s',
    async (kind) => {
      const categoryId = randomUUID();
      const unitId = randomUUID();
      const itemId = randomUUID();
      await client!.query(
        'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
        [categoryId, tag],
      );
      await client!.query(
        'INSERT INTO units (id,code,name) VALUES ($1,$2,$2)',
        [unitId, tag],
      );
      await client!.query(
        'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode) VALUES ($1,$2,$3,$4,$5,$5,$6,$7)',
        [
          itemId,
          farmA,
          categoryId,
          unitId,
          tag,
          kind === 'asset' ? 'EQUIPMENT' : 'MATERIAL',
          kind === 'asset' ? 'ASSET' : 'QUANTITY',
        ],
      );
      if (kind === 'inventory') {
        await client!.query(
          'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,quantity_on_hand) VALUES ($1,$2,$3,1)',
          [farmA, warehouseId, itemId],
        );
      } else {
        const locationId = randomUUID();
        await client!.query(
          "INSERT INTO locations (id,farm_id,warehouse_id,code,name,type) VALUES ($1,$2,$3,$4,$4,'WAREHOUSE')",
          [locationId, farmA, warehouseId, tag],
        );
        await client!.query(
          'INSERT INTO assets (farm_id,item_id,current_location_id,asset_code) VALUES ($1,$2,$3,$4)',
          [farmA, itemId, locationId, tag],
        );
      }
      for (const method of ['delete', 'patch'] as const) {
        const call = request(app!.getHttpServer())
          [method](`${base}/${warehouseId}`)
          .query({ farmId: farmA });
        if (method === 'patch') call.send({ status: 'INACTIVE' });
        const response = await call.expect(409);
        expect((response.body as ErrorResponse).message).toBe(
          'WAREHOUSE_NOT_EMPTY',
        );
      }
      const detail = await request(app!.getHttpServer())
        .get(`${base}/${warehouseId}`)
        .query({ farmId: farmA })
        .expect(200);
      expect((detail.body as WarehouseResponse).data.status).toBe('ACTIVE');
    },
  );

  it('audits create, update and deactivation with actor and before/after (NV08-F01)', async () => {
    const audits = async () =>
      (
        await client!.query<{
          action: string;
          entity_id: string;
          email: string;
          old_name: string | null;
          new_name: string;
          new_status: string;
        }>(
          `SELECT a.action, a.entity_id, u.email, a.old_data->>'name' AS old_name,
             a.new_data->>'name' AS new_name, a.new_data->>'status' AS new_status
           FROM audit_logs a JOIN users u ON u.id = a.user_id
           WHERE a.farm_id = $1 AND a.entity_type = 'WAREHOUSE'
           -- One outer test transaction: created_at is equal, so order by step.
           ORDER BY array_position(ARRAY['WAREHOUSE_CREATED','WAREHOUSE_UPDATED','WAREHOUSE_DEACTIVATED']::varchar[], a.action)`,
          [farmA],
        )
      ).rows;
    const created = await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({ code: `${tag}-AUDIT`, name: 'Audited' })
      .expect(201);
    const id = (created.body as WarehouseResponse).data.id;
    await request(app!.getHttpServer())
      .patch(`${base}/${id}`)
      .query({ farmId: farmA })
      .send({ name: 'Audited 2' })
      .expect(200);
    await request(app!.getHttpServer())
      .delete(`${base}/${id}`)
      .query({ farmId: farmA })
      .expect(200);
    // Retried deactivation and a failed write log nothing more.
    await request(app!.getHttpServer())
      .delete(`${base}/${id}`)
      .query({ farmId: farmA })
      .expect(200);
    await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({ code: tag, name: 'Duplicate' })
      .expect(409);
    identity = reader;
    await request(app!.getHttpServer())
      .patch(`${base}/${id}`)
      .query({ farmId: farmA })
      .send({ name: 'Guest' })
      .expect(403);
    const email = `${owner}@example.local`;
    expect(await audits()).toEqual([
      expect.objectContaining({
        action: 'WAREHOUSE_CREATED',
        entity_id: id,
        email,
        old_name: null,
        new_name: 'Audited',
      }),
      expect.objectContaining({
        action: 'WAREHOUSE_UPDATED',
        old_name: 'Audited',
        new_name: 'Audited 2',
      }),
      expect.objectContaining({
        action: 'WAREHOUSE_DEACTIVATED',
        new_status: 'INACTIVE',
      }),
    ]);
  });

  it('allows guest reads while denying all write operations', async () => {
    identity = reader;
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA })
      .expect(200);
    await request(app!.getHttpServer())
      .get(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .expect(200);
    for (const method of ['post', 'patch', 'delete'] as const) {
      await request(app!.getHttpServer())
        [method](method === 'post' ? base : `${base}/${warehouseId}`)
        .query({ farmId: farmA })
        .send(method === 'delete' ? undefined : { code: tag, name: 'Denied' })
        .expect(403);
    }
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmB })
      .expect(403);
  });

  it('rejects cross-farm IDs and non-members, even with valid IDs', async () => {
    for (const method of ['get', 'patch', 'delete'] as const) {
      await request(app!.getHttpServer())
        [method](`${base}/${warehouseId}`)
        .query({ farmId: farmB })
        .send(method === 'patch' ? { name: 'Denied' } : undefined)
        .expect(404);
    }
    identity = `${tag}-unknown`;
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA })
      .expect(403);
  });

  it('allows ADMIN writes and denies inactive membership', async () => {
    await client!.query(
      'UPDATE farm_member_roles SET role_id=(SELECT id FROM roles WHERE code=$2) WHERE farm_member_id=$1',
      [memberId, 'ADMIN'],
    );
    await request(app!.getHttpServer())
      .patch(`${base}/${warehouseId}`)
      .query({ farmId: farmA })
      .send({ name: 'Admin edited' })
      .expect(200);
    await client!.query(
      "UPDATE farm_members SET status='INACTIVE' WHERE id=$1",
      [memberId],
    );
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA })
      .expect(403);
  });

  it('validates query/DTO boundaries', async () => {
    await request(app!.getHttpServer()).get(base).expect(400);
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, status: 'BROKEN' })
      .expect(400);
    await request(app!.getHttpServer())
      .get(base)
      .query({ farmId: farmA, page: 0 })
      .expect(400);
    await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({ code: ' ', name: 'Invalid' })
      .expect(400);
    await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({ code: tag, name: 'Invalid', description: 'x'.repeat(4001) })
      .expect(400);
    await request(app!.getHttpServer())
      .post(base)
      .query({ farmId: farmA })
      .send({ code: tag, name: 'Invalid', quantity: 1 })
      .expect(400);
  });
});

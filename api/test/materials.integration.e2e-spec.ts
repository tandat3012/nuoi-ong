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
import { FarmAccessGuard } from '../src/modules/auth/farm-access.guard';
import { MaterialsController } from '../src/modules/materials/materials.controller';
import { MaterialsService } from '../src/modules/materials/materials.service';

type DetailResponse = {
  data: Awaited<ReturnType<MaterialsService['getMaterial']>>;
};
type ListResponse = Awaited<ReturnType<MaterialsService['listMaterials']>>;

// Real controller/DTO/service/guard/Postgres; only Clerk identity is a fixture.
// Every fixture and API write stays inside one rolled-back connection transaction.
describe('Materials HTTP contract with local PostgreSQL', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const tag = `MATERIALS-TEST-${randomUUID().slice(0, 8)}`;
  const farmA = randomUUID();
  const farmB = randomUUID();
  const categoryId = randomUUID();
  const unitId = randomUUID();
  const userId = randomUUID();
  let client: PoolClient | undefined;
  let app: INestApplication<App> | undefined;
  let finishTransaction: (() => void) | undefined;
  let transactionDone: Promise<void> | undefined;
  let materialId: string;
  let roleLessIdentity = false;
  const payload = {
    code: `${tag}-CREATE`,
    name: 'Integration material',
    categoryId,
    unitId,
    kind: 'CONSUMABLE',
    trackingMode: 'QUANTITY',
    minStockLevel: '12.345',
    description: 'Clear this field',
  };

  beforeAll(async () => {
    client = await pool.connect();
    const rollback = new Error('Rollback materials test fixtures');
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
    expect(roles.rows).toHaveLength(2);
    await client.query(
      'INSERT INTO farms (id, code, name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    await client.query(
      'INSERT INTO users (id, auth_provider, auth_provider_user_id, email) VALUES ($1,$2,$2,$3)',
      [userId, tag, `${tag}@example.local`],
    );
    await client.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, tag],
    );
    await client.query('INSERT INTO units (id,code,name) VALUES ($1,$2,$2)', [
      unitId,
      `MT-${unitId.slice(0, 8)}`,
    ]);
    for (const [farmId, code] of [
      [farmA, 'FARM_OWNER'],
      [farmB, 'GUEST'],
    ]) {
      const memberId = randomUUID();
      await client.query(
        'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
        [memberId, farmId, userId],
      );
      await client.query(
        'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
        [memberId, roles.rows.find((role) => role.code === code)!.id],
      );
    }
    const module = await Test.createTestingModule({
      controllers: [MaterialsController],
      providers: [
        MaterialsService,
        FarmAccessGuard,
        { provide: DatabaseService, useValue: { db: database } },
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
          clerkUserId: roleLessIdentity ? `${tag}-unknown` : tag,
        };
        return true;
      },
    });
    await app.init();
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
      const result = await pool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM farms WHERE id IN ($1,$2)',
        [farmA, farmB],
      );
      expect(result.rows[0].count).toBe(0);
    } finally {
      await pool.end();
    }
  });

  it('creates a material, retains decimal precision and returns the detail envelope', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/materials')
      .query({ farmId: farmA })
      .send(payload)
      .expect(201);
    const body = response.body as DetailResponse;
    materialId = body.data.item.id;
    expect(body.data.item).toMatchObject({
      farmId: farmA,
      minStockLevel: '12.345',
      status: 'ACTIVE',
    });
    expect(body.data.profile?.kind).toBe('CONSUMABLE');
  });

  it('reads detail and lists using server search, filters and pagination', async () => {
    await request(app!.getHttpServer())
      .get(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmA })
      .expect(200);
    const response = await request(app!.getHttpServer())
      .get('/api/v1/materials')
      .query({
        farmId: farmA,
        search: 'Integration',
        status: 'ACTIVE',
        kind: 'CONSUMABLE',
        trackingMode: 'QUANTITY',
        categoryId,
        page: 1,
        pageSize: 20,
      })
      .expect(200);
    const body = response.body as ListResponse;
    expect(body.page).toEqual({
      number: 1,
      size: 20,
      totalItems: 1,
      totalPages: 1,
    });
    expect(body.data[0].quantityOnHand).toBe('0');
    const empty = await request(app!.getHttpServer())
      .get('/api/v1/materials')
      .query({ farmId: farmA, search: 'does-not-exist' })
      .expect(200);
    expect((empty.body as ListResponse).page.totalItems).toBe(0);
  });

  it('PATCH changes only supplied fields and clears nullable values', async () => {
    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmA })
      .send({ description: null, status: 'INACTIVE' })
      .expect(200);
    expect((response.body as DetailResponse).data.item).toMatchObject({
      name: payload.name,
      description: null,
      status: 'INACTIVE',
      minStockLevel: '12.345',
    });
    await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmA })
      .send({})
      .expect(400);
  });

  it('rejects duplicate codes, invalid tracking/expiry and wrong request fields', async () => {
    await request(app!.getHttpServer())
      .post('/api/v1/materials')
      .query({ farmId: farmA })
      .send(payload)
      .expect(409);
    await request(app!.getHttpServer())
      .post('/api/v1/materials')
      .query({ farmId: farmA })
      .send({ ...payload, code: `${tag}-BAD`, requiresExpiryTracking: true })
      .expect(400);
    await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmA })
      .send({ quantityOnHand: '10' })
      .expect(400);
    await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmA })
      .send({ minStockLevel: '-1', expiryWarningDays: 0 })
      .expect(400);
  });

  it('allows guest reads but denies writes and cross-farm material IDs', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/materials')
      .query({ farmId: farmB })
      .expect(200);
    await request(app!.getHttpServer())
      .post('/api/v1/materials')
      .query({ farmId: farmB })
      .send(payload)
      .expect(403);
    await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmB })
      .send({ name: 'Wrong farm' })
      .expect(403);
    await request(app!.getHttpServer())
      .get(`/api/v1/materials/${materialId}`)
      .query({ farmId: farmB })
      .expect(404);
    roleLessIdentity = true;
    try {
      await request(app!.getHttpServer())
        .get('/api/v1/materials')
        .query({ farmId: farmA })
        .expect(403);
    } finally {
      roleLessIdentity = false;
    }
  });

  it('returns a second page from actual rows and rejects tracking changes with lots', async () => {
    for (let i = 0; i < 21; i += 1) {
      await client!.query(
        "INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode) VALUES ($1,$2,$3,$4,$4,'MATERIAL','QUANTITY')",
        [farmA, categoryId, unitId, `${tag}-${i}`],
      );
    }
    const response = await request(app!.getHttpServer())
      .get('/api/v1/materials')
      .query({ farmId: farmA, page: 2, pageSize: 20 })
      .expect(200);
    const body = response.body as ListResponse;
    expect(body.page).toEqual({
      number: 2,
      size: 20,
      totalItems: 22,
      totalPages: 2,
    });
    expect(body.data).toHaveLength(2);
    const created = await request(app!.getHttpServer())
      .post('/api/v1/materials')
      .query({ farmId: farmA })
      .send({ ...payload, code: `${tag}-LOT`, trackingMode: 'LOT' })
      .expect(201);
    const lotItemId = (created.body as DetailResponse).data.item.id;
    await client!.query(
      'INSERT INTO inventory_lots (farm_id,item_id,lot_number,initial_quantity) VALUES ($1,$2,$3,1)',
      [farmA, lotItemId, tag],
    );
    await request(app!.getHttpServer())
      .patch(`/api/v1/materials/${lotItemId}`)
      .query({ farmId: farmA })
      .send({ trackingMode: 'QUANTITY' })
      .expect(409);
  });
});

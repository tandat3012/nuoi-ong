import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { DatabaseModule } from '../src/db/database.module';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { CLERK_CLIENT } from '../src/modules/auth/clerk/clerk-client.provider';
import type { StoreOrdersService } from '../src/modules/store-orders/store-orders.service';
import { StoreOrdersModule } from '../src/modules/store-orders/store-orders.module';
import { AssetsModule } from '../src/modules/assets/assets.module';
import { InventoryModule } from '../src/modules/inventory/inventory.module';
import { MaintenanceModule } from '../src/modules/maintenance/maintenance.module';
import { WarehousesModule } from '../src/modules/warehouses/warehouses.module';
import { OrderTestDb, seedOrders } from './store-orders.fixture';

type OrderResponse = {
  data: Awaited<ReturnType<StoreOrdersService['staffGet']>>;
};

describe('Store order HTTP authorization and contract', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle(pool, { schema });
  const originalParties = process.env.CLERK_AUTHORIZED_PARTIES;
  const ROLLBACK = new Error('rollback');
  type Context = Awaited<ReturnType<typeof seedOrders>>;
  const withApp = async (
    fn: (
      ctx: Context,
      app: INestApplication<App>,
      tx: OrderTestDb,
    ) => Promise<void>,
  ) => {
    try {
      await db.transaction(async (tx) => {
        const scoped = tx as unknown as OrderTestDb;
        const ctx = await seedOrders(scoped);
        const module = await Test.createTestingModule({
          imports: [
            DatabaseModule,
            StoreOrdersModule,
            WarehousesModule,
            InventoryModule,
            AssetsModule,
            MaintenanceModule,
          ],
        })
          .overrideProvider(DatabaseService)
          .useValue(ctx.database)
          .overrideProvider(CLERK_CLIENT)
          .useValue({
            authenticateRequest: (req: Request) => {
              const userId = req.headers
                .get('authorization')
                ?.replace(/^Bearer /, '');
              return {
                isAuthenticated: Boolean(userId),
                toAuth: () => ({
                  userId,
                  tokenType: 'session_token',
                  sessionId: 'test-session',
                }),
              };
            },
          })
          .compile();
        const app = module.createNestApplication<INestApplication<App>>();
        app.setGlobalPrefix('api/v1');
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        await app.init();
        try {
          await fn(ctx, app, scoped);
        } finally {
          await app.close();
        }
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };
  beforeAll(() => {
    process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
  });
  afterAll(async () => {
    if (originalParties === undefined)
      delete process.env.CLERK_AUTHORIZED_PARTIES;
    else process.env.CLERK_AUTHORIZED_PARTIES = originalParties;
    await pool.end();
  });

  it('requires login on every customer route', () =>
    withApp(async ({ ids, input }, app) => {
      const http = request(app.getHttpServer());
      await http.get('/api/v1/store/orders').expect(401);
      await http.post('/api/v1/store/orders').send(input()).expect(401);
      await http.get(`/api/v1/store/orders/${ids.product}`).expect(401);
      await http
        .post(`/api/v1/store/orders/${ids.product}/cancel`)
        .send({ reason: 'No' })
        .expect(401);
    }));

  it('lets STORE_MANAGER list, confirm and read statistics but not approve inventory', () =>
    withApp(async ({ ids, service, input }, app) => {
      const http = request(app.getHttpServer());
      const auth = `Bearer ${ids.staff}`;
      const { order } = await service.create(ids.customer, input());
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.farm })
        .set('Authorization', auth)
        .expect(200);
      const confirmed = await http
        .post(`/api/v1/store-orders/${order.id}/confirm`)
        .query({ farmId: ids.farm })
        .set('Authorization', auth)
        .expect(201);
      expect((confirmed.body as OrderResponse).data.stockIssue.status).toBe(
        'DRAFT',
      );
      await http
        .get('/api/v1/store-orders/stats')
        .query({ farmId: ids.farm })
        .set('Authorization', auth)
        .expect(200);
      await http
        .post(
          `/api/v1/stock-issues/${(confirmed.body as OrderResponse).data.stockIssue.id}/confirm`,
        )
        .query({ farmId: ids.farm })
        .set('Authorization', auth)
        .expect(403);
    }));

  it('permits admin reports and returns zero values for an empty store', () =>
    withApp(async ({ ids }, app) => {
      const result = await request(app.getHttpServer())
        .get('/api/v1/store-orders/stats')
        .query({ farmId: ids.farm })
        .set('Authorization', `Bearer ${ids.admin}`)
        .expect(200);
      expect((result.body as { data: unknown }).data).toMatchObject({
        revenue: '0',
        completedOrders: 0,
        daily: [],
        topProducts: [],
        topCustomers: [],
      });
    }));

  it('returns 404 for another customer order and 403 for farm or staff-role violations', () =>
    withApp(async ({ ids, service, input }, app) => {
      const { order } = await service.create(ids.customer, input());
      const http = request(app.getHttpServer());
      await http
        .get(`/api/v1/store/orders/${order.id}`)
        .set('Authorization', `Bearer ${ids.otherCustomer}`)
        .expect(404);
      await http
        .post(`/api/v1/store/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${ids.otherCustomer}`)
        .send({ reason: 'No' })
        .expect(404);
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.farm })
        .set('Authorization', `Bearer ${ids.customer}`)
        .expect(403);
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.otherFarm })
        .set('Authorization', `Bearer ${ids.staff}`)
        .expect(403);
    }));

  it('no longer lets EMPLOYEE manage orders', () =>
    withApp(async ({ ids }, app, tx) => {
      const [storeManager] = await tx
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, 'STORE_MANAGER'));
      // Leaves the staff member with EMPLOYEE only.
      await tx
        .delete(schema.farmMemberRoles)
        .where(
          and(
            eq(schema.farmMemberRoles.farmMemberId, ids.member),
            eq(schema.farmMemberRoles.roleId, storeManager.id),
          ),
        );
      const http = request(app.getHttpServer());
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.farm })
        .set('Authorization', `Bearer ${ids.staff}`)
        .expect(403);
    }));

  it('keeps a store-only manager out of warehouse, asset and maintenance routes', () =>
    withApp(async ({ ids }, app, tx) => {
      const [employee] = await tx
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, 'EMPLOYEE'));
      // Leaves the staff member with STORE_MANAGER only.
      await tx
        .delete(schema.farmMemberRoles)
        .where(
          and(
            eq(schema.farmMemberRoles.farmMemberId, ids.member),
            eq(schema.farmMemberRoles.roleId, employee.id),
          ),
        );
      const http = request(app.getHttpServer());
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.farm })
        .set('Authorization', `Bearer ${ids.staff}`)
        .expect(200);
      for (const path of [
        '/api/v1/warehouses',
        '/api/v1/stock-issues',
        '/api/v1/inventory/adjustments',
        '/api/v1/assets',
        '/api/v1/maintenance-records',
        '/api/v1/maintenance-requests',
      ])
        await http
          .get(path)
          .query({ farmId: ids.farm })
          .set('Authorization', `Bearer ${ids.staff}`)
          .expect(403);
    }));

  it('checks the selling farm even for a member of another farm', () =>
    withApp(async ({ ids }, app, tx) => {
      const [role] = await tx
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, 'STORE_MANAGER'));
      const [member] = await tx
        .insert(schema.farmMembers)
        .values({ userId: ids.staff, farmId: ids.otherFarm })
        .returning();
      await tx
        .insert(schema.farmMemberRoles)
        .values({ farmMemberId: member.id, roleId: role.id });
      await request(app.getHttpServer())
        .get('/api/v1/store-orders')
        .query({ farmId: ids.otherFarm })
        .set('Authorization', `Bearer ${ids.staff}`)
        .expect(403);
    }));

  it('validates payloads, calendar filters and customer cancellation', () =>
    withApp(async ({ ids, input }, app) => {
      const http = request(app.getHttpServer());
      await http
        .post('/api/v1/store/orders')
        .set('Authorization', `Bearer ${ids.customer}`)
        .send({ ...input(), total: '1' })
        .expect(400);
      await http
        .get('/api/v1/store-orders')
        .query({ farmId: ids.farm, from: '2026-02-30' })
        .set('Authorization', `Bearer ${ids.staff}`)
        .expect(400);
      const created = await http
        .post('/api/v1/store/orders')
        .set('Authorization', `Bearer ${ids.customer}`)
        .send(input())
        .expect(201);
      const cancelled = await http
        .post(
          `/api/v1/store/orders/${(created.body as OrderResponse).data.order.id}/cancel`,
        )
        .set('Authorization', `Bearer ${ids.customer}`)
        .send({ reason: 'Không mua nữa' })
        .expect(201);
      expect((cancelled.body as OrderResponse).data.order.status).toBe(
        'CANCELLED',
      );
    }));
});

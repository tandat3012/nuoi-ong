import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { NotificationDevicesController } from '../src/modules/notifications/notification-devices.controller';
import { NotificationDevicesService } from '../src/modules/notifications/notification-devices.service';

type DeviceResponse = {
  data: {
    id: string;
    userId: string;
    installationId: string;
    platform: string;
    isActive: boolean;
    createdAt: string;
  };
};

// Real PostgreSQL and HTTP validation; only Clerk token verification is stubbed.
// Every mutation belongs to disposable users created by this suite.
describe('Notification device registrations with PostgreSQL', () => {
  const tag = `push-devices-test-${randomUUID()}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const userA = randomUUID();
  const userB = randomUUID();
  const clerkUsers = {
    a: `${tag}-a`,
    b: `${tag}-b`,
    missing: `${tag}-missing`,
  };
  type Actor = keyof typeof clerkUsers;
  let app: INestApplication<App> | undefined;
  let fixturesCreated = false;
  let service: NotificationDevicesService;
  const path = (installationId: string) =>
    `/api/v1/notifications/devices/${installationId}`;
  const token = () =>
    `ExponentPushToken[test_${randomUUID().replaceAll('-', '')}]`;
  const register = (
    installationId: string,
    actor: Actor = 'a',
    expoPushToken = token(),
    extra = {},
  ) =>
    request(app!.getHttpServer())
      .put(path(installationId))
      .set('Authorization', `Bearer ${actor}`)
      .send({ expoPushToken, platform: 'ANDROID', ...extra });
  const get = (installationId: string, actor: Actor = 'a') =>
    request(app!.getHttpServer())
      .get(path(installationId))
      .set('Authorization', `Bearer ${actor}`);
  const unregister = (installationId: string, actor: Actor = 'a') =>
    request(app!.getHttpServer())
      .delete(path(installationId))
      .set('Authorization', `Bearer ${actor}`);
  const device = (response: { body: unknown }) =>
    (response.body as DeviceResponse).data;

  async function seedJobs(deviceId: string, userId = userA) {
    const statuses = [
      'PENDING',
      'PROCESSING',
      'AWAITING_RECEIPT',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
    ] as const;
    const inserted = await db
      .insert(schema.notifications)
      .values(
        statuses.map(() => ({
          userId,
          type: 'STAGE1_TEST',
          title: tag,
          body: tag,
        })),
      )
      .returning({ id: schema.notifications.id });
    await db.insert(schema.notificationPushOutbox).values(
      statuses.map((status, index) => ({
        notificationId: inserted[index].id,
        devicePushTokenId: deviceId,
        status,
        lockedAt: status === 'PROCESSING' ? new Date().toISOString() : null,
        lockId: status === 'PROCESSING' ? randomUUID() : null,
        expoTicketId:
          status === 'AWAITING_RECEIPT' || status === 'SUCCEEDED'
            ? randomUUID()
            : null,
      })),
    );
    return inserted;
  }

  async function jobStatuses(deviceId: string) {
    return pool.query<{
      status: string;
      locked_at: string | null;
      lock_id: string | null;
    }>(
      'SELECT status, locked_at, lock_id FROM notification_push_outbox WHERE device_push_token_id=$1',
      [deviceId],
    );
  }

  async function expectCancelledJobs(deviceId: string) {
    const jobs = await jobStatuses(deviceId);
    expect(jobs.rows.filter((row) => row.status === 'CANCELLED')).toHaveLength(
      4,
    );
    expect(jobs.rows.filter((row) => row.status === 'SUCCEEDED')).toHaveLength(
      1,
    );
    expect(jobs.rows.filter((row) => row.status === 'FAILED')).toHaveLength(1);
    expect(
      jobs.rows.every((row) => row.locked_at === null && row.lock_id === null),
    ).toBe(true);
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const tables = await pool.query<{
      tokens: string | null;
      outbox: string | null;
    }>(
      'SELECT to_regclass($1)::text AS tokens, to_regclass($2)::text AS outbox',
      ['public.device_push_tokens', 'public.notification_push_outbox'],
    );
    if (!tables.rows[0].tokens || !tables.rows[0].outbox) {
      throw new Error(
        'Apply device_push_tokens_and_push_outbox migration before testing',
      );
    }
    await db.insert(schema.users).values([
      {
        id: userA,
        authProviderUserId: clerkUsers.a,
        email: `${tag}-a@example.local`,
      },
      {
        id: userB,
        authProviderUserId: clerkUsers.b,
        email: `${tag}-b@example.local`,
      },
    ]);
    fixturesCreated = true;
    const module = await Test.createTestingModule({
      controllers: [NotificationDevicesController],
      providers: [
        NotificationDevicesService,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();
    service = module.get(NotificationDevicesService);
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
        const req = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          auth?: { clerkUserId: string };
        }>();
        const actor = req.headers.authorization?.replace(
          /^Bearer /,
          '',
        ) as Actor;
        if (!Object.prototype.hasOwnProperty.call(clerkUsers, actor)) {
          throw new UnauthorizedException();
        }
        req.auth = { clerkUserId: clerkUsers[actor] };
        return true;
      },
    });
    await app.init();
  });

  beforeEach(async () => {
    await pool.query(
      'DELETE FROM device_push_tokens WHERE user_id = ANY($1::uuid[])',
      [[userA, userB]],
    );
    await pool.query(
      'DELETE FROM notifications WHERE user_id = ANY($1::uuid[])',
      [[userA, userB]],
    );
    await pool.query(
      "UPDATE users SET status='ACTIVE' WHERE id = ANY($1::uuid[])",
      [[userA, userB]],
    );
  });

  afterAll(async () => {
    try {
      await app?.close();
      if (fixturesCreated) {
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
          [userA, userB],
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  it('registers the authenticated user, hides the Expo token and creates no notifications or jobs', async () => {
    const installation = randomUUID();
    const expoToken = token();
    const result = await register(installation, 'a', expoToken).expect(200);
    expect(device(result)).toMatchObject({
      userId: userA,
      installationId: installation,
      isActive: true,
    });
    expect(result.body).not.toHaveProperty('data.expoPushToken');
    const saved = await get(installation).expect(200);
    expect(saved.body).not.toHaveProperty('data.expoPushToken');
    const rows = await pool.query<{ expo_push_token: string }>(
      'SELECT expo_push_token FROM device_push_tokens WHERE id=$1',
      [device(result).id],
    );
    expect(rows.rows[0].expo_push_token).toBe(expoToken);
    expect((await jobStatuses(device(result).id)).rows).toHaveLength(0);
    expect(
      (
        await pool.query('SELECT id FROM notifications WHERE user_id=$1', [
          userA,
        ])
      ).rows,
    ).toHaveLength(0);
  });

  it.each(['ExpoPushToken', 'ExponentPushToken'])(
    'accepts the %s prefix',
    async (prefix) => {
      await register(randomUUID(), 'a', `${prefix}[test_valid_token]`).expect(
        200,
      );
    },
  );

  it('refreshes the same registration without duplicate rows or cancelling its jobs', async () => {
    const installation = randomUUID();
    const expoToken = token();
    const original = device(
      await register(installation, 'a', expoToken).expect(200),
    );
    await seedJobs(original.id);
    const repeated = device(
      await register(installation.toUpperCase(), 'a', expoToken).expect(200),
    );
    expect(repeated.id).toBe(original.id);
    expect(repeated.createdAt).toBe(original.createdAt);
    expect(
      (
        await pool.query('SELECT id FROM device_push_tokens WHERE user_id=$1', [
          userA,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (await jobStatuses(original.id)).rows.map((row) => row.status),
    ).toContain('PENDING');
  });

  it('rotates a token in place and cancels only unfinished deliveries', async () => {
    const installation = randomUUID();
    const original = device(await register(installation).expect(200));
    await seedJobs(original.id);
    const newToken = token();
    expect(
      device(await register(installation, 'a', newToken).expect(200)).id,
    ).toBe(original.id);
    await expectCancelledJobs(original.id);
    const saved = await pool.query<{ expo_push_token: string }>(
      'SELECT expo_push_token FROM device_push_tokens WHERE id=$1',
      [original.id],
    );
    expect(saved.rows[0].expo_push_token).toBe(newToken);
  });

  it('reassigns a shared installation to B, retains notifications and leaves other devices untouched', async () => {
    const installation = randomUUID();
    const otherInstallation = randomUUID();
    const expoToken = token();
    const original = device(
      await register(installation, 'a', expoToken).expect(200),
    );
    const other = device(await register(otherInstallation).expect(200));
    await seedJobs(original.id);
    await seedJobs(other.id);
    const reassigned = device(
      await register(installation, 'b', expoToken).expect(200),
    );
    expect(reassigned).toMatchObject({
      id: original.id,
      userId: userB,
      isActive: true,
    });
    await get(installation, 'a').expect(404);
    await unregister(installation, 'a').expect(404);
    await get(installation, 'b').expect(200);
    await expectCancelledJobs(original.id);
    expect(
      (await jobStatuses(other.id)).rows.map((row) => row.status),
    ).toContain('PENDING');
    expect(device(await get(otherInstallation).expect(200)).isActive).toBe(
      true,
    );
    const notifications = await pool.query<{ read_at: string | null }>(
      'SELECT read_at FROM notifications WHERE user_id=$1',
      [userA],
    );
    expect(notifications.rows).toHaveLength(12);
    expect(notifications.rows.every((row) => row.read_at === null)).toBe(true);
  });

  it('unregisters idempotently, preserves notifications and can reactivate the same device', async () => {
    const installation = randomUUID();
    const expoToken = token();
    const original = device(
      await register(installation, 'a', expoToken).expect(200),
    );
    await seedJobs(original.id);
    expect(device(await unregister(installation).expect(200)).isActive).toBe(
      false,
    );
    expect(device(await unregister(installation).expect(200)).isActive).toBe(
      false,
    );
    await expectCancelledJobs(original.id);
    const restored = device(
      await register(installation, 'a', expoToken).expect(200),
    );
    expect(restored).toMatchObject({ id: original.id, isActive: true });
    await expectCancelledJobs(original.id);
    expect(
      (
        await pool.query('SELECT id FROM notifications WHERE user_id=$1', [
          userA,
        ])
      ).rows,
    ).toHaveLength(6);
  });

  it('adopts an existing token after a reinstall without duplicating the token row', async () => {
    const oldInstallation = randomUUID();
    const newInstallation = randomUUID();
    const expoToken = token();
    const original = device(
      await register(oldInstallation, 'a', expoToken).expect(200),
    );
    await seedJobs(original.id);
    expect(
      device(await register(newInstallation, 'a', expoToken).expect(200)),
    ).toMatchObject({ id: original.id, installationId: newInstallation });
    await get(oldInstallation).expect(404);
    await expectCancelledJobs(original.id);
    expect(
      (
        await pool.query('SELECT id FROM device_push_tokens WHERE user_id=$1', [
          userA,
        ])
      ).rows,
    ).toHaveLength(1);
  });

  it('rejects a token collision between two existing installations without changing either', async () => {
    const installationA = randomUUID();
    const installationB = randomUUID();
    const tokenA = token();
    const tokenB = token();
    const originalA = device(
      await register(installationA, 'a', tokenA).expect(200),
    );
    const originalB = device(
      await register(installationB, 'b', tokenB).expect(200),
    );
    await seedJobs(originalA.id);
    await register(installationA, 'a', tokenB).expect(409);
    expect(device(await get(installationA).expect(200)).userId).toBe(userA);
    expect(device(await get(installationB, 'b').expect(200)).id).toBe(
      originalB.id,
    );
    expect(
      (await jobStatuses(originalA.id)).rows.map((row) => row.status),
    ).toContain('PENDING');
  });

  it('rolls back job cancellation if updating the device fails a database constraint', async () => {
    const installation = randomUUID();
    const original = device(await register(installation).expect(200));
    await seedJobs(original.id);
    await expect(
      service.register(clerkUsers.b, installation, {
        expoPushToken: '',
        platform: 'ANDROID',
      }),
    ).rejects.toThrow();
    expect(device(await get(installation).expect(200)).userId).toBe(userA);
    const jobs = await jobStatuses(original.id);
    expect(jobs.rows.map((row) => row.status)).toContain('PENDING');
    expect(
      jobs.rows.find((row) => row.status === 'PROCESSING')?.lock_id,
    ).not.toBeNull();
  });

  it('serializes concurrent first registrations for the same installation', async () => {
    const installation = randomUUID();
    const expoToken = token();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        register(installation, 'a', expoToken).expect(200),
      ),
    );
    expect(new Set(results.map((result) => device(result).id)).size).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT id FROM device_push_tokens WHERE installation_id=$1',
          [installation],
        )
      ).rows,
    ).toHaveLength(1);
  });

  it('serializes concurrent registrations that share a token but have different installations', async () => {
    const expoToken = token();
    const results = await Promise.all([
      register(randomUUID(), 'a', expoToken).expect(200),
      register(randomUUID(), 'a', expoToken).expect(200),
    ]);
    expect(device(results[0]).id).toBe(device(results[1]).id);
    expect(
      (
        await pool.query(
          'SELECT id FROM device_push_tokens WHERE expo_push_token=$1',
          [expoToken],
        )
      ).rows,
    ).toHaveLength(1);
  });

  it('does not let a delayed logout from A disable a device just reassigned to B', async () => {
    const installation = randomUUID();
    const expoToken = token();
    await register(installation, 'a', expoToken).expect(200);
    const results = await Promise.all([
      register(installation, 'b', expoToken),
      unregister(installation, 'a'),
    ]);
    expect(results[0].status).toBe(200);
    expect([200, 404]).toContain(results[1].status);
    expect(device(await get(installation, 'b').expect(200))).toMatchObject({
      userId: userB,
      isActive: true,
    });
  });

  it('prevents another account from viewing or unregistering an owned device', async () => {
    const installation = randomUUID();
    await register(installation).expect(200);
    await get(installation, 'b').expect(404);
    await unregister(installation, 'b').expect(404);
    expect(device(await get(installation).expect(200)).isActive).toBe(true);
  });

  it.each([
    { expoPushToken: 'not-an-expo-token' },
    { expoPushToken: null },
    { expoPushToken: 'ExpoPushToken[]' },
    { platform: 'WEB' },
    { userId: 'cannot-choose-another-user' },
    { farmId: randomUUID() },
  ])(
    'rejects malformed tokens, unsupported platforms and client-owned scope: %j',
    async (extra) => {
      await register(randomUUID(), 'a', token(), extra).expect(400);
      expect(
        (
          await pool.query(
            'SELECT id FROM device_push_tokens WHERE user_id=$1',
            [userA],
          )
        ).rows,
      ).toHaveLength(0);
    },
  );

  it('rejects invalid installation IDs and unauthenticated requests', async () => {
    await register('invalid').expect(400);
    await get('invalid').expect(400);
    await unregister('invalid').expect(400);
    await request(app!.getHttpServer())
      .put(path(randomUUID()))
      .send({ expoPushToken: token(), platform: 'ANDROID' })
      .expect(401);
  });

  it('rejects missing or inactive DB users without reassigning devices', async () => {
    const installation = randomUUID();
    const expoToken = token();
    await register(installation, 'a', expoToken).expect(200);
    await pool.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [userB]);
    await register(installation, 'b', expoToken).expect(403);
    await register(installation, 'missing', expoToken).expect(403);
    expect(device(await get(installation).expect(200)).userId).toBe(userA);
  });

  it('exposes the three authenticated operations and body DTO in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app!,
      new DocumentBuilder()
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'clerk-jwt')
        .build(),
    );
    const route =
      document.paths['/api/v1/notifications/devices/{installationId}'];
    expect(route).toHaveProperty('put');
    expect(route).toHaveProperty('get');
    expect(route).toHaveProperty('delete');
    expect(route.put?.security).toEqual([{ 'clerk-jwt': [] }]);
    expect(
      document.components?.schemas?.RegisterNotificationDeviceDto,
    ).toHaveProperty(
      'required',
      expect.arrayContaining(['expoPushToken', 'platform']),
    );
  });
});

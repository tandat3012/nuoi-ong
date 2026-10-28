import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq, sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import {
  ExpoPushClient,
  ExpoPushFailure,
  type ExpoTicket,
  type ExpoDeliveryResult,
  type ExpoPushMessage,
} from '../src/modules/notifications/expo-push.client';
import { NotificationDevicesService } from '../src/modules/notifications/notification-devices.service';
import { NotificationPushWorker } from '../src/modules/notifications/notification-push.worker';
import { PushOutboxRepository } from '../src/modules/notifications/push-outbox.repository';
import { pushWorkerOptions } from '../src/modules/notifications/push-worker.options';

// The global worker query runs in its own temporary schema: it must never claim,
// send, cancel or retire real local users' jobs/devices. Expo is always mocked.
describe('Push worker with PostgreSQL leases and a fake Expo transport', () => {
  jest.setTimeout(30_000);
  const name = `push_worker_test_${randomUUID().replaceAll('-', '')}`;
  const tables = [
    'roles',
    'users',
    'farms',
    'farm_members',
    'farm_member_roles',
    'stock_receipts',
    'stock_issues',
    'stock_transfers',
    'stock_counts',
    'notifications',
    'device_push_tokens',
    'notification_push_outbox',
  ];
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    options: `-c search_path=${name},public`,
    application_name: name,
  });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const options = {
    ...pushWorkerOptions({}),
    receiptDelayMs: 5000,
    receiptPollMs: 5000,
  };
  const repository = new PushOutboxRepository(database, options);
  const devices = new NotificationDevicesService(database);
  const a = randomUUID(),
    b = randomUUID(),
    farm = randomUUID(),
    otherFarm = randomUUID();
  const memberA = randomUUID(),
    memberB = randomUUID(),
    ownerRole = randomUUID(),
    employeeRole = randomUUID();
  const deviceA = randomUUID(),
    deviceB = randomUUID(),
    installationA = randomUUID(),
    doc = randomUUID();
  const tokenA = 'ExponentPushToken[private_worker_a]',
    tokenB = 'ExponentPushToken[private_worker_b]';
  const send = jest.fn<Promise<ExpoTicket>, [ExpoPushMessage, AbortSignal?]>(
    () => Promise.resolve({ status: 'ok', id: 'ticket-1' }),
  );
  const receipt = jest.fn<
    Promise<ExpoDeliveryResult | null>,
    [string, AbortSignal?]
  >(() => Promise.resolve({ status: 'ok' }));
  const provider = { send, receipt } as unknown as ExpoPushClient;
  let worker: NotificationPushWorker;
  const workers: NotificationPushWorker[] = [];
  let created = false;

  type SqlInput<T> = { [K in keyof T]?: T[K] | SQL };
  async function notice(
    extra: SqlInput<typeof schema.notifications.$inferInsert> = {},
    job: SqlInput<typeof schema.notificationPushOutbox.$inferInsert> = {},
  ) {
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId: a,
        farmId: farm,
        type: 'STOCK_RECEIPT_PENDING_APPROVAL',
        entityType: 'STOCK_RECEIPT',
        entityId: doc,
        title: 'Phiếu cần duyệt',
        body: 'Phiếu thử nghiệm',
        ...extra,
      })
      .returning();
    const [row] = await db
      .insert(schema.notificationPushOutbox)
      .values({
        notificationId: notification.id,
        devicePushTokenId: deviceA,
        ...job,
      })
      .returning();
    return row;
  }
  const get = async (id: string) =>
    (
      await db
        .select()
        .from(schema.notificationPushOutbox)
        .where(eq(schema.notificationPushOutbox.id, id))
    )[0];
  const device = async (id = deviceA) =>
    (
      await db
        .select()
        .from(schema.devicePushTokens)
        .where(eq(schema.devicePushTokens.id, id))
    )[0];
  const due = (id: string) =>
    db
      .update(schema.notificationPushOutbox)
      .set({ nextAttemptAt: sql`statement_timestamp() - interval '1 second'` })
      .where(eq(schema.notificationPushOutbox.id, id));
  const makeWorker = (overrides = {}) => {
    const instance = new NotificationPushWorker(repository, provider, {
      ...options,
      ...overrides,
    });
    workers.push(instance);
    return instance;
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await admin.query(`CREATE SCHEMA "${name}"`);
    created = true;
    for (const table of tables)
      await admin.query(
        `CREATE TABLE "${name}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
      );
    const current = await pool.query<{ current_schema: string }>(
      'SELECT current_schema()',
    );
    if (current.rows[0].current_schema !== name)
      throw new Error('Worker test schema is not isolated');
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await pool.query(
      `TRUNCATE ${tables.map((table) => `"${name}"."${table}"`).join(', ')}`,
    );
    await db.insert(schema.roles).values([
      { id: ownerRole, code: 'FARM_OWNER', name: 'Owner', scope: 'FARM' },
      { id: employeeRole, code: 'EMPLOYEE', name: 'Employee', scope: 'FARM' },
    ]);
    await db.insert(schema.users).values([
      { id: a, authProviderUserId: 'clerk-a', email: 'a@test.local' },
      { id: b, authProviderUserId: 'clerk-b', email: 'b@test.local' },
    ]);
    await db.insert(schema.farms).values([
      { id: farm, code: 'FARM-A', name: 'Farm A' },
      { id: otherFarm, code: 'FARM-B', name: 'Farm B' },
    ]);
    await db.insert(schema.farmMembers).values([
      { id: memberA, userId: a, farmId: farm },
      { id: memberB, userId: b, farmId: farm },
    ]);
    await db.insert(schema.farmMemberRoles).values([
      { farmMemberId: memberA, roleId: ownerRole },
      { farmMemberId: memberB, roleId: employeeRole },
    ]);
    await db.insert(schema.stockReceipts).values({
      id: doc,
      farmId: farm,
      warehouseId: randomUUID(),
      receiptCode: 'RECEIPT-A',
      createdByMemberId: memberB,
      status: 'PENDING_APPROVAL',
    });
    await db.insert(schema.devicePushTokens).values([
      {
        id: deviceA,
        userId: a,
        installationId: installationA,
        expoPushToken: tokenA,
        platform: 'ANDROID',
      },
      {
        id: deviceB,
        userId: b,
        installationId: randomUUID(),
        expoPushToken: tokenB,
        platform: 'ANDROID',
      },
    ]);
    send.mockResolvedValue({ status: 'ok', id: 'ticket-1' });
    receipt.mockResolvedValue({ status: 'ok' });
    worker = makeWorker();
  });
  afterEach(async () => {
    for (const instance of workers.splice(0)) await instance.onModuleDestroy();
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    try {
      await pool.end();
      if (created && /^push_worker_test_[a-f0-9]{32}$/.test(name))
        await admin.query(`DROP SCHEMA "${name}" CASCADE`);
    } finally {
      await admin.end();
    }
  });

  it('sends through the correct channel and saves a ticket before marking provider delivery successful', async () => {
    const job = await notice();
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'AWAITING_RECEIPT',
      expoTicketId: 'ticket-1',
      attemptCount: 1,
      lockId: null,
      lockedAt: null,
    });
    expect(receipt).not.toHaveBeenCalled();
    const [message, signal] = send.mock.calls[0];
    expect(message).toMatchObject({
      to: tokenA,
      channelId: 'stock-documents',
      tag: job.notificationId,
    });
    expect(message.data).toMatchObject({
      version: 1,
      recipientUserId: a,
      farmId: farm,
      entityId: doc,
      notificationId: job.notificationId,
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    await due(job.id);
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'SUCCEEDED',
      attemptCount: 1,
      lastError: null,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(receipt).toHaveBeenCalledWith('ticket-1', expect.any(AbortSignal));
    expect((await db.select().from(schema.notifications))[0].readAt).toBeNull();
  });

  it('polls a missing receipt without sending the message again', async () => {
    const job = await notice(
      {},
      {
        status: 'AWAITING_RECEIPT',
        expoTicketId: 'known-ticket',
        attemptCount: 1,
      },
    );
    receipt.mockResolvedValueOnce(null);
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'AWAITING_RECEIPT',
      lastError: 'EXPO_RECEIPT_NOT_READY',
      expoTicketId: 'known-ticket',
      attemptCount: 1,
    });
    expect(send).not.toHaveBeenCalled();
    expect(Date.parse((await get(job.id)).nextAttemptAt)).toBeGreaterThan(
      Date.now(),
    );
  });

  it('backs off network send errors and succeeds on a later attempt', async () => {
    const job = await notice();
    send.mockRejectedValueOnce(new ExpoPushFailure('EXPO_HTTP_503', true));
    await worker.runOnce();
    const retry = await get(job.id);
    expect(retry).toMatchObject({
      status: 'PENDING',
      attemptCount: 1,
      lastError: 'EXPO_HTTP_503',
      expoTicketId: null,
    });
    expect(Date.parse(retry.nextAttemptAt)).toBeGreaterThan(Date.now());
    await due(job.id);
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'AWAITING_RECEIPT',
      attemptCount: 2,
    });
  });

  it('never resends after a receipt HTTP failure and bounds unknown receipts by age', async () => {
    const job = await notice(
      {},
      {
        status: 'AWAITING_RECEIPT',
        expoTicketId: 'known-ticket',
        attemptCount: 1,
      },
    );
    receipt.mockRejectedValueOnce(new ExpoPushFailure('EXPO_HTTP_429', true));
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'AWAITING_RECEIPT',
      expoTicketId: 'known-ticket',
      attemptCount: 1,
    });
    await db
      .update(schema.notificationPushOutbox)
      .set({
        createdAt: sql`statement_timestamp() - interval '25 hours'`,
        nextAttemptAt: sql`statement_timestamp()`,
      })
      .where(eq(schema.notificationPushOutbox.id, job.id));
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'FAILED',
      lastError: 'RECEIPT_EXPIRED',
    });
    expect(send).not.toHaveBeenCalled();
    expect(receipt).toHaveBeenCalledTimes(1);
  });

  it('resends only after a definitive provider rate-limit rejection, not after an ambiguous missing receipt', async () => {
    const job = await notice(
      {},
      {
        status: 'AWAITING_RECEIPT',
        expoTicketId: 'old-ticket',
        attemptCount: 1,
      },
    );
    receipt.mockResolvedValueOnce({
      status: 'error',
      code: 'MessageRateExceeded',
    });
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'PENDING',
      expoTicketId: null,
      attemptCount: 1,
    });
    await due(job.id);
    await worker.runOnce();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('persists exponential receipt HTTP backoff across worker cycles without resending', async () => {
    const job = await notice(
      {},
      {
        status: 'AWAITING_RECEIPT',
        expoTicketId: 'known-ticket',
        attemptCount: 1,
        lastError: 'EXPO_HTTP_503',
        updatedAt: sql`statement_timestamp() - interval '10 seconds'`,
        nextAttemptAt: sql`statement_timestamp() - interval '1 millisecond'`,
      },
    );
    receipt.mockRejectedValueOnce(new ExpoPushFailure('EXPO_HTTP_503', true));
    await worker.runOnce();
    const updated = await get(job.id);
    const delay =
      Date.parse(updated.nextAttemptAt) - Date.parse(updated.updatedAt);
    expect(delay).toBeGreaterThan(19_000);
    expect(delay).toBeLessThan(21_000);
    expect(updated.status).toBe('AWAITING_RECEIPT');
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'])(
    'fails %s without disabling the user device',
    async (code) => {
      const job = await notice();
      send.mockResolvedValueOnce({ status: 'error', code });
      await worker.runOnce();
      expect(await get(job.id)).toMatchObject({
        status: 'FAILED',
        lastError: code,
      });
      expect((await device()).isActive).toBe(true);
    },
  );

  it('bounds send attempts and does not claim a terminal job again', async () => {
    const job = await notice({}, { attemptCount: options.maxSendAttempts - 1 });
    send.mockRejectedValue(new ExpoPushFailure('EXPO_NETWORK_ERROR', true));
    await worker.runOnce();
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'FAILED',
      attemptCount: options.maxSendAttempts,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    'read',
    'role',
    'member',
    'user',
    'farm',
    'owner',
    'device',
    'scope',
    'status',
    'age',
  ] as const)(
    'cancels a job whose %s condition no longer authorizes delivery',
    async (condition) => {
      const job = await notice();
      if (condition === 'read')
        await db
          .update(schema.notifications)
          .set({ readAt: sql`statement_timestamp()` })
          .where(eq(schema.notifications.id, job.notificationId));
      if (condition === 'role')
        await db
          .delete(schema.farmMemberRoles)
          .where(eq(schema.farmMemberRoles.farmMemberId, memberA));
      if (condition === 'member')
        await db
          .update(schema.farmMembers)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.farmMembers.id, memberA));
      if (condition === 'user')
        await db
          .update(schema.users)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.users.id, a));
      if (condition === 'farm')
        await db
          .update(schema.farms)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.farms.id, farm));
      if (condition === 'owner')
        await db
          .update(schema.devicePushTokens)
          .set({ userId: b })
          .where(eq(schema.devicePushTokens.id, deviceA));
      if (condition === 'device')
        await db
          .update(schema.devicePushTokens)
          .set({ isActive: false })
          .where(eq(schema.devicePushTokens.id, deviceA));
      if (condition === 'scope')
        await db
          .update(schema.notifications)
          .set({ farmId: otherFarm })
          .where(eq(schema.notifications.id, job.notificationId));
      if (condition === 'status')
        await db
          .update(schema.stockReceipts)
          .set({ status: 'REJECTED' })
          .where(eq(schema.stockReceipts.id, doc));
      if (condition === 'age')
        await db
          .update(schema.notifications)
          .set({ createdAt: sql`statement_timestamp() - interval '25 hours'` })
          .where(eq(schema.notifications.id, job.notificationId));
      await worker.runOnce();
      expect((await get(job.id)).status).toBe('CANCELLED');
      expect(send).not.toHaveBeenCalled();
      expect(receipt).not.toHaveBeenCalled();
    },
  );

  it('retires an invalid token and cancels its other jobs without disabling another device', async () => {
    const first = await notice(
      {},
      { nextAttemptAt: sql`statement_timestamp() - interval '2 seconds'` },
    );
    const second = await notice();
    send.mockResolvedValueOnce({
      status: 'error',
      code: 'DeviceNotRegistered',
    });
    await makeWorker({ concurrency: 1 }).runOnce();
    expect(await get(first.id)).toMatchObject({
      status: 'FAILED',
      lastError: 'DeviceNotRegistered',
    });
    expect(await get(second.id)).toMatchObject({ status: 'CANCELLED' });
    expect((await device()).isActive).toBe(false);
    expect((await device(deviceB)).isActive).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('also retires DeviceNotRegistered from the receipt, without resending', async () => {
    const job = await notice(
      {},
      {
        status: 'AWAITING_RECEIPT',
        expoTicketId: 'known-ticket',
        attemptCount: 1,
      },
    );
    receipt.mockResolvedValueOnce({
      status: 'error',
      code: 'DeviceNotRegistered',
    });
    await worker.runOnce();
    expect((await get(job.id)).status).toBe('FAILED');
    expect((await device()).isActive).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['owner', 'token'] as const)(
    'ignores a stale invalid-token callback after the %s binding changed',
    async (change) => {
      const job = await notice();
      send.mockImplementationOnce(async () => {
        await devices.register(
          change === 'owner' ? 'clerk-b' : 'clerk-a',
          installationA,
          {
            expoPushToken: 'ExponentPushToken[new_valid_token]',
            platform: 'ANDROID',
          },
        );
        return { status: 'error', code: 'DeviceNotRegistered' };
      });
      await worker.runOnce();
      expect((await get(job.id)).status).toBe('CANCELLED');
      expect(await device()).toMatchObject({
        isActive: true,
        userId: change === 'owner' ? b : a,
        expoPushToken: 'ExponentPushToken[new_valid_token]',
      });
    },
  );

  it('does not let a stale token error disable a registration freshly refreshed in place', async () => {
    const job = await notice();
    send.mockImplementationOnce(async () => {
      await devices.register('clerk-a', installationA, {
        expoPushToken: tokenA,
        platform: 'ANDROID',
      });
      await db
        .update(schema.devicePushTokens)
        .set({
          updatedAt: sql`statement_timestamp() + interval '1 millisecond'`,
        })
        .where(eq(schema.devicePushTokens.id, deviceA));
      return { status: 'error', code: 'DeviceNotRegistered' };
    });
    await worker.runOnce();
    expect((await get(job.id)).status).toBe('FAILED');
    expect((await device()).isActive).toBe(true);
  });

  it('cannot overwrite logout or a read update committed while the HTTP request was in flight', async () => {
    const job = await notice();
    send.mockImplementationOnce(async () => {
      await devices.unregister('clerk-a', installationA);
      return { status: 'ok', id: 'late-ticket' };
    });
    await worker.runOnce();
    expect(await get(job.id)).toMatchObject({
      status: 'CANCELLED',
      lockId: null,
      expoTicketId: null,
    });
    expect((await device()).isActive).toBe(false);
    // Test the notification read gate independently on an active device.
    await devices.register('clerk-a', installationA, {
      expoPushToken: tokenA,
      platform: 'ANDROID',
    });
    const next = await notice();
    send.mockImplementationOnce(async () => {
      await db
        .update(schema.notifications)
        .set({ readAt: sql`statement_timestamp()` })
        .where(eq(schema.notifications.id, next.notificationId));
      return { status: 'ok', id: 'read-meanwhile' };
    });
    await worker.runOnce();
    expect((await get(next.id)).status).toBe('CANCELLED');
  });

  it('recovers expired receipt leases without sending again and fences late callbacks with lock_id', async () => {
    const receiptJob = await notice(
      {},
      {
        status: 'PROCESSING',
        expoTicketId: 'previous-ticket',
        attemptCount: 1,
        lockId: randomUUID(),
        lockedAt: sql`statement_timestamp() - interval '2 minutes'`,
      },
    );
    await worker.runOnce();
    expect((await get(receiptJob.id)).status).toBe('SUCCEEDED');
    expect(send).not.toHaveBeenCalled();
    const pending = await notice();
    const [oldClaim] = await repository.claimDue();
    const oldContext = await repository.prepare(oldClaim);
    expect(oldContext).not.toBeNull();
    await db
      .update(schema.notificationPushOutbox)
      .set({ lockedAt: sql`statement_timestamp() - interval '2 minutes'` })
      .where(eq(schema.notificationPushOutbox.id, pending.id));
    await repository.recoverExpired();
    const [newClaim] = await repository.claimDue();
    expect(newClaim.lockId).not.toBe(oldClaim.lockId);
    await expect(
      repository.finish(oldClaim, oldContext!, {
        status: 'AWAITING_RECEIPT',
        ticketId: 'stale-ticket',
      }),
    ).resolves.toBe(false);
    expect(await get(pending.id)).toMatchObject({
      status: 'PROCESSING',
      lockId: newClaim.lockId,
      expoTicketId: null,
    });
  });

  it('does not send one job twice when two worker instances drain concurrently', async () => {
    for (let i = 0; i < 16; i++) await notice();
    await Promise.all([
      worker.runOnce(),
      makeWorker().runOnce(),
      worker.runOnce(),
    ]);
    const sentIds = send.mock.calls.map(
      ([message]) => message.data.notificationId,
    );
    expect(sentIds).toHaveLength(16);
    expect(new Set(sentIds).size).toBe(16);
    const rows = await db.select().from(schema.notificationPushOutbox);
    expect(
      rows.every(
        (row) =>
          row.status === 'AWAITING_RECEIPT' &&
          row.attemptCount === 1 &&
          row.lockId === null,
      ),
    ).toBe(true);
  });

  it('sends confirmation results to an employee creator without an approver role', async () => {
    await db
      .update(schema.stockReceipts)
      .set({
        status: 'CONFIRMED',
        confirmedByMemberId: memberA,
        confirmedAt: sql`statement_timestamp()`,
      })
      .where(eq(schema.stockReceipts.id, doc));
    const job = await notice(
      { userId: b, type: 'STOCK_RECEIPT_CONFIRMED' },
      { devicePushTokenId: deviceB },
    );
    await worker.runOnce();
    expect((await get(job.id)).status).toBe('AWAITING_RECEIPT');
    expect(send.mock.calls[0][0].data.recipientUserId).toBe(b);
    expect(send.mock.calls[0][0].to).toBe(tokenB);
  });

  it('truncates only the outbound preview while preserving the full in-app notification', async () => {
    const body = 'Mật ong 🍯 '.repeat(200);
    const job = await notice({ body });
    await worker.runOnce();
    expect(Array.from(send.mock.calls[0][0].body)).toHaveLength(320);
    expect(
      (
        await db
          .select()
          .from(schema.notifications)
          .where(eq(schema.notifications.id, job.notificationId))
      )[0].body,
    ).toBe(body);
  });
});

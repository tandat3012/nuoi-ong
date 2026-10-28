import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { NotificationDevicesService } from '../src/modules/notifications/notification-devices.service';
import * as outbox from '../src/modules/notifications/notification-push-outbox';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

// Real DB, real document services and real farm authorization. Only the provider
// call is absent: stage 3 must never contact Expo. All fixtures have random IDs.
describe('Document push outbox and bounded device catch-up', () => {
  jest.setTimeout(30_000);
  const tag = `push-outbox-${randomUUID().slice(0, 12)}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const authorization = new WarehousesService(database);
  const devices = new NotificationDevicesService(database);
  const receipts = new StockReceiptsService(database, authorization);
  const issues = new StockIssuesService(database, authorization);
  const transfers = new StockTransfersService(database, authorization);
  const counts = new StockCountsService(database, authorization);
  const farm = randomUUID(),
    otherFarm = randomUUID();
  const warehouse = randomUUID(),
    target = randomUUID(),
    otherWarehouse = randomUUID();
  const category = randomUUID(),
    unit = randomUUID(),
    item = randomUUID();
  const actors = {
    creator: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    owner: { id: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    admin: { id: randomUUID(), member: randomUUID(), role: 'ADMIN' },
    peer: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    guest: { id: randomUUID(), member: randomUUID(), role: 'GUEST' },
    outsider: { id: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    inactiveUser: {
      id: randomUUID(),
      member: randomUUID(),
      role: 'FARM_OWNER',
    },
    inactiveMember: {
      id: randomUUID(),
      member: randomUUID(),
      role: 'FARM_OWNER',
    },
  };
  type Actor = keyof typeof actors;
  const userIds = Object.values(actors).map((actor) => actor.id);
  const memberIds = Object.values(actors).map((actor) => actor.member);
  const ownerOtherMember = randomUUID();
  const createdRoleIds: string[] = [];
  const roleIds = new Map<string, string>();
  let fixturesCreated = false;
  const clerk = (actor: Actor) => `${tag}-${actor}`;
  const token = () =>
    `ExponentPushToken[test_${randomUUID().replaceAll('-', '')}]`;
  const register = (
    actor: Actor,
    installationId: string = randomUUID(),
    expoPushToken = token(),
  ) =>
    devices.register(clerk(actor), installationId, {
      expoPushToken,
      platform: 'ANDROID',
    });
  const line = { itemId: item, quantity: '2' };
  const cases = [
    {
      type: 'STOCK_RECEIPT',
      table: 'stock_receipts',
      create: async () =>
        (
          await receipts.createReceipt(farm, clerk('creator'), {
            warehouseId: warehouse,
            receiptCode: randomUUID(),
            items: [line],
          })
        ).receipt.id,
      submit: (id: string, actor: Actor = 'creator') =>
        receipts.submitReceipt(id, farm, clerk(actor)),
      confirm: (id: string) =>
        receipts.confirmReceipt(id, farm, clerk('owner')),
      reject: (id: string) =>
        receipts.rejectReceipt(
          id,
          farm,
          clerk('owner'),
          'Kiểm tra lại số lượng',
        ),
    },
    {
      type: 'STOCK_ISSUE',
      table: 'stock_issues',
      create: async () =>
        (
          await issues.create(farm, clerk('creator'), {
            warehouseId: warehouse,
            issueCode: randomUUID(),
            items: [line],
          })
        ).issue.id,
      submit: (id: string, actor: Actor = 'creator') =>
        issues.submit(id, farm, clerk(actor)),
      confirm: (id: string) => issues.confirm(id, farm, clerk('owner')),
      reject: (id: string) =>
        issues.reject(id, farm, clerk('owner'), 'Kiểm tra lại số lượng'),
    },
    {
      type: 'STOCK_TRANSFER',
      table: 'stock_transfers',
      create: async () =>
        (
          await transfers.create(farm, clerk('creator'), {
            fromWarehouseId: warehouse,
            toWarehouseId: target,
            transferCode: randomUUID(),
            items: [line],
          })
        ).transfer.id,
      submit: (id: string, actor: Actor = 'creator') =>
        transfers.submit(id, farm, clerk(actor)),
      confirm: (id: string) => transfers.confirm(id, farm, clerk('owner')),
      reject: (id: string) =>
        transfers.reject(id, farm, clerk('owner'), 'Kiểm tra lại số lượng'),
    },
    {
      type: 'STOCK_COUNT',
      table: 'stock_counts',
      create: async () =>
        (
          await counts.create(farm, clerk('creator'), {
            warehouseId: warehouse,
            countCode: randomUUID(),
            items: [{ itemId: item, actualQuantity: '22' }],
          })
        ).count.id,
      submit: (id: string, actor: Actor = 'creator') =>
        counts.submit(id, farm, clerk(actor)),
      confirm: (id: string) => counts.confirm(id, farm, clerk('owner')),
      reject: (id: string) =>
        counts.reject(id, farm, clerk('owner'), 'Kiểm tra lại số lượng'),
    },
  ];
  type Status = 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED';

  function signal() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  }

  async function waitFor(promise: Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error('Concurrent test did not reach its barrier')),
            5000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function oldNotification(
    actor: Actor = 'owner',
    options: {
      minutesAgo?: number;
      status?: Status;
      documentStatus?: Status | 'DRAFT';
      read?: boolean;
      farmId?: string;
      creator?: Actor;
      missing?: boolean;
      type?: string;
    } = {},
  ) {
    const status = options.status ?? 'PENDING_APPROVAL';
    const documentStatus = options.documentStatus ?? status;
    const docFarm = options.farmId ?? farm;
    const documentId = randomUUID();
    if (!options.missing)
      await db.insert(schema.stockReceipts).values({
        id: documentId,
        farmId: docFarm,
        warehouseId: docFarm === farm ? warehouse : otherWarehouse,
        receiptCode: randomUUID(),
        createdByMemberId:
          actors[options.creator ?? (docFarm === farm ? 'creator' : 'outsider')]
            .member,
        status: documentStatus,
        confirmedByMemberId:
          documentStatus === 'CONFIRMED' ? actors.owner.member : null,
        confirmedAt:
          documentStatus === 'CONFIRMED' ? new Date().toISOString() : null,
      });
    const [row] = await db
      .insert(schema.notifications)
      .values({
        userId: actors[actor].id,
        farmId: docFarm,
        entityType: 'STOCK_RECEIPT',
        entityId: documentId,
        type: options.type ?? `STOCK_RECEIPT_${status}`,
        title: tag,
        body: tag,
        createdAt: sql`now() - ${options.minutesAgo ?? 1} * interval '1 minute'`,
        readAt: options.read ? new Date().toISOString() : null,
      })
      .returning({ id: schema.notifications.id });
    return row.id;
  }

  async function jobs(deviceId?: string) {
    return (
      await pool.query<{
        id: string;
        notification_id: string;
        device_push_token_id: string;
        status: string;
        user_id: string;
        owner_id: string;
        farm_id: string;
      }>(
        `SELECT o.id, o.notification_id, o.device_push_token_id, o.status, n.user_id, d.user_id AS owner_id, n.farm_id
        FROM notification_push_outbox o JOIN notifications n ON n.id=o.notification_id
        JOIN device_push_tokens d ON d.id=o.device_push_token_id
        WHERE n.user_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR d.id=$2::uuid)`,
        [userIds, deviceId ?? null],
      )
    ).rows;
  }

  async function snapshot(document: (typeof cases)[number], id: string) {
    return (
      await pool.query<{
        status: string;
        audits: number;
        notifications: number;
        jobs: number;
        quantities: unknown;
      }>(
        `
      SELECT status,
        (SELECT count(*)::int FROM audit_logs WHERE entity_id=$1) AS audits,
        (SELECT count(*)::int FROM notifications WHERE entity_id=$1) AS notifications,
        (SELECT count(*)::int FROM notification_push_outbox o JOIN notifications n ON n.id=o.notification_id WHERE n.entity_id=$1) AS jobs,
        (SELECT jsonb_agg(jsonb_build_object('warehouse', warehouse_id, 'qty', quantity_on_hand) ORDER BY warehouse_id) FROM inventory_balances WHERE farm_id=$2) AS quantities
      FROM ${document.table} WHERE id=$1`,
        [id, farm],
      )
    ).rows[0];
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await db.transaction(async (tx) => {
      for (const code of ['ADMIN', 'FARM_OWNER', 'EMPLOYEE', 'GUEST']) {
        const inserted = await tx
          .insert(schema.roles)
          .values({ code, name: code, scope: 'FARM' })
          .onConflictDoNothing()
          .returning({ id: schema.roles.id });
        createdRoleIds.push(...inserted.map((row) => row.id));
        const [role] = await tx
          .select({ id: schema.roles.id })
          .from(schema.roles)
          .where(eq(schema.roles.code, code));
        roleIds.set(code, role.id);
      }
      await tx.insert(schema.farms).values([
        { id: farm, code: `${tag}-a`, name: tag },
        { id: otherFarm, code: `${tag}-b`, name: tag },
      ]);
      await tx.insert(schema.users).values(
        Object.entries(actors).map(([name, actor]) => ({
          id: actor.id,
          authProviderUserId: clerk(name as Actor),
          email: `${clerk(name as Actor)}@example.local`,
        })),
      );
      await tx.insert(schema.farmMembers).values(
        Object.entries(actors).map(([name, actor]) => ({
          id: actor.member,
          userId: actor.id,
          farmId: name === 'outsider' ? otherFarm : farm,
        })),
      );
      await tx.insert(schema.farmMembers).values({
        id: ownerOtherMember,
        farmId: otherFarm,
        userId: actors.owner.id,
      });
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.items).values({
        id: item,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: 'OUTBOX-TEST',
        name: tag,
        itemType: 'MATERIAL',
        trackingMode: 'QUANTITY',
      });
      await tx.insert(schema.warehouses).values([
        { id: warehouse, farmId: farm, code: 'SOURCE', name: tag },
        { id: target, farmId: farm, code: 'TARGET', name: tag },
        { id: otherWarehouse, farmId: otherFarm, code: 'OTHER', name: tag },
      ]);
    });
    fixturesCreated = true;
  });

  beforeEach(async () => {
    await pool.query(
      'DELETE FROM notifications WHERE user_id=ANY($1::uuid[])',
      [userIds],
    );
    await pool.query(
      'DELETE FROM device_push_tokens WHERE user_id=ANY($1::uuid[])',
      [userIds],
    );
    await pool.query('DELETE FROM audit_logs WHERE farm_id=ANY($1::uuid[])', [
      [farm, otherFarm],
    ]);
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farm,
    ]);
    for (const { table } of cases)
      await pool.query(`DELETE FROM ${table} WHERE farm_id=ANY($1::uuid[])`, [
        [farm, otherFarm],
      ]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: item,
        quantityOnHand: '20',
      },
      { farmId: farm, warehouseId: target, itemId: item, quantityOnHand: '0' },
    ]);
    await pool.query(
      "UPDATE users SET status='ACTIVE' WHERE id=ANY($1::uuid[])",
      [userIds],
    );
    await pool.query(
      "UPDATE farm_members SET status='ACTIVE' WHERE id=ANY($1::uuid[])",
      [[...memberIds, ownerOtherMember]],
    );
    await pool.query(
      "UPDATE farms SET status='ACTIVE' WHERE id=ANY($1::uuid[])",
      [[farm, otherFarm]],
    );
    await pool.query(
      'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
      [[...memberIds, ownerOtherMember]],
    );
    await db.insert(schema.farmMemberRoles).values([
      ...Object.values(actors).map((actor) => ({
        farmMemberId: actor.member,
        roleId: roleIds.get(actor.role)!,
      })),
      { farmMemberId: actors.owner.member, roleId: roleIds.get('ADMIN')! },
      { farmMemberId: ownerOtherMember, roleId: roleIds.get('EMPLOYEE')! },
    ]);
    await pool.query("UPDATE farm_members SET status='INACTIVE' WHERE id=$1", [
      actors.inactiveMember.member,
    ]);
    await pool.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [
      actors.inactiveUser.id,
    ]);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await pool.query(
          'DELETE FROM notifications WHERE user_id=ANY($1::uuid[])',
          [userIds],
        );
        await pool.query(
          'DELETE FROM audit_logs WHERE farm_id=ANY($1::uuid[])',
          [[farm, otherFarm]],
        );
        await pool.query(
          'DELETE FROM inventory_transactions WHERE farm_id=$1',
          [farm],
        );
        for (const { table } of cases)
          await pool.query(
            `DELETE FROM ${table} WHERE farm_id=ANY($1::uuid[])`,
            [[farm, otherFarm]],
          );
        await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
          farm,
        ]);
        await pool.query('DELETE FROM items WHERE id=$1', [item]);
        await pool.query(
          'DELETE FROM warehouses WHERE farm_id=ANY($1::uuid[])',
          [[farm, otherFarm]],
        );
        await pool.query(
          'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
          [[...memberIds, ownerOtherMember]],
        );
        await pool.query(
          'DELETE FROM farm_members WHERE user_id=ANY($1::uuid[])',
          [userIds],
        );
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
          userIds,
        ]);
        await pool.query('DELETE FROM farms WHERE id=ANY($1::uuid[])', [
          [farm, otherFarm],
        ]);
        await pool.query('DELETE FROM categories WHERE id=$1', [category]);
        await pool.query('DELETE FROM units WHERE id=$1', [unit]);
        if (createdRoleIds.length)
          await pool.query('DELETE FROM roles WHERE id=ANY($1::uuid[])', [
            createdRoleIds,
          ]);
      }
    } finally {
      await pool.end();
    }
  });

  it.each(cases)(
    '$type: submit only notifies active approvers in the same farm, once per active device',
    async (document) => {
      const ownerDevice = (await register('owner')).data;
      await register('owner');
      await register('admin');
      for (const actor of [
        'creator',
        'peer',
        'guest',
        'outsider',
        'inactiveMember',
      ] as const)
        await register(actor);
      await db.insert(schema.devicePushTokens).values({
        userId: actors.inactiveUser.id,
        installationId: randomUUID(),
        expoPushToken: token(),
        platform: 'ANDROID',
      });
      const inactive = (await register('owner')).data;
      await devices.unregister(clerk('owner'), inactive.installationId);
      const id = await document.create();
      await document.submit(id);
      const notices = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.entityId, id));
      expect(notices.map((row) => row.userId).sort()).toEqual(
        [actors.owner.id, actors.admin.id].sort(),
      );
      const deliveries = await jobs();
      expect(deliveries).toHaveLength(3);
      expect(
        deliveries.every(
          (row) =>
            row.status === 'PENDING' &&
            row.user_id === row.owner_id &&
            row.farm_id === farm,
        ),
      ).toBe(true);
      expect(
        deliveries.some((row) => row.device_push_token_id === ownerDevice.id),
      ).toBe(true);
      await expect(document.submit(id)).rejects.toThrow();
      expect(await jobs()).toHaveLength(3);
    },
  );

  it('excludes the submitting approver without changing the actual creator mapping', async () => {
    await register('owner');
    await register('admin');
    const id = await cases[0].create();
    await cases[0].submit(id, 'owner');
    expect((await jobs()).map((row) => row.user_id)).toEqual([actors.admin.id]);
  });

  it.each(cases)(
    '$type: confirmation queues its result only to the creator',
    async (document) => {
      await register('owner');
      await register('creator');
      await register('peer');
      const id = await document.create();
      await document.submit(id);
      await document.confirm(id);
      const result = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.entityId, id),
            eq(schema.notifications.type, `${document.type}_CONFIRMED`),
          ),
        );
      expect(result.map((row) => row.userId)).toEqual([actors.creator.id]);
      expect(
        (await jobs()).filter((row) => row.notification_id === result[0].id),
      ).toHaveLength(1);
    },
  );

  it.each(cases)(
    '$type: rejection includes the reason and leaves inventory unchanged',
    async (document) => {
      await register('creator');
      const id = await document.create();
      await document.submit(id);
      const before = await snapshot(document, id);
      await document.reject(id);
      const result = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.entityId, id),
            eq(schema.notifications.type, `${document.type}_REJECTED`),
          ),
        );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: actors.creator.id,
        data: { rejectionReason: 'Kiểm tra lại số lượng' },
      });
      expect((await snapshot(document, id)).quantities).toEqual(
        before.quantities,
      );
      expect(await jobs()).toHaveLength(1);
    },
  );

  it.each(cases)(
    '$type: an outbox failure rolls back confirmation, inventory, notification and audit together',
    async (document) => {
      await register('creator');
      const id = await document.create();
      await document.submit(id);
      const before = await snapshot(document, id);
      const enqueue = outbox.enqueueDocumentPushes;
      jest
        .spyOn(outbox, 'enqueueDocumentPushes')
        .mockImplementationOnce(async (...args) => {
          await enqueue(...args);
          throw new Error('outbox test failure after insert');
        });
      await expect(document.confirm(id)).rejects.toThrow('outbox test failure');
      expect(await snapshot(document, id)).toEqual(before);
    },
  );

  it('rolls back submission if adding its push job fails, and does not duplicate an idempotent receipt confirmation', async () => {
    await register('owner');
    await register('creator');
    const id = await cases[0].create();
    const before = await snapshot(cases[0], id);
    const enqueue = outbox.enqueueDocumentPushes;
    jest
      .spyOn(outbox, 'enqueueDocumentPushes')
      .mockImplementationOnce(async (...args) => {
        await enqueue(...args);
        throw new Error('outbox failed');
      });
    await expect(cases[0].submit(id)).rejects.toThrow('outbox failed');
    expect(await snapshot(cases[0], id)).toEqual(before);
    await cases[0].submit(id);
    await cases[0].confirm(id);
    const confirmed = await snapshot(cases[0], id);
    await cases[0].confirm(id);
    expect(await snapshot(cases[0], id)).toEqual(confirmed);
  });

  it('queues only the newest five unread eligible notifications per new device and does not drain older backlog on refresh', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 8; i++)
      ids.push(await oldNotification('owner', { minutesAgo: i }));
    await oldNotification('owner', { minutesAgo: 0.1, read: true });
    await oldNotification('owner', { minutesAgo: 1441 });
    await oldNotification('owner', { minutesAgo: -5 });
    const installation = randomUUID(),
      expoToken = token();
    const first = (await register('owner', installation, expoToken)).data;
    expect(
      (await jobs(first.id)).map((row) => row.notification_id).sort(),
    ).toEqual(ids.slice(0, 5).sort());
    await register('owner', installation, expoToken);
    expect(await jobs(first.id)).toHaveLength(5);
    const second = (await register('owner')).data;
    expect(
      (await jobs(second.id)).map((row) => row.notification_id).sort(),
    ).toEqual(ids.slice(0, 5).sort());
    expect(
      (
        await db
          .select({ readAt: schema.notifications.readAt })
          .from(schema.notifications)
          .where(inArray(schema.notifications.id, ids))
      ).every((row) => row.readAt === null),
    ).toBe(true);
  });

  it('skips missing, stale, unsupported and cross-farm approval records before applying the limit', async () => {
    await oldNotification('owner', { missing: true });
    await oldNotification('owner', { documentStatus: 'DRAFT' });
    await oldNotification('owner', { documentStatus: 'CONFIRMED' });
    await oldNotification('owner', { type: 'UNSUPPORTED_TEST' });
    await oldNotification('owner', { farmId: otherFarm }); // EMPLOYEE in this farm
    await oldNotification('owner', { status: 'CONFIRMED' }); // not the creator
    await oldNotification('owner', { status: 'REJECTED' }); // not the creator
    const valid = await oldNotification('owner', { minutesAgo: 10 });
    const device = (await register('owner')).data;
    expect((await jobs(device.id)).map((row) => row.notification_id)).toEqual([
      valid,
    ]);
  });

  it.each(['role', 'member', 'farm'] as const)(
    'does not backfill after losing current %s authorization',
    async (change) => {
      await oldNotification();
      if (change === 'role')
        await db
          .delete(schema.farmMemberRoles)
          .where(eq(schema.farmMemberRoles.farmMemberId, actors.owner.member));
      if (change === 'member')
        await db
          .update(schema.farmMembers)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.farmMembers.id, actors.owner.member));
      if (change === 'farm')
        await db
          .update(schema.farms)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.farms.id, farm));
      await register('owner');
      expect(await jobs()).toHaveLength(0);
    },
  );

  it('backfills confirmed/rejected results for the actual creator even without an approver role', async () => {
    const confirmed = await oldNotification('creator', { status: 'CONFIRMED' });
    const rejected = await oldNotification('creator', { status: 'REJECTED' });
    await oldNotification('creator'); // EMPLOYEE cannot approve
    const device = (await register('creator')).data;
    expect(
      (await jobs(device.id)).map((row) => row.notification_id).sort(),
    ).toEqual([confirmed, rejected].sort());
  });

  it('keeps terminal jobs terminal and cancels unfinished jobs when a device returns', async () => {
    const device = (await register('owner')).data;
    const statuses = [
      'CANCELLED',
      'SUCCEEDED',
      'FAILED',
      'PROCESSING',
      'AWAITING_RECEIPT',
    ] as const;
    for (const status of statuses) {
      const notificationId = await oldNotification();
      await db.insert(schema.notificationPushOutbox).values({
        notificationId,
        devicePushTokenId: device.id,
        status,
        lockedAt: status === 'PROCESSING' ? new Date().toISOString() : null,
        lockId: status === 'PROCESSING' ? randomUUID() : null,
        expoTicketId:
          status === 'SUCCEEDED' || status === 'AWAITING_RECEIPT'
            ? randomUUID()
            : null,
      });
    }
    await devices.unregister(clerk('owner'), device.installationId);
    await register('owner', device.installationId);
    const results = await jobs(device.id);
    expect(results).toHaveLength(5);
    expect(results.map((row) => row.status).sort()).toEqual([
      'CANCELLED',
      'CANCELLED',
      'CANCELLED',
      'FAILED',
      'SUCCEEDED',
    ]);
  });

  it('rebinds only this device, cancels the old owner jobs and catches up only the new owner', async () => {
    const ownerNotice = await oldNotification();
    const a = (await register('owner')).data;
    const aOther = (await register('owner')).data;
    const creatorNotice = await oldNotification('creator', {
      status: 'CONFIRMED',
    });
    const b = (await register('creator', a.installationId)).data;
    expect(b.id).toBe(a.id);
    expect(
      (await jobs(a.id))
        .map((row) => ({ id: row.notification_id, status: row.status }))
        .sort((x, y) => x.id.localeCompare(y.id)),
    ).toEqual(
      [
        { id: ownerNotice, status: 'CANCELLED' },
        { id: creatorNotice, status: 'PENDING' },
      ].sort((x, y) => x.id.localeCompare(y.id)),
    );
    expect((await jobs(aOther.id))[0].status).toBe('PENDING');
    await expect(
      devices.unregister(clerk('owner'), a.installationId),
    ).rejects.toThrow('not found');
  });

  it('rolls back a rebind and its cancellations if catch-up fails after writing jobs', async () => {
    await oldNotification();
    const a = (await register('owner')).data;
    await oldNotification('creator', { status: 'CONFIRMED' });
    const catchUp = outbox.enqueueDeviceCatchUp;
    jest
      .spyOn(outbox, 'enqueueDeviceCatchUp')
      .mockImplementationOnce(async (...args) => {
        await catchUp(...args);
        throw new Error('catch-up failed');
      });
    await expect(register('creator', a.installationId)).rejects.toThrow(
      'catch-up failed',
    );
    expect(
      (await devices.get(clerk('owner'), a.installationId)).data.userId,
    ).toBe(actors.owner.id);
    expect((await jobs(a.id)).map((row) => row.status)).toEqual(['PENDING']);
  });

  it('does not lose or duplicate a submit when registration holds the user lock first', async () => {
    const id = await cases[0].create();
    const reached = signal(),
      release = signal(),
      eventReached = signal();
    const catchUp = outbox.enqueueDeviceCatchUp;
    const enqueue = outbox.enqueueDocumentPushes;
    jest
      .spyOn(outbox, 'enqueueDeviceCatchUp')
      .mockImplementationOnce(async (...args) => {
        const result = await catchUp(...args);
        reached.release();
        await release.promise;
        return result;
      });
    jest
      .spyOn(outbox, 'enqueueDocumentPushes')
      .mockImplementationOnce((...args) => {
        eventReached.release();
        return enqueue(...args);
      });
    const registration = register('owner');
    let submission: ReturnType<(typeof cases)[0]['submit']> | undefined;
    try {
      await waitFor(reached.promise);
      submission = cases[0].submit(id);
      await waitFor(eventReached.promise);
    } finally {
      release.release();
    }
    const device = (await registration).data;
    await submission;
    expect(await jobs(device.id)).toHaveLength(1);
    expect((await jobs(device.id))[0]).toMatchObject({
      user_id: actors.owner.id,
      status: 'PENDING',
    });
  });

  it('does not lose an event committed while registration waits, even if the registration transaction started earlier', async () => {
    const id = await cases[0].create();
    const reached = signal(),
      release = signal(),
      registrationReached = signal();
    const enqueue = outbox.enqueueDocumentPushes;
    const lock = outbox.lockPushUsers;
    let isSubmitting = false;
    jest.spyOn(outbox, 'lockPushUsers').mockImplementation(async (...args) => {
      if (!isSubmitting) registrationReached.release();
      return lock(...args);
    });
    jest
      .spyOn(outbox, 'enqueueDocumentPushes')
      .mockImplementationOnce(async (...args) => {
        const result = await enqueue(...args);
        reached.release();
        await release.promise;
        return result;
      });
    // Start the registering transaction first but delay it before obtaining the
    // user's advisory lock. Force the event's timestamp to be newer than now().
    const transactionEntered = signal(),
      beginRegistration = signal();
    const registerDb = {
      ...database,
      db: new Proxy(db, {
        get(targetDb, property, receiver) {
          if (property === 'transaction')
            return <T>(operation: (tx: Transaction) => Promise<T>) =>
              db.transaction(async (tx) => {
                await tx.execute(sql`SELECT now()`);
                transactionEntered.release();
                await beginRegistration.promise;
                return operation(tx);
              });
          return Reflect.get(targetDb, property, receiver) as unknown;
        },
      }),
    } as unknown as DatabaseService;
    const service = new NotificationDevicesService(registerDb);
    const registration = service.register(clerk('owner'), randomUUID(), {
      expoPushToken: token(),
      platform: 'ANDROID',
    });
    let submission: ReturnType<(typeof cases)[0]['submit']> | undefined;
    try {
      await waitFor(transactionEntered.promise);
      isSubmitting = true;
      submission = cases[0].submit(id);
      await waitFor(reached.promise);
      isSubmitting = false;
      beginRegistration.release();
      await waitFor(registrationReached.promise);
    } finally {
      beginRegistration.release();
      release.release();
    }
    await submission;
    const device = (await registration).data;
    expect(await jobs(device.id)).toHaveLength(1);
  });
});

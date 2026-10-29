import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';
import { MaintenanceRequestsService } from '../src/modules/maintenance/maintenance-requests.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

// Employees request maintenance for an asset; approvers schedule it or reject it.
describe('Maintenance requests', () => {
  jest.setTimeout(30_000);
  const tag = `maint-req-${randomUUID().slice(0, 12)}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const authorization = new WarehousesService(database);
  const maintenance = new MaintenanceService(database, authorization);
  const requests = new MaintenanceRequestsService(
    database,
    authorization,
    maintenance,
  );
  const auditLogs = new AuditLogsService(database, authorization);
  const farm = randomUUID();
  const category = randomUUID(),
    unit = randomUUID(),
    item = randomUUID();
  const asset = randomUUID(),
    lostAsset = randomUUID();
  const actors = {
    owner: { id: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    creator: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    peer: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    guest: { id: randomUUID(), member: randomUUID(), role: 'GUEST' },
  };
  type Actor = keyof typeof actors;
  const userIds = Object.values(actors).map((actor) => actor.id);
  const memberIds = Object.values(actors).map((actor) => actor.member);
  const clerk = (actor: Actor) => `${tag}-${actor}`;
  const page = { page: 1, pageSize: 20, offset: 0 };
  let fixturesCreated = false;

  const create = (actor: Actor, assetId = asset) =>
    requests.create(farm, clerk(actor), {
      assetId,
      maintenanceType: 'CORRECTIVE',
      description: '  Máy bơm kêu to  ',
    });
  const notificationsFor = async (userId: string) =>
    (
      await pool.query<{ type: string; title: string; body: string }>(
        'SELECT type, title, body FROM notifications WHERE farm_id=$1 AND user_id=$2',
        [farm, userId],
      )
    ).rows;

  const cleanRequests = async () => {
    await pool.query('DELETE FROM notifications WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM maintenance_requests WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM maintenance_records WHERE farm_id=$1', [
      farm,
    ]);
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    fixturesCreated = true;
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values(
        Object.entries(actors).map(([name, actor]) => ({
          id: actor.id,
          authProviderUserId: clerk(name as Actor),
          email: `${clerk(name as Actor)}@example.local`,
        })),
      );
      await tx.insert(schema.farmMembers).values(
        Object.values(actors).map((actor) => ({
          id: actor.member,
          userId: actor.id,
          farmId: farm,
        })),
      );
      for (const actor of Object.values(actors)) {
        await tx
          .insert(schema.roles)
          .values({ code: actor.role, name: actor.role, scope: 'FARM' })
          .onConflictDoNothing();
        const [role] = await tx
          .select({ id: schema.roles.id })
          .from(schema.roles)
          .where(eq(schema.roles.code, actor.role));
        await tx
          .insert(schema.farmMemberRoles)
          .values({ farmMemberId: actor.member, roleId: role.id });
      }
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.items).values({
        id: item,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: tag,
        name: tag,
        itemType: 'EQUIPMENT',
        trackingMode: 'ASSET',
      });
      await tx.insert(schema.devicePushTokens).values({
        userId: actors.owner.id,
        installationId: randomUUID(),
        expoPushToken: `ExponentPushToken[${tag}]`,
        platform: 'ANDROID',
      });
      await tx.insert(schema.assets).values([
        { id: asset, farmId: farm, itemId: item, assetCode: `${tag}-A` },
        {
          id: lostAsset,
          farmId: farm,
          itemId: item,
          assetCode: `${tag}-LOST`,
          status: 'LOST',
        },
      ]);
    });
  });

  beforeEach(cleanRequests);

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await cleanRequests();
        await pool.query('DELETE FROM assets WHERE farm_id=$1', [farm]);
        await pool.query(
          'DELETE FROM device_push_tokens WHERE user_id=ANY($1::uuid[])',
          [userIds],
        );
        await pool.query('DELETE FROM items WHERE id=$1', [item]);
        await pool.query('DELETE FROM categories WHERE id=$1', [category]);
        await pool.query('DELETE FROM units WHERE id=$1', [unit]);
        await pool.query(
          'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM farm_members WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
          userIds,
        ]);
        await pool.query('DELETE FROM farms WHERE id=$1', [farm]);
      }
    } finally {
      await pool.end();
    }
  });

  it('lets only employees request maintenance and notifies approvers with a push', async () => {
    await expect(create('owner')).rejects.toThrow(
      'Only farm employees can request maintenance',
    );
    await expect(create('guest')).rejects.toThrow(
      'Only farm employees can request maintenance',
    );
    const request = await create('creator');
    expect(request).toMatchObject({
      status: 'PENDING_APPROVAL',
      description: 'Máy bơm kêu to',
      requestedByMemberId: actors.creator.member,
    });
    expect(await notificationsFor(actors.owner.id)).toEqual([
      {
        type: 'MAINTENANCE_REQUEST_PENDING_APPROVAL',
        title: 'Yêu cầu bảo trì cần duyệt',
        body: `Yêu cầu bảo trì tài sản ${tag}-A đang chờ duyệt.`,
      },
    ]);
    expect(await notificationsFor(actors.peer.id)).toEqual([]);
    const outbox = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM notification_push_outbox o JOIN notifications n ON n.id=o.notification_id WHERE n.farm_id=$1',
      [farm],
    );
    expect(outbox.rows[0].count).toBe(1);
  });

  it('rejects ineligible assets and a second pending request for the same asset', async () => {
    await expect(create('creator', lostAsset)).rejects.toThrow(
      'Asset is not eligible for a maintenance request',
    );
    await expect(create('creator', randomUUID())).rejects.toThrow(
      'Asset not found',
    );
    await create('creator');
    await expect(create('peer')).rejects.toThrow(
      'This asset already has a pending maintenance request',
    );
  });

  it('refuses a request while the asset already has scheduled maintenance', async () => {
    await maintenance.create(farm, clerk('owner'), {
      assetId: asset,
      maintenanceType: 'PREVENTIVE',
    });
    await expect(create('creator')).rejects.toThrow(
      'Asset already has an active maintenance record',
    );
  });

  it('schedules maintenance on approval and tells the requester', async () => {
    const request = await create('creator');
    await expect(
      requests.approve(
        request.id,
        farm,
        clerk('creator'),
        '2026-11-02T09:00:00Z',
      ),
    ).rejects.toThrow('Warehouse write permission is required');
    const result = await requests.approve(
      request.id,
      farm,
      clerk('owner'),
      '2026-11-02T09:00:00Z',
    );
    expect(result.request).toMatchObject({
      status: 'CONFIRMED',
      reviewedByMemberId: actors.owner.member,
      maintenanceRecordId: result.maintenanceRecord.id,
    });
    expect(result.maintenanceRecord).toMatchObject({
      status: 'SCHEDULED',
      assetId: asset,
      maintenanceType: 'CORRECTIVE',
    });
    expect(await notificationsFor(actors.creator.id)).toEqual([
      expect.objectContaining({
        type: 'MAINTENANCE_REQUEST_CONFIRMED',
        title: 'Yêu cầu bảo trì đã được duyệt',
      }),
    ]);
    await expect(
      requests.reject(request.id, farm, clerk('owner'), 'Đã duyệt rồi'),
    ).rejects.toThrow(
      'Only PENDING_APPROVAL maintenance requests can be reviewed',
    );
    const detail = await requests.get(request.id, farm, clerk('creator'));
    expect(detail).toMatchObject({
      assetCode: `${tag}-A`,
      maintenanceRecordStatus: 'SCHEDULED',
      requestedByEmail: `${clerk('creator')}@example.local`,
      reviewedByEmail: `${clerk('owner')}@example.local`,
    });
  });

  it('approving while another request is created for the same asset neither deadlocks nor duplicates', async () => {
    for (let round = 0; round < 10; round += 1) {
      await cleanRequests();
      const pending = await create('creator');
      const [approved, duplicate] = await Promise.allSettled([
        requests.approve(
          pending.id,
          farm,
          clerk('owner'),
          '2026-11-02T09:00:00Z',
        ),
        create('peer'),
      ]);
      expect(approved.status).toBe('fulfilled');
      expect(duplicate.status).toBe('rejected');
      // 409 either for the pending request or for the maintenance just scheduled; never a deadlock (500).
      expect(
        ((duplicate as PromiseRejectedResult).reason as { status?: number })
          .status,
      ).toBe(409);
    }
  });

  it('rejects with a reason and records the history the requester can read', async () => {
    const request = await create('creator');
    await expect(
      requests.reject(request.id, farm, clerk('owner'), '  ab '),
    ).rejects.toThrow('Rejection reason must have at least 3 characters');
    await requests.reject(request.id, farm, clerk('owner'), 'Không cần sửa');
    expect(await notificationsFor(actors.creator.id)).toEqual([
      expect.objectContaining({
        type: 'MAINTENANCE_REQUEST_REJECTED',
        body: `Yêu cầu bảo trì tài sản ${tag}-A bị từ chối: Không cần sửa`,
      }),
    ]);
    const history = await auditLogs.list({
      farmId: farm,
      clerkUserId: clerk('creator'),
      entityType: 'MAINTENANCE_REQUEST',
      entityId: request.id,
      ...page,
    });
    expect(history.data.map((log) => log.action).sort()).toEqual([
      'CREATE',
      'REJECT',
    ]);
    const peerHistory = await auditLogs.list({
      farmId: farm,
      clerkUserId: clerk('peer'),
      entityType: 'MAINTENANCE_REQUEST',
      ...page,
    });
    expect(peerHistory.data).toEqual([]);
  });

  it('shows employees only their own requests and approvers all of them', async () => {
    const mine = await create('creator');
    await expect(requests.get(mine.id, farm, clerk('peer'))).rejects.toThrow(
      'Maintenance request not found',
    );
    const own = await requests.list({
      farmId: farm,
      clerkUserId: clerk('peer'),
      ...page,
    });
    expect(own.data).toEqual([]);
    const all = await requests.list({
      farmId: farm,
      clerkUserId: clerk('owner'),
      status: 'PENDING_APPROVAL',
      ...page,
    });
    expect(all.data).toEqual([
      expect.objectContaining({ id: mine.id, assetCode: `${tag}-A` }),
    ]);
  });
});

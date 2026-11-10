import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';
import {
  AssetLifecycleService,
  TRANSFER_PENDING_CONFLICT,
} from '../src/modules/assets/asset-lifecycle.service';
import { AssetTransferRequestsService } from '../src/modules/assets/asset-transfer-requests.service';
import { MaintenanceRequestsService } from '../src/modules/maintenance/maintenance-requests.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

// Employees ask to move an asset; it stays TRANSFER_PENDING until an approver
// runs the transfer or rejects the request.
describe('Asset transfer requests', () => {
  jest.setTimeout(30_000);
  const tag = `asset-xfer-${randomUUID().slice(0, 12)}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const authorization = new WarehousesService(database);
  const lifecycle = new AssetLifecycleService(database, authorization);
  const requests = new AssetTransferRequestsService(
    database,
    authorization,
    lifecycle,
  );
  const maintenance = new MaintenanceService(database, authorization);
  const maintenanceRequests = new MaintenanceRequestsService(
    database,
    authorization,
    maintenance,
  );
  const auditLogs = new AuditLogsService(database, authorization);
  const farm = randomUUID();
  const category = randomUUID(),
    unit = randomUUID(),
    item = randomUUID(),
    asset = randomUUID();
  const source = randomUUID(),
    target = randomUUID();
  const sourceShelf = randomUUID(),
    targetShelf = randomUUID();
  const actors = {
    owner: { id: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    creator: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    peer: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    guest: { id: randomUUID(), member: randomUUID(), role: 'GUEST' },
    manager: {
      id: randomUUID(),
      member: randomUUID(),
      role: 'WAREHOUSE_MANAGER',
    },
  };
  type Actor = keyof typeof actors;
  const userIds = Object.values(actors).map((actor) => actor.id);
  const memberIds = Object.values(actors).map((actor) => actor.member);
  const clerk = (actor: Actor) => `${tag}-${actor}`;
  const page = { page: 1, pageSize: 20, offset: 0 };
  const toTarget = { warehouseId: target, locationId: targetShelf };
  let fixturesCreated = false;

  const create = (actor: Actor, destination = toTarget) =>
    requests.create(farm, clerk(actor), { assetId: asset, ...destination });
  const assetRow = async () =>
    (
      await pool.query<{ status: string; current_location_id: string }>(
        'SELECT status, current_location_id FROM assets WHERE id=$1',
        [asset],
      )
    ).rows[0];
  const quantity = async (warehouseId: string) =>
    (
      await pool.query<{ quantity: string }>(
        'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2',
        [warehouseId, item],
      )
    ).rows[0]?.quantity;
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
    await pool.query('DELETE FROM asset_transfer_requests WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM maintenance_requests WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM maintenance_records WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM asset_incidents WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
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
      await tx.insert(schema.devicePushTokens).values({
        userId: actors.owner.id,
        installationId: randomUUID(),
        expoPushToken: `ExponentPushToken[${tag}]`,
        platform: 'ANDROID',
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
        code: tag,
        name: tag,
        itemType: 'EQUIPMENT',
        trackingMode: 'ASSET',
      });
      await tx.insert(schema.warehouses).values([
        { id: source, farmId: farm, code: 'SOURCE', name: tag },
        { id: target, farmId: farm, code: 'TARGET', name: tag },
      ]);
      // Employees work in both warehouses.
      await tx.insert(schema.farmMemberWarehouses).values(
        [actors.creator, actors.peer, actors.manager].flatMap((actor) =>
          [source, target].map((warehouseId) => ({
            farmMemberId: actor.member,
            warehouseId,
          })),
        ),
      );
      await tx.insert(schema.locations).values([
        {
          id: sourceShelf,
          farmId: farm,
          warehouseId: source,
          code: 'S-1',
          name: 'Kệ nguồn',
          type: 'WAREHOUSE_ZONE',
        },
        {
          id: targetShelf,
          farmId: farm,
          warehouseId: target,
          code: 'T-1',
          name: 'Kệ đích',
          type: 'WAREHOUSE_ZONE',
        },
      ]);
      await tx.insert(schema.assets).values({
        id: asset,
        farmId: farm,
        itemId: item,
        assetCode: `${tag}-A`,
        currentLocationId: sourceShelf,
      });
    });
  });

  beforeEach(async () => {
    await cleanRequests();
    await pool.query(
      "UPDATE assets SET status='AVAILABLE', current_location_id=$2 WHERE id=$1",
      [asset, sourceShelf],
    );
    await db.insert(schema.inventoryBalances).values({
      farmId: farm,
      warehouseId: source,
      itemId: item,
      quantityOnHand: '1',
    });
  });

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await cleanRequests();
        await pool.query('DELETE FROM assets WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM locations WHERE farm_id=$1', [farm]);
        await pool.query(
          'DELETE FROM farm_member_warehouses WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM warehouses WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM items WHERE id=$1', [item]);
        await pool.query('DELETE FROM categories WHERE id=$1', [category]);
        await pool.query('DELETE FROM units WHERE id=$1', [unit]);
        await pool.query(
          'DELETE FROM device_push_tokens WHERE user_id=ANY($1::uuid[])',
          [userIds],
        );
        await pool.query(
          'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM farm_members WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
          userIds,
        ]);
        await pool.query(
          'DELETE FROM stock_document_counters WHERE farm_id=$1',
          [farm],
        );
        await pool.query('DELETE FROM farms WHERE id=$1', [farm]);
      }
    } finally {
      await pool.end();
    }
  });

  it('lets only employees request, marks the asset busy and notifies approvers with a push', async () => {
    await expect(create('owner')).rejects.toThrow(
      'Only farm employees can request an asset transfer',
    );
    await expect(create('guest')).rejects.toThrow(
      'Only farm employees can request an asset transfer',
    );
    const request = await create('creator');
    expect(request).toMatchObject({
      status: 'PENDING_APPROVAL',
      fromLocationId: sourceShelf,
      toLocationId: targetShelf,
    });
    expect((await assetRow()).status).toBe('TRANSFER_PENDING');
    expect(await notificationsFor(actors.owner.id)).toEqual([
      {
        type: 'ASSET_TRANSFER_REQUEST_PENDING_APPROVAL',
        title: 'Yêu cầu chuyển tài sản cần duyệt',
        body: `Yêu cầu chuyển tài sản ${tag}-A đang chờ duyệt.`,
      },
    ]);
    const outbox = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM notification_push_outbox o JOIN notifications n ON n.id=o.notification_id WHERE n.farm_id=$1',
      [farm],
    );
    expect(outbox.rows[0].count).toBe(1);
  });

  it('blocks other actions on the asset while the request is pending', async () => {
    await create('creator');
    await expect(create('peer')).rejects.toThrow(
      'Only AVAILABLE assets can be requested for transfer',
    );
    await expect(
      lifecycle.transfer(asset, farm, clerk('owner'), toTarget),
    ).rejects.toThrow('Only AVAILABLE assets can be transferred');
    await expect(
      lifecycle.reportIncident(asset, farm, clerk('owner'), {
        incidentType: 'LOSS',
        description: 'Mất',
        severity: 'HIGH',
      }),
    ).rejects.toThrow(TRANSFER_PENDING_CONFLICT);
    await expect(
      maintenance.create(farm, clerk('owner'), {
        assetId: asset,
        maintenanceType: 'INSPECTION',
      }),
    ).rejects.toThrow(TRANSFER_PENDING_CONFLICT);
    await expect(
      maintenanceRequests.create(farm, clerk('creator'), {
        assetId: asset,
        maintenanceType: 'CORRECTIVE',
        description: 'Kêu to',
      }),
    ).rejects.toThrow('Asset is not eligible for a maintenance request');
  });

  it('makes a concurrent maintenance request wait for the asset and see TRANSFER_PENDING', async () => {
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM assets WHERE id=$1 FOR UPDATE', [
        asset,
      ]);
      const outcome = maintenanceRequests
        .create(farm, clerk('creator'), {
          assetId: asset,
          maintenanceType: 'CORRECTIVE',
          description: 'Kêu to',
        })
        .then(
          () => 'created',
          (error: Error) => error.message,
        );
      // Stands in for a transfer request committing while the maintenance request runs.
      await new Promise((resolve) => setTimeout(resolve, 300));
      await blocker.query(
        "UPDATE assets SET status='TRANSFER_PENDING' WHERE id=$1",
        [asset],
      );
      await blocker.query('COMMIT');
      expect(await outcome).toBe(
        'Asset is not eligible for a maintenance request',
      );
    } finally {
      blocker.release();
    }
  });

  it('never leaves both a maintenance and a transfer request pending when they race', async () => {
    for (let round = 0; round < 10; round += 1) {
      await cleanRequests();
      await pool.query(
        "UPDATE assets SET status='AVAILABLE', current_location_id=$2 WHERE id=$1",
        [asset, sourceShelf],
      );
      await db.insert(schema.inventoryBalances).values({
        farmId: farm,
        warehouseId: source,
        itemId: item,
        quantityOnHand: '1',
      });
      const results = await Promise.allSettled([
        create('creator'),
        maintenanceRequests.create(farm, clerk('peer'), {
          assetId: asset,
          maintenanceType: 'CORRECTIVE',
          description: 'Kêu to',
        }),
      ]);
      const created = results.filter((result) => result.status === 'fulfilled');
      expect(created).toHaveLength(1);
      for (const result of results)
        if (result.status === 'rejected')
          expect((result.reason as { status?: number }).status).toBe(409);
    }
  });

  it('rejects invalid destinations without marking the asset', async () => {
    await expect(
      create('creator', { warehouseId: source, locationId: targetShelf }),
    ).rejects.toThrow('Receiving location must be ACTIVE');
    await expect(
      create('creator', { warehouseId: source, locationId: sourceShelf }),
    ).rejects.toThrow('Asset is already at this location');
    expect((await assetRow()).status).toBe('AVAILABLE');
  });

  it('dispatches on approval, waits for the destination, then receives once (P1-02)', async () => {
    const request = await create('creator');
    await expect(
      requests.approve(request.id, farm, clerk('creator')),
    ).rejects.toThrow('Warehouse write permission is required');
    const result = await requests.approve(request.id, farm, clerk('owner'));
    expect(result.request).toMatchObject({
      status: 'IN_TRANSIT',
      reviewedByMemberId: actors.owner.member,
    });
    // Source debited; the destination is not credited and the asset is not usable yet.
    expect(await assetRow()).toEqual({
      status: 'TRANSFER_PENDING',
      current_location_id: null,
    });
    expect(await quantity(source)).toBe('0.000');
    expect(Number((await quantity(target)) ?? 0)).toBe(0);
    expect(await notificationsFor(actors.creator.id)).toEqual([
      expect.objectContaining({
        type: 'ASSET_TRANSFER_REQUEST_IN_TRANSIT',
        title: 'Yêu cầu chuyển tài sản đã duyệt, tài sản đang chuyển',
      }),
    ]);
    await expect(
      requests.reject(request.id, farm, clerk('owner'), 'Đã duyệt'),
    ).rejects.toThrow(
      'Only PENDING_APPROVAL transfer requests can be reviewed',
    );
    await expect(
      lifecycle.transfer(asset, farm, clerk('owner'), {
        warehouseId: source,
        locationId: sourceShelf,
      }),
    ).rejects.toThrow('Only AVAILABLE assets can be transferred');

    const receive = (
      actor: Actor,
      body: { assetCode: string; condition: 'GOOD' | 'DAMAGED'; note?: string },
    ) => requests.receive(request.id, farm, clerk(actor), body);
    await expect(
      receive('creator', { assetCode: `${tag}-A`, condition: 'GOOD' }),
    ).rejects.toThrow('Warehouse write permission is required');
    await expect(
      receive('owner', { assetCode: `${tag}-B`, condition: 'GOOD' }),
    ).rejects.toThrow('ASSET_MISMATCH');
    await expect(
      receive('owner', { assetCode: `${tag}-A`, condition: 'DAMAGED' }),
    ).rejects.toThrow('note is required');
    expect(Number((await quantity(target)) ?? 0)).toBe(0);

    const received = await receive('owner', {
      assetCode: ` ${tag}-a `,
      condition: 'DAMAGED',
      note: 'Móp vỏ khi vận chuyển',
    });
    // A2: a damaged arrival is recorded but stays open for the owner.
    expect(received.request).toMatchObject({
      status: 'DISCREPANCY',
      receivedByMemberId: actors.owner.member,
      receivedCondition: 'DAMAGED',
      receiveNote: 'Móp vỏ khi vận chuyển',
      resolvedAt: null,
    });
    // Damaged on arrival: in the destination stock, out of use.
    expect(await assetRow()).toEqual({
      status: 'DAMAGED',
      current_location_id: targetShelf,
    });
    expect(await quantity(target)).toBe('1.000');
    await expect(
      receive('owner', { assetCode: `${tag}-A`, condition: 'GOOD' }),
    ).rejects.toThrow('Only IN_TRANSIT');
    expect(await quantity(source)).toBe('0.000');
    expect(await quantity(target)).toBe('1.000');
    expect(
      (await notificationsFor(actors.creator.id)).map((n) => n.type),
    ).toContain('ASSET_TRANSFER_REQUEST_DISCREPANCY');
    expect(
      (await notificationsFor(actors.manager.id)).map((n) => n.title),
    ).toContain('Tài sản điều chuyển đến bị hỏng, cần xử lý');

    // Only the owner/admin settles it, with a note; no stock or asset change, once.
    await expect(
      requests.resolve(request.id, farm, clerk('manager'), 'Đã gửi sửa'),
    ).rejects.toThrow();
    await expect(
      requests.resolve(request.id, farm, clerk('owner'), '  '),
    ).rejects.toThrow('A resolution needs a note');
    const resolved = await requests.resolve(
      request.id,
      farm,
      clerk('owner'),
      'Đã lập yêu cầu bảo trì',
    );
    expect(resolved).toMatchObject({
      status: 'CONFIRMED',
      resolvedByMemberId: actors.owner.member,
      resolutionNote: 'Đã lập yêu cầu bảo trì',
    });
    const retried = await requests.resolve(
      request.id,
      farm,
      clerk('owner'),
      'Lần hai',
    );
    expect(retried.resolutionNote).toBe('Đã lập yêu cầu bảo trì');
    expect(
      (await notificationsFor(actors.creator.id)).map((n) => n.title),
    ).toContain('Sai lệch điều chuyển tài sản đã được xử lý');
    expect(await assetRow()).toEqual({
      status: 'DAMAGED',
      current_location_id: targetShelf,
    });
    expect(await quantity(target)).toBe('1.000');
    // A discrepancy needs a damaged receipt behind it.
    await expect(
      pool.query(
        "UPDATE asset_transfer_requests SET status='DISCREPANCY', resolved_at=NULL, resolved_by_member_id=NULL, resolution_note=NULL, received_at=NULL, received_by_member_id=NULL, received_condition=NULL, receive_note=NULL WHERE id=$1",
        [request.id],
      ),
    ).rejects.toThrow('ck_asset_transfer_discrepancy');
    // The database refuses a receipt without its condition.
    await expect(
      pool.query(
        'UPDATE asset_transfer_requests SET received_condition=NULL WHERE id=$1',
        [request.id],
      ),
    ).rejects.toThrow('ck_asset_transfer_received');
  });

  it('frees the asset on rejection and separates each actor’s audit history', async () => {
    const request = await create('creator');
    await expect(
      requests.reject(request.id, farm, clerk('owner'), ' ab '),
    ).rejects.toThrow('Rejection reason must have at least 3 characters');
    await requests.reject(request.id, farm, clerk('owner'), 'Kho đích đầy');
    expect(await assetRow()).toEqual({
      status: 'AVAILABLE',
      current_location_id: sourceShelf,
    });
    expect(await notificationsFor(actors.creator.id)).toEqual([
      expect.objectContaining({
        type: 'ASSET_TRANSFER_REQUEST_REJECTED',
        body: `Yêu cầu chuyển tài sản ${tag}-A bị từ chối: Kho đích đầy`,
      }),
    ]);
    const history = await auditLogs.list({
      farmId: farm,
      clerkUserId: clerk('creator'),
      entityType: 'ASSET_TRANSFER_REQUEST',
      entityId: request.id,
      ...page,
    });
    expect(history.data.map((log) => log.action)).toEqual(['CREATE']);
    const reviewerHistory = await auditLogs.list({
      farmId: farm,
      clerkUserId: clerk('owner'),
      entityType: 'ASSET_TRANSFER_REQUEST',
      entityId: request.id,
      ...page,
    });
    expect(reviewerHistory.data.map((log) => log.action).sort()).toEqual([

      'CREATE',
      'REJECT',
    ]);
  });

  it('shows employees only their own requests and approvers all of them', async () => {
    const mine = await create('creator');
    await expect(requests.get(mine.id, farm, clerk('peer'))).rejects.toThrow(
      'Asset transfer request not found',
    );
    expect(
      (
        await requests.list({
          farmId: farm,
          clerkUserId: clerk('peer'),
          ...page,
        })
      ).data,
    ).toEqual([]);
    const detail = await requests.get(mine.id, farm, clerk('owner'));
    expect(detail).toMatchObject({
      assetCode: `${tag}-A`,
      fromLocationCode: 'S-1',
      toLocationCode: 'T-1',
      toWarehouseCode: 'TARGET',
      requestedByEmail: `${clerk('creator')}@example.local`,
    });
  });
});

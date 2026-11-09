import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { DatabaseService } from '../src/db/database.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { MaintenanceReminderWorker } from '../src/modules/maintenance/maintenance-reminder.worker';
import {
  documentPushEligibility,
  enqueueDeviceCatchUp,
} from '../src/modules/notifications/notification-push-outbox';
import { AssetLifecycleService } from '../src/modules/assets/asset-lifecycle.service';
import { AssetsService } from '../src/modules/assets/assets.service';
import { AssetHistoryService } from '../src/modules/assets/asset-history.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { InventoryAdjustmentsService } from '../src/modules/inventory/inventory-adjustments.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { and } from 'drizzle-orm';

describe('External maintenance, inspection and warehouse receipt', () => {
  jest.setTimeout(30000);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const access = new WarehousesService(database);
  const service = new MaintenanceService(database, access);
  const reminders = new MaintenanceReminderWorker(database);
  const lifecycle = new AssetLifecycleService(database, access);
  const assetsService = new AssetsService(database, access);
  const history = new AssetHistoryService(database);
  const farm = randomUUID(),
    warehouse = randomUUID(),
    location = randomUUID(),
    supplier = randomUUID(),
    item = randomUUID(),
    category = randomUUID(),
    unit = randomUUID();
  const actors = Object.fromEntries(
    [
      'MAINTENANCE_STAFF',
      'WAREHOUSE_MANAGER',
      'EMPLOYEE',
      'STORE_MANAGER',
      'FARM_OWNER',
    ].map((role) => [
      role,
      { user: randomUUID(), member: randomUUID(), clerk: randomUUID() },
    ]),
  );
  const worker = actors.MAINTENANCE_STAFF.clerk,
    manager = actors.WAREHOUSE_MANAGER.clerk,
    // Gives the final reuse decision on a passed repair (NV04, P1-05).
    owner = actors.FARM_OWNER.clerk;
  const before = () => new Date(Date.now() - 86400000).toISOString();
  const future = () => new Date(Date.now() + 86400000 * 3).toISOString();
  let asset: string;
  beforeAll(async () => {
    await db
      .insert(schema.farms)
      .values({ id: farm, code: farm, name: 'maintenance test' });
    for (const [code, actor] of Object.entries(actors)) {
      await db.insert(schema.users).values({
        id: actor.user,
        email: actor.clerk + '@example.local',
        authProviderUserId: actor.clerk,
      });
      await db
        .insert(schema.farmMembers)
        .values({ id: actor.member, userId: actor.user, farmId: farm });
      await db
        .insert(schema.roles)
        .values({ code, name: code, scope: 'FARM' })
        .onConflictDoNothing();
      const [role] = await db
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, code));
      await db
        .insert(schema.farmMemberRoles)
        .values({ farmMemberId: actor.member, roleId: role.id });
    }
    await db
      .insert(schema.categories)
      .values({ id: category, code: category, name: 'test' });
    await db
      .insert(schema.units)
      .values({ id: unit, code: unit.slice(0, 20), name: 'test' });
    await db.insert(schema.items).values({
      id: item,
      farmId: farm,
      categoryId: category,
      unitId: unit,
      code: item,
      name: 'test',
      itemType: 'EQUIPMENT',
      trackingMode: 'ASSET',
    });
    await db
      .insert(schema.warehouses)
      .values({ id: warehouse, farmId: farm, code: warehouse, name: 'test' });
    // The warehouse manager and employee work in this warehouse.
    await db.insert(schema.farmMemberWarehouses).values(
      [actors.WAREHOUSE_MANAGER, actors.EMPLOYEE].map((actor) => ({
        farmMemberId: actor.member,
        warehouseId: warehouse,
      })),
    );
    await db.insert(schema.locations).values({
      id: location,
      farmId: farm,
      warehouseId: warehouse,
      code: location,
      name: 'test',
      type: 'WAREHOUSE',
    });
    await db.insert(schema.suppliers).values({
      id: supplier,
      farmId: farm,
      code: supplier,
      name: 'external repairer',
    });
    await db.insert(schema.devicePushTokens).values(
      Object.values(actors)
        .slice(0, 2)
        .map((a) => ({
          userId: a.user,
          installationId: randomUUID(),
          expoPushToken: 'ExponentPushToken[' + a.user + ']',
          platform: 'ANDROID' as const,
        })),
    );
  });
  beforeEach(async () => {
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM notifications WHERE farm_id=$1', [farm]);
    asset = randomUUID();
    await db.insert(schema.assets).values({
      id: asset,
      farmId: farm,
      itemId: item,
      assetCode: asset,
      currentLocationId: location,
    });
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>(
      'INSERT INTO inventory_balances(farm_id,warehouse_id,item_id,quantity_on_hand) VALUES($1,$2,$3,1) ON CONFLICT(item_id,lot_id,warehouse_id) DO UPDATE SET quantity_on_hand=inventory_balances.quantity_on_hand+1',
      [farm, warehouse, item],
    );
  });
  afterAll(async () => {
    await pool.query(
      'DELETE FROM farm_member_warehouses WHERE warehouse_id=$1',
      [warehouse],
    );
    for (const table of [
      'notifications',
      'inventory_transactions',
      'asset_assignments',
      'asset_incidents',
      'audit_logs',
      'maintenance_records',
      'assets',
      'inventory_balances',
      'locations',
      'warehouses',
      'suppliers',
      'items',
    ])
      await pool.query<{
        count: string;
        id: string;
        action: string;
        quantity_on_hand: string;
      }>('DELETE FROM ' + table + ' WHERE farm_id=$1', [farm]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM device_push_tokens WHERE user_id=ANY($1::uuid[])', [
      Object.values(actors).map((a) => a.user),
    ]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])', [
      Object.values(actors).map((a) => a.member),
    ]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM farm_members WHERE farm_id=$1', [farm]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM users WHERE id=ANY($1::uuid[])', [
      Object.values(actors).map((a) => a.user),
    ]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM farms WHERE id=$1', [farm]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM categories WHERE id=$1', [category]);
    await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('DELETE FROM units WHERE id=$1', [unit]);
    await pool.end();
  });
  const schedule = () =>
    service.create(farm, manager, {
      assetId: asset,
      maintenanceType: 'PREVENTIVE',
      scheduledAt: before(),
      supplierId: supplier,
      expectedReturnAt: future(),
    });
  const assetRow = async () =>
    (
      await db.select().from(schema.assets).where(eq(schema.assets.id, asset))
    )[0];
  const balance = async () =>
    Number(
      (
        await pool.query<{
          count: string;
          id: string;
          action: string;
          quantity_on_hand: string;
        }>(
          'SELECT quantity_on_hand FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2',
          [warehouse, item],
        )
      ).rows[0].quantity_on_hand,
    );
  async function inspect(outcome: 'PASSED' | 'FAILED') {
    const r = await schedule();
    await service.start(r.id, farm, manager);
    const receivedAt = new Date().toISOString();
    await service.receive(r.id, farm, worker, receivedAt);
    return service.complete(r.id, farm, worker, {
      outcome,
      resultNote: 'Inspection result',
      intervalMonths: 3,
    });
  }
  it('filters one asset without exposing aggregate stock or assets outside the warehouse', async () => {
    const inventory = new InventoryService(database, access);
    const filters = {
      farmId: farm,
      clerkUserId: manager,
      assetId: asset,
      page: 1,
      pageSize: 20,
      offset: 0,
    };
    const original = await balance();
    await pool.query(
      'UPDATE inventory_balances SET quantity_on_hand=quantity_on_hand+5 WHERE farm_id=$1 AND item_id=$2',
      [farm, item],
    );
    const result = await inventory.listBalances(filters);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].quantityOnHand).toBe('1.000');
    expect(result.selectedAsset?.id).toBe(asset);
    const serialNumber = 'SERIAL-' + asset;
    await db
      .update(schema.assets)
      .set({ serialNumber })
      .where(eq(schema.assets.id, asset));
    const choices = await assetsService.listAssets({
      farmId: farm,
      clerkUserId: manager,
      warehouseId: warehouse,
      itemId: item,
      search: serialNumber,
      page: 1,
      pageSize: 50,
      offset: 0,
    });
    expect(choices.data.map((row) => row.asset.id)).toEqual([asset]);
    await expect(
      inventory.listBalances({ ...filters, farmId: randomUUID() }),
    ).rejects.toThrow();
    expect(
      (await inventory.listBalances({ ...filters, warehouseId: randomUUID() }))
        .data,
    ).toHaveLength(0);
    expect(
      (await inventory.listBalances({ ...filters, itemId: randomUUID() })).data,
    ).toHaveLength(0);
    expect(
      (await inventory.listBalances({ ...filters, lotId: randomUUID() })).data,
    ).toHaveLength(0);
    const page2 = await inventory.listBalances({
      ...filters,
      page: 2,
      pageSize: 1,
      offset: 1,
    });
    expect(page2.page.totalItems).toBe(1);
    expect(page2.data).toHaveLength(0);
    await expect(
      inventory.listBalances({ ...filters, assetId: randomUUID() }),
    ).rejects.toThrow('Asset not found');
    for (const status of [
      'ASSIGNED',
      'IN_USE',
      'MAINTENANCE',
      'LOST',
      'RETIRED',
    ] as const) {
      await db
        .update(schema.assets)
        .set({ status })
        .where(eq(schema.assets.id, asset));
      expect((await inventory.listBalances(filters)).data).toHaveLength(0);
    }
    await db
      .update(schema.assets)
      .set({ status: 'AVAILABLE' })
      .where(eq(schema.assets.id, asset));
    await db
      .update(schema.assets)
      .set({ status: 'TRANSFER_PENDING' })
      .where(eq(schema.assets.id, asset));
    expect((await inventory.listBalances(filters)).data[0].quantityOnHand).toBe(
      '1.000',
    );
    await db
      .update(schema.assets)
      .set({ status: 'AVAILABLE' })
      .where(eq(schema.assets.id, asset));
    expect(await balance()).toBe(original + 5);
    const failed = await inspect('FAILED');
    expect((await inventory.listBalances(filters)).data).toHaveLength(0);
    await service.submitReturn(failed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(failed.id, farm, manager, true);
    const quarantined = await inventory.listBalances(filters);
    expect(quarantined.data[0].quantityOnHand).toBe('1.000');
    expect(quarantined.selectedAsset?.status).toBe('MAINTENANCE');
    const retry = await schedule();
    expect((await inventory.listBalances(filters)).data).toHaveLength(1);
    await service.start(retry.id, farm, manager);
    expect((await inventory.listBalances(filters)).data).toHaveLength(0);
  });
  it('filters scheduled dates by inclusive Vietnam calendar days before pagination', async () => {
    const r = await service.create(farm, manager, {
      assetId: asset,
      maintenanceType: 'PREVENTIVE',
      scheduledAt: '2026-11-01T17:00:00.000Z',
    });
    const list = (dateFrom: string, dateTo: string) =>
      service.list({
        farmId: farm,
        clerkUserId: manager,
        dateFrom,
        dateTo,
        page: 1,
        pageSize: 20,
        offset: 0,
        recordId: r.id,
      });
    expect((await list('2026-11-02', '2026-11-02')).page.totalItems).toBe(1);
    expect((await list('2026-11-01', '2026-11-01')).page.totalItems).toBe(0);
  });
  it('denies a maintenance-only member stock creation, approval and rejection', async () => {
    const receipts = new StockReceiptsService(database, access);
    const issues = new StockIssuesService(database, access);
    const transfers = new StockTransfersService(database, access);
    const counts = new StockCountsService(database, access);
    const adjustments = new InventoryAdjustmentsService(database, access);
    const id = randomUUID();
    const attempts = [
      () => receipts.createReceipt(farm, worker, {} as never),
      () => receipts.confirmReceipt(id, farm, worker),
      () => receipts.rejectReceipt(id, farm, worker, 'test'),
      () => issues.create(farm, worker, {} as never),
      () => issues.confirm(id, farm, worker),
      () => issues.reject(id, farm, worker, 'test'),
      () => transfers.create(farm, worker, {} as never),
      () => transfers.confirm(id, farm, worker),
      () => transfers.reject(id, farm, worker, 'test'),
      () => counts.create(farm, worker, {} as never),
      () => counts.confirm(id, farm, worker),
      () => counts.reject(id, farm, worker, 'test'),
      () => adjustments.create(farm, worker, {} as never),
      () => adjustments.approve(farm, worker, id),
      () => adjustments.reject(farm, worker, id, 'test'),
    ];
    for (const attempt of attempts)
      await expect(attempt()).rejects.toBeInstanceOf(ForbiddenException);
    expect((await schedule()).status).toBe('SCHEDULED');
  });
  it('rejects a return date before the scheduled date without changing the record', async () => {
    const r = await schedule();
    const scheduledAt = new Date(Date.now() + 86400000 * 5).toISOString();
    await expect(
      service.update(r.id, farm, worker, {
        scheduledAt,
        expectedReturnAt: future(),
      }),
    ).rejects.toThrow('Expected return cannot precede scheduled maintenance');
    expect((await service.get(r.id, farm, worker)).scheduledAt).toBe(
      r.scheduledAt,
    );
    await service.update(r.id, farm, worker, {
      scheduledAt,
      expectedReturnAt: scheduledAt,
    });
  });
  it.each(['RECEIVED', 'COMPLETED', 'FAILED'] as const)(
    'blocks loss and recovery while %s maintenance has no confirmed return',
    async (stage) => {
      const r = await schedule();
      await service.start(r.id, farm, manager);
      await service.receive(r.id, farm, worker, new Date().toISOString());
      if (stage !== 'RECEIVED')
        await service.complete(r.id, farm, worker, {
          outcome: stage === 'COMPLETED' ? 'PASSED' : 'FAILED',
          resultNote: 'Inspection result',
          intervalMonths: 3,
        });
      const original = await balance();
      await expect(
        lifecycle.reportIncident(asset, farm, manager, {
          incidentType: 'LOSS',
          description: 'Reported missing',
          severity: 'HIGH',
        }),
      ).rejects.toThrow('active maintenance');
      expect((await assetRow()).status).toBe('MAINTENANCE');
      // Simulate an asset already marked lost by the old guard.
      await db
        .update(schema.assets)
        .set({ status: 'LOST' })
        .where(eq(schema.assets.id, asset));
      await expect(
        lifecycle.recover(asset, farm, manager, {
          warehouseId: warehouse,
          locationId: location,
        }),
      ).rejects.toThrow('active maintenance');
      expect((await assetRow()).status).toBe('LOST');
      expect(await balance()).toBe(original);
      await db
        .update(schema.assets)
        .set({ status: 'ASSIGNED' })
        .where(eq(schema.assets.id, asset));
      await expect(
        assetsService.returnAsset(asset, farm, manager, {
          warehouseId: warehouse,
          locationId: location,
          condition: 'GOOD',
        }),
      ).rejects.toThrow('active maintenance');
      expect(await balance()).toBe(original);
      expect(
        await db
          .select()
          .from(schema.assetIncidents)
          .where(eq(schema.assetIncidents.assetId, asset)),
      ).toHaveLength(0);
    },
  );

  it('keeps failed stock quarantined after cancelling a retry and permits normal loss only after repair', async () => {
    const original = await balance();
    const failed = await inspect('FAILED');
    await service.submitReturn(failed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    expect(
      (await assetsService.getAsset(asset, farm, manager))
        .maintenanceRetryEligible,
    ).toBe(false);
    await service.reviewReturn(failed.id, farm, manager, true);
    expect(
      (await assetsService.getAsset(asset, farm, manager))
        .maintenanceRetryEligible,
    ).toBe(true);
    const retry = await schedule();
    expect(
      (await assetsService.getAsset(asset, farm, manager))
        .maintenanceRetryEligible,
    ).toBe(false);
    await service.cancel(retry.id, farm, manager);
    expect(await assetsService.getAsset(asset, farm, manager)).toMatchObject({
      latestMaintenanceStatus: 'CANCELLED',
      maintenanceRetryEligible: true,
    });
    await expect(
      lifecycle.reportIncident(asset, farm, manager, {
        incidentType: 'LOSS',
        description: 'Reported missing',
        severity: 'HIGH',
      }),
    ).rejects.toThrow('Failed maintenance');
    expect((await assetRow()).status).toBe('MAINTENANCE');
    expect(await balance()).toBe(original);
    await db
      .update(schema.assets)
      .set({ status: 'LOST' })
      .where(eq(schema.assets.id, asset));
    await expect(
      lifecycle.recover(asset, farm, manager, {
        warehouseId: warehouse,
        locationId: location,
      }),
    ).rejects.toThrow('Failed maintenance');
    expect(await balance()).toBe(original);
    await db
      .update(schema.assets)
      .set({ status: 'MAINTENANCE' })
      .where(eq(schema.assets.id, asset));
    const passed = await inspect('PASSED');
    await service.submitReturn(passed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(passed.id, farm, manager, true);
    await service.decide(passed.id, farm, owner, true);
    expect(
      (await assetsService.getAsset(asset, farm, manager))
        .maintenanceRetryEligible,
    ).toBe(false);
    await lifecycle.reportIncident(asset, farm, manager, {
      incidentType: 'LOSS',
      description: 'Reported missing',
      severity: 'HIGH',
    });
    expect(await balance()).toBe(original - 1);
    await lifecycle.recover(asset, farm, manager, {
      warehouseId: warehouse,
      locationId: location,
    });
    expect(await balance()).toBe(original);
    expect((await assetRow()).status).toBe('AVAILABLE');
  });

  it.each(['PASSED', 'FAILED'] as const)(
    'closes legacy assignments on %s receipt approval',
    async (outcome) => {
      const r = await schedule();
      await service.start(r.id, farm, manager);
      const [assignment] = await db
        .insert(schema.assetAssignments)
        .values({
          farmId: farm,
          assetId: asset,
          assignedToMemberId: actors.EMPLOYEE.member,
          assignedByMemberId: actors.WAREHOUSE_MANAGER.member,
        })
        .returning();
      await service.receive(r.id, farm, worker, new Date().toISOString());
      await service.complete(r.id, farm, worker, {
        outcome,
        resultNote: 'Inspection result',
        intervalMonths: 3,
      });
      await service.submitReturn(r.id, farm, worker, {
        warehouseId: warehouse,
        locationId: location,
      });
      await service.reviewReturn(
        r.id,
        farm,
        manager,
        false,
        'Check destination',
      );
      expect(
        (
          await db
            .select()
            .from(schema.assetAssignments)
            .where(eq(schema.assetAssignments.id, assignment.id))
        )[0].status,
      ).toBe('ACTIVE');
      await service.submitReturn(r.id, farm, worker, {
        warehouseId: warehouse,
        locationId: location,
      });
      await service.reviewReturn(r.id, farm, manager, true);
      const [closed] = await db
        .select()
        .from(schema.assetAssignments)
        .where(eq(schema.assetAssignments.id, assignment.id));
      expect(closed.status).toBe('RETURNED');
      expect(closed.returnedAt).not.toBeNull();
      expect(await history.holder(asset, farm)).toBeNull();
      if (outcome === 'PASSED') await service.decide(r.id, farm, owner, true);
      if (outcome === 'PASSED')
        await expect(
          lifecycle.assign(asset, farm, manager, {
            assignedToMemberId: actors.EMPLOYEE.member,
            locationId: location,
          }),
        ).resolves.toBeDefined();
    },
  );

  it('does not catch up stale asset pushes during quarantine or an unconfirmed return', async () => {
    const due = (
      await pool.query<{ due: string }>(
        "SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1)::text AS due",
      )
    ).rows[0].due;
    await db
      .update(schema.assets)
      .set({ nextMaintenanceDate: due })
      .where(eq(schema.assets.id, asset));
    await reminders.run();
    const oldNotifications = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.entityId, asset),
          eq(schema.notifications.entityType, 'MAINTENANCE_ASSET'),
        ),
      );
    // Manager, worker and the owner added for final decisions are reminded.
    expect(oldNotifications).toHaveLength(3);
    const catchUp = async () => {
      const [device] = await db
        .insert(schema.devicePushTokens)
        .values({
          userId: actors.MAINTENANCE_STAFF.user,
          installationId: randomUUID(),
          expoPushToken: 'ExponentPushToken[' + randomUUID() + ']',
          platform: 'ANDROID',
        })
        .returning();
      await db.transaction((tx) =>
        enqueueDeviceCatchUp(tx, device.id, device.userId),
      );
      const jobs = await pool.query<{ count: string }>(
        'SELECT count(*) FROM notification_push_outbox WHERE device_push_token_id=$1 AND notification_id=ANY($2::uuid[])',
        [device.id, oldNotifications.map((n) => n.id)],
      );
      await db
        .update(schema.devicePushTokens)
        .set({ isActive: false })
        .where(eq(schema.devicePushTokens.id, device.id));
      return Number(jobs.rows[0].count);
    };
    expect(await catchUp()).toBe(1);
    const r = await inspect('FAILED');
    expect(await catchUp()).toBe(0);
    // The return predicate must also protect inconsistent legacy asset statuses.
    await db
      .update(schema.assets)
      .set({ status: 'AVAILABLE' })
      .where(eq(schema.assets.id, asset));
    expect(await catchUp()).toBe(0);
    await db
      .update(schema.assets)
      .set({ status: 'MAINTENANCE' })
      .where(eq(schema.assets.id, asset));
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    expect(await catchUp()).toBe(0);
    await service.reviewReturn(r.id, farm, manager, false, 'Check destination');
    expect(await catchUp()).toBe(0);
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(r.id, farm, manager, true);
    expect(await catchUp()).toBe(0);
  });
  it('notifies maintenance staff and the warehouse at each step and still allows rescheduling', async () => {
    const sent = async (type: string) =>
      (
        await pool.query<{ user_id: string; body: string }>(
          'SELECT user_id, body FROM notifications WHERE entity_id=$1 AND type=$2 ORDER BY user_id',
          [r.id, type],
        )
      ).rows;
    const r = await schedule();
    const code = `BT-${r.id.slice(0, 8)}`;
    // Scheduled by the manager: staff hear of it, the actor does not.
    expect(await sent('MAINTENANCE_RECORD_SCHEDULED')).toEqual([
      {
        user_id: actors.MAINTENANCE_STAFF.user,
        body: `Hồ sơ bảo trì ${code} đã được lên lịch, chờ chọn đơn vị và ngày hẹn trả.`,
      },
    ]);
    // Supplier and return date set: the warehouse approvers (not the actor) get it.
    expect(
      (await sent('MAINTENANCE_RECORD_READY_TO_SEND')).map((n) => n.user_id),
    ).toEqual([actors.FARM_OWNER.user]);
    // A ready record can still be moved to another day.
    const later = new Date(Date.now() + 86400000 * 2).toISOString();
    await expect(
      service.update(r.id, farm, worker, { scheduledAt: later }),
    ).resolves.toMatchObject({ status: 'SCHEDULED' });
    await service.start(r.id, farm, manager);
    expect(
      (await sent('MAINTENANCE_RECORD_IN_PROGRESS')).map((n) => n.user_id),
    ).toEqual([actors.MAINTENANCE_STAFF.user]);
  });

  it('keeps maintenance notifications inside the warehouses of staff who also hold a warehouse role', async () => {
    const staff = actors.MAINTENANCE_STAFF;
    const [employeeRole] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, 'EMPLOYEE'));
    const scheduledTo = async (id: string) =>
      (
        await pool.query<{ user_id: string }>(
          "SELECT user_id FROM notifications WHERE entity_id=$1 AND type='MAINTENANCE_RECORD_SCHEDULED'",
          [id],
        )
      ).rows.map((row) => row.user_id);
    await db
      .insert(schema.farmMemberRoles)
      .values({ farmMemberId: staff.member, roleId: employeeRole.id });
    try {
      // Now warehouse-scoped with no assignment: this asset's warehouse is out of reach.
      const outside = await schedule();
      expect(await scheduledTo(outside.id)).toEqual([]);
      await service.cancel(outside.id, farm, manager);
      await db
        .insert(schema.farmMemberWarehouses)
        .values({ farmMemberId: staff.member, warehouseId: warehouse });
      const inside = await schedule();
      expect(await scheduledTo(inside.id)).toEqual([staff.user]);
    } finally {
      await pool.query(
        'DELETE FROM farm_member_warehouses WHERE farm_member_id=$1',
        [staff.member],
      );
      await pool.query(
        'DELETE FROM farm_member_roles WHERE farm_member_id=$1 AND role_id=$2',
        [staff.member, employeeRole.id],
      );
    }
  });

  it('enforces duties, keeps original asset, adds stock once under concurrent approval', async () => {
    const original = await balance();
    const r = await schedule();
    // AC10: the maintenance coordinator cannot confirm the warehouse issue.
    await expect(service.start(r.id, farm, worker)).rejects.toThrow(
      'permission',
    );
    await expect(
      service.create(farm, actors.EMPLOYEE.clerk, {
        assetId: asset,
        maintenanceType: 'CORRECTIVE',
      }),
    ).rejects.toThrow('permission');
    const started = await service.start(r.id, farm, manager);
    expect(started).toMatchObject({
      status: 'IN_PROGRESS',
      issuedByMemberId: actors.WAREHOUSE_MANAGER.member,
    });
    expect(started.startedAt).toBeTruthy();
    expect(await balance()).toBe(original - 1);
    // Confirmed once: a resent or concurrent confirm does not debit again.
    const again = await Promise.allSettled([
      service.start(r.id, farm, manager),
      service.start(r.id, farm, manager),
    ]);
    expect(again.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(await balance()).toBe(original - 1);
    const issues = await pool.query<{ performed_by_member_id: string }>(
      `SELECT performed_by_member_id FROM inventory_transactions
       WHERE source_id=$1 AND transaction_type='MAINTENANCE_ISSUE'`,
      [r.id],
    );
    expect(issues.rows).toEqual([
      { performed_by_member_id: actors.WAREHOUSE_MANAGER.member },
    ]);
    expect((await service.get(r.id, farm, manager)).issuedByName).toBeTruthy();
    await expect(
      service.complete(r.id, farm, worker, {
        outcome: 'PASSED',
        resultNote: 'pass',
        intervalMonths: 3,
      }),
    ).rejects.toThrow('Receive');
    await service.receive(r.id, farm, worker, new Date().toISOString());
    await expect(
      service.complete(r.id, farm, manager, {
        outcome: 'PASSED',
        resultNote: 'pass',
        intervalMonths: 3,
      }),
    ).rejects.toThrow('permission');
    const completed = await service.complete(r.id, farm, worker, {
      outcome: 'PASSED',
      resultNote: 'pass',
      intervalMonths: 3,
    });
    expect((await assetRow()).status).toBe('MAINTENANCE');
    expect((await assetRow()).nextMaintenanceDate).toBe(completed.nextDueDate);
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await expect(
      service.reviewReturn(r.id, farm, worker, true),
    ).rejects.toThrow('permission');
    const results = await Promise.allSettled([
      service.reviewReturn(r.id, farm, manager, true),
      service.reviewReturn(r.id, farm, manager, true),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance()).toBe(original);
    // In stock at the location, out of use until the owner decides.
    expect(await assetRow()).toMatchObject({
      id: asset,
      status: 'MAINTENANCE',
      currentLocationId: location,
    });
    await expect(service.decide(r.id, farm, manager, true)).rejects.toThrow(
      'permission',
    );
    await expect(service.decide(r.id, farm, owner, false)).rejects.toThrow(
      'needs a note',
    );
    await service.decide(r.id, farm, owner, false, 'Chưa yên tâm');
    expect((await assetRow()).status).toBe('DAMAGED');
    expect(
      (
        await pool.query<{
          count: string;
          id: string;
          action: string;
          quantity_on_hand: string;
        }>(
          "SELECT count(*) FROM inventory_transactions WHERE source_id=$1 AND source_type='MAINTENANCE_RETURN'",
          [r.id],
        )
      ).rows[0].count,
    ).toBe('1');
  });
  it('keeps failed assets blocked, preserves old due date and permits repair after receipt', async () => {
    await db
      .update(schema.assets)
      .set({ nextMaintenanceDate: '2026-11-01' })
      .where(eq(schema.assets.id, asset));
    const original = await balance(),
      r = await inspect('FAILED');
    expect(r.status).toBe('FAILED');
    expect((await assetRow()).nextMaintenanceDate).toBe('2026-11-01');
    await expect(schedule()).rejects.toThrow('active maintenance');
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(r.id, farm, manager, true);
    expect(await balance()).toBe(original);
    expect((await assetRow()).status).toBe('MAINTENANCE');
    const next = await schedule();
    await service.start(next.id, farm, manager);
    expect(await balance()).toBe(original - 1);
  });
  it('lets only one of two concurrent warehouse confirmations issue the asset (AC10)', async () => {
    const original = await balance();
    const r = await schedule();
    const results = await Promise.allSettled([
      service.start(r.id, farm, manager),
      service.start(r.id, farm, manager),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await balance()).toBe(original - 1);
    const issues = await pool.query(
      `SELECT 1 FROM inventory_transactions WHERE source_id=$1 AND transaction_type='MAINTENANCE_ISSUE'`,
      [r.id],
    );
    expect(issues.rowCount).toBe(1);
  });
  it('has the source warehouse confirm a field asset without a second debit (AC10)', async () => {
    await lifecycle.assign(asset, farm, manager, {
      assignedToMemberId: actors.EMPLOYEE.member,
      locationId: location,
    });
    expect((await assetRow()).status).toBe('ASSIGNED');
    const afterAssign = await balance();
    // A warehouse manager scoped to another warehouse cannot confirm it.
    const other = {
      warehouse: randomUUID(),
      user: randomUUID(),
      member: randomUUID(),
      clerk: randomUUID(),
    };
    await db.insert(schema.warehouses).values({
      id: other.warehouse,
      farmId: farm,
      code: other.warehouse,
      name: 'other',
    });
    await db.insert(schema.users).values({
      id: other.user,
      email: other.clerk + '@example.local',
      authProviderUserId: other.clerk,
    });
    await db
      .insert(schema.farmMembers)
      .values({ id: other.member, userId: other.user, farmId: farm });
    const [role] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'WAREHOUSE_MANAGER'));
    await db
      .insert(schema.farmMemberRoles)
      .values({ farmMemberId: other.member, roleId: role.id });
    await db
      .insert(schema.farmMemberWarehouses)
      .values({ farmMemberId: other.member, warehouseId: other.warehouse });
    try {
      const r = await schedule();
      await expect(
        service.start(r.id, farm, other.clerk),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const started = await service.start(r.id, farm, manager);
      expect(started).toMatchObject({
        issuedByMemberId: actors.WAREHOUSE_MANAGER.member,
      });
      expect(started.startedAt).toBeTruthy();
      expect((await assetRow()).status).toBe('MAINTENANCE');
      expect(await balance()).toBe(afterAssign);
    } finally {
      await pool.query(
        'DELETE FROM farm_member_warehouses WHERE farm_member_id=$1',
        [other.member],
      );
      await pool.query(
        'DELETE FROM farm_member_roles WHERE farm_member_id=$1',
        [other.member],
      );
      await pool.query('DELETE FROM farm_members WHERE id=$1', [other.member]);
      await pool.query('DELETE FROM users WHERE id=$1', [other.user]);
      await pool.query('DELETE FROM warehouses WHERE id=$1', [other.warehouse]);
    }
  });
  it('lets a coordinator who also holds a warehouse role confirm the issue', async () => {
    const [role] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'WAREHOUSE_MANAGER'));
    await db.insert(schema.farmMemberRoles).values({
      farmMemberId: actors.MAINTENANCE_STAFF.member,
      roleId: role.id,
    });
    await db.insert(schema.farmMemberWarehouses).values({
      farmMemberId: actors.MAINTENANCE_STAFF.member,
      warehouseId: warehouse,
    });
    try {
      const r = await schedule();
      await expect(service.start(r.id, farm, worker)).resolves.toMatchObject({
        issuedByMemberId: actors.MAINTENANCE_STAFF.member,
      });
    } finally {
      await pool.query(
        'DELETE FROM farm_member_roles WHERE farm_member_id=$1 AND role_id=$2',
        [actors.MAINTENANCE_STAFF.member, role.id],
      );
      await pool.query(
        'DELETE FROM farm_member_warehouses WHERE farm_member_id=$1',
        [actors.MAINTENANCE_STAFF.member],
      );
    }
  });
  it('retires a failed repair received back exactly once, never via AVAILABLE (AC12, AC28)', async () => {
    const original = await balance();
    const note = { note: 'Hỏng không sửa được' };
    const failed = await inspect('FAILED');
    // Out for repair, then waiting for the warehouse: the asset has no location yet.
    await expect(lifecycle.retire(asset, farm, manager, note)).rejects.toThrow(
      'no warehouse location',
    );
    await service.submitReturn(failed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await expect(lifecycle.retire(asset, farm, manager, note)).rejects.toThrow(
      'no warehouse location',
    );
    await service.reviewReturn(failed.id, farm, manager, true);
    expect(await assetRow()).toMatchObject({
      status: 'MAINTENANCE',
      currentLocationId: location,
    });
    expect(await balance()).toBe(original);
    await expect(
      lifecycle.retire(asset, farm, worker, note),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // A scheduled retry blocks retirement until it is cancelled.
    const retry = await schedule();
    await expect(lifecycle.retire(asset, farm, manager, note)).rejects.toThrow(
      'active maintenance',
    );
    await service.cancel(retry.id, farm, manager);

    const results = await Promise.allSettled([
      lifecycle.retire(asset, farm, manager, note),
      lifecycle.retire(asset, farm, manager, note),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      results.find((result) => result.status === 'rejected')?.reason,
    ).toBeInstanceOf(ConflictException);
    await expect(lifecycle.retire(asset, farm, manager, note)).rejects.toThrow(
      'Return assigned',
    );
    expect((await assetRow()).status).toBe('RETIRED');
    expect(await balance()).toBe(original - 1);
    const moves = await pool.query<{ source_type: string; reason: string }>(
      `SELECT source_type, reason FROM inventory_transactions
       WHERE asset_id=$1 AND source_type='ASSET_RETIRE'`,
      [asset],
    );
    expect(moves.rows).toEqual([
      { source_type: 'ASSET_RETIRE', reason: 'Hỏng không sửa được' },
    ]);
    const audits = await pool.query<{ old: string; ref: string }>(
      `SELECT old_data->>'status' AS old, new_data->>'referenceId' AS ref
       FROM audit_logs WHERE entity_id=$1 AND action='ASSET_RETIRED'`,
      [asset],
    );
    expect(audits.rows).toEqual([{ old: 'MAINTENANCE', ref: failed.id }]);
  });
  it('lets an older received failure authorise retirement only while no retry is open', async () => {
    const note = { note: 'Hỏng không sửa được' };
    const receive = async (id: string) => {
      await service.submitReturn(id, farm, worker, {
        warehouseId: warehouse,
        locationId: location,
      });
      await service.reviewReturn(id, farm, manager, true);
    };
    await receive((await inspect('FAILED')).id);
    const original = await balance();
    // Retry passed, return waiting for the warehouse, then rejected: still blocked.
    const passed = await inspect('PASSED');
    await service.submitReturn(passed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await expect(
      lifecycle.retire(asset, farm, manager, note),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.reviewReturn(passed.id, farm, manager, false, 'Sai vị trí');
    await expect(
      lifecycle.retire(asset, farm, manager, note),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await balance()).toBe(original - 1);
    expect((await assetRow()).status).toBe('MAINTENANCE');
  });
  it('serializes retirement against scheduling a retry: exactly one wins', async () => {
    const failed = await inspect('FAILED');
    await service.submitReturn(failed.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(failed.id, farm, manager, true);
    const original = await balance();
    const [retired, scheduled] = await Promise.allSettled([
      lifecycle.retire(asset, farm, manager, { note: 'Ngừng' }),
      schedule(),
    ]);
    expect([retired.status, scheduled.status].sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const row = await assetRow();
    if (retired.status === 'fulfilled') {
      expect(row.status).toBe('RETIRED');
      expect(await balance()).toBe(original - 1);
    } else {
      expect(retired.reason).toBeInstanceOf(ConflictException);
      expect(row.status).toBe('MAINTENANCE');
      expect(await balance()).toBe(original);
    }
  });
  it('does not retire a maintenance asset without a received failed repair', async () => {
    await db
      .update(schema.assets)
      .set({ status: 'MAINTENANCE' })
      .where(eq(schema.assets.id, asset));
    const original = await balance();
    await expect(
      lifecycle.retire(asset, farm, manager, { note: 'Thử ngừng' }),
    ).rejects.toThrow('failed repair received back');
    expect(await balance()).toBe(original);
  });
  it('rejects invalid destination, allows rejection/resubmission and audits both decisions', async () => {
    const original = await balance(),
      r = await inspect('PASSED');
    await expect(
      service.submitReturn(r.id, farm, worker, {
        warehouseId: warehouse,
        locationId: randomUUID(),
      }),
    ).rejects.toThrow('location');
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(r.id, farm, manager, false, 'Wrong location');
    expect(await balance()).toBe(original - 1);
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    await service.reviewReturn(r.id, farm, manager, true);
    expect(await balance()).toBe(original);
    const logs = await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>('SELECT action FROM audit_logs WHERE entity_id=$1', [asset]);
    expect(logs.rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        'ASSET_MAINTENANCE_RETURN_REJECTED',
        'ASSET_MAINTENANCE_RETURN_APPROVED',
      ]),
    );
  });
  it('rolls back stock, receipt and notifications when audit fails', async () => {
    const r = await inspect('PASSED');
    await service.submitReturn(r.id, farm, worker, {
      warehouseId: warehouse,
      locationId: location,
    });
    const original = await balance();
    const audit = jest
      .spyOn(
        service as unknown as { audit: (...args: unknown[]) => Promise<void> },
        'audit',
      )
      .mockRejectedValueOnce(new Error('audit unavailable'));
    try {
      await expect(
        service.reviewReturn(r.id, farm, manager, true),
      ).rejects.toThrow('audit unavailable');
    } finally {
      audit.mockRestore();
    }
    expect(await balance()).toBe(original);
    expect((await service.get(r.id, farm, worker)).returnStatus).toBe(
      'PENDING_APPROVAL',
    );
    expect((await assetRow()).status).toBe('MAINTENANCE');
    expect(
      (
        await pool.query<{ count: string }>(
          "SELECT count(*) FROM notifications WHERE entity_id=$1 AND type='MAINTENANCE_RETURN_CONFIRMED'",
          [r.id],
        )
      ).rows[0].count,
    ).toBe('0');
    expect(
      (
        await pool.query<{ count: string }>(
          "SELECT count(*) FROM inventory_transactions WHERE source_id=$1 AND source_type='MAINTENANCE_RETURN'",
          [r.id],
        )
      ).rows[0].count,
    ).toBe('0');
    await service.reviewReturn(r.id, farm, manager, true);
    expect(await balance()).toBe(original + 1);
  });

  it('disallows cancellation outside the farm or after sending; validates reception and inspection', async () => {
    const r = await schedule();
    await expect(service.cancel(r.id, randomUUID(), worker)).rejects.toThrow();
    await service.start(r.id, farm, manager);
    await expect(service.cancel(r.id, farm, manager)).rejects.toThrow();
    await expect(service.receive(r.id, farm, worker, future())).rejects.toThrow(
      'Invalid',
    );
    await service.receive(r.id, farm, worker, new Date().toISOString());
    await expect(
      service.complete(r.id, farm, worker, {
        outcome: 'FAILED',
        resultNote: '  ',
      }),
    ).rejects.toThrow('required');
    await expect(
      service.complete(r.id, farm, worker, {
        outcome: 'PASSED',
        resultNote: 'pass',
      }),
    ).rejects.toThrow('interval');
  });
  it('deduplicates reminders, queues push, stops old milestones after rescheduling and sending', async () => {
    const r = await schedule();
    await reminders.run();
    await reminders.run();
    const rows = await pool.query<{
      count: string;
      id: string;
      action: string;
      quantity_on_hand: string;
    }>(
      "SELECT id FROM notifications WHERE entity_id=$1 AND type='MAINTENANCE_RECORD_OVERDUE'",
      [r.id],
    );
    // One per reminded member (manager, worker, owner), sent once.
    expect(rows.rows).toHaveLength(3);
    expect(
      Number(
        (
          await pool.query<{
            count: string;
            id: string;
            action: string;
            quantity_on_hand: string;
          }>(
            'SELECT count(*) FROM notification_push_outbox WHERE notification_id=ANY($1::uuid[])',
            [rows.rows.map((r) => r.id)],
          )
        ).rows[0].count,
      ),
      // The owner has no push device in this test; only in-app.
    ).toBe(2);
    await service.update(r.id, farm, manager, {
      scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    });
    await reminders.run();
    expect(
      (
        await pool.query<{
          count: string;
          id: string;
          action: string;
          quantity_on_hand: string;
        }>(
          "SELECT count(*) FROM notifications WHERE entity_id=$1 AND type='MAINTENANCE_RECORD_UPCOMING'",
          [r.id],
        )
      ).rows[0].count,
    ).toBe('3');
    const stale = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.entityId, r.id),
          eq(schema.notifications.type, 'MAINTENANCE_RECORD_OVERDUE'),
          documentPushEligibility(),
        ),
      );
    expect(stale).toHaveLength(0);
    await service.start(r.id, farm, manager);
    await db
      .update(schema.maintenanceRecords)
      .set({ expectedReturnAt: before() })
      .where(eq(schema.maintenanceRecords.id, r.id));
    await reminders.run();
    await reminders.run();
    expect(
      (
        await pool.query<{
          count: string;
          id: string;
          action: string;
          quantity_on_hand: string;
        }>(
          "SELECT count(*) FROM notifications WHERE entity_id=$1 AND type='MAINTENANCE_RECORD_RETURN_OVERDUE'",
          [r.id],
        )
      ).rows[0].count,
    ).toBe('3');
    await service.receive(r.id, farm, worker, new Date().toISOString());
    expect(
      await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.entityId, r.id),
            documentPushEligibility(),
          ),
        ),
    ).toHaveLength(0);
  });
  it('assigns only maintenance-capable members and keeps staff off jobs of others (P1-05)', async () => {
    const assign = (performedByMemberId: string) =>
      service.create(farm, manager, {
        assetId: asset,
        maintenanceType: 'PREVENTIVE',
        scheduledAt: before(),
        performedByMemberId,
      });
    for (const role of ['EMPLOYEE', 'STORE_MANAGER'])
      await expect(assign(actors[role].member)).rejects.toThrow(
        'Performer must be a maintenance staff member',
      );
    // A warehouse manager assigned to the asset's warehouse may coordinate it.
    const coordinated = await assign(actors.WAREHOUSE_MANAGER.member);
    await service.cancel(coordinated.id, farm, manager);

    const record = await assign(actors.MAINTENANCE_STAFF.member);
    // Staff never reassign a job, not even to themselves.
    await expect(
      service.update(record.id, farm, worker, {
        performedByMemberId: actors.WAREHOUSE_MANAGER.member,
      }),
    ).rejects.toThrow('assigns maintenance');

    // Registered with the actors so afterAll removes the extra member and user.
    const peerClerk = randomUUID();
    const peer = { user: randomUUID(), member: randomUUID(), clerk: peerClerk };
    actors.PEER_MAINTENANCE_STAFF = peer;
    await db.insert(schema.users).values({
      id: peer.user,
      email: `${peerClerk}@example.local`,
      authProviderUserId: peerClerk,
    });
    await db
      .insert(schema.farmMembers)
      .values({ id: peer.member, userId: peer.user, farmId: farm });
    const [staffRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'MAINTENANCE_STAFF'));
    await db
      .insert(schema.farmMemberRoles)
      .values({ farmMemberId: peer.member, roleId: staffRole.id });
    await expect(
      service.update(record.id, farm, peerClerk, { resultNote: 'mine' }),
    ).rejects.toThrow('assigned to another staff member');
    await expect(service.cancel(record.id, farm, peerClerk)).rejects.toThrow(
      'assigned to another staff member',
    );
    // A manager reassigns; then the new assignee works on it.
    await service.update(record.id, farm, manager, {
      performedByMemberId: peer.member,
    });
    await service.update(record.id, farm, peerClerk, {
      supplierId: supplier,
      expectedReturnAt: future(),
    });
    await service.start(record.id, farm, manager);
    await expect(
      service.receive(record.id, farm, worker, new Date().toISOString()),
    ).rejects.toThrow('assigned to another staff member');
    await service.receive(record.id, farm, peerClerk, new Date().toISOString());
    // An assignee who left the farm no longer blocks the job.
    await pool.query("UPDATE farm_members SET status='INACTIVE' WHERE id=$1", [
      peer.member,
    ]);
    await service.complete(record.id, farm, worker, {
      outcome: 'PASSED',
      resultNote: 'Done by a colleague',
      intervalMonths: 3,
    });
  });

  it('lets staff schedule only for themselves and keeps scoped managers to their warehouses (P1-05)', async () => {
    const input = (performedByMemberId: string) => ({
      assetId: asset,
      maintenanceType: 'PREVENTIVE' as const,
      scheduledAt: before(),
      performedByMemberId,
    });
    await expect(
      service.create(farm, worker, input(actors.WAREHOUSE_MANAGER.member)),
    ).rejects.toThrow('assigns maintenance');
    const own = await service.create(
      farm,
      worker,
      input(actors.MAINTENANCE_STAFF.member),
    );
    expect(own.performedByMemberId).toBe(actors.MAINTENANCE_STAFF.member);
    await service.cancel(own.id, farm, worker);
    // An asset outside any warehouse is out of a scoped manager's reach.
    await pool.query('UPDATE assets SET current_location_id=NULL WHERE id=$1', [
      asset,
    ]);
    await expect(
      service.create(farm, owner, input(actors.WAREHOUSE_MANAGER.member)),
    ).rejects.toThrow("Performer must manage the asset's warehouse");
  });
});

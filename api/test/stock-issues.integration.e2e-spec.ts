import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { AssetsController } from '../src/modules/assets/assets.controller';
import { AssetsService } from '../src/modules/assets/assets.service';
import { FarmAccessGuard } from '../src/modules/auth/farm-access.guard';
import { MaintenanceController } from '../src/modules/maintenance/maintenance.controller';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type Detail = {
  issue: typeof schema.stockIssues.$inferSelect & {
    warehouseCode: string | null;
    warehouseName: string | null;
  };
  items: (typeof schema.stockIssueItems.$inferSelect & {
    itemCode: string | null;
    itemName: string | null;
    trackingMode: string | null;
    unitName: string | null;
    unitSymbol: string | null;
    lotNumber: string | null;
    lotExpiryDate: string | null;
    assetCode: string | null;
    serialNumber: string | null;
  })[];
};

// Real PostgreSQL transactions on separate connections; only farm authorization
// is stubbed. Fixtures belong to a unique farm and are removed after the suite.
describe('Stock Issue HTTP and PostgreSQL consistency', () => {
  const tag = `issue-test-${randomUUID().slice(0, 8)}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const farm = randomUUID(),
    user = randomUUID(),
    member = randomUUID();
  const access = jest.fn().mockResolvedValue(member);
  const category = randomUUID(),
    unit = randomUUID();
  const warehouse = randomUUID(),
    otherWarehouse = randomUUID();
  const location = randomUUID(),
    otherLocation = randomUUID();
  const quantityItem = randomUUID(),
    lotItem = randomUUID(),
    assetItem = randomUUID(),
    otherLotItem = randomUUID();
  const lot = randomUUID();
  const assetIds = [randomUUID(), randomUUID(), randomUUID()];
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const line = (quantity = '1') => ({ itemId: quantityItem, quantity });
  const assetLine = (assetId = assetIds[0]) => ({
    itemId: assetItem,
    assetId,
    quantity: '1',
  });
  const input = (lines: unknown[], extra = {}) => ({
    warehouseId: warehouse,
    issueCode: randomUUID(),
    items: lines,
    ...extra,
  });
  const create = async (lines: unknown[], extra = {}) => {
    const response = await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(input(lines, extra))
      .expect(201);
    return (response.body as { data: Detail }).data;
  };
  const confirm = (id: string) =>
    http().post(`/stock-issues/${id}/confirm`).query({ farmId: farm });
  const balance = async (itemId = quantityItem) => {
    const result = await pool.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farm, itemId],
    );
    return result.rows[0].quantity;
  };
  const state = async (id: string) => {
    const result = await pool.query<{
      status: string;
      transactions: number;
      confirmed_at: string | null;
    }>(
      'SELECT status, confirmed_at, (SELECT count(*)::int FROM inventory_transactions WHERE source_id=$1) AS transactions FROM stock_issues WHERE id=$1',
      [id],
    );
    return result.rows[0];
  };
  const maintenance = async (
    status:
      'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' = 'SCHEDULED',
    assetId = assetIds[0],
  ) => {
    const now = new Date().toISOString();
    const [record] = await db
      .insert(schema.maintenanceRecords)
      .values({
        farmId: farm,
        assetId,
        maintenanceType: 'INSPECTION',
        description: `Record ${tag}`,
        scheduledAt: now,
        status,
        startedAt:
          status === 'IN_PROGRESS' || status === 'COMPLETED' ? now : null,
        completedAt: status === 'COMPLETED' ? now : null,
      })
      .returning();
    return record;
  };

  beforeAll(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values({
        id: user,
        authProviderUserId: tag,
        email: `${tag}@example.local`,
      });
      await tx
        .insert(schema.farmMembers)
        .values({ id: member, farmId: farm, userId: user });
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.warehouses).values(
        [warehouse, otherWarehouse].map((id, i) => ({
          id,
          farmId: farm,
          code: `W${i}`,
          name: tag,
          status: 'ACTIVE' as const,
        })),
      );
      await tx.insert(schema.locations).values(
        [location, otherLocation].map((id, i) => ({
          id,
          farmId: farm,
          warehouseId: i ? otherWarehouse : warehouse,
          type: 'WAREHOUSE_ZONE' as const,
          code: `L${i}`,
          name: tag,
        })),
      );
      await tx.insert(schema.items).values(
        [quantityItem, lotItem, assetItem, otherLotItem].map((id, i) => ({
          id,
          farmId: farm,
          categoryId: category,
          unitId: unit,
          code: `I${i}`,
          name: tag,
          itemType: i === 2 ? ('EQUIPMENT' as const) : ('MATERIAL' as const),
          trackingMode: (['QUANTITY', 'LOT', 'ASSET', 'LOT'] as const)[i],
        })),
      );
      await tx.insert(schema.inventoryLots).values({
        id: lot,
        farmId: farm,
        itemId: lotItem,
        lotNumber: tag,
        initialQuantity: '10',
      });
      await tx.insert(schema.assets).values(
        assetIds.map((id, i) => ({
          id,
          farmId: farm,
          itemId: assetItem,
          assetCode: `A${i}`,
          currentLocationId: location,
        })),
      );
    });
    const module = await Test.createTestingModule({
      controllers: [
        StockIssuesController,
        InventoryController,
        AssetsController,
        MaintenanceController,
      ],
      providers: [
        StockIssuesService,
        InventoryService,
        AssetsService,
        MaintenanceService,
        { provide: DatabaseService, useValue: { db } },
        {
          provide: WarehousesService,
          useValue: {
            assertFarmAccess: access,
            // Document writes reuse the same mock so write-denial cases still apply.
            assertDocumentWriter: async (farmId: string, user: string) => ({
              memberId: (await access(farmId, user, true)) as string,
              canApprove: true,
            }),
          },
        },
      ],
    })
      .overrideGuard(FarmAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
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

  beforeEach(async () => {
    access.mockReset().mockResolvedValue(member);
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM stock_issues WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM maintenance_records WHERE farm_id=$1', [
      farm,
    ]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
    await pool.query(
      "UPDATE assets SET status='AVAILABLE',current_location_id=$2 WHERE farm_id=$1",
      [farm, location],
    );
    await pool.query('UPDATE inventory_lots SET expiry_date=NULL WHERE id=$1', [
      lot,
    ]);
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: quantityItem,
        quantityOnHand: '10',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: lotItem,
        lotId: lot,
        quantityOnHand: '10',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: assetItem,
        quantityOnHand: '3',
      },
    ]);
  });

  afterAll(async () => {
    try {
      await app?.close();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const table of [
          'audit_logs',
          'inventory_transactions',
          'stock_issues',
          'maintenance_records',
          'inventory_balances',
          'assets',
          'inventory_lots',
          'items',
          'locations',
          'warehouses',
          'farm_members',
        ]) {
          await client.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
        }
        for (const [table, id] of [
          ['users', user],
          ['categories', category],
          ['units', unit],
          ['farms', farm],
        ]) {
          await client.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  it('lists warehouse labels with stable pagination and status filtering without duplicating multi-line issues', async () => {
    const a = await create([line(), line()]);
    const b = await create([line()]);
    const c = await create([line()]);
    await confirm(b.issue.id).expect(201);
    await http()
      .post(`/stock-issues/${c.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(201);
    await pool.query('UPDATE stock_issues SET created_at=$2 WHERE farm_id=$1', [
      farm,
      '2026-01-01T00:00:00Z',
    ]);
    const list = async (page: number, status?: string) => {
      const response = await http()
        .get('/stock-issues')
        .query({
          farmId: farm,
          page,
          pageSize: 1,
          ...(status ? { status } : {}),
        })
        .expect(200);
      return response.body as {
        data: Detail['issue'][];
        page: {
          number: number;
          size: number;
          totalItems: number;
          totalPages: number;
        };
      };
    };
    const pages = await Promise.all([list(1), list(2), list(3)]);
    expect(
      pages.flatMap((result) => result.data.map((issue) => issue.id)),
    ).toEqual([a.issue.id, b.issue.id, c.issue.id].sort().reverse());
    for (const [index, result] of pages.entries()) {
      expect(result.page).toEqual({
        number: index + 1,
        size: 1,
        totalItems: 3,
        totalPages: 3,
      });
      expect(result.data[0]).toMatchObject({
        farmId: farm,
        warehouseCode: 'W0',
        warehouseName: tag,
      });
    }
    expect((await list(4)).data).toEqual([]);
    for (const [status, id] of [
      ['DRAFT', a.issue.id],
      ['CONFIRMED', b.issue.id],
      ['CANCELLED', c.issue.id],
    ]) {
      const result = await list(1, status);
      expect(result.data.map((issue) => issue.id)).toEqual([id]);
      expect(result.page.totalItems).toBe(1);
    }
    await http()
      .get('/stock-issues')
      .query({ farmId: farm, status: 'UNKNOWN' })
      .expect(400);
  });

  it('reads all tracking labels and original fields without changing decimal quantities or inventory', async () => {
    const draft = await create(
      [
        line('1.250'),
        {
          itemId: lotItem,
          lotId: lot,
          quantity: '0.001',
          note: 'Keep LOT note',
        },
        assetLine(),
        assetLine(assetIds[1]),
      ],
      { reason: 'Test reason', note: 'Test note' },
    );
    await pool.query('UPDATE assets SET serial_number=$2 WHERE id=$1', [
      assetIds[0],
      tag,
    ]);
    const response = await http()
      .get(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    const detail = (response.body as { data: Detail }).data;
    expect(detail.issue).toMatchObject({
      id: draft.issue.id,
      warehouseId: warehouse,
      warehouseCode: 'W0',
      warehouseName: tag,
      reason: 'Test reason',
      note: 'Test note',
      status: 'DRAFT',
    });
    expect(detail.items).toHaveLength(4);
    expect(new Set(detail.items.map((item) => item.id)).size).toBe(4);
    expect(
      detail.items.find((item) => item.itemId === quantityItem),
    ).toMatchObject({
      quantity: '1.250',
      trackingMode: 'QUANTITY',
      itemCode: 'I0',
      itemName: tag,
      unitName: tag,
      lotId: null,
      assetId: null,
    });
    expect(detail.items.find((item) => item.lotId === lot)).toMatchObject({
      quantity: '0.001',
      trackingMode: 'LOT',
      lotNumber: tag,
      note: 'Keep LOT note',
    });
    expect(
      detail.items.find((item) => item.assetId === assetIds[0]),
    ).toMatchObject({
      quantity: '1.000',
      trackingMode: 'ASSET',
      assetCode: 'A0',
      serialNumber: tag,
    });
    expect(
      detail.items.find((item) => item.assetId === assetIds[1]),
    ).toMatchObject({ assetCode: 'A1' });
    expect(await balance()).toBe('10.000');
    expect(await balance(lotItem)).toBe('10.000');
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it('cancels a mixed maintenance draft without changing balances, lots, assets, records, or lines', async () => {
    const record = await maintenance();
    const draft = await create(
      [
        line('2.500'),
        { itemId: lotItem, lotId: lot, quantity: '0.125', note: 'Lot note' },
        assetLine(),
      ],
      { issueType: 'MAINTENANCE', maintenanceRecordId: record.id },
    );
    const response = await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(201);
    const cancelled = (response.body as { data: Detail }).data;
    expect(cancelled.issue).toMatchObject({
      status: 'CANCELLED',
      maintenanceRecordId: record.id,
      confirmedAt: null,
    });
    expect(cancelled.issue.cancelledAt).not.toBeNull();
    expect(cancelled.items).toEqual(draft.items);
    expect(await balance()).toBe('10.000');
    expect(await balance(lotItem)).toBe('10.000');
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CANCELLED',
      transactions: 0,
    });
    const assetRows = await pool.query<{
      status: string;
      current_location_id: string;
    }>('SELECT status,current_location_id FROM assets WHERE farm_id=$1', [
      farm,
    ]);
    for (const row of assetRows.rows)
      expect(row).toMatchObject({
        status: 'AVAILABLE',
        current_location_id: location,
      });
    const lotRows = await pool.query<{
      initial_quantity: string;
      expiry_date: string | null;
    }>(
      'SELECT initial_quantity::text,expiry_date FROM inventory_lots WHERE id=$1',
      [lot],
    );
    expect(lotRows.rows[0]).toMatchObject({
      initial_quantity: '10.000',
      expiry_date: null,
    });
    const records = await pool.query<{ status: string }>(
      'SELECT status FROM maintenance_records WHERE id=$1',
      [record.id],
    );
    expect(records.rows[0].status).toBe('SCHEDULED');
    await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(409);
    await confirm(draft.issue.id).expect(409);
    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ note: 'cannot edit' })
      .expect(409);
    const after = await http()
      .get(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    expect((after.body as { data: Detail }).data.issue.cancelledAt).toBe(
      cancelled.issue.cancelledAt,
    );
  });

  it('serializes concurrent duplicate cancellations and changes only the issue state', async () => {
    const draft = await create([line('2')]);
    const results = await race(
      'SELECT id FROM stock_issues WHERE id=$1 FOR UPDATE',
      [draft.issue.id],
      [
        () =>
          http()
            .post(`/stock-issues/${draft.issue.id}/cancel`)
            .query({ farmId: farm }),
        () =>
          http()
            .post(`/stock-issues/${draft.issue.id}/cancel`)
            .query({ farmId: farm }),
      ],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance()).toBe('10.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CANCELLED',
      transactions: 0,
    });
  });

  it('rejects cancellation without write access or with a different farm', async () => {
    const draft = await create([line('2')]);
    access.mockRejectedValueOnce(new ForbiddenException('Read only'));
    await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(403);
    expect(access).toHaveBeenLastCalledWith(farm, tag, true);
    await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: randomUUID() })
      .expect(404);
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
    expect(await balance()).toBe('10.000');
  });

  it('reads maintenance asset labels without restricting eligible record statuses or multiplying rows', async () => {
    const records = [
      await maintenance('SCHEDULED'),
      await maintenance('IN_PROGRESS', assetIds[1]),
      await maintenance('COMPLETED'),
      await maintenance('CANCELLED'),
    ];
    const response = await http()
      .get('/maintenance-records')
      .query({ farmId: farm, pageSize: 2 })
      .expect(200);
    type RecordPage = {
      data: {
        id: string;
        assetCode: string | null;
        serialNumber: string | null;
        status: string;
      }[];
      page: { totalItems: number; totalPages: number };
    };
    const page = response.body as RecordPage;
    expect(page.page).toMatchObject({ totalItems: 4, totalPages: 2 });
    const second = await http()
      .get('/maintenance-records')
      .query({ farmId: farm, page: 2, pageSize: 2 })
      .expect(200);
    const all = [...page.data, ...(second.body as RecordPage).data];
    expect(all.map((row) => row.id).sort()).toEqual(
      records.map((record) => record.id).sort(),
    );
    expect(all.map((row) => row.status).sort()).toEqual([
      'CANCELLED',
      'COMPLETED',
      'IN_PROGRESS',
      'SCHEDULED',
    ]);
    for (const record of records) {
      const detail = await http()
        .get(`/maintenance-records/${record.id}`)
        .query({ farmId: farm })
        .expect(200);
      expect(
        (detail.body as { data: { id: string; assetCode: string | null } })
          .data,
      ).toMatchObject({
        id: record.id,
        assetCode: record.assetId === assetIds[0] ? 'A0' : 'A1',
      });
    }
  });

  it('rejects missing and foreign-farm maintenance links without inserting a draft', async () => {
    const record = await maintenance();
    await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(input([line()], { issueType: 'MAINTENANCE' }))
      .expect(400);
    await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(
        input([line()], { issueType: 'OTHER', maintenanceRecordId: record.id }),
      )
      .expect(400);
    await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(
        input([line()], {
          issueType: 'MAINTENANCE',
          maintenanceRecordId: randomUUID(),
        }),
      )
      .expect(404);
    const foreignFarm = randomUUID();
    try {
      await db
        .insert(schema.farms)
        .values({ id: foreignFarm, code: `${tag}-MAINT`, name: tag });
      await http()
        .get(`/maintenance-records/${record.id}`)
        .query({ farmId: foreignFarm })
        .expect(404);
      const foreignList = await http()
        .get('/maintenance-records')
        .query({ farmId: foreignFarm })
        .expect(200);
      expect((foreignList.body as { data: unknown[] }).data).toEqual([]);
      // Foreign farm request is authorized by the suite stub; the record belongs to the source farm.
      await http()
        .post('/stock-issues')
        .query({ farmId: foreignFarm })
        .send(
          input([line()], {
            issueType: 'MAINTENANCE',
            maintenanceRecordId: record.id,
          }),
        )
        .expect(404);
      const count = await pool.query<{ value: number }>(
        'SELECT count(*)::int AS value FROM stock_issues WHERE farm_id=ANY($1::uuid[])',
        [[farm, foreignFarm]],
      );
      expect(count.rows[0].value).toBe(0);
    } finally {
      await pool.query('DELETE FROM farms WHERE id=$1', [foreignFarm]);
    }
    expect(await balance()).toBe('10.000');
  });

  it.each(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)(
    'creates a maintenance draft linked to a %s record without changing inventory or maintenance',
    async (status) => {
      const record = await maintenance(status);
      const draft = await create([line('0.125')], {
        issueType: 'MAINTENANCE',
        maintenanceRecordId: record.id,
      });
      expect(draft.issue).toMatchObject({
        issueType: 'MAINTENANCE',
        maintenanceRecordId: record.id,
        status: 'DRAFT',
      });
      expect(await balance()).toBe('10.000');
      expect(await state(draft.issue.id)).toMatchObject({ transactions: 0 });
      const result = await pool.query<{ status: string }>(
        'SELECT status FROM maintenance_records WHERE id=$1',
        [record.id],
      );
      expect(result.rows[0].status).toBe(status);
    },
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'rejects confirmation against a %s maintenance record without changing stock',
    async (status) => {
      const record = await maintenance(status);
      const draft = await create([line('0.125')], {
        issueType: 'MAINTENANCE',
        maintenanceRecordId: record.id,
      });
      const before = await state(draft.issue.id);
      await confirm(draft.issue.id).expect(409);
      expect(await state(draft.issue.id)).toEqual(before);
    },
  );

  it('preserves a maintenance link on draft edits and clears it when the issue type changes', async () => {
    const record = await maintenance();
    const draft = await create([line('0.125')], {
      issueType: 'MAINTENANCE',
      maintenanceRecordId: record.id,
      note: 'Original note',
    });
    const updated = await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({
        note: 'Edited note',
        items: [{ ...line('0.250'), note: 'Line note' }],
      })
      .expect(200);
    const detail = (updated.body as { data: Detail }).data;
    expect(detail.issue).toMatchObject({
      maintenanceRecordId: record.id,
      issueType: 'MAINTENANCE',
      note: 'Edited note',
    });
    expect(detail.items[0]).toMatchObject({
      quantity: '0.250',
      note: 'Line note',
    });
    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ issueType: 'OTHER', items: [line('9')] })
      .expect(400);
    const unchanged = await http()
      .get(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    expect((unchanged.body as { data: Detail }).data.items[0].quantity).toBe(
      '0.250',
    );
    const cleared = await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ issueType: 'OTHER', maintenanceRecordId: null })
      .expect(200);
    expect((cleared.body as { data: Detail }).data.issue).toMatchObject({
      issueType: 'OTHER',
      maintenanceRecordId: null,
      status: 'DRAFT',
    });
    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ issueType: 'MAINTENANCE' })
      .expect(400);
    expect(await balance()).toBe('10.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it('filters asset data and count by current warehouse while preserving unfiltered lists', async () => {
    await pool.query('UPDATE assets SET current_location_id=$2 WHERE id=$1', [
      assetIds[1],
      otherLocation,
    ]);
    await pool.query('UPDATE assets SET current_location_id=NULL WHERE id=$1', [
      assetIds[2],
    ]);
    const source = await http()
      .get('/assets')
      .query({
        farmId: farm,
        warehouseId: warehouse,
        itemId: assetItem,
        status: 'AVAILABLE',
        pageSize: 1,
      })
      .expect(200);
    const sourceBody = source.body as {
      data: { asset: { id: string }; locationWarehouseId: string | null }[];
      page: { totalItems: number; totalPages: number };
    };
    expect(sourceBody.data.map((row) => row.asset.id)).toEqual([assetIds[0]]);
    expect(sourceBody.data[0].locationWarehouseId).toBe(warehouse);
    expect(sourceBody.page).toMatchObject({ totalItems: 1, totalPages: 1 });
    const other = await http()
      .get('/assets')
      .query({ farmId: farm, warehouseId: otherWarehouse, itemId: assetItem })
      .expect(200);
    expect(
      (other.body as typeof sourceBody).data.map((row) => row.asset.id),
    ).toEqual([assetIds[1]]);
    expect((other.body as typeof sourceBody).page.totalItems).toBe(1);
    const unfiltered = await http()
      .get('/assets')
      .query({ farmId: farm })
      .expect(200);
    expect((unfiltered.body as typeof sourceBody).data).toHaveLength(3);
    expect((unfiltered.body as typeof sourceBody).page.totalItems).toBe(3);
    const detail = await http()
      .get(`/assets/${assetIds[1]}`)
      .query({ farmId: farm })
      .expect(200);
    expect(
      (detail.body as { data: { locationWarehouseId: string | null } }).data
        .locationWarehouseId,
    ).toBe(otherWarehouse);
  });

  it('keeps asset count and pagination consistent with combined warehouse filters', async () => {
    await pool.query("UPDATE assets SET status='RETIRED' WHERE id=$1", [
      assetIds[2],
    ]);
    const query = {
      farmId: farm,
      warehouseId: warehouse,
      itemId: assetItem,
      status: 'AVAILABLE',
      pageSize: 1,
    };
    const first = await http().get('/assets').query(query).expect(200);
    const second = await http()
      .get('/assets')
      .query({ ...query, page: 2 })
      .expect(200);
    type AssetPage = {
      data: { asset: { id: string } }[];
      page: { number: number; totalItems: number; totalPages: number };
    };
    const firstPage = first.body as AssetPage;
    const secondPage = second.body as AssetPage;
    expect(firstPage.page).toMatchObject({
      number: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(secondPage.page).toMatchObject({
      number: 2,
      totalItems: 2,
      totalPages: 2,
    });
    expect([firstPage.data[0].asset.id, secondPage.data[0].asset.id]).toEqual([
      assetIds[0],
      assetIds[1],
    ]);
    await pool.query(
      "UPDATE assets SET serial_number='warehouse-filter-needle' WHERE id=$1",
      [assetIds[0]],
    );
    try {
      const searched = await http()
        .get('/assets')
        .query({
          ...query,
          search: 'warehouse-filter-needle',
          locationId: location,
        })
        .expect(200);
      expect((searched.body as AssetPage).page.totalItems).toBe(1);
    } finally {
      await pool.query('UPDATE assets SET serial_number=NULL WHERE id=$1', [
        assetIds[0],
      ]);
    }
    const wrongItem = await http()
      .get('/assets')
      .query({ ...query, itemId: quantityItem })
      .expect(200);
    expect((wrongItem.body as AssetPage).page.totalItems).toBe(0);
    const wrongFarm = await http()
      .get('/assets')
      .query({ ...query, farmId: randomUUID() })
      .expect(200);
    expect((wrongFarm.body as AssetPage).data).toEqual([]);
    await http()
      .get('/assets')
      .query({ farmId: farm, warehouseId: 'invalid' })
      .expect(400);
  });

  it('does not use a location from another farm to satisfy the asset warehouse filter', async () => {
    const foreignFarm = randomUUID(),
      foreignWarehouse = randomUUID(),
      foreignLocation = randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(schema.farms)
          .values({ id: foreignFarm, code: `${tag}-ASSET-FARM`, name: tag });
        await tx.insert(schema.warehouses).values({
          id: foreignWarehouse,
          farmId: foreignFarm,
          code: 'FOREIGN',
          name: tag,
        });
        await tx.insert(schema.locations).values({
          id: foreignLocation,
          farmId: foreignFarm,
          warehouseId: foreignWarehouse,
          type: 'WAREHOUSE_ZONE',
          code: 'FOREIGN',
          name: tag,
        });
      });
      await expect(
        pool.query('UPDATE assets SET current_location_id=$2 WHERE id=$1', [
          assetIds[0],
          foreignLocation,
        ]),
      ).rejects.toThrow(
        'asset and current location must belong to the same farm',
      );
      const response = await http()
        .get('/assets')
        .query({ farmId: farm, warehouseId: foreignWarehouse })
        .expect(200);
      const page = response.body as {
        data: unknown[];
        page: { totalItems: number };
      };
      expect(page.data).toEqual([]);
      expect(page.page.totalItems).toBe(0);
      const detail = await http()
        .get(`/assets/${assetIds[0]}`)
        .query({ farmId: farm })
        .expect(200);
      expect(
        (
          detail.body as {
            data: {
              locationWarehouseId: string | null;
              locationName: string | null;
            };
          }
        ).data,
      ).toMatchObject({ locationWarehouseId: warehouse, locationName: tag });
    } finally {
      await pool.query('UPDATE assets SET current_location_id=$2 WHERE id=$1', [
        assetIds[0],
        location,
      ]);
      await pool.query('DELETE FROM locations WHERE id=$1', [foreignLocation]);
      await pool.query('DELETE FROM warehouses WHERE id=$1', [
        foreignWarehouse,
      ]);
      await pool.query('DELETE FROM farms WHERE id=$1', [foreignFarm]);
    }
  });

  it('persists three physical assets as separate lines in one draft without changing business state', async () => {
    const draft = await create(
      assetIds.map((id, index) => ({
        ...assetLine(id),
        note: `Tool ${index}`,
      })),
    );
    expect(draft.items).toHaveLength(3);
    expect(draft.items.map((row) => row.assetId).sort()).toEqual(
      [...assetIds].sort(),
    );
    for (const row of draft.items)
      expect(row).toMatchObject({
        quantity: '1.000',
        lotId: null,
        trackingMode: 'ASSET',
      });
    const response = await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({
        note: 'Three tools',
        items: assetIds.map((id, index) => ({
          ...assetLine(id),
          note: `Updated ${index}`,
        })),
      })
      .expect(200);
    const updated = (response.body as { data: Detail }).data;
    for (const [index, id] of assetIds.entries())
      expect(updated.items.find((row) => row.assetId === id)?.note).toBe(
        `Updated ${index}`,
      );
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
    const result = await pool.query<{
      status: string;
      current_location_id: string;
    }>('SELECT status,current_location_id FROM assets WHERE farm_id=$1', [
      farm,
    ]);
    for (const row of result.rows)
      expect(row).toMatchObject({
        status: 'AVAILABLE',
        current_location_id: location,
      });
  });

  it('returns raw lot suggestions scoped to eligible farm, warehouse, and item balances', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLot = randomUUID();
    const expiredLot = randomUUID();
    const emptyLot = randomUUID();
    const otherWarehouseLot = randomUUID();
    const otherItemLot = randomUUID();
    const foreignFarm = randomUUID();
    const foreignWarehouse = randomUUID();
    const foreignItem = randomUUID();
    const foreignLot = randomUUID();
    const localTestLots = [
      {
        id: todayLot,
        itemId: lotItem,
        lotNumber: `${tag}-TODAY`,
        expiryDate: today,
      },
      {
        id: expiredLot,
        itemId: lotItem,
        lotNumber: `${tag}-EXPIRED`,
        expiryDate: '2000-01-01',
      },
      {
        id: emptyLot,
        itemId: lotItem,
        lotNumber: `${tag}-EMPTY`,
        expiryDate: null,
      },
      {
        id: otherWarehouseLot,
        itemId: lotItem,
        lotNumber: `${tag}-OTHER-WH`,
        expiryDate: null,
      },
      {
        id: otherItemLot,
        itemId: otherLotItem,
        lotNumber: `${tag}-OTHER-ITEM`,
        expiryDate: null,
      },
    ];
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.inventoryLots).values(
          localTestLots.map((row) => ({
            ...row,
            farmId: farm,
            initialQuantity: '10',
          })),
        );
        await tx.insert(schema.inventoryBalances).values([
          {
            farmId: farm,
            warehouseId: warehouse,
            itemId: lotItem,
            lotId: todayLot,
            quantityOnHand: '2',
          },
          {
            farmId: farm,
            warehouseId: warehouse,
            itemId: lotItem,
            lotId: expiredLot,
            quantityOnHand: '2',
          },
          {
            farmId: farm,
            warehouseId: warehouse,
            itemId: lotItem,
            lotId: emptyLot,
            quantityOnHand: '0',
          },
          {
            farmId: farm,
            warehouseId: otherWarehouse,
            itemId: lotItem,
            lotId: otherWarehouseLot,
            quantityOnHand: '2',
          },
          {
            farmId: farm,
            warehouseId: warehouse,
            itemId: otherLotItem,
            lotId: otherItemLot,
            quantityOnHand: '2',
          },
        ]);
        await tx.insert(schema.farms).values({
          id: foreignFarm,
          code: `${tag}-OTHER-FARM`,
          name: `${tag}-OTHER-FARM`,
        });
        await tx.insert(schema.warehouses).values({
          id: foreignWarehouse,
          farmId: foreignFarm,
          code: `${tag}-OTHER-WH`,
          name: tag,
          status: 'ACTIVE',
        });
        await tx.insert(schema.items).values({
          id: foreignItem,
          farmId: foreignFarm,
          categoryId: category,
          unitId: unit,
          code: `${tag}-OTHER-ITEM`,
          name: tag,
          itemType: 'MATERIAL',
          trackingMode: 'LOT',
        });
        await tx.insert(schema.inventoryLots).values({
          id: foreignLot,
          farmId: foreignFarm,
          itemId: foreignItem,
          lotNumber: `${tag}-FOREIGN`,
          initialQuantity: '10',
        });
        await tx.insert(schema.inventoryBalances).values({
          farmId: foreignFarm,
          warehouseId: foreignWarehouse,
          itemId: foreignItem,
          lotId: foreignLot,
          quantityOnHand: '2',
        });
      });

      const local = await http()
        .get('/lots/suggestions')
        .query({ farmId: farm, warehouseId: warehouse, itemId: lotItem })
        .expect(200);
      const localRows = local.body as {
        lot: {
          id: string;
          farmId: string;
          itemId: string;
          expiryDate: string | null;
        };
        balance: {
          farmId: string;
          warehouseId: string;
          itemId: string;
          lotId: string | null;
          quantityOnHand: string;
        };
      }[];
      expect(Array.isArray(localRows)).toBe(true);
      expect(localRows.map((row) => row.lot.id).sort()).toEqual(
        [lot, todayLot].sort(),
      );
      const todaySuggestion = localRows.find(
        ({ lot: suggestedLot }) => suggestedLot.id === todayLot,
      );
      expect(todaySuggestion?.lot).toMatchObject({
        id: todayLot,
        farmId: farm,
        itemId: lotItem,
        expiryDate: today,
      });
      expect(todaySuggestion?.balance).toMatchObject({
        farmId: farm,
        warehouseId: warehouse,
        itemId: lotItem,
        lotId: todayLot,
        quantityOnHand: '2.000',
      });

      const foreign = await http()
        .get('/lots/suggestions')
        .query({
          farmId: foreignFarm,
          warehouseId: foreignWarehouse,
          itemId: foreignItem,
        })
        .expect(200);
      const foreignRows = foreign.body as { lot: { id: string } }[];
      expect(Array.isArray(foreignRows)).toBe(true);
      expect(foreignRows.map((row) => row.lot.id)).toEqual([foreignLot]);
    } finally {
      await pool.query(
        'DELETE FROM inventory_balances WHERE lot_id = ANY($1::uuid[])',
        [localTestLots.map(({ id }) => id)],
      );
      await pool.query(
        'DELETE FROM inventory_lots WHERE id = ANY($1::uuid[])',
        [localTestLots.map(({ id }) => id)],
      );
      await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
        foreignFarm,
      ]);
      await pool.query('DELETE FROM inventory_lots WHERE farm_id=$1', [
        foreignFarm,
      ]);
      await pool.query('DELETE FROM items WHERE farm_id=$1', [foreignFarm]);
      await pool.query('DELETE FROM warehouses WHERE farm_id=$1', [
        foreignFarm,
      ]);
      await pool.query('DELETE FROM farms WHERE id=$1', [foreignFarm]);
    }
  });

  it('creates and updates mixed QUANTITY and LOT drafts without changing inventory', async () => {
    const quantityBefore = await balance();
    const lotBefore = await balance(lotItem);
    const draft = await create(
      [
        line('1.250'),
        { itemId: lotItem, lotId: lot, quantity: '0.001', note: 'LOT note' },
      ],
      { reason: 'Initial reason', note: 'Header note' },
    );
    expect(draft.items.find((item) => item.itemId === lotItem)).toMatchObject({
      quantity: '0.001',
      lotId: lot,
      lotNumber: tag,
      trackingMode: 'LOT',
      note: 'LOT note',
      assetId: null,
    });
    expect(await balance()).toBe(quantityBefore);
    expect(await balance(lotItem)).toBe(lotBefore);

    const updated = await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({
        note: 'Updated header note',
        items: [
          { ...line('2.500'), note: 'Quantity note' },
          {
            itemId: lotItem,
            lotId: lot,
            quantity: '0.125',
            note: 'LOT updated',
          },
        ],
      })
      .expect(200);
    const detail = (updated.body as { data: Detail }).data;
    expect(detail.issue.note).toBe('Updated header note');
    expect(
      detail.items.find((item) => item.itemId === quantityItem),
    ).toMatchObject({
      quantity: '2.500',
      trackingMode: 'QUANTITY',
      lotId: null,
      assetId: null,
      note: 'Quantity note',
    });
    expect(detail.items.find((item) => item.itemId === lotItem)).toMatchObject({
      quantity: '0.125',
      lotId: lot,
      lotNumber: tag,
      trackingMode: 'LOT',
      note: 'LOT updated',
      assetId: null,
    });
    expect(await balance()).toBe(quantityBefore);
    expect(await balance(lotItem)).toBe(lotBefore);
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it('maps a duplicate issue code to 409 on create without inserting a partial issue', async () => {
    const issueCode = `DUP-${randomUUID()}`;
    const original = await create([line('1.250')], { issueCode });
    const balanceBefore = await balance();

    await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send(input([line('2.500')], { issueCode }))
      .expect(409);

    const result = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM stock_issues WHERE farm_id=$1 AND issue_code=$2',
      [farm, issueCode],
    );
    const after = await http()
      .get(`/stock-issues/${original.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    expect(result.rows[0].count).toBe(1);
    expect(
      (after.body as { data: Detail }).data.items.map((item) => item.quantity),
    ).toEqual(['1.250']);
    expect(await balance()).toBe(balanceBefore);
    expect(await state(original.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it('rolls back replacement lines when an update collides with the issue-code constraint', async () => {
    const existingCode = `EXISTING-${randomUUID()}`;
    const originalCode = `EDIT-${randomUUID()}`;
    await create([line('1.250')], { issueCode: existingCode });
    const draft = await create([line('2.500')], { issueCode: originalCode });
    const balanceBefore = await balance();

    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({
        issueCode: existingCode,
        items: [line('3.750'), { ...line('4.125'), note: 'replacement' }],
      })
      .expect(409);

    const after = await http()
      .get(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    const detail = (after.body as { data: Detail }).data;
    const count = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM stock_issues WHERE farm_id=$1',
      [farm],
    );
    expect(detail.issue.issueCode).toBe(originalCode);
    expect(detail.items.map((item) => [item.quantity, item.note])).toEqual([
      ['2.500', null],
    ]);
    expect(count.rows[0].count).toBe(2);
    expect(await balance()).toBe(balanceBefore);
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it('does not map an unrelated PostgreSQL unique-constraint error to 409', async () => {
    const error = Object.assign(new Error('duplicate unrelated value'), {
      code: '23505',
      constraint: 'uq_unrelated_per_farm',
    });
    const spy = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce(() => Promise.reject(error));
    try {
      await http()
        .post('/stock-issues')
        .query({ farmId: farm })
        .send(input([line()]))
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    const issues = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM stock_issues WHERE farm_id=$1',
      [farm],
    );
    expect(issues.rows[0].count).toBe(0);
    expect(await balance()).toBe('10.000');
  });

  it('keeps lines when legacy references belong to another farm and does not expose their labels', async () => {
    const draft = await create([
      line(),
      { itemId: lotItem, lotId: lot, quantity: '1' },
      assetLine(),
    ]);
    const otherFarm = randomUUID();
    await pool.query('INSERT INTO farms (id,code,name) VALUES ($1,$2,$2)', [
      otherFarm,
      `${tag}-other`,
    ]);
    try {
      // Simulate legacy inconsistent foreign keys; never alter non-test data.
      await pool.query('UPDATE warehouses SET farm_id=$2 WHERE id=$1', [
        warehouse,
        otherFarm,
      ]);
      await pool.query('UPDATE items SET farm_id=$2 WHERE id=$1', [
        quantityItem,
        otherFarm,
      ]);
      await pool.query('UPDATE inventory_lots SET farm_id=$2 WHERE id=$1', [
        lot,
        otherFarm,
      ]);
      await pool.query('UPDATE items SET farm_id=$2 WHERE id=$1', [
        assetItem,
        otherFarm,
      ]);
      const response = await http()
        .get(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: farm })
        .expect(200);
      const detail = (response.body as { data: Detail }).data;
      expect(detail.issue).toMatchObject({
        warehouseId: warehouse,
        warehouseName: null,
        warehouseCode: null,
      });
      expect(detail.items).toHaveLength(3);
      expect(
        detail.items.find((item) => item.itemId === quantityItem),
      ).toMatchObject({
        quantity: '1.000',
        itemName: null,
        itemCode: null,
        trackingMode: null,
        unitName: null,
      });
      expect(detail.items.find((item) => item.lotId === lot)).toMatchObject({
        lotId: lot,
        lotNumber: null,
      });
      expect(
        detail.items.find((item) => item.assetId === assetIds[0]),
      ).toMatchObject({
        assetId: assetIds[0],
        assetCode: null,
        serialNumber: null,
      });
      const listed = await http()
        .get('/stock-issues')
        .query({ farmId: farm })
        .expect(200);
      expect((listed.body as { data: Detail['issue'][] }).data).toHaveLength(1);
      expect(
        (listed.body as { data: Detail['issue'][] }).data[0].warehouseName,
      ).toBeNull();
      const remote = await http()
        .get('/stock-issues')
        .query({ farmId: otherFarm })
        .expect(200);
      expect((remote.body as { data: unknown[] }).data).toEqual([]);
      await http()
        .get(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: otherFarm })
        .expect(404);
    } finally {
      await pool.query('UPDATE warehouses SET farm_id=$2 WHERE id=$1', [
        warehouse,
        farm,
      ]);
      await pool.query('UPDATE items SET farm_id=$2 WHERE id=$1', [
        quantityItem,
        farm,
      ]);
      await pool.query('UPDATE inventory_lots SET farm_id=$2 WHERE id=$1', [
        lot,
        farm,
      ]);
      await pool.query('UPDATE items SET farm_id=$2 WHERE id=$1', [
        assetItem,
        farm,
      ]);
      await pool.query('DELETE FROM farms WHERE id=$1', [otherFarm]);
    }
  });

  it('enforces the read-access check and reports missing issues', async () => {
    const draft = await create([line()]);
    access.mockClear();
    await http().get('/stock-issues').query({ farmId: farm }).expect(200);
    expect(access).toHaveBeenCalledWith(farm, tag, false);
    access.mockRejectedValueOnce(new ForbiddenException('No farm access'));
    await http().get('/stock-issues').query({ farmId: farm }).expect(403);
    access.mockRejectedValueOnce(new ForbiddenException('No farm access'));
    await http()
      .get(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .expect(403);
    await http()
      .get(`/stock-issues/${randomUUID()}`)
      .query({ farmId: farm })
      .expect(404);
  });

  it('confirms QUANTITY once and rejects repeat confirmation, editing, and cancellation', async () => {
    const draft = await create([line('1.250')]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance()).toBe('8.750');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CONFIRMED',
      transactions: 1,
    });
    await confirm(draft.issue.id).expect(409);
    await http()
      .patch(`/stock-issues/${draft.issue.id}`)
      .query({ farmId: farm })
      .send({ items: [line('2')] })
      .expect(409);
    await http()
      .post(`/stock-issues/${draft.issue.id}/cancel`)
      .query({ farmId: farm })
      .expect(409);
    expect(await balance()).toBe('8.750');
  });

  it('confirms a mixed maintenance issue atomically and preserves the maintenance record', async () => {
    const { id: recordId } = await maintenance();
    const draft = await create(
      [
        line('2.125'),
        { itemId: lotItem, lotId: lot, quantity: '0.125' },
        assetLine(),
      ],
      { issueType: 'MAINTENANCE', maintenanceRecordId: recordId },
    );
    const response = await confirm(draft.issue.id).expect(201);
    expect((response.body as { data: Detail }).data.issue.status).toBe(
      'CONFIRMED',
    );
    expect(await balance()).toBe('7.875');
    expect(await balance(lotItem)).toBe('9.875');
    expect(await balance(assetItem)).toBe('2.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CONFIRMED',
      transactions: 3,
    });
    const ledger = await pool.query<{
      transaction_type: string;
      lot_id: string | null;
      asset_id: string | null;
    }>(
      'SELECT transaction_type, lot_id, asset_id FROM inventory_transactions WHERE source_id=$1',
      [draft.issue.id],
    );
    expect(
      ledger.rows.every((row) => row.transaction_type === 'MAINTENANCE_ISSUE'),
    ).toBe(true);
    expect(ledger.rows.some((row) => row.lot_id === lot)).toBe(true);
    expect(ledger.rows.some((row) => row.asset_id === assetIds[0])).toBe(true);
    const record = await pool.query<{ status: string }>(
      'SELECT status FROM maintenance_records WHERE id=$1',
      [recordId],
    );
    expect(record.rows[0].status).toBe('SCHEDULED');
    const asset = await pool.query<{
      status: string;
      current_location_id: string;
    }>('SELECT status, current_location_id FROM assets WHERE id=$1', [
      assetIds[0],
    ]);
    expect(asset.rows[0]).toEqual({
      status: 'IN_USE',
      current_location_id: location,
    });
  });

  it('rejects confirmation without write access or with another farm without side effects', async () => {
    const draft = await create([line('2')]);
    access.mockRejectedValueOnce(new ForbiddenException('Read only'));
    await confirm(draft.issue.id).expect(403);
    expect(access).toHaveBeenLastCalledWith(farm, tag, true);
    await http()
      .post(`/stock-issues/${draft.issue.id}/confirm`)
      .query({ farmId: randomUUID() })
      .expect(404);
    expect(await balance()).toBe('10.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
      confirmed_at: null,
    });
  });

  it('confirms LOT and deducts its warehouse balance without changing initial quantity', async () => {
    const draft = await create([
      { itemId: lotItem, lotId: lot, quantity: '0.001' },
    ]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance(lotItem)).toBe('9.999');
    const result = await pool.query<{ initial_quantity: string }>(
      'SELECT initial_quantity FROM inventory_lots WHERE id=$1',
      [lot],
    );
    expect(result.rows[0].initial_quantity).toBe('10.000');
  });

  it('issues multiple individually traceable ASSET lines in one issue, accepting stored 1.000', async () => {
    const draft = await create(assetIds.map(assetLine));
    expect(draft.items.map((item) => item.quantity)).toEqual([
      '1.000',
      '1.000',
      '1.000',
    ]);
    await confirm(draft.issue.id).expect(201);
    expect(await balance(assetItem)).toBe('0.000');
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE farm_id=$1',
      [farm],
    );
    expect(result.rows.map((asset) => asset.status)).toEqual([
      'IN_USE',
      'IN_USE',
      'IN_USE',
    ]);
    const transactions = await pool.query<{ asset_id: string }>(
      'SELECT asset_id FROM inventory_transactions WHERE source_id=$1',
      [draft.issue.id],
    );
    expect(transactions.rows.map((row) => row.asset_id).sort()).toEqual(
      [...assetIds].sort(),
    );
  });

  it.each([
    ['DAMAGE', 'MAINTENANCE'],
    ['DISPOSAL', 'RETIRED'],
    ['OTHER', 'IN_USE'],
  ])('maps ASSET %s issues to %s', async (issueType, status) => {
    const draft = await create([assetLine()], { issueType });
    await confirm(draft.issue.id).expect(201);
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe(status);
    expect(await balance(assetItem)).toBe('2.000');
  });

  it('returns insufficient stock when no balance exists', async () => {
    const draft = await create([line()]);
    await pool.query(
      'DELETE FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farm, quantityItem],
    );
    const response = await confirm(draft.issue.id).expect(409);
    expect((response.body as { message: string }).message).toBe(
      'Insufficient inventory',
    );
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
  });

  it.each(['11', '10.001'])(
    'returns insufficient stock without mutations for quantity %s',
    async (quantity) => {
      const draft = await create([line(quantity)]);
      const result = await confirm(draft.issue.id).expect(409);
      expect((result.body as { message: string }).message).toBe(
        'Insufficient inventory',
      );
      expect(await balance()).toBe('10.000');
      expect(await state(draft.issue.id)).toEqual({
        status: 'DRAFT',
        transactions: 0,
        confirmed_at: null,
      });
    },
  );

  it.each(['0', '0.000', '-1', '-0.001', '0.0001'])(
    'rejects invalid quantity %s at create and update HTTP validation',
    async (quantity) => {
      await http()
        .post('/stock-issues')
        .query({ farmId: farm })
        .send(input([line(quantity)]))
        .expect(400);
      const draft = await create([line()]);
      await http()
        .patch(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: farm })
        .send({ items: [line(quantity)] })
        .expect(400);
    },
  );

  const invalidLines = [
    ['QUANTITY + lotId', () => ({ ...line(), lotId: lot })],
    ['QUANTITY + assetId', () => ({ ...line(), assetId: assetIds[0] })],
    ['LOT without lotId', () => ({ itemId: lotItem, quantity: '1' })],
    [
      'LOT + assetId',
      () => ({
        itemId: lotItem,
        quantity: '1',
        lotId: lot,
        assetId: assetIds[0],
      }),
    ],
    ['ASSET without assetId', () => ({ itemId: assetItem, quantity: '1' })],
    ['ASSET + lotId', () => ({ ...assetLine(), lotId: lot })],
    ['ASSET quantity 2', () => ({ ...assetLine(), quantity: '2' })],
    ['ASSET quantity 0.5', () => ({ ...assetLine(), quantity: '0.5' })],
  ] as const;
  it.each(invalidLines)(
    'rejects %s on creation and editing',
    async (_name, invalid) => {
      await http()
        .post('/stock-issues')
        .query({ farmId: farm })
        .send(input([invalid()]))
        .expect(400);
      const draft = await create([line()]);
      await http()
        .patch(`/stock-issues/${draft.issue.id}`)
        .query({ farmId: farm })
        .send({ items: [invalid()] })
        .expect(400);
    },
  );

  it.each(invalidLines.slice(0, 6))(
    'revalidates legacy persisted %s at confirmation',
    async (_name, invalid) => {
      const draft = await create([line()]);
      await pool.query(
        'DELETE FROM stock_issue_items WHERE stock_issue_id=$1',
        [draft.issue.id],
      );
      await db
        .insert(schema.stockIssueItems)
        .values({ stockIssueId: draft.issue.id, ...invalid() });
      await confirm(draft.issue.id).expect(400);
      expect(await balance()).toBe('10.000');
      expect(await state(draft.issue.id)).toMatchObject({
        status: 'DRAFT',
        transactions: 0,
      });
    },
  );

  it.each([otherLocation, null])(
    'rejects an asset outside the source warehouse (location %s)',
    async (currentLocation) => {
      const draft = await create([assetLine()]);
      await pool.query('UPDATE assets SET current_location_id=$2 WHERE id=$1', [
        assetIds[0],
        currentLocation,
      ]);
      await confirm(draft.issue.id).expect(409);
      expect(await balance(assetItem)).toBe('3.000');
      expect(await state(draft.issue.id)).toMatchObject({
        status: 'DRAFT',
        transactions: 0,
      });
    },
  );

  it.each(['ASSIGNED', 'IN_USE', 'MAINTENANCE', 'LOST', 'RETIRED'])(
    'rejects unavailable ASSET status %s',
    async (status) => {
      const draft = await create([assetLine()]);
      await pool.query('UPDATE assets SET status=$2 WHERE id=$1', [
        assetIds[0],
        status,
      ]);
      await confirm(draft.issue.id).expect(409);
      expect(await balance(assetItem)).toBe('3.000');
    },
  );

  it('rolls back previous lines when one physical asset is listed twice', async () => {
    const draft = await create([assetLine(), assetLine()]);
    await confirm(draft.issue.id).expect(409);
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'DRAFT',
      transactions: 0,
    });
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe('AVAILABLE');
  });

  it('rejects an expired LOT without inventory mutations', async () => {
    const draft = await create([
      { itemId: lotItem, lotId: lot, quantity: '1' },
    ]);
    await pool.query(
      "UPDATE inventory_lots SET expiry_date='2000-01-01' WHERE id=$1",
      [lot],
    );
    await confirm(draft.issue.id).expect(409);
    expect(await balance(lotItem)).toBe('10.000');
  });

  it('rolls back balance and asset changes when transaction creation fails', async () => {
    const draft = await create([assetLine()]);
    const actualDb = drizzle(pool, { schema });
    const spy = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce((callback) =>
        actualDb.transaction(async (tx) => {
          jest.spyOn(tx, 'insert').mockImplementation(() => {
            throw new Error('Forced transaction creation failure');
          });
          return callback(tx);
        }),
      );
    try {
      await confirm(draft.issue.id).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toEqual({
      status: 'DRAFT',
      transactions: 0,
      confirmed_at: null,
    });
    const result = await pool.query<{
      status: string;
      current_location_id: string;
    }>('SELECT status,current_location_id FROM assets WHERE id=$1', [
      assetIds[0],
    ]);
    expect(result.rows[0]).toEqual({
      status: 'AVAILABLE',
      current_location_id: location,
    });
  });

  it('rolls back all writes, including ledger and status, on a late failure', async () => {
    const draft = await create([
      line(),
      { itemId: lotItem, lotId: lot, quantity: '1' },
      assetLine(),
    ]);
    const actualDb = drizzle(pool, { schema });
    const spy = jest
      .spyOn(db, 'transaction')
      .mockImplementationOnce((callback) =>
        actualDb.transaction(async (tx) => {
          await callback(tx);
          throw new Error('Forced failure before commit');
        }),
      );
    try {
      await confirm(draft.issue.id).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await balance()).toBe('10.000');
    expect(await balance(lotItem)).toBe('10.000');
    expect(await balance(assetItem)).toBe('3.000');
    expect(await state(draft.issue.id)).toEqual({
      status: 'DRAFT',
      transactions: 0,
      confirmed_at: null,
    });
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM assets WHERE id=$1',
      [assetIds[0]],
    );
    expect(result.rows[0].status).toBe('AVAILABLE');
  });

  // Hold a real row lock until both HTTP requests are waiting inside PostgreSQL.
  // This makes races reproducible rather than relying on Promise.all timing.
  const race = async (
    lockSql: string,
    params: string[],
    operations: (() => PromiseLike<request.Response>)[],
  ) => {
    const blocker = await pool.connect();
    const pending: Promise<request.Response>[] = [];
    let waiting = 0;
    try {
      await blocker.query('BEGIN');
      await blocker.query(lockSql, params);
      pending.push(
        ...operations.map((operation) => Promise.resolve(operation())),
      );
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = await pool.query<{ count: number }>(
          "SELECT count(*)::int FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [tag],
        );
        waiting = result.rows[0].count;
        if (waiting >= operations.length) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    const results = await Promise.all(pending);
    expect(waiting).toBeGreaterThanOrEqual(operations.length);
    return results;
  };

  it('allows exactly one of two concurrent confirmations of the same issue', async () => {
    const draft = await create([line('7')]);
    const results = await race(
      'SELECT id FROM stock_issues WHERE id=$1 FOR UPDATE',
      [draft.issue.id],
      [() => confirm(draft.issue.id), () => confirm(draft.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance()).toBe('3.000');
    expect(await state(draft.issue.id)).toMatchObject({
      status: 'CONFIRMED',
      transactions: 1,
    });
  });

  it('returns insufficient stock when two issues compete for 10 units with requests of 7 and 6', async () => {
    const a = await create([line('7')]),
      b = await create([line('6')]);
    const results = await race(
      'SELECT id FROM inventory_balances WHERE farm_id=$1 AND item_id=$2 FOR UPDATE',
      [farm, quantityItem],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      (
        results.find((result) => result.status === 409)!.body as {
          message: string;
        }
      ).message,
    ).toBe('Insufficient inventory');
    expect(await balance()).toBe(results[0].status === 201 ? '3.000' : '4.000');
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.map((result) => result.status).sort()).toEqual([
      'CONFIRMED',
      'DRAFT',
    ]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      1,
    );
  });

  it('prevents two different issues from consuming the same asset', async () => {
    const a = await create([assetLine()]),
      b = await create([assetLine()]);
    const results = await race(
      'SELECT id FROM assets WHERE id=$1 FOR UPDATE',
      [assetIds[0]],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance(assetItem)).toBe('2.000');
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      1,
    );
  });

  it('serializes overlapping multi-asset issues without a deadlock or partial issue', async () => {
    const a = await create(assetIds.map(assetLine));
    const b = await create([assetLine([...assetIds].sort()[2])]);
    const results = await race(
      'SELECT id FROM inventory_balances WHERE farm_id=$1 AND item_id=$2 FOR UPDATE',
      [farm, assetItem],
      [() => confirm(a.issue.id), () => confirm(b.issue.id)],
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance(assetItem)).toBe(
      results[0].status === 201 ? '0.000' : '2.000',
    );
    const states = await Promise.all([state(a.issue.id), state(b.issue.id)]);
    expect(states.map((result) => result.status).sort()).toEqual([
      'CONFIRMED',
      'DRAFT',
    ]);
    expect(states.reduce((sum, result) => sum + result.transactions, 0)).toBe(
      results[0].status === 201 ? 3 : 1,
    );
  });

  it.each(['edit', 'cancel'])(
    'serializes confirmation against a concurrent %s',
    async (operation) => {
      const draft = await create([line('2')]);
      const results = await race(
        'SELECT id FROM stock_issues WHERE id=$1 FOR UPDATE',
        [draft.issue.id],
        [
          () => confirm(draft.issue.id),
          () =>
            operation === 'edit'
              ? http()
                  .patch(`/stock-issues/${draft.issue.id}`)
                  .query({ farmId: farm })
                  .send({ items: [line('4')] })
              : http()
                  .post(`/stock-issues/${draft.issue.id}/cancel`)
                  .query({ farmId: farm }),
        ],
      );
      if (operation === 'cancel') {
        expect(results.map((result) => result.status).sort()).toEqual([
          201, 409,
        ]);
        expect(await balance()).toBe(
          results[0].status === 201 ? '8.000' : '10.000',
        );
        expect(await state(draft.issue.id)).toMatchObject({
          status: results[0].status === 201 ? 'CONFIRMED' : 'CANCELLED',
          transactions: results[0].status === 201 ? 1 : 0,
        });
      } else {
        expect(results[0].status).toBe(201);
        expect([200, 409]).toContain(results[1].status);
        expect(await balance()).toBe(
          results[1].status === 200 ? '6.000' : '8.000',
        );
        expect(await state(draft.issue.id)).toMatchObject({
          status: 'CONFIRMED',
          transactions: 1,
        });
      }
    },
  );
});

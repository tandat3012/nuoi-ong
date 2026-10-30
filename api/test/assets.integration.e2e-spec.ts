import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { AssetsController } from '../src/modules/assets/assets.controller';
import { AssetHistoryService } from '../src/modules/assets/asset-history.service';
import { AssetLifecycleService } from '../src/modules/assets/asset-lifecycle.service';
import { AssetsService } from '../src/modules/assets/assets.service';
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsController } from '../src/modules/warehouses/stock-receipts.controller';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { MaintenanceController } from '../src/modules/maintenance/maintenance.controller';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';

type AssetView = Awaited<ReturnType<AssetsService['getAsset']>>;
type AssetList = Awaited<ReturnType<AssetsService['listAssets']>>;
type ApiResponse = { status: number; body: unknown };

jest.setTimeout(60000);

describe('Asset HTTP and PostgreSQL consistency', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  const suffix = randomUUID().slice(0, 8);
  const tag = `asset-test-${suffix}`;
  const farmId = randomUUID();
  const foreignFarmId = randomUUID();
  const categoryId = randomUUID();
  const unitId = randomUUID();
  const itemId = randomUUID();
  const foreignItemId = randomUUID();
  const warehouseId = randomUUID();
  const destinationWarehouseId = randomUUID();
  const inactiveWarehouseId = randomUUID();
  const foreignWarehouseId = randomUUID();
  const locationId = randomUUID();
  const destinationLocationId = randomUUID();
  const inactiveLocationId = randomUUID();
  const wrongWarehouseLocationId = randomUUID();
  const foreignLocationId = randomUUID();
  const assetIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const foreignAssetId = randomUUID();
  const qrTokens = assetIds.map(() => randomUUID());
  const foreignQrToken = randomUUID();
  const ownerIdentity = `${tag}-owner`;
  const guestIdentity = `${tag}-guest`;
  const inactiveMemberIdentity = `${tag}-inactive-member`;
  const inactiveUserIdentity = `${tag}-inactive-user`;
  const noMemberIdentity = `${tag}-no-member`;
  let ownerMemberId: string;
  let guestMemberId: string;
  let app: INestApplication<App>;
  let identity = ownerIdentity;
  const http = () => request(app.getHttpServer());

  const returnAsset = async (
    id: string = assetIds[0],
    body: Record<string, unknown> = {
      warehouseId: destinationWarehouseId,
      locationId: destinationLocationId,
    },
  ): Promise<ApiResponse> => {
    const response = await http()
      .post(`/api/v1/assets/${id}/return`)
      .query({ farmId })
      .send(body);
    return { status: response.status, body: response.body as unknown };
  };

  const issueInput = (assetId: string, sourceWarehouseId: string) => ({
    warehouseId: sourceWarehouseId,
    issueCode: `${tag}-${randomUUID().slice(0, 20)}`,
    items: [{ itemId, assetId, quantity: '1' }],
  });

  const createIssue = async (assetId: string, sourceWarehouseId: string) => {
    const response = await http()
      .post('/api/v1/stock-issues')
      .query({ farmId })
      .send(issueInput(assetId, sourceWarehouseId));
    if (response.status !== 201)
      throw new Error(
        `create issue failed: ${response.status} ${JSON.stringify(response.body as unknown)}`,
      );
    return (response.body as unknown as { data: { issue: { id: string } } })
      .data.issue.id;
  };

  const confirmIssue = (id: string) =>
    http().post(`/api/v1/stock-issues/${id}/confirm`).query({ farmId });

  const scheduleMaintenance = async (assetId: string) => {
    const response = await http()
      .post('/api/v1/maintenance-records')
      .query({ farmId })
      .send({ assetId, maintenanceType: 'INSPECTION' })
      .expect(201);
    return (response.body as unknown as { data: { id: string } }).data.id;
  };

  const maintenanceAction = (id: string, action: string) =>
    http()
      .post(`/api/v1/maintenance-records/${id}/${action}`)
      .query({ farmId });

  const assetAction = (
    id: string,
    action: string,
    body: Record<string, unknown> = {},
  ) =>
    http().post(`/api/v1/assets/${id}/${action}`).query({ farmId }).send(body);

  const assignmentInput = () => ({
    assignedToMemberId: guestMemberId,
    locationId,
  });
  const destinationInput = () => ({
    warehouseId: destinationWarehouseId,
    locationId: destinationLocationId,
  });
  const incidentInput = (incidentType = 'LOSS') => ({
    incidentType,
    description: 'Asset incident acceptance',
    severity: 'HIGH',
  });
  const reportIncident = async (id: string, incidentType = 'LOSS') => {
    const response = await assetAction(
      id,
      'incidents',
      incidentInput(incidentType),
    ).expect(201);
    return (response.body as unknown as { data: { id: string } }).data.id;
  };

  const assignments = async (id: string) => {
    const result = await pool.query<{
      status: string;
      assigned_to_member_id: string;
    }>(
      'SELECT status,assigned_to_member_id FROM asset_assignments WHERE farm_id=$1 AND asset_id=$2 ORDER BY assigned_at,id',
      [farmId, id],
    );
    return result.rows;
  };

  const incident = async (id: string) => {
    const result = await pool.query<{
      status: string;
      resolved_at: Date | null;
    }>('SELECT status,resolved_at FROM asset_incidents WHERE id=$1', [id]);
    return result.rows[0];
  };

  const auditActions = async (id: string) => {
    const result = await pool.query<{ action: string }>(
      'SELECT action FROM audit_logs WHERE farm_id=$1 AND entity_id=$2 ORDER BY created_at,id',
      [farmId, id],
    );
    return result.rows.map((row) => row.action);
  };

  const lifecycleState = () =>
    Promise.all(
      [
        'assets',
        'asset_assignments',
        'asset_incidents',
        'inventory_balances',
        'inventory_transactions',
        'audit_logs',
      ].map(async (table) => {
        const result = await pool.query<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE farm_id=$1 ORDER BY id`,
          [farmId],
        );
        return result.rows;
      }),
    );

  const withWriteFailure = async (
    table: 'audit_logs' | 'inventory_transactions',
    id: string,
    action: string,
    check: () => Promise<void>,
  ) => {
    const name = `asset_fail_${randomUUID().replaceAll('-', '')}`;
    const entityColumn = table === 'audit_logs' ? 'entity_id' : 'asset_id';
    const actionColumn = table === 'audit_logs' ? 'action' : 'transaction_type';
    const client = await pool.connect();
    try {
      await client.query(
        `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.farm_id = '${farmId}'::uuid AND NEW.${entityColumn} = '${id}'::uuid AND NEW.${actionColumn} = '${action.replaceAll("'", "''")}' THEN RAISE EXCEPTION 'injected asset write failure'; END IF; RETURN NEW; END $body$`,
      );
      await client.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION public.${name}()`,
      );
      await check();
    } finally {
      await client.query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);
      await client.query(`DROP FUNCTION IF EXISTS public.${name}()`);
      client.release();
    }
  };

  const readAsset = async (id: string) => {
    const result = await pool.query<{
      status: string;
      item_id: string;
      current_location_id: string | null;
    }>('SELECT status, item_id, current_location_id FROM assets WHERE id=$1', [
      id,
    ]);
    return result.rows[0];
  };

  const balance = async (warehouse: string, item = itemId) => {
    const result = await pool.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND warehouse_id=$2 AND item_id=$3 AND lot_id IS NULL',
      [farmId, warehouse, item],
    );
    return result.rows[0]?.quantity;
  };

  const seedBalance = async (
    warehouse = warehouseId,
    quantity = '1',
    item = itemId,
  ) =>
    pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,lot_id,quantity_on_hand) VALUES ($1,$2,$3,NULL,$4) ON CONFLICT (item_id,lot_id,warehouse_id) DO UPDATE SET quantity_on_hand=EXCLUDED.quantity_on_hand',
      [farmId, warehouse, item, quantity],
    );

  const transactionRows = async (assetId: string) => {
    const result = await pool.query<{
      transaction_type: string;
      quantity_change: string;
      source_type: string;
      source_id: string;
      movement_group_id: string | null;
      warehouse_id: string;
    }>(
      'SELECT transaction_type,quantity_change,source_type,source_id,movement_group_id,warehouse_id FROM inventory_transactions WHERE farm_id=$1 AND asset_id=$2 ORDER BY created_at,id',
      [farmId, assetId],
    );
    return result.rows;
  };

  const movements = async (assetId: string, sourceType = 'ASSET_RETURN') => {
    const result = await pool.query<{ count: string; quantity: string | null }>(
      'SELECT count(*)::text AS count, sum(quantity_change)::text AS quantity FROM inventory_transactions WHERE farm_id=$1 AND asset_id=$2 AND source_type=$3',
      [farmId, assetId, sourceType],
    );
    return result.rows[0];
  };

  const resetData = async () => {
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM stock_issues WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM maintenance_records WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query('DELETE FROM asset_incidents WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM asset_assignments WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
      farmId,
    ]);
    await pool.query(
      'UPDATE assets SET source_receipt_item_id=NULL WHERE farm_id=$1',
      [farmId],
    );
    await pool.query('DELETE FROM assets WHERE farm_id=$1', [farmId]);
    await pool.query('DELETE FROM assets WHERE id=$1', [foreignAssetId]);
    await pool.query('DELETE FROM stock_receipts WHERE farm_id=$1', [farmId]);
    await pool.query(
      "UPDATE warehouses SET status='ACTIVE' WHERE id=ANY($1::uuid[])",
      [[warehouseId, destinationWarehouseId, foreignWarehouseId]],
    );
    await pool.query("UPDATE warehouses SET status='INACTIVE' WHERE id=$1", [
      inactiveWarehouseId,
    ]);
    await pool.query(
      "UPDATE locations SET status='ACTIVE' WHERE id=ANY($1::uuid[])",
      [
        [
          locationId,
          destinationLocationId,
          wrongWarehouseLocationId,
          foreignLocationId,
        ],
      ],
    );
    await pool.query("UPDATE locations SET status='INACTIVE' WHERE id=$1", [
      inactiveLocationId,
    ]);
    await pool.query(
      'INSERT INTO assets (id,farm_id,item_id,asset_code,qr_token,status,current_location_id) VALUES ($1,$3,$7,$8,$9,$10,$11),($2,$3,$7,$12,$13,$10,$11),($4,$3,$7,$14,$15,$16,$11),($5,$3,$7,$17,$18,$10,$19),($6,$20,$21,$22,$23,$10,$24)',
      [
        assetIds[0],
        assetIds[1],
        farmId,
        assetIds[2],
        assetIds[3],
        foreignAssetId,
        itemId,
        `${tag}-A1`,
        qrTokens[0],
        'IN_USE',
        locationId,
        `${tag}-A2`,
        qrTokens[1],
        `${tag}-A3`,
        qrTokens[2],
        'AVAILABLE',
        `${tag}-A4`,
        qrTokens[3],
        null,
        foreignFarmId,
        foreignItemId,
        `${tag}-FOREIGN`,
        foreignQrToken,
        foreignLocationId,
      ],
    );
    await pool.query(
      'INSERT INTO asset_assignments (farm_id,asset_id,assigned_to_member_id,assigned_by_member_id,status) VALUES ($1,$2,$3,$3,$4)',
      [farmId, assetIds[0], ownerMemberId, 'ACTIVE'],
    );
  };

  beforeAll(async () => {
    await pool.query(
      "INSERT INTO roles (code,name,scope) VALUES ('FARM_OWNER','Test owner','FARM'),('GUEST','Test reader','FARM') ON CONFLICT (code) DO NOTHING",
    );
    const roles = await pool.query<{ id: string; code: string }>(
      "SELECT id,code FROM roles WHERE code IN ('FARM_OWNER','GUEST')",
    );
    const ownerRoleId = roles.rows.find(
      (role) => role.code === 'FARM_OWNER',
    )?.id;
    const guestRoleId = roles.rows.find((role) => role.code === 'GUEST')?.id;
    expect(ownerRoleId).toBeDefined();
    expect(guestRoleId).toBeDefined();

    await pool.query(
      'INSERT INTO farms (id,code,name) VALUES ($1,$2,$2),($3,$4,$4)',
      [farmId, `${tag}-A`, foreignFarmId, `${tag}-B`],
    );
    await pool.query(
      'INSERT INTO users (id,auth_provider_user_id,email,status) VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12),($13,$14,$15,$16),($17,$18,$19,$20)',
      [
        randomUUID(),
        ownerIdentity,
        `${ownerIdentity}@example.local`,
        'ACTIVE',
        randomUUID(),
        guestIdentity,
        `${guestIdentity}@example.local`,
        'ACTIVE',
        randomUUID(),
        inactiveMemberIdentity,
        `${inactiveMemberIdentity}@example.local`,
        'ACTIVE',
        randomUUID(),
        inactiveUserIdentity,
        `${inactiveUserIdentity}@example.local`,
        'INACTIVE',
        randomUUID(),
        noMemberIdentity,
        `${noMemberIdentity}@example.local`,
        'ACTIVE',
      ],
    );
    const users = await pool.query<{
      id: string;
      auth_provider_user_id: string;
    }>(
      'SELECT id,auth_provider_user_id FROM users WHERE auth_provider_user_id = ANY($1::varchar[])',
      [
        [
          ownerIdentity,
          guestIdentity,
          inactiveMemberIdentity,
          inactiveUserIdentity,
        ],
      ],
    );
    const userId = (authId: string) =>
      users.rows.find((user) => user.auth_provider_user_id === authId)!.id;
    ownerMemberId = randomUUID();
    guestMemberId = randomUUID();
    const inactiveMemberId = randomUUID();
    const inactiveUserMemberId = randomUUID();
    await pool.query(
      'INSERT INTO farm_members (id,farm_id,user_id,status) VALUES ($1,$2,$3,$4),($5,$2,$6,$4),($7,$2,$8,$9),($10,$2,$11,$4)',
      [
        ownerMemberId,
        farmId,
        userId(ownerIdentity),
        'ACTIVE',
        guestMemberId,
        userId(guestIdentity),
        inactiveMemberId,
        userId(inactiveMemberIdentity),
        'INACTIVE',
        inactiveUserMemberId,
        userId(inactiveUserIdentity),
      ],
    );
    await pool.query(
      'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2),($3,$4),($5,$2),($6,$2)',
      [
        ownerMemberId,
        ownerRoleId,
        guestMemberId,
        guestRoleId,
        inactiveMemberId,
        inactiveUserMemberId,
      ],
    );
    await pool.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, `${tag}-category`],
    );
    await pool.query('INSERT INTO units (id,code,name) VALUES ($1,$2,$2)', [
      unitId,
      `${tag}-unit`,
    ]);
    await pool.query(
      'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode) VALUES ($1,$2,$3,$4,$5,$5,$6,$7),($8,$9,$3,$4,$10,$10,$6,$7)',
      [
        itemId,
        farmId,
        categoryId,
        unitId,
        `${tag}-item`,
        'EQUIPMENT',
        'ASSET',
        foreignItemId,
        foreignFarmId,
        `${tag}-foreign-item`,
      ],
    );
    await pool.query(
      'INSERT INTO warehouses (id,farm_id,code,name,status) VALUES ($1,$2,$3,$3,$6),($4,$2,$5,$5,$6),($7,$2,$8,$8,$9),($10,$11,$12,$12,$6)',
      [
        warehouseId,
        farmId,
        `${tag}-warehouse-a`,
        destinationWarehouseId,
        `${tag}-warehouse-b`,
        'ACTIVE',
        inactiveWarehouseId,
        `${tag}-warehouse-inactive`,
        'INACTIVE',
        foreignWarehouseId,
        foreignFarmId,
        `${tag}-warehouse-foreign`,
      ],
    );
    await pool.query(
      "INSERT INTO locations (id,farm_id,warehouse_id,code,name,type,status) VALUES ($1,$2,$3,$5,$5,'WAREHOUSE_ZONE',$8),($4,$2,$6,$7,$7,'WAREHOUSE_ZONE',$8),($9,$2,$6,$10,$10,'WAREHOUSE_ZONE',$11),($12,$2,$3,$13,$13,'WAREHOUSE_ZONE',$8),($14,$15,$16,$17,$17,'WAREHOUSE_ZONE',$8)",
      [
        locationId,
        farmId,
        warehouseId,
        destinationLocationId,
        `${tag}-location-a`,
        destinationWarehouseId,
        `${tag}-location-b`,
        'ACTIVE',
        inactiveLocationId,
        `${tag}-location-inactive`,
        'INACTIVE',
        wrongWarehouseLocationId,
        `${tag}-location-other`,
        foreignLocationId,
        foreignFarmId,
        foreignWarehouseId,
        `${tag}-location-foreign`,
      ],
    );

    const module = await Test.createTestingModule({
      controllers: [
        AssetsController,
        StockIssuesController,
        StockReceiptsController,
        MaintenanceController,
      ],
      providers: [
        AssetsService,
        AssetLifecycleService,
        AssetHistoryService,
        StockIssuesService,
        StockReceiptsService,
        MaintenanceService,
        WarehousesService,
        FarmAccessGuard,
        {
          provide: DatabaseService,
          useValue: { db: drizzle(pool, { schema }) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
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
          clerkUserId: identity,
        };
        return true;
      },
    });
    await app.init();
    await resetData();
  });

  beforeEach(async () => {
    identity = ownerIdentity;
    await resetData();
  });

  afterAll(async () => {
    await app?.close();
    try {
      await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
        farmId,
      ]);
      await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farmId]);
      await pool.query('DELETE FROM stock_issues WHERE farm_id=$1', [farmId]);
      await pool.query('DELETE FROM maintenance_records WHERE farm_id=$1', [
        farmId,
      ]);
      await pool.query('DELETE FROM asset_incidents WHERE farm_id=$1', [
        farmId,
      ]);
      await pool.query('DELETE FROM asset_assignments WHERE farm_id=$1', [
        farmId,
      ]);
      await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
        farmId,
      ]);
      await pool.query(
        'UPDATE assets SET source_receipt_item_id=NULL WHERE farm_id=$1',
        [farmId],
      );
      await pool.query('DELETE FROM assets WHERE farm_id=$1', [farmId]);
      await pool.query('DELETE FROM assets WHERE id=$1', [foreignAssetId]);
      await pool.query('DELETE FROM stock_receipts WHERE farm_id=$1', [farmId]);
      await pool.query('DELETE FROM locations WHERE farm_id=ANY($1::uuid[])', [
        [farmId, foreignFarmId],
      ]);
      await pool.query('DELETE FROM warehouses WHERE farm_id=ANY($1::uuid[])', [
        [farmId, foreignFarmId],
      ]);
      await pool.query('DELETE FROM items WHERE id=ANY($1::uuid[])', [
        [itemId, foreignItemId],
      ]);
      await pool.query('DELETE FROM categories WHERE id=$1', [categoryId]);
      await pool.query('DELETE FROM units WHERE id=$1', [unitId]);
      await pool.query('DELETE FROM farm_members WHERE farm_id=$1', [farmId]);
      await pool.query(
        'DELETE FROM users WHERE auth_provider_user_id = ANY($1::varchar[])',
        [
          [
            ownerIdentity,
            guestIdentity,
            inactiveMemberIdentity,
            inactiveUserIdentity,
            noMemberIdentity,
          ],
        ],
      );
      await pool.query('DELETE FROM farms WHERE id=ANY($1::uuid[])', [
        [farmId, foreignFarmId],
      ]);
    } finally {
      await pool.end();
    }
  });

  it('allows one concurrent return of an asset and records one movement', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await resetData();
      const responses: ApiResponse[] = await Promise.all(
        Array.from({ length: 4 }, () => returnAsset(assetIds[0])),
      );
      expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
      expect(
        responses.every(({ status }) => status === 201 || status === 409),
      ).toBe(true);
      expect(await balance(destinationWarehouseId)).toBe('1.000');
      expect(await movements(assetIds[0])).toMatchObject({ count: '1' });
    }
  });

  it('updates the physical location when returning to another warehouse', async () => {
    const response = await returnAsset(assetIds[0]);
    expect(response.status).toBe(201);
    expect((await readAsset(assetIds[0])).current_location_id).toBe(
      destinationLocationId,
    );
  });

  it('serves farm-scoped list, detail, exact code, and QR reads', async () => {
    const list = await http()
      .get('/api/v1/assets')
      .query({ farmId, status: 'IN_USE', warehouseId, locationId })
      .expect(200);
    const listBody = list.body as unknown as AssetList;
    expect(listBody.data).toHaveLength(2);
    expect(listBody.data.every((row) => row.asset.farmId === farmId)).toBe(
      true,
    );
    expect(listBody.page).toMatchObject({
      number: 1,
      size: 20,
      totalItems: 2,
    });

    const detail = await http()
      .get(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .expect(200);
    const detailBody = detail.body as unknown as { data: AssetView };
    expect(detailBody.data).toMatchObject({
      asset: { id: assetIds[0], farmId, currentLocationId: locationId },
      itemCode: `${tag}-item`,
      locationWarehouseId: warehouseId,
    });
    await http()
      .get(`/api/v1/assets/by-code/${tag}-A1`)
      .query({ farmId })
      .expect(200);
    await http()
      .get('/api/v1/assets/by-code/%20%20')
      .query({ farmId })
      .expect(400);
    await http()
      .get(`/api/v1/assets/by-code/${'A'.repeat(101)}`)
      .query({ farmId })
      .expect(400);
    await http()
      .get(`/api/v1/assets/by-qr/${qrTokens[0]}`)
      .query({ farmId })
      .expect(200);
    await http()
      .get(`/api/v1/assets/${foreignAssetId}`)
      .query({ farmId })
      .expect(404);
    await http()
      .get(`/api/v1/assets/by-code/${tag}-FOREIGN`)
      .query({ farmId })
      .expect(404);
    await http()
      .get(`/api/v1/assets/by-qr/${foreignQrToken}`)
      .query({ farmId })
      .expect(404);
    await http()
      .get(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId: foreignFarmId })
      .expect(403);
  });

  it('serves paged active members, current holder, normalized history, and QR SVG', async () => {
    const members = await http()
      .get('/api/v1/assets/members')
      .query({ farmId, page: 1, pageSize: 1, search: tag })
      .expect(200);
    expect(members.body as unknown).toMatchObject({
      page: { number: 1, size: 1, totalItems: 2, totalPages: 2 },
    });
    const memberRows = (
      members.body as unknown as { data: { id: string; email: string }[] }
    ).data;
    expect(memberRows).toHaveLength(1);
    expect(typeof memberRows[0].id).toBe('string');
    expect(memberRows[0].email).toContain(tag);

    const holder = await http()
      .get(`/api/v1/assets/${assetIds[0]}/holder`)
      .query({ farmId })
      .expect(200);
    expect(holder.body).toMatchObject({
      data: {
        assignedToMemberId: ownerMemberId,
        memberName: `${ownerIdentity}@example.local`,
        expectedReturnAt: null,
      },
    });

    for (const kind of [
      'assignments',
      'incidents',
      'maintenance',
      'movements',
      'changes',
    ]) {
      const history = await http()
        .get(`/api/v1/assets/${assetIds[0]}/history`)
        .query({ farmId, kind, page: 1, pageSize: 5 })
        .expect(200);
      expect(history.body as unknown).toMatchObject({
        page: { number: 1, size: 5 },
      });
      const rows = (
        history.body as unknown as { data: Record<string, unknown>[] }
      ).data;
      expect(Array.isArray(rows)).toBe(true);
      for (const row of rows) {
        for (const field of ['id', 'at', 'title', 'detail'])
          expect(typeof row[field]).toBe('string');
        expect(row.status === null || typeof row.status === 'string').toBe(
          true,
        );
        expect(
          row.referenceId === null || typeof row.referenceId === 'string',
        ).toBe(true);
      }
    }
    await http()
      .get(`/api/v1/assets/${foreignAssetId}/holder`)
      .query({ farmId })
      .expect(404);
    await http()
      .get(`/api/v1/assets/${assetIds[0]}/history`)
      .query({ farmId, kind: 'unknown' })
      .expect(400);

    const label = await http()
      .get(`/api/v1/assets/${assetIds[0]}/label`)
      .query({ farmId })
      .expect(200);
    const labelData = (
      label.body as unknown as { data: { assetCode: string; svg: string } }
    ).data;
    expect(labelData.assetCode).toBe(`${tag}-A1`);
    expect(labelData.svg).toContain('<svg');
  });

  it('assigns, starts use, reassigns, and returns with exactly one unit moved', async () => {
    await seedBalance(warehouseId, '1');
    const assigned = await http()
      .post(`/api/v1/assets/${assetIds[2]}/assign`)
      .query({ farmId })
      .send({
        assignedToMemberId: guestMemberId,
        locationId,
        expectedReturnAt: '2026-11-01T12:00:00.000Z',
        note: 'Field work',
      })
      .expect(201);
    expect(assigned.body as unknown).toMatchObject({
      data: {
        id: assetIds[2],
        status: 'ASSIGNED',
        currentLocationId: locationId,
      },
    });
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await transactionRows(assetIds[2])).toMatchObject([
      {
        transaction_type: 'ASSIGNMENT_OUT',
        quantity_change: '-1.000',
        source_type: 'ASSET_ASSIGNMENT',
      },
    ]);

    await http()
      .post(`/api/v1/assets/${assetIds[2]}/start-use`)
      .query({ farmId })
      .send({})
      .expect(201);
    expect((await readAsset(assetIds[2])).status).toBe('IN_USE');

    await http()
      .post(`/api/v1/assets/${assetIds[2]}/assign`)
      .query({ farmId })
      .send({ assignedToMemberId: ownerMemberId, locationId })
      .expect(201);
    await http()
      .post(`/api/v1/assets/${assetIds[2]}/assign`)
      .query({ farmId })
      .send({ assignedToMemberId: ownerMemberId, locationId })
      .expect(409);
    expect((await readAsset(assetIds[2])).status).toBe('IN_USE');
    expect(await transactionRows(assetIds[2])).toHaveLength(1);
    const assignmentRows = await pool.query<{ status: string }>(
      'SELECT status FROM asset_assignments WHERE farm_id=$1 AND asset_id=$2 ORDER BY assigned_at,id',
      [farmId, assetIds[2]],
    );
    expect(assignmentRows.rows.map((row) => row.status).sort()).toEqual([
      'ACTIVE',
      'CANCELLED',
    ]);

    const holder = await http()
      .get(`/api/v1/assets/${assetIds[2]}/holder`)
      .query({ farmId })
      .expect(200);
    expect(holder.body as unknown).toMatchObject({
      data: {
        assignedToMemberId: ownerMemberId,
        memberName: `${ownerIdentity}@example.local`,
      },
    });
    await http()
      .post(`/api/v1/assets/${assetIds[2]}/return`)
      .query({ farmId })
      .send({
        warehouseId: destinationWarehouseId,
        locationId: destinationLocationId,
      })
      .expect(201);
    expect((await readAsset(assetIds[2])).status).toBe('AVAILABLE');
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    expect(await transactionRows(assetIds[2])).toMatchObject([
      { transaction_type: 'ASSIGNMENT_OUT', quantity_change: '-1.000' },
      { transaction_type: 'RETURN_IN', quantity_change: '1.000' },
    ]);
    await http()
      .get(`/api/v1/assets/${assetIds[2]}/holder`)
      .query({ farmId })
      .expect(200)
      .then((response) =>
        expect(response.body as unknown).toMatchObject({ data: null }),
      );
  });

  it('serializes duplicate assignment requests and moves stock only once', async () => {
    await seedBalance(warehouseId, '1');
    const sendAssignment = () =>
      http()
        .post(`/api/v1/assets/${assetIds[2]}/assign`)
        .query({ farmId })
        .send({ assignedToMemberId: guestMemberId, locationId });
    const results = await Promise.all([sendAssignment(), sendAssignment()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await balance(warehouseId)).toBe('0.000');
    expect(
      (await transactionRows(assetIds[2])).filter(
        (row) => row.transaction_type === 'ASSIGNMENT_OUT',
      ),
    ).toHaveLength(1);
    const reassignment = () =>
      http()
        .post(`/api/v1/assets/${assetIds[2]}/assign`)
        .query({ farmId })
        .send({ assignedToMemberId: ownerMemberId, locationId });
    const concurrent = await Promise.all([reassignment(), reassignment()]);
    expect(concurrent.map((result) => result.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      (
        await pool.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM asset_assignments WHERE farm_id=$1 AND asset_id=$2 AND status='ACTIVE'",
          [farmId, assetIds[2]],
        )
      ).rows[0].count,
    ).toBe('1');
    expect(await transactionRows(assetIds[2])).toHaveLength(1);
  });

  it('creates a manual ASSET atomically with one balance unit and receipt ledger', async () => {
    const assetCode = `${tag}-manual`;
    const input = {
      itemId,
      warehouseId,
      locationId,
      assetCode,
      serialNumber: `${tag}-serial-manual`,
      purchaseDate: '2026-10-01',
      purchasePrice: '1250000.50',
      warrantyExpiryDate: '2027-10-01',
      note: 'Manual asset intake',
    };
    const response = await http()
      .post('/api/v1/assets')
      .query({ farmId })
      .send(input)
      .expect(201);
    const assetId = (response.body as unknown as { data: { id: string } }).data
      .id;
    expect(response.body as unknown).toMatchObject({
      data: {
        farmId,
        itemId,
        currentLocationId: locationId,
        assetCode,
        serialNumber: input.serialNumber,
        purchasePrice: input.purchasePrice,
        status: 'AVAILABLE',
      },
    });
    expect(await balance(warehouseId)).toBe('1.000');
    expect(await transactionRows(assetId)).toMatchObject([
      {
        transaction_type: 'RECEIPT',
        quantity_change: '1.000',
        source_type: 'ASSET_CREATE',
      },
    ]);

    await http()
      .post('/api/v1/assets')
      .query({ farmId })
      .send({ ...input, serialNumber: `${tag}-another-serial` })
      .expect(409);
    await http()
      .post('/api/v1/assets')
      .query({ farmId })
      .send({
        ...input,
        assetCode: `${tag}-wrong-destination`,
        locationId: destinationLocationId,
      })
      .expect(409);
    expect(await balance(warehouseId)).toBe('1.000');
    expect(await balance(destinationWarehouseId)).toBeUndefined();
  });

  it('rolls back a newly created asset and balance when the ledger insert fails', async () => {
    const functionName = `asset_ledger_fail_${suffix}`;
    const triggerName = `asset_ledger_fail_trigger_${suffix}`;
    await pool.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.farm_id = '${farmId}'::uuid AND NEW.source_type = 'ASSET_CREATE' THEN
          RAISE EXCEPTION 'injected asset ledger failure' USING ERRCODE='P0001';
        END IF;
        RETURN NEW;
      END $$`);
    try {
      await pool.query(
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await http()
        .post('/api/v1/assets')
        .query({ farmId })
        .send({
          itemId,
          warehouseId,
          locationId,
          assetCode: `${tag}-rollback`,
        })
        .expect(500);
      const asset = await pool.query(
        'SELECT id FROM assets WHERE farm_id=$1 AND asset_code=$2',
        [farmId, `${tag}-rollback`],
      );
      expect(asset.rowCount).toBe(0);
      expect(await balance(warehouseId)).toBeUndefined();
      expect(
        (
          await pool.query(
            "SELECT id FROM audit_logs WHERE farm_id=$1 AND action='ASSET_CREATED'",
            [farmId],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await pool.query(
        `DROP TRIGGER IF EXISTS ${triggerName} ON inventory_transactions`,
      );
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });

  it('uses optimistic versions for metadata and maps unique serial conflicts to 409', async () => {
    const detail = await http()
      .get(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .expect(200);
    const updatedAt = (detail.body as unknown as { data: AssetView }).data.asset
      .updatedAt;
    await http()
      .patch(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .send({ updatedAt, note: 'Metadata updated' })
      .expect(200);
    await http()
      .patch(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .send({ updatedAt, note: 'Stale write' })
      .expect(409);

    const first = await http()
      .get(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .expect(200);
    const currentUpdatedAt = (first.body as unknown as { data: AssetView }).data
      .asset.updatedAt;
    await http()
      .patch(`/api/v1/assets/${assetIds[0]}`)
      .query({ farmId })
      .send({
        updatedAt: currentUpdatedAt,
        serialNumber: `${tag}-unique-serial`,
      })
      .expect(200);
    const second = await http()
      .get(`/api/v1/assets/${assetIds[1]}`)
      .query({ farmId })
      .expect(200);
    await http()
      .patch(`/api/v1/assets/${assetIds[1]}`)
      .query({ farmId })
      .send({
        updatedAt: (second.body as unknown as { data: AssetView }).data.asset
          .updatedAt,
        serialNumber: `${tag}-unique-serial`,
      })
      .expect(409);
    await http()
      .patch(`/api/v1/assets/${assetIds[1]}`)
      .query({ farmId })
      .send({ updatedAt: currentUpdatedAt, status: 'RETIRED' })
      .expect(400);
  });

  it('transfers an available asset across warehouses with a balanced movement pair', async () => {
    await seedBalance(warehouseId, '1');
    const moved = await http()
      .post(`/api/v1/assets/${assetIds[2]}/transfer`)
      .query({ farmId })
      .send({
        warehouseId: destinationWarehouseId,
        locationId: destinationLocationId,
        note: 'Move to workshop',
      })
      .expect(201);
    expect(moved.body as unknown).toMatchObject({
      data: {
        status: 'AVAILABLE',
        currentLocationId: destinationLocationId,
      },
    });
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    const rows = await transactionRows(assetIds[2]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.transaction_type).sort()).toEqual([
      'TRANSFER_IN',
      'TRANSFER_OUT',
    ]);
    expect(rows.every((row) => row.source_type === 'ASSET_TRANSFER')).toBe(
      true,
    );
    expect(rows[0].movement_group_id).toBeTruthy();
    expect(rows[0].movement_group_id).toBe(rows[1].movement_group_id);

    await resetData();
    await seedBalance(warehouseId, '1');
    const relocated = await http()
      .post(`/api/v1/assets/${assetIds[2]}/transfer`)
      .query({ farmId })
      .send({ warehouseId, locationId: wrongWarehouseLocationId })
      .expect(201);
    expect(relocated.body as unknown).toMatchObject({
      data: { currentLocationId: wrongWarehouseLocationId },
    });
    expect(await balance(warehouseId)).toBe('1.000');
    expect(await transactionRows(assetIds[2])).toEqual([]);
    expect(
      (
        await pool.query(
          "SELECT id FROM audit_logs WHERE farm_id=$1 AND entity_id=$2 AND action='ASSET_TRANSFERRED'",
          [farmId, assetIds[2]],
        )
      ).rowCount,
    ).toBe(1);
  });

  it('serializes concurrent physical transfers of one available asset', async () => {
    await seedBalance(warehouseId, '1');
    const sendTransfer = () =>
      http()
        .post(`/api/v1/assets/${assetIds[2]}/transfer`)
        .query({ farmId })
        .send({
          warehouseId: destinationWarehouseId,
          locationId: destinationLocationId,
        });
    const responses = await Promise.all([sendTransfer(), sendTransfer()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    expect(await transactionRows(assetIds[2])).toHaveLength(2);
  });

  it('allows active readers to read but rejects guests and inactive identities from returns', async () => {
    identity = guestIdentity;
    await http().get('/api/v1/assets').query({ farmId }).expect(200);
    const guestReturn = await returnAsset(assetIds[0]);
    expect(guestReturn.status).toBe(403);
    expect((await readAsset(assetIds[0])).status).toBe('IN_USE');
    expect(await balance(destinationWarehouseId)).toBeUndefined();

    for (const authId of [
      inactiveMemberIdentity,
      inactiveUserIdentity,
      noMemberIdentity,
    ]) {
      identity = authId;
      await http().get('/api/v1/assets').query({ farmId }).expect(403);
      const denied = await returnAsset(assetIds[0]);
      expect(denied.status).toBe(403);
    }
  });

  it('validates return ids and notes before changing inventory', async () => {
    await http()
      .post('/api/v1/assets/not-a-uuid/return')
      .query({ farmId })
      .send({ warehouseId: destinationWarehouseId })
      .expect(400);
    const invalidWarehouse = await returnAsset(assetIds[0], {
      warehouseId: 'not-a-uuid',
      locationId: destinationLocationId,
    });
    expect(invalidWarehouse.status).toBe(400);
    await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
      locationId: 'not-a-uuid',
    }).then((response) => expect(response.status).toBe(400));
    await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
      locationId: null,
    }).then((response) => expect(response.status).toBe(400));
    await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
      locationId: destinationLocationId,
      note: 'n'.repeat(4001),
    }).then((response) => expect(response.status).toBe(400));
    await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
      locationId: destinationLocationId,
      extra: true,
    }).then((response) => expect(response.status).toBe(400));
    expect((await readAsset(assetIds[0])).status).toBe('IN_USE');
    expect(await balance(destinationWarehouseId)).toBeUndefined();
    expect((await movements(assetIds[0])).count).toBe('0');
  });

  it('requires an active receiving warehouse and a valid active location in it', async () => {
    const missingWarehouseId = randomUUID();
    for (const [warehouse, location] of [
      [inactiveWarehouseId, locationId],
      [destinationWarehouseId, inactiveLocationId],
      [destinationWarehouseId, wrongWarehouseLocationId],
      [foreignWarehouseId, foreignLocationId],
      [missingWarehouseId, destinationLocationId],
    ]) {
      const response = await returnAsset(assetIds[0], {
        warehouseId: warehouse,
        locationId: location,
      });
      expect(response.status).toBe(409);
    }
    expect((await readAsset(assetIds[0])).status).toBe('IN_USE');
    expect(await balance(destinationWarehouseId)).toBeUndefined();
    expect(await balance(foreignWarehouseId)).toBeUndefined();
    expect(await balance(missingWarehouseId)).toBeUndefined();
  });

  it('supports the legacy warehouse-only fallback only for a valid current location', async () => {
    const fallback = await returnAsset(assetIds[0], { warehouseId });
    expect(fallback.status).toBe(201);
    expect((await readAsset(assetIds[0])).current_location_id).toBe(locationId);

    await resetData();
    const wrongWarehouseFallback = await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
    });
    expect(wrongWarehouseFallback.status).toBe(409);
    expect(await balance(destinationWarehouseId)).toBeUndefined();

    await resetData();
    await pool.query("UPDATE locations SET status='INACTIVE' WHERE id=$1", [
      locationId,
    ]);
    const inactiveFallback = await returnAsset(assetIds[0], { warehouseId });
    expect(inactiveFallback.status).toBe(409);
    expect(await balance(warehouseId)).toBeUndefined();

    await resetData();
    await pool.query('UPDATE assets SET current_location_id=NULL WHERE id=$1', [
      assetIds[0],
    ]);
    const missingFallback = await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
    });
    expect(missingFallback.status).toBe(409);
    expect((await readAsset(assetIds[0])).status).toBe('IN_USE');
    expect(await balance(destinationWarehouseId)).toBeUndefined();
  });

  it('marks eligible assets available, moves their location, closes assignments, and writes one ledger row', async () => {
    const response = await returnAsset(assetIds[0], {
      warehouseId: destinationWarehouseId,
      locationId: destinationLocationId,
      note: 'Returned after inspection',
    });
    expect(response.status).toBe(201);
    const responseBody = response.body as {
      data: Awaited<ReturnType<AssetsService['returnAsset']>>;
    };
    expect(responseBody.data).toMatchObject({
      id: assetIds[0],
      farmId,
      itemId,
      status: 'AVAILABLE',
      currentLocationId: destinationLocationId,
    });
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    expect(await movements(assetIds[0])).toMatchObject({
      count: '1',
      quantity: '1.000',
    });
    const ledger = await pool.query<{
      transaction_type: string;
      warehouse_id: string;
      performed_by_member_id: string;
      reason: string;
    }>(
      'SELECT transaction_type,warehouse_id,performed_by_member_id,reason FROM inventory_transactions WHERE farm_id=$1 AND asset_id=$2',
      [farmId, assetIds[0]],
    );
    expect(ledger.rows[0]).toMatchObject({
      transaction_type: 'RETURN_IN',
      warehouse_id: destinationWarehouseId,
      performed_by_member_id: ownerMemberId,
      reason: 'Returned after inspection',
    });
    const assignment = await pool.query<{
      status: string;
      returned_at: string | null;
    }>(
      'SELECT status,returned_at FROM asset_assignments WHERE farm_id=$1 AND asset_id=$2',
      [farmId, assetIds[0]],
    );
    expect(assignment.rows[0]).toMatchObject({ status: 'RETURNED' });
    expect(assignment.rows[0].returned_at).not.toBeNull();
  });

  it('rejects sequential duplicate returns and returns only ASSIGNED or IN_USE assets', async () => {
    const first = await returnAsset(assetIds[0]);
    expect(first.status).toBe(201);
    const duplicate = await returnAsset(assetIds[0]);
    expect(duplicate.status).toBe(409);
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    expect((await movements(assetIds[0])).count).toBe('1');

    await pool.query("UPDATE assets SET status='MAINTENANCE' WHERE id=$1", [
      assetIds[1],
    ]);
    const unavailable = await returnAsset(assetIds[1]);
    expect(unavailable.status).toBe(409);
    expect(await balance(destinationWarehouseId)).toBe('1.000');
  });

  it.each([
    ['a new balance row', false],
    ['an existing balance row', true],
  ])(
    'serializes different asset returns sharing %s',
    async (_label, existing) => {
      if (existing) {
        await pool.query(
          'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,quantity_on_hand) VALUES ($1,$2,$3,$4)',
          [farmId, destinationWarehouseId, itemId, '8'],
        );
      }
      const responses = await Promise.all([
        returnAsset(assetIds[0]),
        returnAsset(assetIds[1]),
      ]);
      expect(responses.map(({ status }) => status).sort()).toEqual([201, 201]);
      expect(await balance(destinationWarehouseId)).toBe(
        existing ? '10.000' : '2.000',
      );
      expect((await movements(assetIds[0])).count).toBe('1');
      expect((await movements(assetIds[1])).count).toBe('1');
    },
  );

  it('rolls back a new balance, assignment, asset update, and ledger when ledger insertion fails', async () => {
    const name = `asset_return_fail_${randomUUID().replaceAll('-', '')}`;
    const client = await pool.connect();
    try {
      await client.query(
        `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.source_type = 'ASSET_RETURN' AND NEW.source_id = '${assetIds[0]}'::uuid THEN RAISE EXCEPTION 'injected asset return ledger failure'; END IF; RETURN NEW; END $body$`,
      );
      await client.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.${name}()`,
      );
      const response = await returnAsset(assetIds[0]);
      expect(response.status).toBe(500);
      expect(await readAsset(assetIds[0])).toMatchObject({
        status: 'IN_USE',
        current_location_id: locationId,
      });
      expect(await balance(destinationWarehouseId)).toBeUndefined();
      expect((await movements(assetIds[0])).count).toBe('0');
      const assignment = await pool.query<{ status: string }>(
        'SELECT status FROM asset_assignments WHERE farm_id=$1 AND asset_id=$2',
        [farmId, assetIds[0]],
      );
      expect(assignment.rows[0].status).toBe('ACTIVE');
    } finally {
      await client.query(
        `DROP TRIGGER IF EXISTS ${name} ON inventory_transactions`,
      );
      await client.query(`DROP FUNCTION IF EXISTS public.${name}()`);
      client.release();
    }
  });

  it('serializes a competing issue confirmation and return without partial movement', async () => {
    await pool.query(
      'INSERT INTO inventory_balances (farm_id,warehouse_id,item_id,quantity_on_hand) VALUES ($1,$2,$3,$4)',
      [farmId, warehouseId, itemId, '1'],
    );
    const issueId = await createIssue(assetIds[2], warehouseId);
    const [issue, returned] = await Promise.all([
      confirmIssue(issueId),
      returnAsset(assetIds[2], { warehouseId, locationId }),
    ]);
    expect(issue.status).toBe(201);
    expect([201, 409]).toContain(returned.status);
    const result = await readAsset(assetIds[2]);
    const quantity = await balance(warehouseId);
    const issueMovements = await movements(assetIds[2], 'STOCK_ISSUE');
    const returnMovements = await movements(assetIds[2]);
    if (returned.status === 201) {
      expect(result).toMatchObject({
        status: 'AVAILABLE',
        current_location_id: locationId,
      });
      expect(quantity).toBe('1.000');
      expect(issueMovements.count).toBe('1');
      expect(returnMovements.count).toBe('1');
    } else {
      expect(result.status).toBe('IN_USE');
      expect(quantity).toBe('0.000');
      expect(issueMovements.count).toBe('1');
      expect(returnMovements.count).toBe('0');
    }
  });

  it('runs confirmed receipt, issue, return to a new location, and reissue over HTTP', async () => {
    const receipt = await http()
      .post('/api/v1/stock-receipts')
      .query({ farmId })
      .send({
        warehouseId,
        receiptCode: `${tag}-flow`,
        items: [
          {
            itemId,
            quantity: '1',
            assetCode: `${tag}-FLOW-ASSET`,
            locationId,
          },
        ],
      });
    if (receipt.status !== 201)
      throw new Error(
        `create receipt failed: ${receipt.status} ${JSON.stringify(receipt.body as unknown)}`,
      );
    const receiptBody = receipt.body as unknown as {
      data: { receipt: { id: string } };
    };
    const receiptId = receiptBody.data.receipt.id;
    await http()
      .post(`/api/v1/stock-receipts/${receiptId}/confirm`)
      .query({ farmId })
      .expect(201);
    const created = await http()
      .get(`/api/v1/assets/by-code/${tag}-FLOW-ASSET`)
      .query({ farmId })
      .expect(200);
    const createdBody = created.body as unknown as { data: AssetView };
    const createdId = createdBody.data.asset.id;
    expect(await balance(warehouseId)).toBe('1.000');

    const firstIssueId = await createIssue(createdId, warehouseId);
    await confirmIssue(firstIssueId).expect(201);
    expect((await readAsset(createdId)).status).toBe('IN_USE');
    expect(await balance(warehouseId)).toBe('0.000');

    const returned = await returnAsset(createdId);
    expect(returned.status).toBe(201);
    expect((await readAsset(createdId)).current_location_id).toBe(
      destinationLocationId,
    );
    expect(await balance(destinationWarehouseId)).toBe('1.000');

    const secondIssueId = await createIssue(createdId, destinationWarehouseId);
    await confirmIssue(secondIssueId).expect(201);
    expect((await readAsset(createdId)).status).toBe('IN_USE');
    expect(await balance(destinationWarehouseId)).toBe('0.000');
    expect((await movements(createdId)).count).toBe('1');
  });

  it.each(['CONSUMPTION', 'OTHER', 'DISPOSAL'])(
    'rejects %s confirmation after maintenance was scheduled without moving stock',
    async (issueType) => {
      await seedBalance();
      const draft = await http()
        .post('/api/v1/stock-issues')
        .query({ farmId })
        .send({ ...issueInput(assetIds[2], warehouseId), issueType })
        .expect(201);
      const issueId = (
        draft.body as unknown as { data: { issue: { id: string } } }
      ).data.issue.id;
      await scheduleMaintenance(assetIds[2]);
      await confirmIssue(issueId).expect(409);
      expect((await readAsset(assetIds[2])).status).toBe('AVAILABLE');
      expect(await balance(warehouseId)).toBe('1.000');
      expect(await transactionRows(assetIds[2])).toEqual([]);
      const issue = await pool.query<{ status: string }>(
        'SELECT status FROM stock_issues WHERE id=$1',
        [issueId],
      );
      expect(issue.rows[0].status).toBe('DRAFT');
    },
  );

  it.each(['DAMAGE', 'MAINTENANCE'])(
    'rejects ASSET lines in %s creates, edits and legacy confirmations atomically',
    async (issueType) => {
      await seedBalance();
      const maintenanceRecordId =
        issueType === 'MAINTENANCE'
          ? await scheduleMaintenance(assetIds[2])
          : undefined;
      const extra = { issueType, maintenanceRecordId };
      await http()
        .post('/api/v1/stock-issues')
        .query({ farmId })
        .send({ ...issueInput(assetIds[2], warehouseId), ...extra })
        .expect(400);
      const draftId = await createIssue(assetIds[2], warehouseId);
      await http()
        .patch(`/api/v1/stock-issues/${draftId}`)
        .query({ farmId })
        .send(extra)
        .expect(400);
      // Old drafts can predate the new API validation; confirmation must recheck.
      await pool.query(
        'UPDATE stock_issues SET issue_type=$2, maintenance_record_id=$3 WHERE id=$1',
        [draftId, issueType, maintenanceRecordId ?? null],
      );
      await confirmIssue(draftId).expect(409);
      expect((await readAsset(assetIds[2])).status).toBe('AVAILABLE');
      expect(await balance(warehouseId)).toBe('1.000');
      expect(await transactionRows(assetIds[2])).toEqual([]);
    },
  );

  it('maintains an issued asset without inventing a holder or deducting inventory twice', async () => {
    await seedBalance();
    const issueId = await createIssue(assetIds[2], warehouseId);
    await confirmIssue(issueId).expect(201);
    const recordId = await scheduleMaintenance(assetIds[2]);
    await maintenanceAction(recordId, 'start').expect(201);
    expect((await readAsset(assetIds[2])).status).toBe('MAINTENANCE');
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await transactionRows(assetIds[2])).toHaveLength(1);
    await maintenanceAction(recordId, 'complete')
      .send({ resultNote: 'Inspected' })
      .expect(201);
    expect((await readAsset(assetIds[2])).status).toBe('IN_USE');
    expect(await balance(warehouseId)).toBe('0.000');
    const holder = await http()
      .get(`/api/v1/assets/${assetIds[2]}/holder`)
      .query({ farmId })
      .expect(200);
    expect(holder.body as unknown).toEqual({ data: null });
    expect((await returnAsset(assetIds[2])).status).toBe(201);
    expect(await balance(destinationWarehouseId)).toBe('1.000');
    expect(
      (await transactionRows(assetIds[2])).map((row) => row.quantity_change),
    ).toEqual(['-1.000', '1.000']);
  });

  it('can repeat maintenance after completing an in-stock repair before explicit return', async () => {
    await seedBalance();
    const first = await scheduleMaintenance(assetIds[2]);
    await maintenanceAction(first, 'start').expect(201);
    await maintenanceAction(first, 'complete').expect(201);
    const second = await scheduleMaintenance(assetIds[2]);
    await maintenanceAction(second, 'start').expect(201);
    await maintenanceAction(second, 'cancel').expect(201);
    expect((await readAsset(assetIds[2])).status).toBe('IN_USE');
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await transactionRows(assetIds[2])).toHaveLength(1);
    expect((await returnAsset(assetIds[2])).status).toBe(201);
    expect(await transactionRows(assetIds[2])).toHaveLength(2);
  });

  it('still rejects an ASSIGNED asset with no active assignment when starting maintenance', async () => {
    await pool.query("UPDATE assets SET status='ASSIGNED' WHERE id=$1", [
      assetIds[1],
    ]);
    const record = await scheduleMaintenance(assetIds[1]);
    await maintenanceAction(record, 'start').expect(409);
    expect((await readAsset(assetIds[1])).status).toBe('ASSIGNED');
    expect(await transactionRows(assetIds[1])).toEqual([]);
  });

  it('serializes maintenance start against stock issue confirmation without a second debit', async () => {
    await seedBalance();
    const issueId = await createIssue(assetIds[2], warehouseId);
    const record = await scheduleMaintenance(assetIds[2]);
    const responses = await Promise.all([
      maintenanceAction(record, 'start'),
      confirmIssue(issueId),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 409]);
    expect((await readAsset(assetIds[2])).status).toBe('MAINTENANCE');
    expect(await balance(warehouseId)).toBe('0.000');
    expect(await transactionRows(assetIds[2])).toMatchObject([
      { transaction_type: 'MAINTENANCE_ISSUE', quantity_change: '-1.000' },
    ]);
  });

  describe('Phase 2–3 write boundaries', () => {
    const writes = () => [
      { action: 'assign', body: assignmentInput() },
      { action: 'start-use', body: {} },
      { action: 'return', body: destinationInput() },
      { action: 'transfer', body: destinationInput() },
      { action: 'incidents', body: incidentInput() },
      {
        action: `incidents/${randomUUID()}/status`,
        body: { status: 'RESOLVED' },
      },
      { action: 'recover', body: destinationInput() },
      { action: 'retire', body: { note: 'End of service' } },
    ];

    it('rejects readers, inactive identities and non-members on every lifecycle write', async () => {
      const before = await lifecycleState();
      for (const authId of [
        guestIdentity,
        inactiveMemberIdentity,
        inactiveUserIdentity,
        noMemberIdentity,
      ]) {
        identity = authId;
        for (const { action, body } of writes())
          await assetAction(assetIds[2], action, body).expect(403);
      }
      expect(await lifecycleState()).toEqual(before);
    });

    it('does not expose or mutate a foreign asset through any lifecycle write', async () => {
      const before = await readAsset(foreignAssetId);
      for (const { action, body } of writes())
        await assetAction(foreignAssetId, action, body).expect(404);
      expect(await readAsset(foreignAssetId)).toEqual(before);
      expect(await transactionRows(foreignAssetId)).toEqual([]);
    });

    it('validates lifecycle payloads before creating records or moving stock', async () => {
      const before = await lifecycleState();
      const invalid = [
        {
          action: 'assign',
          body: { ...assignmentInput(), assignedToMemberId: null },
        },
        {
          action: 'assign',
          body: { ...assignmentInput(), expectedReturnAt: 'bad-date' },
        },
        {
          action: 'transfer',
          body: { ...destinationInput(), locationId: 'bad-id' },
        },
        {
          action: 'recover',
          body: { ...destinationInput(), warehouseId: null },
        },
        {
          action: 'incidents',
          body: { ...incidentInput(), description: '   ' },
        },
        {
          action: 'incidents',
          body: { ...incidentInput(), incidentType: 'UNKNOWN' },
        },
        {
          action: 'incidents',
          body: { ...incidentInput(), severity: 'UNKNOWN' },
        },
        {
          action: `incidents/${randomUUID()}/status`,
          body: { status: 'OPEN' },
        },
        { action: 'retire', body: { note: '   ' } },
        { action: 'retire', body: { note: 'x'.repeat(4001) } },
      ];
      for (const { action, body } of invalid)
        await assetAction(assetIds[2], action, body).expect(400);
      expect(await lifecycleState()).toEqual(before);
    });

    it.each(['assign', 'transfer', 'incidents', 'retire'])(
      'rejects unavailable source inventory and locations for %s without partial writes',
      async (action) => {
        const body =
          action === 'assign'
            ? assignmentInput()
            : action === 'transfer'
              ? destinationInput()
              : action === 'incidents'
                ? incidentInput()
                : { note: 'End of service' };
        await seedBalance(warehouseId, '0');
        let before = await lifecycleState();
        await assetAction(assetIds[2], action, body).expect(409);
        expect(await lifecycleState()).toEqual(before);
        await seedBalance();
        for (const sourceLocation of [null, inactiveLocationId]) {
          await pool.query(
            'UPDATE assets SET current_location_id=$2 WHERE id=$1',
            [assetIds[2], sourceLocation],
          );
          before = await lifecycleState();
          await assetAction(assetIds[2], action, body).expect(409);
          expect(await lifecycleState()).toEqual(before);
        }
        await pool.query(
          'UPDATE assets SET current_location_id=$2 WHERE id=$1',
          [assetIds[2], locationId],
        );
        await pool.query(
          "UPDATE warehouses SET status='INACTIVE' WHERE id=$1",
          [warehouseId],
        );
        before = await lifecycleState();
        await assetAction(assetIds[2], action, body).expect(409);
        expect(await lifecycleState()).toEqual(before);
      },
    );
  });

  describe('Phase 2 assignment and dedicated transfer acceptance', () => {
    it('requires an active assignee and destination within the selected farm', async () => {
      await seedBalance();
      const inactiveMembers = await pool.query<{ id: string }>(
        "SELECT fm.id FROM farm_members fm JOIN users u ON u.id=fm.user_id WHERE fm.farm_id=$1 AND (fm.status<>'ACTIVE' OR u.status<>'ACTIVE')",
        [farmId],
      );
      const foreignMember = randomUUID();
      await pool.query(
        'INSERT INTO farm_members (id,farm_id,user_id) SELECT $1,$2,user_id FROM farm_members WHERE id=$3',
        [foreignMember, foreignFarmId, guestMemberId],
      );
      try {
        const before = await lifecycleState();
        for (const member of [
          foreignMember,
          randomUUID(),
          ...inactiveMembers.rows.map((row) => row.id),
        ])
          await assetAction(assetIds[2], 'assign', {
            ...assignmentInput(),
            assignedToMemberId: member,
          }).expect(409);
        for (const destination of [
          foreignLocationId,
          inactiveLocationId,
          randomUUID(),
        ])
          await assetAction(assetIds[2], 'assign', {
            ...assignmentInput(),
            locationId: destination,
          }).expect(409);
        expect(await lifecycleState()).toEqual(before);
      } finally {
        await pool.query('DELETE FROM farm_members WHERE id=$1', [
          foreignMember,
        ]);
      }
    });

    it('assigns an issued asset without a holder without a second inventory debit', async () => {
      await assetAction(assetIds[1], 'assign', {
        ...assignmentInput(),
        locationId: destinationLocationId,
      }).expect(201);
      expect(await readAsset(assetIds[1])).toMatchObject({
        status: 'IN_USE',
        current_location_id: destinationLocationId,
      });
      expect(await assignments(assetIds[1])).toEqual([
        { status: 'ACTIVE', assigned_to_member_id: guestMemberId },
      ]);
      expect(await transactionRows(assetIds[1])).toEqual([]);
      expect(await balance(warehouseId)).toBeUndefined();
      expect(await balance(destinationWarehouseId)).toBeUndefined();
    });

    it('allows only one concurrent start-use and requires an active assignment', async () => {
      await seedBalance();
      await assetAction(assetIds[2], 'assign', assignmentInput()).expect(201);
      const responses = await Promise.all([
        assetAction(assetIds[2], 'start-use'),
        assetAction(assetIds[2], 'start-use'),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      expect((await readAsset(assetIds[2])).status).toBe('IN_USE');
      expect(await transactionRows(assetIds[2])).toHaveLength(1);
      expect(
        (await auditActions(assetIds[2])).filter(
          (action) => action === 'ASSET_USE_STARTED',
        ),
      ).toHaveLength(1);
      await pool.query("UPDATE assets SET status='ASSIGNED' WHERE id=$1", [
        assetIds[1],
      ]);
      await assetAction(assetIds[1], 'start-use').expect(409);
    });

    it('serializes assignments of different assets competing for the last stock unit', async () => {
      await pool.query(
        "UPDATE assets SET status='AVAILABLE' WHERE id=ANY($1::uuid[])",
        [[assetIds[1], assetIds[2]]],
      );
      await seedBalance();
      const responses = await Promise.all([
        assetAction(assetIds[1], 'assign', assignmentInput()),
        assetAction(assetIds[2], 'assign', assignmentInput()),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      expect(await balance(warehouseId)).toBe('0.000');
      const allAssignments = [
        ...(await assignments(assetIds[1])),
        ...(await assignments(assetIds[2])),
      ];
      expect(allAssignments).toEqual([
        { status: 'ACTIVE', assigned_to_member_id: guestMemberId },
      ]);
      expect([
        ...(await transactionRows(assetIds[1])),
        ...(await transactionRows(assetIds[2])),
      ]).toHaveLength(1);
    });

    it('rejects invalid receiving warehouse/location pairs without creating a destination balance', async () => {
      await seedBalance();
      const before = await lifecycleState();
      for (const body of [
        { warehouseId: foreignWarehouseId, locationId: foreignLocationId },
        { warehouseId: inactiveWarehouseId, locationId },
        { warehouseId: destinationWarehouseId, locationId: inactiveLocationId },
        {
          warehouseId: destinationWarehouseId,
          locationId: wrongWarehouseLocationId,
        },
        { warehouseId, locationId },
      ])
        await assetAction(assetIds[2], 'transfer', body).expect(409);
      expect(await lifecycleState()).toEqual(before);
    });

    it('requires available assets for physical transfer and blocks terminal lifecycle actions', async () => {
      for (const status of [
        'ASSIGNED',
        'IN_USE',
        'MAINTENANCE',
        'LOST',
        'RETIRED',
      ]) {
        await pool.query('UPDATE assets SET status=$2 WHERE id=$1', [
          assetIds[2],
          status,
        ]);
        const before = await lifecycleState();
        await assetAction(assetIds[2], 'transfer', destinationInput()).expect(
          409,
        );
        if (['MAINTENANCE', 'LOST', 'RETIRED'].includes(status)) {
          await assetAction(assetIds[2], 'assign', assignmentInput()).expect(
            409,
          );
          await assetAction(assetIds[2], 'start-use').expect(409);
          await assetAction(assetIds[2], 'return', destinationInput()).expect(
            409,
          );
        }
        expect(await lifecycleState()).toEqual(before);
      }
    });

    it('serializes opposite warehouse transfers without deadlocks or balance drift', async () => {
      await pool.query(
        "UPDATE assets SET status='AVAILABLE',current_location_id=$2 WHERE id=$1",
        [assetIds[1], destinationLocationId],
      );
      await seedBalance();
      await seedBalance(destinationWarehouseId);
      const responses = await Promise.all([
        assetAction(assetIds[2], 'transfer', destinationInput()),
        assetAction(assetIds[1], 'transfer', { warehouseId, locationId }),
      ]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(await balance(warehouseId)).toBe('1.000');
      expect(await balance(destinationWarehouseId)).toBe('1.000');
      expect((await readAsset(assetIds[2])).current_location_id).toBe(
        destinationLocationId,
      );
      expect((await readAsset(assetIds[1])).current_location_id).toBe(
        locationId,
      );
      expect(await transactionRows(assetIds[1])).toHaveLength(2);
      expect(await transactionRows(assetIds[2])).toHaveLength(2);
    });

    it('serializes a stock issue competing with dedicated asset transfer', async () => {
      await seedBalance();
      const issueId = await createIssue(assetIds[2], warehouseId);
      const [issued, transferred] = await Promise.all([
        confirmIssue(issueId),
        assetAction(assetIds[2], 'transfer', destinationInput()),
      ]);
      expect([issued.status, transferred.status].sort()).toEqual([201, 409]);
      expect(await balance(warehouseId)).toBe('0.000');
      if (issued.status === 201) {
        expect((await readAsset(assetIds[2])).status).toBe('IN_USE');
        expect(await balance(destinationWarehouseId)).toBeUndefined();
        expect(await transactionRows(assetIds[2])).toHaveLength(1);
      } else {
        expect(await readAsset(assetIds[2])).toMatchObject({
          status: 'AVAILABLE',
          current_location_id: destinationLocationId,
        });
        expect(await balance(destinationWarehouseId)).toBe('1.000');
        expect(await transactionRows(assetIds[2])).toHaveLength(2);
      }
    });

    it.each(['assign', 'start-use', 'return', 'transfer'])(
      'blocks %s until scheduled maintenance is cancelled',
      async (action) => {
        const id = ['start-use', 'return'].includes(action)
          ? assetIds[0]
          : assetIds[2];
        if (action === 'start-use')
          await pool.query("UPDATE assets SET status='ASSIGNED' WHERE id=$1", [
            id,
          ]);
        await seedBalance();
        const record = await scheduleMaintenance(id);
        const body =
          action === 'assign'
            ? assignmentInput()
            : action === 'start-use'
              ? {}
              : destinationInput();
        const before = await lifecycleState();
        await assetAction(id, action, body).expect(409);
        expect(await lifecycleState()).toEqual(before);
        await maintenanceAction(record, 'cancel').expect(201);
        await assetAction(id, action, body).expect(201);
      },
    );

    it.each([
      ['assign', 'ASSET_ASSIGNED'],
      ['handover', 'ASSET_REASSIGNED'],
      ['start-use', 'ASSET_USE_STARTED'],
      ['transfer', 'ASSET_TRANSFERRED'],
      ['return', 'ASSET_RETURNED'],
    ])(
      'rolls back %s completely if its audit write fails',
      async (action, auditAction) => {
        const id = ['assign', 'transfer'].includes(action)
          ? assetIds[2]
          : assetIds[0];
        await seedBalance();
        if (action === 'start-use')
          await pool.query("UPDATE assets SET status='ASSIGNED' WHERE id=$1", [
            id,
          ]);
        const body =
          action === 'start-use'
            ? {}
            : ['return', 'transfer'].includes(action)
              ? destinationInput()
              : assignmentInput();
        const before = await lifecycleState();
        await withWriteFailure('audit_logs', id, auditAction, async () => {
          await assetAction(
            id,
            action === 'handover' ? 'assign' : action,
            body,
          ).expect(500);
          expect(await lifecycleState()).toEqual(before);
        });
        await assetAction(
          id,
          action === 'handover' ? 'assign' : action,
          body,
        ).expect(201);
      },
    );

    it('rolls back both transfer movements, location, audit and a new balance if the second movement fails', async () => {
      await seedBalance();
      const before = await lifecycleState();
      await withWriteFailure(
        'inventory_transactions',
        assetIds[2],
        'TRANSFER_IN',
        async () => {
          await assetAction(assetIds[2], 'transfer', destinationInput()).expect(
            500,
          );
          expect(await lifecycleState()).toEqual(before);
        },
      );
      await assetAction(assetIds[2], 'transfer', destinationInput()).expect(
        201,
      );
      expect(await transactionRows(assetIds[2])).toHaveLength(2);
    });
  });

  describe('Phase 3 incidents, recovery and retirement acceptance', () => {
    it.each(['DAMAGE', 'OTHER'])(
      'records %s without changing the holder, asset or inventory',
      async (kind) => {
        for (const id of [assetIds[0], assetIds[1], assetIds[2]]) {
          const before = await readAsset(id);
          const holders = await assignments(id);
          const incidentId = await reportIncident(id, kind);
          expect(await incident(incidentId)).toMatchObject({
            status: 'OPEN',
            resolved_at: null,
          });
          expect(await readAsset(id)).toEqual(before);
          expect(await assignments(id)).toEqual(holders);
          expect(await transactionRows(id)).toEqual([]);
          expect(await auditActions(id)).toEqual(['ASSET_INCIDENT_REPORTED']);
        }
        expect(await balance(warehouseId)).toBeUndefined();
      },
    );

    it.each(['RESOLVED', 'CANCELLED'])(
      'closing an in-stock loss as %s never receives inventory; explicit recovery does',
      async (status) => {
        await seedBalance();
        const incidentId = await reportIncident(assetIds[2]);
        expect((await readAsset(assetIds[2])).status).toBe('LOST');
        expect(await balance(warehouseId)).toBe('0.000');
        expect(await transactionRows(assetIds[2])).toMatchObject([
          {
            transaction_type: 'ADJUSTMENT_OUT',
            quantity_change: '-1.000',
            source_type: 'ASSET_LOSS',
            source_id: incidentId,
          },
        ]);
        await assetAction(assetIds[2], `incidents/${incidentId}/status`, {
          status: 'IN_PROGRESS',
        }).expect(201);
        await assetAction(assetIds[2], `incidents/${incidentId}/status`, {
          status,
        }).expect(201);
        const closed = await incident(incidentId);
        expect(closed.status).toBe(status);
        expect(closed.resolved_at instanceof Date).toBe(status === 'RESOLVED');
        expect((await readAsset(assetIds[2])).status).toBe('LOST');
        expect(await balance(warehouseId)).toBe('0.000');
        expect(await balance(destinationWarehouseId)).toBeUndefined();
        expect(await transactionRows(assetIds[2])).toHaveLength(1);
        await assetAction(assetIds[2], `incidents/${incidentId}/status`, {
          status: 'IN_PROGRESS',
        }).expect(409);
        await assetAction(assetIds[2], 'return', destinationInput()).expect(
          409,
        );
        await assetAction(assetIds[2], 'recover', destinationInput()).expect(
          201,
        );
        expect(await readAsset(assetIds[2])).toMatchObject({
          status: 'AVAILABLE',
          current_location_id: destinationLocationId,
        });
        expect(await balance(destinationWarehouseId)).toBe('1.000');
        expect(await transactionRows(assetIds[2])).toHaveLength(2);
        expect(await assignments(assetIds[2])).toEqual([]);
        expect((await incident(incidentId)).status).toBe(status);
      },
    );

    it.each(['ASSIGNED', 'IN_USE', 'UNASSIGNED_IN_USE'])(
      'reports loss from %s without debiting available inventory twice',
      async (status) => {
        const id = status === 'UNASSIGNED_IN_USE' ? assetIds[1] : assetIds[2];
        await seedBalance();
        if (status !== 'UNASSIGNED_IN_USE') {
          await assetAction(id, 'assign', assignmentInput()).expect(201);
          if (status === 'IN_USE')
            await assetAction(id, 'start-use').expect(201);
        }
        const previousMovements = await transactionRows(id);
        const previousBalance = await balance(warehouseId);
        await reportIncident(id);
        expect((await readAsset(id)).status).toBe('LOST');
        expect(await transactionRows(id)).toEqual(previousMovements);
        expect(await balance(warehouseId)).toBe(previousBalance);
        expect(
          (await assignments(id)).every((row) => row.status === 'CANCELLED'),
        ).toBe(true);
        await assetAction(id, 'recover', destinationInput()).expect(201);
        expect(await balance(destinationWarehouseId)).toBe('1.000');
        expect(
          (await assignments(id)).filter((row) => row.status === 'ACTIVE'),
        ).toEqual([]);
        expect((await movements(id, 'ASSET_RECOVERY')).count).toBe('1');
      },
    );

    it('requires matching asset and farm for incident transitions, and rejects repeated transitions', async () => {
      const incidentId = await reportIncident(assetIds[0], 'DAMAGE');
      const before = await lifecycleState();
      await assetAction(assetIds[1], `incidents/${incidentId}/status`, {
        status: 'RESOLVED',
      }).expect(404);
      await assetAction(assetIds[0], `incidents/${randomUUID()}/status`, {
        status: 'RESOLVED',
      }).expect(404);
      await http()
        .post(`/api/v1/assets/${assetIds[0]}/incidents/${incidentId}/status`)
        .query({ farmId: foreignFarmId })
        .send({ status: 'RESOLVED' })
        .expect(403);
      expect(await lifecycleState()).toEqual(before);
      await assetAction(assetIds[0], `incidents/${incidentId}/status`, {
        status: 'IN_PROGRESS',
      }).expect(201);
      await assetAction(assetIds[0], `incidents/${incidentId}/status`, {
        status: 'IN_PROGRESS',
      }).expect(409);
      await assetAction(assetIds[0], `incidents/${incidentId}/status`, {
        status: 'CANCELLED',
      }).expect(201);
      await assetAction(assetIds[0], `incidents/${incidentId}/status`, {
        status: 'RESOLVED',
      }).expect(409);
      expect(await incident(incidentId)).toMatchObject({
        status: 'CANCELLED',
        resolved_at: null,
      });
      expect(await transactionRows(assetIds[0])).toEqual([]);
      expect((await readAsset(assetIds[0])).status).toBe('IN_USE');
      expect(await assignments(assetIds[0])).toEqual([
        { status: 'ACTIVE', assigned_to_member_id: ownerMemberId },
      ]);
    });

    it('serializes competing incident closure requests and audits only the accepted transition', async () => {
      const incidentId = await reportIncident(assetIds[0], 'DAMAGE');
      const responses = await Promise.all([
        assetAction(assetIds[0], `incidents/${incidentId}/status`, {
          status: 'RESOLVED',
        }),
        assetAction(assetIds[0], `incidents/${incidentId}/status`, {
          status: 'CANCELLED',
        }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const closed = await incident(incidentId);
      expect(['RESOLVED', 'CANCELLED']).toContain(closed.status);
      expect(closed.resolved_at instanceof Date).toBe(
        closed.status === 'RESOLVED',
      );
      expect(
        (await auditActions(assetIds[0])).filter(
          (action) => action === 'ASSET_INCIDENT_STATUS',
        ),
      ).toHaveLength(1);
      expect(await transactionRows(assetIds[0])).toEqual([]);
    });

    it('validates recovery destinations and receives once into an existing balance', async () => {
      await reportIncident(assetIds[0]);
      await seedBalance(destinationWarehouseId, '3');
      const before = await lifecycleState();
      for (const body of [
        { warehouseId: foreignWarehouseId, locationId: foreignLocationId },
        { warehouseId: inactiveWarehouseId, locationId },
        { warehouseId: destinationWarehouseId, locationId: inactiveLocationId },
        {
          warehouseId: destinationWarehouseId,
          locationId: wrongWarehouseLocationId,
        },
        { warehouseId: destinationWarehouseId, locationId: randomUUID() },
      ])
        await assetAction(assetIds[0], 'recover', body).expect(409);
      expect(await lifecycleState()).toEqual(before);
      const responses = await Promise.all([
        assetAction(assetIds[0], 'recover', destinationInput()),
        assetAction(assetIds[0], 'recover', destinationInput()),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await assetAction(assetIds[0], 'recover', destinationInput()).expect(409);
      expect(await balance(destinationWarehouseId)).toBe('4.000');
      expect((await movements(assetIds[0], 'ASSET_RECOVERY')).count).toBe('1');
      expect(
        (await auditActions(assetIds[0])).filter(
          (action) => action === 'ASSET_RECOVERED',
        ),
      ).toHaveLength(1);
    });

    it('serializes concurrent recovery into different new balances and preserves the open loss report', async () => {
      const incidentId = await reportIncident(assetIds[0]);
      const responses = await Promise.all([
        assetAction(assetIds[0], 'recover', { warehouseId, locationId }),
        assetAction(assetIds[0], 'recover', destinationInput()),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const recovered = await readAsset(assetIds[0]);
      const winningWarehouse =
        recovered.current_location_id === locationId
          ? warehouseId
          : destinationWarehouseId;
      const losingWarehouse =
        winningWarehouse === warehouseId ? destinationWarehouseId : warehouseId;
      expect(recovered.status).toBe('AVAILABLE');
      expect(await balance(winningWarehouse)).toBe('1.000');
      expect(await balance(losingWarehouse)).toBeUndefined();
      expect((await movements(assetIds[0], 'ASSET_RECOVERY')).count).toBe('1');
      expect((await incident(incidentId)).status).toBe('OPEN');
    });

    it.each(['incidents', 'retire'])(
      'serializes duplicate concurrent %s requests with only one stock debit',
      async (action) => {
        await seedBalance();
        const body =
          action === 'incidents' ? incidentInput() : { note: 'End of service' };
        const responses = await Promise.all([
          assetAction(assetIds[2], action, body),
          assetAction(assetIds[2], action, body),
        ]);
        expect(responses.map((response) => response.status).sort()).toEqual([
          201, 409,
        ]);
        await assetAction(assetIds[2], action, body).expect(409);
        expect((await readAsset(assetIds[2])).status).toBe(
          action === 'incidents' ? 'LOST' : 'RETIRED',
        );
        expect(await balance(warehouseId)).toBe('0.000');
        expect(await transactionRows(assetIds[2])).toMatchObject([
          {
            transaction_type: 'ADJUSTMENT_OUT',
            quantity_change: '-1.000',
            source_type: action === 'incidents' ? 'ASSET_LOSS' : 'ASSET_RETIRE',
          },
        ]);
        expect(await auditActions(assetIds[2])).toEqual([
          action === 'incidents' ? 'ASSET_INCIDENT_REPORTED' : 'ASSET_RETIRED',
        ]);
        await assetAction(assetIds[2], 'assign', assignmentInput()).expect(409);
        await assetAction(assetIds[2], 'transfer', destinationInput()).expect(
          409,
        );
        await assetAction(
          assetIds[2],
          'incidents',
          incidentInput('DAMAGE'),
        ).expect(409);
        if (action === 'retire')
          await assetAction(assetIds[2], 'recover', destinationInput()).expect(
            409,
          );
      },
    );

    it('serializes loss against retirement without a double debit or partial incident', async () => {
      await seedBalance();
      const responses = await Promise.all([
        assetAction(assetIds[2], 'incidents', incidentInput()),
        assetAction(assetIds[2], 'retire', { note: 'End of service' }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const current = await readAsset(assetIds[2]);
      expect(await balance(warehouseId)).toBe('0.000');
      expect(await transactionRows(assetIds[2])).toHaveLength(1);
      const reports = await pool.query(
        'SELECT id FROM asset_incidents WHERE asset_id=$1',
        [assetIds[2]],
      );
      expect(reports.rowCount).toBe(current.status === 'LOST' ? 1 : 0);
      expect(await auditActions(assetIds[2])).toHaveLength(1);
    });

    it.each(['SCHEDULED', 'IN_PROGRESS'])(
      'blocks loss and retirement during %s maintenance',
      async (status) => {
        await seedBalance();
        const record = await scheduleMaintenance(assetIds[2]);
        if (status === 'IN_PROGRESS')
          await maintenanceAction(record, 'start').expect(201);
        const before = await lifecycleState();
        await assetAction(assetIds[2], 'incidents', incidentInput()).expect(
          409,
        );
        await assetAction(assetIds[2], 'retire', {
          note: 'End of service',
        }).expect(409);
        expect(await lifecycleState()).toEqual(before);
      },
    );

    it('rejects retirement while assigned or in use without changing the active holder', async () => {
      for (const status of [
        'ASSIGNED',
        'IN_USE',
        'MAINTENANCE',
        'LOST',
        'RETIRED',
      ]) {
        await pool.query('UPDATE assets SET status=$2 WHERE id=$1', [
          assetIds[0],
          status,
        ]);
        const before = await lifecycleState();
        await assetAction(assetIds[0], 'retire', {
          note: 'End of service',
        }).expect(409);
        expect(await lifecycleState()).toEqual(before);
      }
    });

    it.each([
      ['incidents', 'ADJUSTMENT_OUT'],
      ['recover', 'RETURN_IN'],
      ['retire', 'ADJUSTMENT_OUT'],
    ])(
      'rolls back %s and its balance, holder, incident and audit if the ledger fails',
      async (action, transactionType) => {
        const id = action === 'recover' ? assetIds[0] : assetIds[2];
        await seedBalance();
        if (action === 'recover') await reportIncident(id);
        const body =
          action === 'incidents'
            ? incidentInput()
            : action === 'recover'
              ? destinationInput()
              : { note: 'End of service' };
        const before = await lifecycleState();
        await withWriteFailure(
          'inventory_transactions',
          id,
          transactionType,
          async () => {
            await assetAction(id, action, body).expect(500);
            expect(await lifecycleState()).toEqual(before);
          },
        );
        await assetAction(id, action, body).expect(201);
      },
    );

    it.each(['loss', 'available-loss', 'incident-status', 'recover', 'retire'])(
      'rolls back %s including previously inserted movements if the audit fails',
      async (action) => {
        const id = ['loss', 'incident-status', 'recover'].includes(action)
          ? assetIds[0]
          : assetIds[2];
        await seedBalance();
        let route = action;
        let body: Record<string, unknown>;
        let auditAction: string;
        if (action === 'loss' || action === 'available-loss') {
          route = 'incidents';
          body = incidentInput();
          auditAction = 'ASSET_INCIDENT_REPORTED';
        } else if (action === 'incident-status') {
          const incidentId = await reportIncident(id, 'DAMAGE');
          route = `incidents/${incidentId}/status`;
          body = { status: 'RESOLVED' };
          auditAction = 'ASSET_INCIDENT_STATUS';
        } else if (action === 'recover') {
          await reportIncident(id);
          body = destinationInput();
          auditAction = 'ASSET_RECOVERED';
        } else {
          body = { note: 'End of service' };
          auditAction = 'ASSET_RETIRED';
        }
        const before = await lifecycleState();
        await withWriteFailure('audit_logs', id, auditAction, async () => {
          await assetAction(id, route, body).expect(500);
          expect(await lifecycleState()).toEqual(before);
        });
        await assetAction(id, route, body).expect(201);
      },
    );
  });
});

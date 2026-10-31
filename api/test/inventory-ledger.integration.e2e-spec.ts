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
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsController } from '../src/modules/warehouses/stock-receipts.controller';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type LedgerRow = {
  id: string;
  transactionType: string;
  quantityChange: string;
  reason: string | null;
  createdAt: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: { id: string; name: string; symbol: string | null };
  };
  warehouse: { id: string; code: string; name: string };
  lot: {
    id: string;
    supplierLotNumber: string | null;
    expiryDate: string | null;
  } | null;
  asset: {
    id: string;
    assetCode: string;
    serialNumber: string | null;
  } | null;
  performer: { id: string; displayName: string } | null;
  source: { type: string; id: string; code: string | null };
};
type LedgerResponse = {
  data: LedgerRow[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

describe('Inventory ledger HTTP and PostgreSQL contract', () => {
  const tag = `LEDGER-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const identity = `${tag}-reader`;
  const ownerIdentity = `${tag}-owner`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const farmA = randomUUID();
  const farmB = randomUUID();
  const categoryId = randomUUID();
  const unitId = randomUUID();
  const warehouseA = randomUUID();
  const warehouseB = randomUUID();
  const warehouseOtherFarm = randomUUID();
  const itemA = randomUUID();
  const assetItem = randomUUID();
  const itemOtherFarm = randomUUID();
  const lotId = randomUUID();
  const lotOtherFarmId = randomUUID();
  const assetId = randomUUID();
  const receiptId = randomUUID();
  const receiptOtherFarmId = randomUUID();
  const issueId = randomUUID();
  const transferId = randomUUID();
  const countId = randomUUID();
  const unknownSourceId = randomUUID();
  const receiptTransactionId = randomUUID();
  const issueTransactionId = randomUUID();
  const maintenanceTransactionId = randomUUID();
  const transferOutTransactionId = randomUUID();
  const transferInTransactionId = randomUUID();
  const countTransactionId = randomUUID();
  const adjustmentTransactionId = randomUUID();
  const returnTransactionId = randomUUID();
  const assignmentTransactionId = randomUUID();
  const crossFarmMetadataTransactionId = randomUUID();
  const missingSourceTransactionId = randomUUID();
  const otherFarmTransactionId = randomUUID();
  let readerMemberA = '';
  let readerMemberB = '';
  let client: PoolClient | undefined;
  let app: INestApplication<App> | undefined;
  let currentIdentity = identity;
  let finishTransaction: (() => void) | undefined;
  let transactionDone: Promise<void> | undefined;
  const endpoint = '/api/v1/inventory/transactions';
  const http = () => request(app!.getHttpServer());

  beforeAll(async () => {
    client = await pool.connect();
    const rollback = new Error('Rollback inventory ledger fixtures');
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
    const db = await transactionReady;
    await client.query(
      'INSERT INTO farms (id,code,name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    const user = await client.query<{ id: string }>(
      'INSERT INTO users (auth_provider_user_id,email,full_name) VALUES ($1,$2,$3) RETURNING id',
      [identity, `${identity}@example.local`, 'Ledger Reader'],
    );
    const owner = await client.query<{ id: string }>(
      'INSERT INTO users (auth_provider_user_id,email,full_name) VALUES ($1,$2,$3) RETURNING id',
      [ownerIdentity, `${ownerIdentity}@example.local`, 'Ledger Owner'],
    );
    const missingNameUser = await client.query<{ id: string }>(
      'INSERT INTO users (auth_provider_user_id,email) VALUES ($1,$2) RETURNING id',
      [`${identity}-missing-name`, `${identity}-missing-name@example.local`],
    );
    const farmAOnlyUser = await client.query<{ id: string }>(
      'INSERT INTO users (auth_provider_user_id,email) VALUES ($1,$2) RETURNING id',
      [`${identity}-farm-a-only`, `${identity}-farm-a-only@example.local`],
    );
    const roles = await client.query<{ id: string; code: string }>(
      "SELECT id,code FROM roles WHERE code IN ('GUEST','FARM_OWNER')",
    );
    const guestRoleId = roles.rows.find(({ code }) => code === 'GUEST')!.id;
    const ownerRoleId = roles.rows.find(
      ({ code }) => code === 'FARM_OWNER',
    )!.id;
    for (const farmId of [farmA, farmB]) {
      const memberId = randomUUID();
      await client.query(
        'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
        [memberId, farmId, user.rows[0].id],
      );
      await client.query(
        'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
        [memberId, guestRoleId],
      );
      if (farmId === farmA) readerMemberA = memberId;
      else readerMemberB = memberId;
    }
    const ownerMemberA = randomUUID();
    await client.query(
      'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
      [ownerMemberA, farmA, owner.rows[0].id],
    );
    await client.query(
      'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
      [ownerMemberA, ownerRoleId],
    );
    const missingNameMemberId = randomUUID();
    await client.query(
      'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
      [missingNameMemberId, farmA, missingNameUser.rows[0].id],
    );
    const farmAOnlyMemberId = randomUUID();
    await client.query(
      'INSERT INTO farm_members (id,farm_id,user_id) VALUES ($1,$2,$3)',
      [farmAOnlyMemberId, farmA, farmAOnlyUser.rows[0].id],
    );
    await client.query(
      'INSERT INTO farm_member_roles (farm_member_id,role_id) VALUES ($1,$2)',
      [farmAOnlyMemberId, guestRoleId],
    );
    await client.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, tag],
    );
    await client.query(
      'INSERT INTO units (id,code,name,symbol) VALUES ($1,$2,$3,NULL)',
      [unitId, tag, 'Kilogram'],
    );
    await client.query(
      'INSERT INTO warehouses (id,farm_id,code,name) VALUES ($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$10,$11)',
      [
        warehouseA,
        farmA,
        `${tag}-WH-A`,
        `${tag} Warehouse A`,
        warehouseB,
        `${tag}-WH-B`,
        `${tag} Warehouse B`,
        warehouseOtherFarm,
        farmB,
        `${tag}-WH-X`,
        `${tag} Other Farm Warehouse`,
      ],
    );
    await client.query(
      'INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9),($10,$2,$3,$4,$11,$12,$13,$14,$15),($16,$17,$3,$4,$18,$19,$20,$21,$22)',
      [
        itemA,
        farmA,
        categoryId,
        unitId,
        `${tag}-QTY`,
        `${tag} Quantity item`,
        'MATERIAL',
        'QUANTITY',
        'ACTIVE',
        assetItem,
        `${tag}-ASSET`,
        `${tag} Asset item`,
        'EQUIPMENT',
        'ASSET',
        'ACTIVE',
        itemOtherFarm,
        farmB,
        `${tag}-OTHER`,
        `${tag} Other Farm item`,
        'MATERIAL',
        'QUANTITY',
        'ACTIVE',
      ],
    );
    await client.query(
      'INSERT INTO inventory_lots (id,farm_id,item_id,supplier_lot_number,initial_quantity,expiry_date) VALUES ($1,$2,$3,$4,10,$5)',
      [lotId, farmA, itemA, `${tag}-LOT-1`, '2026-12-31'],
    );
    await client.query(
      'INSERT INTO inventory_lots (id,farm_id,item_id,supplier_lot_number,initial_quantity) VALUES ($1,$2,$3,$4,10)',
      [lotOtherFarmId, farmB, itemOtherFarm, `${tag}-OTHER-LOT`],
    );
    await client.query(
      'INSERT INTO assets (id,farm_id,item_id,asset_code,serial_number) VALUES ($1,$2,$3,$4,$5)',
      [assetId, farmA, assetItem, `${tag}-ASSET-1`, 'SERIAL-001'],
    );
    await client.query(
      'INSERT INTO stock_receipts (id,farm_id,warehouse_id,receipt_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5)',
      [receiptId, farmA, warehouseA, `${tag}-PN-001`, readerMemberA],
    );
    await client.query(
      'INSERT INTO stock_receipts (id,farm_id,warehouse_id,receipt_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5)',
      [
        receiptOtherFarmId,
        farmB,
        warehouseOtherFarm,
        `${tag}-OTHER-PN`,
        readerMemberB,
      ],
    );
    await client.query(
      'INSERT INTO stock_issues (id,farm_id,warehouse_id,issue_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5)',
      [issueId, farmA, warehouseA, `${tag}-PX-001`, readerMemberA],
    );
    await client.query(
      'INSERT INTO stock_transfers (id,farm_id,from_warehouse_id,to_warehouse_id,transfer_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        transferId,
        farmA,
        warehouseA,
        warehouseB,
        `${tag}-CK-001`,
        readerMemberA,
      ],
    );
    await client.query(
      'INSERT INTO stock_counts (id,farm_id,warehouse_id,count_code,created_by_member_id) VALUES ($1,$2,$3,$4,$5)',
      [countId, farmA, warehouseA, `${tag}-KK-001`, readerMemberA],
    );

    const movements: Array<{
      id: string;
      itemId: string;
      type: string;
      quantity: string;
      sourceType: string;
      sourceId: string;
      memberId: string | null;
      lotId: string | null;
      assetId: string | null;
      reason: string | null;
      createdAt: string;
      farmId?: string;
      warehouseId?: string;
    }> = [
      {
        id: receiptTransactionId,
        itemId: itemA,
        type: 'RECEIPT',
        quantity: '123456789012345.678',
        sourceType: 'STOCK_RECEIPT',
        sourceId: receiptId,
        memberId: readerMemberA,
        lotId,
        assetId: null,
        reason: 'Received stock from supplier',
        createdAt: '2026-01-01T08:00:00.000Z',
      },
      {
        id: issueTransactionId,
        itemId: itemA,
        type: 'ISSUE',
        quantity: '-3.125',
        sourceType: 'STOCK_ISSUE',
        sourceId: issueId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: 'Material issue',
        createdAt: '2026-01-02T08:00:00.000Z',
      },
      {
        id: maintenanceTransactionId,
        itemId: itemA,
        type: 'MAINTENANCE_ISSUE',
        quantity: '-1',
        sourceType: 'STOCK_ISSUE',
        sourceId: issueId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: 'Maintenance use',
        createdAt: '2026-01-03T08:00:00.000Z',
      },
      {
        id: transferOutTransactionId,
        itemId: itemA,
        type: 'TRANSFER_OUT',
        quantity: '-2',
        sourceType: 'STOCK_TRANSFER',
        sourceId: transferId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: null,
        createdAt: '2026-01-04T08:00:00.000Z',
      },
      {
        id: transferInTransactionId,
        itemId: itemA,
        type: 'TRANSFER_IN',
        quantity: '2',
        sourceType: 'STOCK_TRANSFER',
        sourceId: transferId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: null,
        createdAt: '2026-01-04T08:00:00.000Z',
      },
      {
        id: countTransactionId,
        itemId: itemA,
        type: 'ADJUSTMENT_IN',
        quantity: '1.5',
        sourceType: 'STOCK_COUNT',
        sourceId: countId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: 'Physical count adjustment',
        createdAt: '2026-01-05T08:00:00.000Z',
      },
      {
        id: adjustmentTransactionId,
        itemId: itemA,
        type: 'ADJUSTMENT_OUT',
        quantity: '-0.125',
        sourceType: 'INVENTORY_ADJUSTMENT',
        sourceId: unknownSourceId,
        memberId: missingNameMemberId,
        lotId: null,
        assetId: null,
        reason: 'Manual correction',
        createdAt: '2026-01-06T08:00:00.000Z',
      },
      {
        id: returnTransactionId,
        itemId: assetItem,
        type: 'RETURN_IN',
        quantity: '1',
        sourceType: 'ASSET_RETURN',
        sourceId: assetId,
        memberId: readerMemberA,
        lotId: null,
        assetId: null,
        reason: null,
        createdAt: '2026-01-07T08:00:00.000Z',
      },
      {
        id: assignmentTransactionId,
        itemId: assetItem,
        type: 'ASSIGNMENT_OUT',
        quantity: '-1',
        sourceType: 'STOCK_ISSUE',
        sourceId: issueId,
        memberId: readerMemberA,
        lotId: null,
        assetId,
        reason: null,
        createdAt: '2026-01-08T08:00:00.000Z',
      },
      {
        id: crossFarmMetadataTransactionId,
        itemId: itemA,
        type: 'ADJUSTMENT_IN',
        quantity: '4',
        sourceType: 'STOCK_RECEIPT',
        sourceId: receiptOtherFarmId,
        memberId: readerMemberB,
        lotId: lotOtherFarmId,
        assetId: null,
        reason: 'Historical row with mismatched optional references',
        createdAt: '2026-01-09T08:00:00.000Z',
      },
      {
        id: missingSourceTransactionId,
        itemId: itemA,
        type: 'ADJUSTMENT_OUT',
        quantity: '-0.5',
        sourceType: 'UNKNOWN_SOURCE',
        sourceId: unknownSourceId,
        memberId: null,
        lotId: null,
        assetId: null,
        reason: null,
        createdAt: '2026-01-10T08:00:00.000Z',
      },
      {
        id: otherFarmTransactionId,
        itemId: itemOtherFarm,
        type: 'RECEIPT',
        quantity: '99',
        sourceType: 'UNKNOWN_SOURCE',
        sourceId: randomUUID(),
        memberId: readerMemberB,
        lotId: null,
        assetId: null,
        reason: null,
        createdAt: '2027-01-01T08:00:00.000Z',
        farmId: farmB,
        warehouseId: warehouseOtherFarm,
      },
    ];
    for (const movement of movements) {
      await client.query(
        'INSERT INTO inventory_transactions (id,farm_id,warehouse_id,item_id,lot_id,asset_id,transaction_type,quantity_change,source_type,source_id,performed_by_member_id,reason,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [
          movement.id,
          movement.farmId ?? farmA,
          movement.warehouseId ?? warehouseA,
          movement.itemId,
          movement.lotId,
          movement.assetId,
          movement.type,
          movement.quantity,
          movement.sourceType,
          movement.sourceId,
          movement.memberId,
          movement.reason,
          movement.createdAt,
        ],
      );
    }

    const module = await Test.createTestingModule({
      controllers: [
        InventoryController,
        StockReceiptsController,
        StockIssuesController,
      ],
      providers: [
        InventoryService,
        StockReceiptsService,
        StockIssuesService,
        WarehousesService,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();
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
        context
          .switchToHttp()
          .getRequest<{ auth: { clerkUserId: string } }>().auth = {
          clerkUserId: currentIdentity,
        };
        return true;
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    try {
      if (client) {
        finishTransaction?.();
        await transactionDone;
        const remaining = await client.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM farms WHERE id IN ($1,$2)',
          [farmA, farmB],
        );
        expect(remaining.rows[0].count).toBe(0);
      }
    } finally {
      client?.release();
      await pool.end();
    }
  });

  it('returns a complete joined ledger with source codes and exact decimal strings', async () => {
    const response = await http()
      .get(endpoint)
      .query({ farmId: farmA })
      .expect(200);
    const body = response.body as LedgerResponse;
    expect(body.page).toEqual({
      number: 1,
      size: 20,
      totalItems: 11,
      totalPages: 1,
    });
    expect(body.data).toHaveLength(11);
    expect(body.data[0].id).toBe(missingSourceTransactionId);
    expect(body.data[1].id).toBe(crossFarmMetadataTransactionId);
    const assignment = body.data.find(
      ({ id }) => id === assignmentTransactionId,
    )!;
    expect(assignment).toMatchObject({
      transactionType: 'ASSIGNMENT_OUT',
      quantityChange: '-1.000',
      reason: null,
      item: {
        id: assetItem,
        name: `${tag} Asset item`,
        unit: { id: unitId, name: 'Kilogram', symbol: null },
      },
      warehouse: { id: warehouseA, name: `${tag} Warehouse A` },
      asset: {
        id: assetId,
        assetCode: `${tag}-ASSET-1`,
        serialNumber: 'SERIAL-001',
      },
      performer: { id: readerMemberA, displayName: 'Ledger Reader' },
      source: { type: 'STOCK_ISSUE', id: issueId, code: `${tag}-PX-001` },
    });
    expect(assignment.createdAt).toContain('2026-01-08');

    const receipt = body.data.find(({ id }) => id === receiptTransactionId)!;
    expect(receipt).toMatchObject({
      quantityChange: '123456789012345.678',
      reason: 'Received stock from supplier',
      item: { id: itemA, code: `${tag}-QTY`, name: `${tag} Quantity item` },
      lot: {
        id: lotId,
        supplierLotNumber: `${tag}-LOT-1`,
        expiryDate: '2026-12-31',
      },
      source: { type: 'STOCK_RECEIPT', id: receiptId, code: `${tag}-PN-001` },
    });
    expect(receipt.createdAt).toContain('2026-01-01');
    expect(typeof receipt.createdAt).toBe('string');
    expect(typeof receipt.quantityChange).toBe('string');
    expect(receipt.performer).toEqual({
      id: readerMemberA,
      displayName: 'Ledger Reader',
    });
    expect(
      body.data.find(({ id }) => id === issueTransactionId)?.source.code,
    ).toBe(`${tag}-PX-001`);
    expect(
      body.data.find(({ id }) => id === transferInTransactionId)?.source.code,
    ).toBe(`${tag}-CK-001`);
    expect(
      body.data.find(({ id }) => id === countTransactionId)?.source.code,
    ).toBe(`${tag}-KK-001`);
    expect(
      body.data.find(({ id }) => id === returnTransactionId)?.source.code,
    ).toBe(`${tag}-ASSET-1`);
    expect(
      body.data.find(({ id }) => id === returnTransactionId),
    ).toMatchObject({ asset: null });

    const tiedTransfers = body.data
      .filter(
        ({ id }) =>
          id === transferOutTransactionId || id === transferInTransactionId,
      )
      .map(({ id }) => id);
    expect(tiedTransfers).toEqual(
      [transferOutTransactionId, transferInTransactionId].sort((a, b) =>
        b.localeCompare(a),
      ),
    );

    expect(
      body.data.find(({ id }) => id === crossFarmMetadataTransactionId),
    ).toMatchObject({
      lot: null,
      asset: null,
      performer: null,
      source: {
        type: 'STOCK_RECEIPT',
        id: receiptOtherFarmId,
        code: null,
      },
    });
    expect(
      body.data.find(({ id }) => id === missingSourceTransactionId),
    ).toMatchObject({
      source: { type: 'UNKNOWN_SOURCE', id: unknownSourceId, code: null },
    });

    const adjustment = body.data.find(
      ({ id }) => id === adjustmentTransactionId,
    )!;
    expect(adjustment).toMatchObject({
      performer: null,
      source: { type: 'INVENTORY_ADJUSTMENT', id: unknownSourceId, code: null },
    });
    expect(JSON.stringify(body)).not.toContain('@example.local');
    expect(
      body.data.every((row) => row.lot === null || row.lot.id === lotId),
    ).toBe(true);
  });

  it('filters independently and together, paginates, and rejects invalid queries', async () => {
    const byWarehouse = await http()
      .get(endpoint)
      .query({ farmId: farmA, warehouseId: warehouseA })
      .expect(200);
    expect((byWarehouse.body as LedgerResponse).page.totalItems).toBe(11);

    const byItem = await http()
      .get(endpoint)
      .query({ farmId: farmA, itemId: itemA })
      .expect(200);
    expect((byItem.body as LedgerResponse).page.totalItems).toBe(9);

    const byType = await http()
      .get(endpoint)
      .query({ farmId: farmA, transactionType: 'ISSUE' })
      .expect(200);
    expect((byType.body as LedgerResponse).data.map(({ id }) => id)).toEqual([
      issueTransactionId,
    ]);

    const combined = await http()
      .get(endpoint)
      .query({
        farmId: farmA,
        warehouseId: warehouseA,
        itemId: itemA,
        transactionType: 'RECEIPT',
      })
      .expect(200);
    expect((combined.body as LedgerResponse).data.map(({ id }) => id)).toEqual([
      receiptTransactionId,
    ]);

    const page = await http()
      .get(endpoint)
      .query({ farmId: farmA, page: 2, pageSize: 2 })
      .expect(200);
    expect((page.body as LedgerResponse).page).toEqual({
      number: 2,
      size: 2,
      totalItems: 11,
      totalPages: 6,
    });
    expect((page.body as LedgerResponse).data).toHaveLength(2);

    const capped = await http()
      .get(endpoint)
      .query({ farmId: farmA, pageSize: 500 })
      .expect(200);
    expect((capped.body as LedgerResponse).page.size).toBe(100);

    for (const query of [
      { warehouseId: warehouseOtherFarm },
      { itemId: itemOtherFarm },
      { itemId: randomUUID() },
    ]) {
      const empty = await http()
        .get(endpoint)
        .query({ farmId: farmA, ...query })
        .expect(200);
      expect((empty.body as LedgerResponse).data).toEqual([]);
      expect((empty.body as LedgerResponse).page.totalItems).toBe(0);
    }

    await http()
      .get(endpoint)
      .query({ farmId: farmA, transactionType: 'NOT_A_TYPE' })
      .expect(400);
    await http().get(endpoint).query({ farmId: farmA, page: 0 }).expect(400);
    await http()
      .get(endpoint)
      .query({ farmId: farmA, warehouseId: 'bad-id' })
      .expect(400);
  });

  it('scopes farms and allows active guest members to read without leaking other-farm rows', async () => {
    const farmAResponse = await http()
      .get(endpoint)
      .query({ farmId: farmA })
      .expect(200);
    expect((farmAResponse.body as LedgerResponse).data).toHaveLength(11);
    expect(
      (farmAResponse.body as LedgerResponse).data.map(({ id }) => id),
    ).not.toContain(otherFarmTransactionId);

    const farmBResponse = await http()
      .get(endpoint)
      .query({ farmId: farmB })
      .expect(200);
    expect(
      (farmBResponse.body as LedgerResponse).data.map(({ id }) => id),
    ).toEqual([otherFarmTransactionId]);

    currentIdentity = `${identity}-outsider`;
    await http().get(endpoint).query({ farmId: farmA }).expect(403);
    currentIdentity = `${identity}-farm-a-only`;
    await http().get(endpoint).query({ farmId: farmB }).expect(403);
    currentIdentity = identity;
  });

  it('shows confirmed receipt and issue movements beside the resulting balance', async () => {
    currentIdentity = ownerIdentity;
    const emptyBalance = await http()
      .get('/api/v1/inventory')
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: itemA })
      .expect(200);
    expect((emptyBalance.body as { data: unknown[] }).data).toEqual([]);

    const receiptResponse = await http()
      .post('/api/v1/stock-receipts')
      .query({ farmId: farmA })
      .send({
        warehouseId: warehouseA,
        items: [{ itemId: itemA, quantity: '10', unitPrice: '0' }],
      })
      .expect(201);
    const createdReceipt = (
      receiptResponse.body as { data: { receipt: { id: string } } }
    ).data.receipt;
    await http()
      .post(`/api/v1/stock-receipts/${createdReceipt.id}/confirm`)
      .query({ farmId: farmA })
      .expect(201);
    currentIdentity = identity;

    const receiptBalance = await http()
      .get('/api/v1/inventory')
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: itemA })
      .expect(200);
    expect(
      (receiptBalance.body as { data: Array<{ quantityOnHand: string }> }).data,
    ).toEqual([expect.objectContaining({ quantityOnHand: '10.000' })]);

    currentIdentity = ownerIdentity;
    const issueResponse = await http()
      .post('/api/v1/stock-issues')
      .query({ farmId: farmA })
      .send({
        warehouseId: warehouseA,
        items: [{ itemId: itemA, quantity: '3' }],
      })
      .expect(201);
    const createdIssue = (
      issueResponse.body as { data: { issue: { id: string } } }
    ).data.issue;
    await http()
      .post(`/api/v1/stock-issues/${createdIssue.id}/confirm`)
      .query({ farmId: farmA })
      .expect(201);
    currentIdentity = identity;

    const balances = await http()
      .get('/api/v1/inventory')
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: itemA })
      .expect(200);
    expect(
      (balances.body as { data: Array<{ quantityOnHand: string }> }).data,
    ).toEqual([expect.objectContaining({ quantityOnHand: '7.000' })]);

    const ledger = await http()
      .get(endpoint)
      .query({ farmId: farmA, warehouseId: warehouseA, itemId: itemA })
      .expect(200);
    const movements = (ledger.body as LedgerResponse).data;
    expect(
      movements.find(({ source }) => source.id === createdReceipt.id),
    ).toMatchObject({
      transactionType: 'RECEIPT',
      quantityChange: '10.000',
      source: {
        type: 'STOCK_RECEIPT',
        id: createdReceipt.id,
        code: expect.stringMatching(/^PN-\d{4}-\d{6}$/) as string,
      },
    });
    expect(
      movements.find(({ source }) => source.id === createdIssue.id),
    ).toMatchObject({
      transactionType: 'ISSUE',
      quantityChange: '-3.000',
      source: {
        type: 'STOCK_ISSUE',
        id: createdIssue.id,
        code: expect.stringMatching(/^PX-\d{4}-\d{6}$/) as string,
      },
    });
  });
});

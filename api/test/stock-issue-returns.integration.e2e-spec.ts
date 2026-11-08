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
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { StockIssuesController } from '../src/modules/warehouses/stock-issues.controller';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsController } from '../src/modules/warehouses/stock-receipts.controller';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type IssueDetail = {
  issue: { id: string };
  items: {
    id: string;
    itemId: string;
    lotId: string | null;
    returnedQuantity: string;
  }[];
};
type ReceiptDetail = {
  receipt: { id: string; status: string; sourceIssueId: string | null };
  items: {
    sourceIssueItemId: string | null;
    quantity: string;
    rejectedQuantity: string;
    lotId: string | null;
  }[];
};

// NV02 internal return (P0-03) against real PostgreSQL; only farm access is stubbed.
describe('Internal return of issued QUANTITY/LOT goods', () => {
  const tag = `return-test-${randomUUID().slice(0, 8)}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: tag,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  const farm = randomUUID(),
    otherFarm = randomUUID(),
    user = randomUUID(),
    member = randomUUID();
  const access = jest.fn();
  const category = randomUUID(),
    unit = randomUUID(),
    warehouse = randomUUID(),
    location = randomUUID();
  const quantityItem = randomUUID(),
    lotItem = randomUUID(),
    assetItem = randomUUID(),
    lot = randomUUID(),
    asset = randomUUID();
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  const issue = async (
    lines: Record<string, unknown>[],
    issueType = 'CONSUMPTION',
  ) => {
    const created = await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send({ warehouseId: warehouse, issueType, items: lines })
      .expect(201);
    const id = (created.body as { data: IssueDetail }).data.issue.id;
    await http()
      .post(`/stock-issues/${id}/confirm`)
      .query({ farmId: farm })
      .expect(201);
    const detail = await http()
      .get(`/stock-issues/${id}`)
      .query({ farmId: farm })
      .expect(200);
    return (detail.body as { data: IssueDetail }).data;
  };
  const returnDraft = (issueId: string, items: Record<string, unknown>[]) =>
    http()
      .post(`/stock-receipts/from-issue/${issueId}`)
      .query({ farmId: farm })
      .send({ items });
  const confirm = (receiptId: string) =>
    http().post(`/stock-receipts/${receiptId}/confirm`).query({ farmId: farm });
  const balance = async (itemId: string) => {
    const result = await pool.query<{ quantity: string }>(
      'SELECT quantity_on_hand::text AS quantity FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farm, itemId],
    );
    return result.rows[0]?.quantity;
  };
  const ledger = async (receiptId: string) =>
    (
      await pool.query<{ quantity: string; lot_id: string | null }>(
        'SELECT quantity_change::text AS quantity, lot_id FROM inventory_transactions WHERE source_id=$1 ORDER BY quantity_change',
        [receiptId],
      )
    ).rows;

  beforeAll(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values([
        { id: farm, code: tag, name: tag },
        { id: otherFarm, code: `${tag}-b`, name: tag },
      ]);
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
      await tx.insert(schema.warehouses).values({
        id: warehouse,
        farmId: farm,
        code: 'W0',
        name: tag,
        status: 'ACTIVE',
      });
      await tx.insert(schema.locations).values({
        id: location,
        farmId: farm,
        warehouseId: warehouse,
        type: 'WAREHOUSE_ZONE',
        code: 'L0',
        name: tag,
      });
      await tx.insert(schema.items).values(
        [quantityItem, lotItem, assetItem].map((id, i) => ({
          id,
          farmId: farm,
          categoryId: category,
          unitId: unit,
          code: `I${i}`,
          name: tag,
          itemType: i === 2 ? ('EQUIPMENT' as const) : ('MATERIAL' as const),
          trackingMode: (['QUANTITY', 'LOT', 'ASSET'] as const)[i],
        })),
      );
      await tx.insert(schema.inventoryLots).values({
        id: lot,
        farmId: farm,
        itemId: lotItem,
        initialQuantity: '50',
      });
      await tx.insert(schema.assets).values({
        id: asset,
        farmId: farm,
        itemId: assetItem,
        assetCode: `${tag}-A`,
        currentLocationId: location,
      });
    });
    const writer = async (farmId: string, user: string) => ({
      memberId: (await access(farmId, user, true)) as string,
      canApprove: true,
      scope: null,
    });
    const module = await Test.createTestingModule({
      controllers: [StockIssuesController, StockReceiptsController],
      providers: [
        StockIssuesService,
        StockReceiptsService,
        { provide: DatabaseService, useValue: { db } },
        {
          provide: WarehousesService,
          useValue: {
            assertFarmAccess: access,
            documentReadScope: async (farmId: string, user: string) => {
              await access(farmId, user, false);
              return { memberId: null, scope: null };
            },
            assertScopedAccess: writer,
            assertDocumentWriter: writer,
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
    await pool.query('DELETE FROM stock_receipts WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM stock_issues WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
    await pool.query(
      "UPDATE assets SET status='AVAILABLE', current_location_id=$2 WHERE id=$1",
      [asset, location],
    );
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: quantityItem,
        quantityOnHand: '20',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: lotItem,
        lotId: lot,
        quantityOnHand: '20',
      },
      {
        farmId: farm,
        warehouseId: warehouse,
        itemId: assetItem,
        quantityOnHand: '1',
      },
    ]);
  });

  afterAll(async () => {
    try {
      await app?.close();
      for (const table of [
        'audit_logs',
        'notifications',
        'inventory_transactions',
        'stock_receipts',
        'stock_issues',
        'stock_document_counters',
        'inventory_balances',
        'assets',
        'inventory_lots',
        'items',
        'locations',
        'warehouses',
        'farm_members',
      ])
        await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
      for (const [table, id] of [
        ['users', user],
        ['categories', category],
        ['units', unit],
        ['farms', farm],
        ['farms', otherFarm],
      ])
        await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    } finally {
      await pool.end();
    }
  });

  it('puts back only the accepted part, once, into the same lot', async () => {
    const issued = await issue([
      { itemId: quantityItem, quantity: '10' },
      { itemId: lotItem, lotId: lot, quantity: '10' },
    ]);
    expect(await balance(quantityItem)).toBe('10.000');
    const [quantityLine, lotLine] = [quantityItem, lotItem].map((itemId) =>
      issued.items.find((line) => line.itemId === itemId)!,
    );
    const draft = await returnDraft(issued.issue.id, [
      {
        issueItemId: quantityLine.id,
        acceptedQuantity: '8',
        rejectedQuantity: '2',
        rejectionReason: 'Rách bao bì',
      },
      { issueItemId: lotLine.id, acceptedQuantity: '10' },
    ]).expect(201);
    const receipt = (draft.body as { data: ReceiptDetail }).data;
    expect(receipt.receipt.sourceIssueId).toBe(issued.issue.id);
    expect(receipt.items.find((l) => l.lotId === lot)).toBeDefined();
    // A draft moves nothing.
    expect(await balance(quantityItem)).toBe('10.000');

    await confirm(receipt.receipt.id).expect(201);
    expect(await balance(quantityItem)).toBe('18.000');
    expect(await balance(lotItem)).toBe('20.000');
    expect(await ledger(receipt.receipt.id)).toEqual([
      { quantity: '8.000', lot_id: null },
      { quantity: '10.000', lot_id: lot },
    ]);
    // Retried confirm is a no-op.
    await confirm(receipt.receipt.id).expect(201);
    expect(await balance(quantityItem)).toBe('18.000');

    const detail = await http()
      .get(`/stock-issues/${issued.issue.id}`)
      .query({ farmId: farm })
      .expect(200);
    const lines = (detail.body as { data: IssueDetail }).data.items;
    expect(lines.find((l) => l.id === quantityLine.id)?.returnedQuantity).toBe(
      '10.000',
    );
  });

  it('records a return where nothing passes without moving stock', async () => {
    const issued = await issue([{ itemId: quantityItem, quantity: '10' }]);
    const draft = await returnDraft(issued.issue.id, [
      {
        issueItemId: issued.items[0].id,
        acceptedQuantity: '0',
        rejectedQuantity: '10',
        rejectionReason: 'Hỏng toàn bộ',
      },
    ]).expect(201);
    const receipt = (draft.body as { data: ReceiptDetail }).data;
    await confirm(receipt.receipt.id).expect(201);
    expect(await balance(quantityItem)).toBe('10.000');
    expect(await ledger(receipt.receipt.id)).toEqual([]);
    const status = await pool.query<{ status: string }>(
      'SELECT status FROM stock_receipts WHERE id=$1',
      [receipt.receipt.id],
    );
    expect(status.rows[0].status).toBe('CONFIRMED');
  });

  it('refuses returns beyond what was issued, empty lines and missing reasons', async () => {
    const issued = await issue([{ itemId: quantityItem, quantity: '10' }]);
    const issueItemId = issued.items[0].id;
    await returnDraft(issued.issue.id, [
      { issueItemId, acceptedQuantity: '11' },
    ]).expect(409);
    await returnDraft(issued.issue.id, [
      { issueItemId, acceptedQuantity: '0' },
    ]).expect(400);
    await returnDraft(issued.issue.id, [
      { issueItemId, acceptedQuantity: '1', rejectedQuantity: '1' },
    ]).expect(400);
    await returnDraft(issued.issue.id, [
      { issueItemId, acceptedQuantity: '1' },
      { issueItemId, acceptedQuantity: '1' },
    ]).expect(400);
    await returnDraft(issued.issue.id, [
      { issueItemId: randomUUID(), acceptedQuantity: '1' },
    ]).expect(400);

    // Two drafts each fit alone; the second confirm no longer fits.
    const drafts = await Promise.all(
      ['6', '6'].map(async (quantity) => {
        const response = await returnDraft(issued.issue.id, [
          { issueItemId, acceptedQuantity: quantity },
        ]).expect(201);
        return (response.body as { data: ReceiptDetail }).data.receipt.id;
      }),
    );
    await confirm(drafts[0]).expect(201);
    const second = await confirm(drafts[1]).expect(409);
    expect((second.body as { code?: string }).code).toBe(
      'RETURN_EXCEEDS_ISSUED',
    );
    expect(await balance(quantityItem)).toBe('16.000');
  });

  it('serializes concurrent confirmations of competing returns', async () => {
    const issued = await issue([{ itemId: quantityItem, quantity: '10' }]);
    const ids = await Promise.all(
      ['7', '7'].map(async (quantity) => {
        const response = await returnDraft(issued.issue.id, [
          { issueItemId: issued.items[0].id, acceptedQuantity: quantity },
        ]).expect(201);
        return (response.body as { data: ReceiptDetail }).data.receipt.id;
      }),
    );
    const results = await Promise.all(ids.map((id) => confirm(id)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await balance(quantityItem)).toBe('17.000');
  });

  it('refuses unconfirmed, asset and damage issues, other farms and edits', async () => {
    const draft = await http()
      .post('/stock-issues')
      .query({ farmId: farm })
      .send({
        warehouseId: warehouse,
        items: [{ itemId: quantityItem, quantity: '1' }],
      })
      .expect(201);
    const draftIssue = (draft.body as { data: IssueDetail }).data;
    await returnDraft(draftIssue.issue.id, [
      { issueItemId: draftIssue.items[0].id, acceptedQuantity: '1' },
    ]).expect(409);

    const damage = await issue(
      [{ itemId: quantityItem, quantity: '1' }],
      'DAMAGE',
    );
    await returnDraft(damage.issue.id, [
      { issueItemId: damage.items[0].id, acceptedQuantity: '1' },
    ]).expect(409);

    const assets = await issue([
      { itemId: assetItem, assetId: asset, quantity: '1' },
    ]);
    await returnDraft(assets.issue.id, [
      { issueItemId: assets.items[0].id, acceptedQuantity: '1' },
    ]).expect(400);

    const issued = await issue([{ itemId: quantityItem, quantity: '5' }]);
    await http()
      .post(`/stock-receipts/from-issue/${issued.issue.id}`)
      .query({ farmId: otherFarm })
      .send({
        items: [{ issueItemId: issued.items[0].id, acceptedQuantity: '1' }],
      })
      .expect(404);

    const created = await returnDraft(issued.issue.id, [
      { issueItemId: issued.items[0].id, acceptedQuantity: '1' },
    ]).expect(201);
    const receiptId = (created.body as { data: ReceiptDetail }).data.receipt.id;
    await http()
      .patch(`/stock-receipts/${receiptId}`)
      .query({ farmId: farm })
      .send({ items: [{ itemId: quantityItem, quantity: '5' }] })
      .expect(409);

    // A failed confirmation leaves nothing behind.
    await pool.query("UPDATE warehouses SET status='INACTIVE' WHERE id=$1", [
      warehouse,
    ]);
    try {
      await confirm(receiptId).expect(409);
    } finally {
      await pool.query("UPDATE warehouses SET status='ACTIVE' WHERE id=$1", [
        warehouse,
      ]);
    }
    expect(await ledger(receiptId)).toEqual([]);
    expect(await balance(quantityItem)).toBe('14.000');
  });
});

import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { InventoryAdjustmentsService } from '../src/modules/inventory/inventory-adjustments.service';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

/**
 * Backdated stock and maintenance history for the reports page (/reports).
 *
 * Runs every document through the real services (approval, ledger, balances,
 * document codes) in the farm's real warehouses, then moves its timestamps back
 * to the planned day, oldest first, so "price at the time" stays correct.
 *
 * Everything happens in one transaction: notifications raised by the services
 * and the MAINTENANCE_STAFF role lent to the owner for the maintenance steps are
 * removed before commit, so the push worker never sees them. Documents carry
 * MARKER in their note, and the script refuses to run twice.
 *
 * Usage: ts-node --transpile-only scripts/seed-demo-history.ts
 *          [--farm FARM_CODE] [--weeks 13] [--dry-run] [--allow-remote]
 */

const MARKER = '[Dữ liệu mẫu lịch sử]';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'postgres'];
const DEMO_WAREHOUSE = 'DEMO-KHO';
// Preferred items when the farm has them; otherwise any active item of that tracking mode.
const PREFERRED = {
  QUANTITY: ['KS-041', 'KS-086', 'KS-040', 'KS-069', 'KS-218', 'KS-185'],
  LOT: ['KS-103', 'KS-104', 'KS-108', 'KS-206'],
  ASSET: ['KS-175', 'KS-119', 'KS-205'],
};
const ROLLBACK = new Error('dry run: rolled back');

type Db = DatabaseService['db'];
type Item = { id: string; code: string; name: string; price: number };
type Warehouse = { id: string; code: string; name: string };

/** Deterministic pseudo-random numbers, so a re-run on a fresh copy plans the same history. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Vietnam wall-clock time `days` after `start` (YYYY-MM-DD) as an ISO instant. */
function vnTime(start: string, days: number, hour: number, minute = 0) {
  const [y, m, d] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, hour - 7, minute)).toISOString();
}
const vnDate = (iso: string) =>
  new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

async function seed(db: Db, farmCode: string | undefined, weeks: number) {
  const service = { db } as DatabaseService;
  const warehouses = new WarehousesService(service);
  const receipts = new StockReceiptsService(service, warehouses);
  const issues = new StockIssuesService(service, warehouses);
  const transfers = new StockTransfersService(service, warehouses);
  const adjustments = new InventoryAdjustmentsService(service, warehouses);
  const maintenance = new MaintenanceService(service, warehouses);

  const farms = await db
    .select({ id: schema.farms.id, code: schema.farms.code })
    .from(schema.farms)
    .where(farmCode ? eq(schema.farms.code, farmCode) : undefined);
  if (farms.length !== 1)
    throw new Error(
      `Pass --farm FARM_CODE (${farms.map((farm) => farm.code).join(', ')}).`,
    );
  const farm = farms[0];

  const [already] = await db
    .select({ id: schema.stockReceipts.id })
    .from(schema.stockReceipts)
    .where(
      and(
        eq(schema.stockReceipts.farmId, farm.id),
        sql`${schema.stockReceipts.note} LIKE ${`%${MARKER}%`}`,
      ),
    )
    .limit(1);
  if (already) throw new Error(`History was already seeded on ${farm.code}.`);

  const [owner] = await db
    .select({
      clerkUserId: schema.users.authProviderUserId,
      memberId: schema.farmMembers.id,
    })
    .from(schema.farmMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.farmMembers.userId))
    .innerJoin(
      schema.farmMemberRoles,
      eq(schema.farmMemberRoles.farmMemberId, schema.farmMembers.id),
    )
    .innerJoin(schema.roles, eq(schema.roles.id, schema.farmMemberRoles.roleId))
    .where(
      and(
        eq(schema.farmMembers.farmId, farm.id),
        eq(schema.farmMembers.status, 'ACTIVE'),
        eq(schema.users.status, 'ACTIVE'),
        eq(schema.roles.code, 'FARM_OWNER'),
      ),
    )
    .orderBy(asc(schema.farmMembers.createdAt))
    .limit(1);
  if (!owner) throw new Error('The farm has no active FARM_OWNER.');
  const user = owner.clerkUserId;

  const allWarehouses: Warehouse[] = await db
    .select({
      id: schema.warehouses.id,
      code: schema.warehouses.code,
      name: schema.warehouses.name,
    })
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.farmId, farm.id),
        eq(schema.warehouses.status, 'ACTIVE'),
        sql`${schema.warehouses.code} <> ${DEMO_WAREHOUSE}`,
      ),
    )
    .orderBy(asc(schema.warehouses.code));
  const [settings] = await db
    .select({ id: schema.storeSettings.salesWarehouseId })
    .from(schema.storeSettings)
    .where(eq(schema.storeSettings.farmId, farm.id));
  const sales = allWarehouses.find((w) => w.id === settings?.id);
  const working = allWarehouses.filter((w) => w.id !== sales?.id);
  if (working.length < 2)
    throw new Error(
      'Need at least two working warehouses besides the sales one.',
    );
  const main = working.find((w) => w.code === farm.code) ?? working[0];

  const pick = async (mode: 'QUANTITY' | 'LOT' | 'ASSET', count: number) => {
    const rows = await db
      .select({
        id: schema.items.id,
        code: schema.items.code,
        name: schema.items.name,
      })
      .from(schema.items)
      .where(
        and(
          eq(schema.items.farmId, farm.id),
          eq(schema.items.status, 'ACTIVE'),
          eq(schema.items.trackingMode, mode),
        ),
      )
      .orderBy(asc(schema.items.code));
    const rank = (code: string) => {
      const index = PREFERRED[mode].indexOf(code);
      return index === -1 ? Infinity : index;
    };
    return rows.sort((a, b) => rank(a.code) - rank(b.code)).slice(0, count);
  };
  const next = random(20261105);
  const priced = (rows: Omit<Item, 'price'>[], min: number, max: number) =>
    rows.map((row) => ({
      ...row,
      price: Math.round((min + next() * (max - min)) / 1000) * 1000,
    }));
  const quantityItems = priced(await pick('QUANTITY', 6), 15_000, 250_000);
  const lotItems = priced(await pick('LOT', 4), 20_000, 120_000);
  const assetItems = priced(await pick('ASSET', 3), 2_500_000, 12_000_000);
  if (quantityItems.length < 3 || assetItems.length === 0)
    throw new Error(
      'The farm needs at least 3 QUANTITY items and 1 ASSET item.',
    );

  const [supplier] = await db
    .select({ id: schema.suppliers.id })
    .from(schema.suppliers)
    .where(
      and(
        eq(schema.suppliers.farmId, farm.id),
        eq(schema.suppliers.status, 'ACTIVE'),
      ),
    )
    .orderBy(asc(schema.suppliers.code))
    .limit(1);
  const shelfCode = `${main.code}-KE-TB`.slice(0, 50);
  await db
    .insert(schema.locations)
    .values({
      farmId: farm.id,
      warehouseId: main.id,
      code: shelfCode,
      name: 'Kệ thiết bị',
      type: 'WAREHOUSE_ZONE',
    })
    .onConflictDoNothing();
  const [shelf] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(
      and(
        eq(schema.locations.farmId, farm.id),
        eq(schema.locations.code, shelfCode),
      ),
    );

  // Lend MAINTENANCE_STAFF for start/receive/complete; removed again below.
  const [maintenanceRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, 'MAINTENANCE_STAFF'));
  const lent = await db
    .insert(schema.farmMemberRoles)
    .values({ farmMemberId: owner.memberId, roleId: maintenanceRole.id })
    .onConflictDoNothing()
    .returning();

  const seeded: string[] = [];
  const counts: Record<string, number> = {};
  const done = (kind: string, id: string) => {
    seeded.push(id);
    counts[kind] = (counts[kind] ?? 0) + 1;
  };
  /** Moves a document, its ledger rows and its audit entries to `at`. */
  const backdate = async (
    table: string,
    id: string,
    at: string,
    extra: Record<string, string> = {},
  ) => {
    // inventory_adjustments has no updated_at.
    const base: Record<string, string> =
      table === 'inventory_adjustments'
        ? { created_at: at }
        : { created_at: at, updated_at: at };
    const sets = Object.entries({ ...base, ...extra })
      .map(([column, value]) => sql`${sql.identifier(column)} = ${value}`)
      .reduce((all, part) => sql`${all}, ${part}`);
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET ${sets} WHERE id = ${id}`,
    );
    await db.execute(
      sql`UPDATE inventory_transactions SET created_at = ${at} WHERE source_id = ${id}`,
    );
    await db.execute(
      sql`UPDATE audit_logs SET created_at = ${at} WHERE entity_id = ${id}`,
    );
  };
  const onHand = async (warehouseId: string, itemId: string) => {
    const rows = await db
      .select({
        lotId: schema.inventoryBalances.lotId,
        quantity: schema.inventoryBalances.quantityOnHand,
      })
      .from(schema.inventoryBalances)
      .where(
        and(
          eq(schema.inventoryBalances.warehouseId, warehouseId),
          eq(schema.inventoryBalances.itemId, itemId),
          sql`${schema.inventoryBalances.quantityOnHand} >= 1`,
        ),
      )
      .orderBy(sql`${schema.inventoryBalances.quantityOnHand} DESC`)
      .limit(1);
    return rows[0]
      ? { lotId: rows[0].lotId, quantity: Math.floor(Number(rows[0].quantity)) }
      : null;
  };
  const between = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const choose = <T>(list: T[]) => list[Math.floor(next() * list.length)];
  // Prices creep up ~1.5% a week so the value chart shows price-at-the-time.
  const priceAt = (item: Item, week: number) =>
    String(Math.round((item.price * (1 + 0.015 * week)) / 100) * 100);

  const receive = async (
    at: string,
    week: number,
    warehouse: Warehouse,
    lines: { item: Item; quantity: number; lot?: boolean; asset?: number }[],
  ) => {
    const created = await receipts.createReceipt(farm.id, user, {
      warehouseId: warehouse.id,
      supplierId: supplier?.id ?? null,
      receiptDate: vnDate(at),
      note: `${MARKER} Nhập hàng định kỳ`,
      items: lines.map(({ item, quantity, lot, asset }) => ({
        itemId: item.id,
        quantity: String(quantity),
        unitPrice: priceAt(item, week),
        ...(lot
          ? {
              supplierLotNumber: `LO-${vnDate(at).replaceAll('-', '')}-${item.code}`,
              manufacturedDate: vnDate(vnTime(vnDate(at), -20, 12)),
              expiryDate: vnDate(vnTime(vnDate(at), 300, 12)),
            }
          : {}),
        ...(asset !== undefined
          ? {
              assetCode: `TS-${item.code}-${String(asset).padStart(2, '0')}`,
              serialNumber: `SN-${item.code}-${randomUUID().slice(0, 6)}`,
              locationId: shelf.id,
            }
          : {}),
      })),
    });
    const id = created.receipt.id;
    await receipts.confirmReceipt(id, farm.id, user);
    await backdate('stock_receipts', id, at, {
      confirmed_at: at,
      receipt_date: vnDate(at),
    });
    await db.execute(sql`
      UPDATE inventory_lots SET created_at = ${at}
      WHERE source_receipt_item_id IN (SELECT id FROM stock_receipt_items WHERE stock_receipt_id = ${id})`);
    await db.execute(sql`
      UPDATE assets SET created_at = ${at}, updated_at = ${at}, purchase_date = ${vnDate(at)}
      WHERE farm_id = ${farm.id} AND asset_code IN (
        SELECT asset_code FROM stock_receipt_items WHERE stock_receipt_id = ${id} AND asset_code IS NOT NULL)`);
    done('phiếu nhập', id);
  };

  const issue = async (
    at: string,
    warehouse: Warehouse,
    candidates: Item[],
    issueType: 'CONSUMPTION' | 'DAMAGE',
  ) => {
    const lines: { itemId: string; quantity: string; lotId?: string }[] = [];
    for (const item of candidates) {
      const stock = await onHand(warehouse.id, item.id);
      if (!stock || stock.quantity < 2) continue;
      const share = issueType === 'DAMAGE' ? 0.1 : 0.2 + next() * 0.25;
      lines.push({
        itemId: item.id,
        quantity: String(Math.max(1, Math.floor(stock.quantity * share))),
        ...(stock.lotId ? { lotId: stock.lotId } : {}),
      });
      if (lines.length === (issueType === 'DAMAGE' ? 1 : 2)) break;
    }
    if (!lines.length) return;
    const created = await issues.create(farm.id, user, {
      warehouseId: warehouse.id,
      issueDate: vnDate(at),
      issueType,
      reason:
        issueType === 'DAMAGE'
          ? 'Hư hỏng trong quá trình bảo quản'
          : 'Xuất dùng cho các đàn ong',
      note: MARKER,
      items: lines,
    });
    const id = created.issue.id;
    await issues.confirm(id, farm.id, user);
    await backdate('stock_issues', id, at, {
      confirmed_at: at,
      issue_date: vnDate(at),
    });
    done('phiếu xuất', id);
  };

  const transfer = async (
    at: string,
    from: Warehouse,
    to: Warehouse,
    candidates: Item[],
  ) => {
    const lines: { itemId: string; quantity: string; lotId?: string }[] = [];
    for (const item of candidates) {
      const stock = await onHand(from.id, item.id);
      if (!stock || stock.quantity < 4) continue;
      lines.push({
        itemId: item.id,
        quantity: String(Math.floor(stock.quantity * 0.3)),
        ...(stock.lotId ? { lotId: stock.lotId } : {}),
      });
      if (lines.length === 2) break;
    }
    if (!lines.length) return;
    const created = await transfers.create(farm.id, user, {
      fromWarehouseId: from.id,
      toWarehouseId: to.id,
      transferDate: vnDate(at),
      note: MARKER,
      items: lines,
    });
    const id = (created as { transfer: { id: string } }).transfer.id;
    await transfers.submit(id, farm.id, user);
    await transfers.confirm(id, farm.id, user);
    await backdate('stock_transfers', id, at, {
      confirmed_at: at,
      transfer_date: vnDate(at),
    });
    done('điều chuyển', id);
  };

  const adjust = async (at: string, warehouse: Warehouse, item: Item) => {
    const stock = await onHand(warehouse.id, item.id);
    if (!stock || stock.quantity < 3) return;
    const surplus = next() < 0.3;
    const created = await adjustments.create(farm.id, user, {
      idempotencyKey: randomUUID(),
      warehouseId: warehouse.id,
      itemId: item.id,
      ...(stock.lotId ? { lotId: stock.lotId } : {}),
      quantityChange: surplus ? '1' : `-${between(1, 2)}`,
      reasonCode: surplus ? 'STOCK_COUNT' : 'SHRINKAGE',
      note: `${MARKER} ${surplus ? 'Kiểm kê thấy dư' : 'Hao hụt khi kiểm kê'}`,
    });
    const id = created.adjustment.id;
    await backdate('inventory_adjustments', id, at, { reviewed_at: at });
    done('điều chỉnh', id);
  };

  const serviceAsset = async (
    day: string,
    assetId: string,
    kind: 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION',
  ) => {
    const now = Date.now();
    const created = await maintenance.create(farm.id, user, {
      assetId,
      maintenanceType: kind,
      scheduledAt: new Date(now).toISOString(),
      expectedReturnAt: new Date(now + 4 * 86_400_000).toISOString(),
      supplierId: supplier?.id ?? null,
      description: `${MARKER} ${
        kind === 'CORRECTIVE'
          ? 'Sửa chữa sau sự cố'
          : kind === 'INSPECTION'
            ? 'Kiểm tra định kỳ'
            : 'Bảo dưỡng định kỳ'
      }`,
    });
    const id = (created as { id: string }).id;
    await maintenance.start(id, farm.id, user);
    await maintenance.receive(id, farm.id, user, new Date().toISOString());
    await maintenance.complete(id, farm.id, user, {
      outcome: 'PASSED',
      intervalMonths: 3,
      resultNote: 'Thiết bị hoạt động bình thường sau bảo trì',
      laborCost: String(between(2, 8) * 50_000),
      materialCost: String(kind === 'INSPECTION' ? 0 : between(1, 10) * 40_000),
      otherCost: String(next() < 0.4 ? between(1, 3) * 30_000 : 0),
    });
    await maintenance.submitReturn(id, farm.id, user, {
      warehouseId: main.id,
      locationId: shelf.id,
    });
    await maintenance.reviewReturn(id, farm.id, user, true);
    const start = vnTime(day, 0, 8);
    const completed = vnTime(day, 3, 16);
    await backdate('maintenance_records', id, completed, {
      created_at: vnTime(day, -2, 9),
      scheduled_at: start,
      started_at: vnTime(day, 0, 9),
      expected_return_at: vnTime(day, 4, 17),
      received_at: vnTime(day, 3, 15),
      completed_at: completed,
      return_reviewed_at: vnTime(day, 3, 17),
    });
    // The asset left and came back: its two ledger rows get their own times.
    await db.execute(sql`
      UPDATE inventory_transactions SET created_at = CASE
        WHEN transaction_type = 'MAINTENANCE_ISSUE' THEN ${vnTime(day, 0, 9)}::timestamptz
        ELSE ${vnTime(day, 3, 17)}::timestamptz END
      WHERE source_id = ${id}`);
    // Next due date counts from the (backdated) day the asset came back.
    const due = sql`(${vnDate(completed)}::date + interval '3 months')::date`;
    await db.execute(
      sql`UPDATE maintenance_records SET next_due_date = ${due} WHERE id = ${id}`,
    );
    await db.execute(sql`
      UPDATE assets SET last_maintenance_date = ${vnDate(completed)}, next_maintenance_date = ${due}
      WHERE id = ${assetId}`);
    done('bảo trì', id);
  };

  // Plan: Monday (today - weeks) onwards, about four documents a week.
  const today = new Date();
  const monday = new Date(today.getTime() - weeks * 7 * 86_400_000);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const start = monday.toISOString().slice(0, 10);
  const past = (iso: string) => Date.parse(iso) < today.getTime() - 3_600_000;
  const stockItems: Item[] = [...quantityItems, ...lotItems];
  const isLot = (item: Item) => lotItems.includes(item);
  console.info(
    `Farm ${farm.code}: ${weeks} weeks from ${start}; warehouses ${working.map((w) => w.code).join(', ')}${sales ? ` + sales ${sales.code}` : ''}.`,
  );

  // Opening stock in every working warehouse, so later issues have something to take.
  for (const [index, warehouse] of working.entries()) {
    const at = vnTime(start, index, 8, 30);
    await receive(
      at,
      0,
      warehouse,
      stockItems.map((item) => ({
        item,
        quantity: between(30, 80),
        lot: isLot(item),
      })),
    );
  }
  const assetDay = vnTime(start, 1, 10);
  await receive(
    assetDay,
    0,
    main,
    assetItems.map((item, index) => ({ item, quantity: 1, asset: index + 1 })),
  );
  const assets = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.farmId, farm.id),
        inArray(
          schema.assets.assetCode,
          assetItems.map(
            (item, index) =>
              `TS-${item.code}-${String(index + 1).padStart(2, '0')}`,
          ),
        ),
      ),
    );

  // week === weeks is the current week, filled up to today.
  for (let week = 0; week <= weeks; week++) {
    const warehouse = choose(working);
    const plan: [string, () => Promise<void>][] = [
      [
        vnTime(start, week * 7, 8, between(0, 50)),
        () =>
          receive(
            vnTime(start, week * 7, 8),
            week,
            warehouse,
            [choose(stockItems), choose(stockItems)]
              .filter((item, index, all) => all.indexOf(item) === index)
              .map((item) => ({
                item,
                quantity: between(10, 40),
                lot: isLot(item),
              })),
          ),
      ],
      [
        vnTime(start, week * 7 + 2, 14),
        () =>
          issue(
            vnTime(start, week * 7 + 2, 14),
            choose(working),
            [...stockItems].sort(() => next() - 0.5),
            'CONSUMPTION',
          ),
      ],
      [
        vnTime(start, week * 7 + 3, 10),
        () =>
          sales && week % 2 === 0
            ? transfer(
                vnTime(start, week * 7 + 3, 10),
                choose(working),
                sales,
                [...stockItems].sort(() => next() - 0.5),
              )
            : transfer(
                vnTime(start, week * 7 + 3, 10),
                working[week % working.length],
                working[(week + 1) % working.length],
                [...stockItems].sort(() => next() - 0.5),
              ),
      ],
      [
        vnTime(start, week * 7 + 4, 16),
        () =>
          week % 3 === 2
            ? adjust(
                vnTime(start, week * 7 + 4, 16),
                choose(working),
                choose(stockItems),
              )
            : issue(
                vnTime(start, week * 7 + 4, 16),
                choose(working),
                [...stockItems].sort(() => next() - 0.5),
                week % 3 === 1 ? 'DAMAGE' : 'CONSUMPTION',
              ),
      ],
    ];
    // Maintenance: each asset roughly once a month, staggered.
    for (const [index, asset] of assets.entries()) {
      if ((week + index) % 4 === 1 && week > 0) {
        const day = vnDate(vnTime(start, week * 7 + 1, 12));
        // Maintenance ends three days after it starts; keep the whole visit in the past.
        if (!past(vnTime(day, 4, 0))) continue;
        plan.push([
          vnTime(day, 0, 8),
          () =>
            serviceAsset(
              day,
              asset.id,
              (['PREVENTIVE', 'INSPECTION', 'CORRECTIVE'] as const)[
                (week + index) % 3
              ],
            ),
        ]);
      }
    }
    for (const [at, run] of plan.sort(([a], [b]) => a.localeCompare(b))) {
      if (past(at)) await run();
    }
  }

  // Raised while seeding; history should not show up as fresh alerts or pushes.
  if (seeded.length)
    await db
      .delete(schema.notifications)
      .where(inArray(schema.notifications.entityId, seeded));
  if (lent.length)
    await db
      .delete(schema.farmMemberRoles)
      .where(
        and(
          eq(schema.farmMemberRoles.farmMemberId, owner.memberId),
          eq(schema.farmMemberRoles.roleId, maintenanceRole.id),
        ),
      );
  console.info(
    `Seeded: ${Object.entries(counts)
      .map(([kind, count]) => `${count} ${kind}`)
      .join(', ')}.`,
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const remote = !LOCAL_HOSTS.includes(new URL(connectionString).hostname);
  if (remote && !process.argv.includes('--allow-remote'))
    throw new Error(
      'DATABASE_URL points to a remote database; pass --allow-remote to confirm.',
    );
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
    ...(remote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const weeks = Number(argValue('--weeks') ?? 13);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)
    throw new Error('--weeks must be 1–52.');
  const dryRun = process.argv.includes('--dry-run');
  try {
    await drizzle(pool, { schema }).transaction(async (tx) => {
      await seed(tx, argValue('--farm'), weeks);
      if (dryRun) throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
    console.info('Dry run: everything rolled back.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

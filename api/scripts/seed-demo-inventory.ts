import 'reflect-metadata';
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import type { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { InventoryAdjustmentsService } from '../src/modules/inventory/inventory-adjustments.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

/**
 * Demo inventory for walking through the warehouse screens.
 *
 * Everything lives in its own warehouse (DEMO-KHO) with DEMO- codes, so it never
 * shows up as sellable storefront stock, and `--cleanup` removes it again.
 * Stock is created through the real services (receipts, issues, adjustments) so
 * balances and the ledger always agree.
 *
 * Usage: ts-node --transpile-only scripts/seed-demo-inventory.ts
 *          [--farm FARM_CODE] [--cleanup] [--allow-remote]
 */

const WAREHOUSE_CODE = 'DEMO-KHO';
const DEMO_NOTE = 'Dữ liệu mẫu (DEMO) — xóa bằng seed-demo-inventory --cleanup';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'postgres'];

type Db = DatabaseService['db'];
type Services = {
  warehouses: WarehousesService;
  receipts: StockReceiptsService;
  issues: StockIssuesService;
  adjustments: InventoryAdjustmentsService;
};

/** Stable UUID per name, so re-runs replay the same adjustment instead of adding another. */
function stableUuid(name: string) {
  const hex = createHash('sha256')
    .update(`nuoi-ong-demo:${name}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function findFarm(db: Db, code?: string) {
  const farms = await db
    .select({ id: schema.farms.id, code: schema.farms.code })
    .from(schema.farms)
    .where(code ? eq(schema.farms.code, code) : undefined);
  if (farms.length !== 1) {
    throw new Error(
      code
        ? `Farm ${code} not found.`
        : `Found ${farms.length} farms; pass --farm FARM_CODE (${farms.map((farm) => farm.code).join(', ')}).`,
    );
  }
  return farms[0];
}

async function findOwnerIdentity(db: Db, farmId: string) {
  const [owner] = await db
    .select({ clerkUserId: schema.users.authProviderUserId })
    .from(schema.farmMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.farmMembers.userId))
    .innerJoin(
      schema.farmMemberRoles,
      eq(schema.farmMemberRoles.farmMemberId, schema.farmMembers.id),
    )
    .innerJoin(schema.roles, eq(schema.roles.id, schema.farmMemberRoles.roleId))
    .where(
      and(
        eq(schema.farmMembers.farmId, farmId),
        eq(schema.farmMembers.status, 'ACTIVE'),
        eq(schema.users.status, 'ACTIVE'),
        inArray(schema.roles.code, ['FARM_OWNER', 'ADMIN']),
      ),
    )
    .orderBy(asc(schema.farmMembers.createdAt))
    .limit(1);
  if (!owner) throw new Error('The farm has no active FARM_OWNER or ADMIN.');
  return owner.clerkUserId;
}

async function pickItems(db: Db, farmId: string) {
  const rows = await db
    .select({
      id: schema.items.id,
      code: schema.items.code,
      trackingMode: schema.items.trackingMode,
      unitCode: schema.units.code,
      unitName: schema.units.name,
    })
    .from(schema.items)
    .innerJoin(schema.units, eq(schema.units.id, schema.items.unitId))
    .where(
      and(eq(schema.items.farmId, farmId), eq(schema.items.status, 'ACTIVE')),
    )
    .orderBy(asc(schema.items.code));
  const unitOf = (row: (typeof rows)[number]) => {
    const text = `${row.unitCode} ${row.unitName}`.toLowerCase();
    if (/\bkg\b|kilo/.test(text)) return 'kg';
    if (/lít|\blit|liter/.test(text)) return 'lít';
    return row.unitName;
  };
  const picked = (mode: string) =>
    rows
      .filter((row) => row.trackingMode === mode)
      .map((row) => ({ id: row.id, code: row.code, unit: unitOf(row) }));
  const quantity = picked('QUANTITY');
  // Prefer a mix of kg, litre and count units so the stock hints show each kind.
  const byUnit = (unit: string) =>
    quantity.filter((item) => item.unit === unit);
  const mixed = [
    ...byUnit('kg').slice(0, 4),
    ...byUnit('lít').slice(0, 3),
    ...quantity.filter((item) => item.unit !== 'kg' && item.unit !== 'lít'),
  ].slice(0, 12);
  return {
    quantity: mixed,
    lot: picked('LOT').slice(0, 5),
    asset: picked('ASSET').slice(0, 4),
  };
}

async function ensureWarehouse(
  db: Db,
  services: Services,
  farmId: string,
  owner: string,
) {
  const existing = await findWarehouse(db, farmId);
  if (existing) return existing.id;
  await services.warehouses.createWarehouse(farmId, owner, {
    code: WAREHOUSE_CODE,
    name: 'Kho dữ liệu mẫu',
    description: `${DEMO_NOTE}. Không dùng cho cửa hàng.`,
  });
  return (await findWarehouse(db, farmId)).id;
}

async function findWarehouse(db: Db, farmId: string) {
  const [warehouse] = await db
    .select({ id: schema.warehouses.id })
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.farmId, farmId),
        eq(schema.warehouses.code, WAREHOUSE_CODE),
      ),
    );
  return warehouse;
}

async function ensureLocations(db: Db, farmId: string, warehouseId: string) {
  await db
    .insert(schema.locations)
    .values(
      [
        ['DEMO-KHO-KE-A', 'Kệ A — vật tư tiêu hao'],
        ['DEMO-KHO-KE-B', 'Kệ B — thiết bị, tài sản'],
      ].map(([code, name]) => ({
        farmId,
        warehouseId,
        code,
        name,
        type: 'WAREHOUSE_ZONE' as const,
        description: DEMO_NOTE,
      })),
    )
    .onConflictDoNothing();
  const [zone] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(
      and(
        eq(schema.locations.farmId, farmId),
        eq(schema.locations.code, 'DEMO-KHO-KE-B'),
      ),
    );
  return zone.id;
}

async function ensureSuppliers(db: Db, farmId: string) {
  await db
    .insert(schema.suppliers)
    .values([
      {
        farmId,
        code: 'DEMO-NCC-01',
        name: 'Nhà cung cấp mẫu — Vật tư nuôi ong',
        note: DEMO_NOTE,
      },
      {
        farmId,
        code: 'DEMO-NCC-02',
        name: 'Nhà cung cấp mẫu — Thiết bị',
        note: DEMO_NOTE,
      },
    ])
    .onConflictDoNothing();
  const rows = await db
    .select({ id: schema.suppliers.id, code: schema.suppliers.code })
    .from(schema.suppliers)
    .where(
      and(
        eq(schema.suppliers.farmId, farmId),
        like(schema.suppliers.code, 'DEMO-NCC-%'),
      ),
    )
    .orderBy(asc(schema.suppliers.code));
  return rows.map((row) => row.id);
}

/** Creates the receipt once, then confirms it if it is still a draft. */
async function ensureReceipt(
  db: Db,
  services: Services,
  farmId: string,
  owner: string,
  input: Parameters<StockReceiptsService['createReceipt']>[2],
) {
  if (input.items.length === 0) return 'skipped (no matching items)';
  const find = () =>
    db
      .select({
        id: schema.stockReceipts.id,
        status: schema.stockReceipts.status,
      })
      .from(schema.stockReceipts)
      .where(
        and(
          eq(schema.stockReceipts.farmId, farmId),
          eq(schema.stockReceipts.receiptCode, input.receiptCode),
        ),
      );
  let [receipt] = await find();
  if (!receipt) {
    await services.receipts.createReceipt(farmId, owner, input);
    [receipt] = await find();
  }
  if (receipt.status === 'DRAFT') {
    await services.receipts.confirmReceipt(receipt.id, farmId, owner);
    return 'confirmed';
  }
  return receipt.status === 'CONFIRMED' ? 'already confirmed' : receipt.status;
}

async function ensureIssue(
  db: Db,
  services: Services,
  farmId: string,
  owner: string,
  input: Parameters<StockIssuesService['create']>[2],
) {
  if (input.items.length === 0) return 'skipped (no matching items)';
  const find = () =>
    db
      .select({ id: schema.stockIssues.id, status: schema.stockIssues.status })
      .from(schema.stockIssues)
      .where(
        and(
          eq(schema.stockIssues.farmId, farmId),
          eq(schema.stockIssues.issueCode, input.issueCode),
        ),
      );
  let [issue] = await find();
  if (!issue) {
    await services.issues.create(farmId, owner, input);
    [issue] = await find();
  }
  if (issue.status === 'DRAFT') {
    await services.issues.confirm(issue.id, farmId, owner);
    return 'confirmed';
  }
  return issue.status === 'CONFIRMED' ? 'already confirmed' : issue.status;
}

async function lotId(db: Db, farmId: string, lotNumber: string) {
  const [lot] = await db
    .select({ id: schema.inventoryLots.id })
    .from(schema.inventoryLots)
    .where(
      and(
        eq(schema.inventoryLots.farmId, farmId),
        eq(schema.inventoryLots.lotNumber, lotNumber),
      ),
    );
  return lot?.id;
}

async function seed(db: Db, farmCode?: string) {
  const databaseService = { db } as DatabaseService;
  const warehouses = new WarehousesService(databaseService);
  const services: Services = {
    warehouses,
    receipts: new StockReceiptsService(databaseService, warehouses),
    issues: new StockIssuesService(databaseService, warehouses),
    adjustments: new InventoryAdjustmentsService(databaseService, warehouses),
  };
  const farm = await findFarm(db, farmCode);
  const owner = await findOwnerIdentity(db, farm.id);
  const items = await pickItems(db, farm.id);
  const warehouseId = await ensureWarehouse(db, services, farm.id, owner);
  const zoneId = await ensureLocations(db, farm.id, warehouseId);
  const [supplierA, supplierB] = await ensureSuppliers(db, farm.id);
  const log = (step: string, result: string) =>
    console.info(`  ${step.padEnd(34)} ${result}`);
  console.info(`Farm ${farm.code}: warehouse ${WAREHOUSE_CODE} ready.`);

  const quantityByUnit: Record<string, string[]> = {
    kg: ['25.5', '12.75', '50', '8.2'],
    lít: ['40', '18.5', '6'],
  };
  const countQuantities = [
    '30',
    '12',
    '8',
    '45',
    '20',
    '15',
    '6',
    '24',
    '10',
    '5',
    '60',
    '3',
  ];
  log(
    'DEMO-PN-001 (vật tư theo số lượng)',
    await ensureReceipt(db, services, farm.id, owner, {
      warehouseId,
      supplierId: supplierA,
      receiptCode: 'DEMO-PN-001',
      receiptDate: isoDate(-21),
      note: DEMO_NOTE,
      items: items.quantity.map((item, index) => ({
        itemId: item.id,
        quantity:
          quantityByUnit[item.unit]?.[
            items.quantity
              .filter((other) => other.unit === item.unit)
              .indexOf(item)
          ] ?? countQuantities[index % countQuantities.length],
        unitPrice: String(15000 + index * 5000),
      })),
    }),
  );

  // Expiry spread: fresh, near expiry, already expired, no expiry.
  const lotPlan = [
    { offset: 365, quantity: '20' },
    { offset: 20, quantity: '8' },
    { offset: -30, quantity: '5' },
    { offset: 180, quantity: '15.5' },
    { offset: null, quantity: '12' },
  ];
  log(
    'DEMO-PN-002 (vật tư theo lô)',
    await ensureReceipt(db, services, farm.id, owner, {
      warehouseId,
      supplierId: supplierA,
      receiptCode: 'DEMO-PN-002',
      receiptDate: isoDate(-14),
      note: DEMO_NOTE,
      items: items.lot.map((item, index) => ({
        itemId: item.id,
        quantity: lotPlan[index].quantity,
        lotNumber: `DEMO-LO-${String(index + 1).padStart(3, '0')}`,
        manufacturedDate: isoDate(-60),
        ...(lotPlan[index].offset === null
          ? {}
          : { expiryDate: isoDate(lotPlan[index].offset) }),
      })),
    }),
  );

  log(
    'DEMO-PN-003 (tài sản)',
    await ensureReceipt(db, services, farm.id, owner, {
      warehouseId,
      supplierId: supplierB,
      receiptCode: 'DEMO-PN-003',
      receiptDate: isoDate(-10),
      note: DEMO_NOTE,
      items: items.asset.map((item, index) => ({
        itemId: item.id,
        quantity: '1',
        unitPrice: String(1500000 + index * 250000),
        assetCode: `DEMO-TS-${String(index + 1).padStart(3, '0')}`,
        serialNumber: `DEMO-SN-${String(index + 1).padStart(3, '0')}`,
        locationId: zoneId,
      })),
    }),
  );

  const freshLot = items.lot[0] && (await lotId(db, farm.id, 'DEMO-LO-001'));
  log(
    'DEMO-PX-001 (phiếu xuất)',
    await ensureIssue(db, services, farm.id, owner, {
      warehouseId,
      issueCode: 'DEMO-PX-001',
      issueDate: isoDate(-5),
      issueType: 'CONSUMPTION',
      reason: 'Dữ liệu mẫu: xuất dùng cho đàn ong',
      note: DEMO_NOTE,
      items: [
        ...items.quantity
          .slice(0, 2)
          .map((item) => ({ itemId: item.id, quantity: '2' })),
        ...(freshLot
          ? [{ itemId: items.lot[0].id, lotId: freshLot, quantity: '4' }]
          : []),
      ],
    }),
  );

  const adjustments = [
    items.quantity[0] && {
      key: 'DEMO-DC-001',
      itemId: items.quantity[0].id,
      quantityChange: '-1.25',
      reasonCode: 'SHRINKAGE' as const,
      note: 'Dữ liệu mẫu: hao hụt khi kiểm kê cuối tuần',
    },
    items.quantity[2] && {
      key: 'DEMO-DC-002',
      itemId: items.quantity[2].id,
      quantityChange: '2',
      reasonCode: 'STOCK_COUNT' as const,
      note: 'Dữ liệu mẫu: kiểm kê thấy dư',
    },
    items.lot[2] && {
      key: 'DEMO-DC-003',
      itemId: items.lot[2].id,
      lotNumber: 'DEMO-LO-003',
      quantityChange: '-2',
      reasonCode: 'EXPIRED' as const,
      note: 'Dữ liệu mẫu: hủy hàng hết hạn',
    },
  ].filter((adjustment) => Boolean(adjustment));
  for (const adjustment of adjustments) {
    if (!adjustment) continue;
    const lot =
      'lotNumber' in adjustment && adjustment.lotNumber
        ? await lotId(db, farm.id, adjustment.lotNumber)
        : undefined;
    const result = await services.adjustments.create(farm.id, owner, {
      idempotencyKey: stableUuid(`${farm.code}:${adjustment.key}`),
      warehouseId,
      itemId: adjustment.itemId,
      ...(lot ? { lotId: lot } : {}),
      quantityChange: adjustment.quantityChange,
      reasonCode: adjustment.reasonCode,
      note: adjustment.note,
    });
    log(`${adjustment.key} (điều chỉnh)`, result.adjustment.status);
  }

  console.info(
    `Done: ${items.quantity.length} quantity, ${items.lot.length} lot and ${items.asset.length} asset items in ${WAREHOUSE_CODE}.`,
  );
}

/** Removes everything the seed created; refuses when real work depends on it. */
async function cleanup(client: PoolClient, farmCode?: string) {
  const farms = await client.query<{ id: string; code: string }>(
    farmCode
      ? 'SELECT id, code FROM farms WHERE code = $1'
      : 'SELECT id, code FROM farms',
    farmCode ? [farmCode] : [],
  );
  if (farms.rows.length !== 1)
    throw new Error('Pass --farm FARM_CODE to choose the farm to clean.');
  const farmId = farms.rows[0].id;
  const warehouse = await client.query<{ id: string }>(
    'SELECT id FROM warehouses WHERE farm_id = $1 AND code = $2',
    [farmId, WAREHOUSE_CODE],
  );
  const warehouseId = warehouse.rows[0]?.id ?? null;

  const blockers = await client.query<{ name: string; count: number }>(
    `SELECT name, count FROM (
       SELECT 'stock_transfers' AS name, count(*)::int AS count FROM stock_transfers
         WHERE from_warehouse_id = $2 OR to_warehouse_id = $2
       UNION ALL SELECT 'stock_counts', count(*)::int FROM stock_counts WHERE warehouse_id = $2
       UNION ALL SELECT 'non-demo stock_receipts', count(*)::int FROM stock_receipts
         WHERE (warehouse_id = $2 AND receipt_code NOT LIKE 'DEMO-%')
            OR (supplier_id IN (SELECT id FROM suppliers WHERE farm_id = $1 AND code LIKE 'DEMO-NCC-%') AND receipt_code NOT LIKE 'DEMO-%')
       UNION ALL SELECT 'non-demo stock_issues', count(*)::int FROM stock_issues
         WHERE warehouse_id = $2 AND issue_code NOT LIKE 'DEMO-%'
       UNION ALL SELECT 'asset_assignments', count(*)::int FROM asset_assignments
         WHERE asset_id IN (SELECT id FROM assets WHERE farm_id = $1 AND asset_code LIKE 'DEMO-TS-%')
       UNION ALL SELECT 'asset_incidents', count(*)::int FROM asset_incidents
         WHERE asset_id IN (SELECT id FROM assets WHERE farm_id = $1 AND asset_code LIKE 'DEMO-TS-%')
       UNION ALL SELECT 'maintenance_records', count(*)::int FROM maintenance_records
         WHERE asset_id IN (SELECT id FROM assets WHERE farm_id = $1 AND asset_code LIKE 'DEMO-TS-%')
            OR supplier_id IN (SELECT id FROM suppliers WHERE farm_id = $1 AND code LIKE 'DEMO-NCC-%')
     ) blockers WHERE count > 0`,
    [farmId, warehouseId],
  );
  if (blockers.rows.length > 0) {
    throw new Error(
      `Demo data is referenced by other records, nothing deleted: ${blockers.rows
        .map((row) => `${row.name}=${row.count}`)
        .join(', ')}`,
    );
  }

  const demoReceiptItems = `SELECT ri.id FROM stock_receipt_items ri
    JOIN stock_receipts r ON r.id = ri.stock_receipt_id
    WHERE r.farm_id = $1 AND r.receipt_code LIKE 'DEMO-%'`;
  const steps: [string, string][] = [
    [
      'inventory_adjustments',
      'DELETE FROM inventory_adjustments WHERE farm_id = $1 AND warehouse_id = $2',
    ],
    [
      'inventory_transactions',
      'DELETE FROM inventory_transactions WHERE farm_id = $1 AND warehouse_id = $2',
    ],
    [
      'inventory_balances',
      'DELETE FROM inventory_balances WHERE farm_id = $1 AND warehouse_id = $2',
    ],
    [
      'stock_issue_items',
      `DELETE FROM stock_issue_items WHERE stock_issue_id IN (SELECT id FROM stock_issues WHERE farm_id = $1 AND issue_code LIKE 'DEMO-%')`,
    ],
    [
      'stock_issues',
      `DELETE FROM stock_issues WHERE farm_id = $1 AND issue_code LIKE 'DEMO-%'`,
    ],
    // Receipt lines and the lots/assets they created point at each other; unlink first.
    [
      'unlink receipt lines',
      `UPDATE stock_receipt_items SET lot_id = NULL, asset_id = NULL WHERE id IN (${demoReceiptItems})`,
    ],
    [
      'assets',
      `DELETE FROM assets WHERE farm_id = $1 AND source_receipt_item_id IN (${demoReceiptItems})`,
    ],
    [
      'inventory_lots',
      `DELETE FROM inventory_lots WHERE farm_id = $1 AND source_receipt_item_id IN (${demoReceiptItems})`,
    ],
    [
      'stock_receipt_items',
      `DELETE FROM stock_receipt_items WHERE id IN (${demoReceiptItems})`,
    ],
    [
      'stock_receipts',
      `DELETE FROM stock_receipts WHERE farm_id = $1 AND receipt_code LIKE 'DEMO-%'`,
    ],
    [
      'locations',
      `DELETE FROM locations WHERE farm_id = $1 AND code LIKE 'DEMO-KHO-%'`,
    ],
    [
      'suppliers',
      `DELETE FROM suppliers WHERE farm_id = $1 AND code LIKE 'DEMO-NCC-%'`,
    ],
    [
      'farm_member_warehouses',
      'DELETE FROM farm_member_warehouses WHERE warehouse_id IN (SELECT id FROM warehouses WHERE farm_id = $1 AND id = $2)',
    ],
    ['warehouses', 'DELETE FROM warehouses WHERE farm_id = $1 AND id = $2'],
  ];
  await client.query('BEGIN');
  try {
    for (const [label, sql] of steps) {
      const parameters = sql.includes('$2')
        ? [farmId, warehouseId]
        : sql.includes('$1')
          ? [farmId]
          : [];
      const result = await client.query(sql, parameters);
      if (result.rowCount)
        console.info(`  ${label.padEnd(24)} ${result.rowCount}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.info(`Demo inventory removed from ${farms.rows[0].code}.`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const remote = !LOCAL_HOSTS.includes(new URL(connectionString).hostname);
  if (remote && !process.argv.includes('--allow-remote')) {
    throw new Error(
      'DATABASE_URL points to a remote database; pass --allow-remote to confirm.',
    );
  }
  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
    ...(remote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const farmCode = argValue('--farm');
  try {
    if (process.argv.includes('--cleanup')) {
      const client = await pool.connect();
      try {
        await cleanup(client, farmCode);
      } finally {
        client.release();
      }
    } else {
      await seed(drizzle(pool, { schema }), farmCode);
    }
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

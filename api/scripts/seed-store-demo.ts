import 'reflect-metadata';
import 'dotenv/config';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

/**
 * Storefront demo for delivery regions, sales/working warehouses and split
 * orders (see docs in the PR / CLAUDE.md "Storefront model"). Only the sales
 * warehouse ever sells (D03).
 *
 * FARM-DEMO   sells NORTH + SOUTH from WH-MAIN; WH-BEE, WH-FIELD are working.
 * FARM-COFFEE sells SOUTH + CENTRAL from CF-BAN; CF-KHO is working.
 *
 * Idempotent: products, items and receipts use fixed SD- codes, so a re-run
 * only re-applies the settings. Stock is received through the real receipt
 * service so balances and the ledger agree. Stock sold by demo orders is not
 * topped up again.
 *
 * Usage: ts-node --transpile-only scripts/seed-store-demo.ts [--allow-remote]
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'postgres'];
const CATEGORY_SLUG = 'demo-theo-mien';

type Db = DatabaseService['db'];
type Region = (typeof schema.storeRegion.enumValues)[number];

const FARMS: Record<
  string,
  {
    regions: Region[];
    sales: { code: string; name: string };
    working: { code: string; name: string }[];
  }
> = {
  'FARM-DEMO': {
    regions: ['NORTH', 'SOUTH'],
    sales: { code: 'WH-MAIN', name: 'Kho chính' },
    working: [
      { code: 'WH-BEE', name: 'Kho ong' },
      { code: 'WH-FIELD', name: 'Kho ngoài trại' },
    ],
  },
  'FARM-COFFEE': {
    regions: ['SOUTH', 'CENTRAL'],
    sales: { code: 'CF-BAN', name: 'Kho bán Hoa Cà Phê' },
    working: [{ code: 'CF-KHO', name: 'Kho làm việc Hoa Cà Phê' }],
  },
};

/** Stock per farm and warehouse code; a farm listed with {} maps the item without stock. */
const PRODUCTS: {
  slug: string;
  name: string;
  price: string;
  description: string;
  stock: Record<string, Record<string, string>>;
}[] = [
  {
    slug: 'sd-co-san-moi-mien',
    name: 'DEMO Mật ong có sẵn mọi miền',
    price: '150000',
    description: 'Cả hai trại đều có hàng ở kho bán: giao được ở mọi miền.',
    stock: {
      'FARM-DEMO': { 'WH-MAIN': '50' },
      'FARM-COFFEE': { 'CF-BAN': '50' },
    },
  },
  {
    slug: 'sd-chi-mien-nam-trung',
    name: 'DEMO Mật ong hoa cà phê (chỉ trại Cà Phê)',
    price: '180000',
    description:
      'Chỉ FARM-COFFEE bán: miền Bắc báo chưa hỗ trợ, miền Nam/Trung giao được.',
    stock: { 'FARM-COFFEE': { 'CF-BAN': '30' } },
  },
  {
    slug: 'sd-het-o-mien-bac',
    name: 'DEMO Phấn hoa (hết ở miền Bắc)',
    price: '120000',
    description:
      'FARM-DEMO có bán nhưng hết hàng, FARM-COFFEE còn: miền Bắc báo tạm hết tại khu vực.',
    stock: { 'FARM-DEMO': {}, 'FARM-COFFEE': { 'CF-BAN': '20' } },
  },
  {
    slug: 'sd-so-luong-it',
    name: 'DEMO Keo ong (kho bán còn 3)',
    price: '250000',
    description: 'Chỉ còn 3 ở kho bán FARM-DEMO: đặt 4 trở lên báo không đủ.',
    stock: { 'FARM-DEMO': { 'WH-MAIN': '3' } },
  },
  {
    slug: 'sd-bu-tu-kho-nguon',
    name: 'DEMO Sữa ong chúa (kho bán còn ít)',
    price: '300000',
    description:
      'Kho bán còn 2, WH-BEE còn 20: đặt 10 báo không đủ hàng; chuyển kho sang WH-MAIN trước mới bán được.',
    stock: { 'FARM-DEMO': { 'WH-MAIN': '2', 'WH-BEE': '20' } },
  },
  {
    slug: 'sd-chi-o-kho-lam-viec',
    name: 'DEMO Hộp quà (chỉ có ở kho làm việc)',
    price: '90000',
    description:
      'Hàng chỉ nằm ở WH-FIELD (kho làm việc): cửa hàng báo hết hàng.',
    stock: { 'FARM-DEMO': { 'WH-FIELD': '50' } },
  },
  {
    slug: 'sd-chi-trai-huong-duong',
    name: 'DEMO Nến sáp ong (chỉ trại Hướng Dương)',
    price: '60000',
    description:
      'Chỉ FARM-DEMO bán. Cho vào giỏ cùng sản phẩm "chỉ trại Cà Phê" ở miền Nam để thấy gợi ý tách đơn.',
    stock: { 'FARM-DEMO': { 'WH-MAIN': '40' } },
  },
  {
    slug: 'sd-het-hang',
    name: 'DEMO Bánh sáp (hết hàng)',
    price: '45000',
    description: 'Có bán nhưng không kho nào còn: báo hết hàng.',
    stock: { 'FARM-DEMO': {} },
  },
];

async function farmContext(db: Db, code: string) {
  const [farm] = await db
    .select({ id: schema.farms.id })
    .from(schema.farms)
    .where(eq(schema.farms.code, code));
  if (!farm) throw new Error(`Farm ${code} not found; run db:seed first.`);
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
        eq(schema.farmMembers.farmId, farm.id),
        eq(schema.farmMembers.status, 'ACTIVE'),
        eq(schema.users.status, 'ACTIVE'),
        inArray(schema.roles.code, ['FARM_OWNER', 'ADMIN']),
      ),
    )
    .orderBy(asc(schema.farmMembers.createdAt))
    .limit(1);
  if (!owner) throw new Error(`${code} has no active FARM_OWNER or ADMIN.`);
  return { farmId: farm.id, owner: owner.clerkUserId };
}

async function ensureWarehouse(
  db: Db,
  warehouses: WarehousesService,
  farmId: string,
  owner: string,
  { code, name }: { code: string; name: string },
) {
  const find = () =>
    db
      .select({ id: schema.warehouses.id })
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.farmId, farmId),
          eq(schema.warehouses.code, code),
        ),
      );
  let [row] = await find();
  if (!row) {
    await warehouses.createWarehouse(farmId, owner, { code, name });
    [row] = await find();
  }
  await db
    .update(schema.warehouses)
    .set({ status: 'ACTIVE' })
    .where(eq(schema.warehouses.id, row.id));
  return row.id;
}

async function seed(db: Db) {
  const databaseService = { db } as DatabaseService;
  const warehouses = new WarehousesService(databaseService);
  const receipts = new StockReceiptsService(databaseService, warehouses);
  const [unit] = await db
    .select({ id: schema.units.id })
    .from(schema.units)
    .where(eq(schema.units.code, 'PIECE'));
  const [category] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.code, 'MATERIAL'));
  if (!unit || !category)
    throw new Error(
      'Unit PIECE or category MATERIAL missing; run db:seed first.',
    );

  const contexts = new Map<
    string,
    { farmId: string; owner: string; warehouseIds: Record<string, string> }
  >();
  for (const [code, config] of Object.entries(FARMS)) {
    const { farmId, owner } = await farmContext(db, code);
    const warehouseIds: Record<string, string> = {};
    for (const warehouse of [config.sales, ...config.working])
      warehouseIds[warehouse.code] = await ensureWarehouse(
        db,
        warehouses,
        farmId,
        owner,
        warehouse,
      );
    const settings = {
      salesWarehouseId: warehouseIds[config.sales.code],
      salesEnabled: true,
      regions: config.regions,
      updatedAt: new Date().toISOString(),
    };
    await db
      .insert(schema.storeSettings)
      .values({ farmId, ...settings })
      .onConflictDoUpdate({
        target: schema.storeSettings.farmId,
        set: settings,
      });
    contexts.set(code, { farmId, owner, warehouseIds });
    console.info(
      `${code}: sales ${config.sales.code} → ${config.regions.join(', ')}`,
    );
  }

  await db
    .insert(schema.storeCategories)
    .values({ name: 'Demo theo miền', slug: CATEGORY_SLUG })
    .onConflictDoNothing();
  const [storeCategory] = await db
    .select({ id: schema.storeCategories.id })
    .from(schema.storeCategories)
    .where(eq(schema.storeCategories.slug, CATEGORY_SLUG));

  for (const product of PRODUCTS) {
    await db
      .insert(schema.storeProducts)
      .values({
        categoryId: storeCategory.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        status: 'PUBLISHED',
      })
      .onConflictDoNothing();
    const [row] = await db
      .select({ id: schema.storeProducts.id })
      .from(schema.storeProducts)
      .where(eq(schema.storeProducts.slug, product.slug));
    let [variant] = await db
      .select({ id: schema.storeProductVariants.id })
      .from(schema.storeProductVariants)
      .where(eq(schema.storeProductVariants.productId, row.id));
    if (!variant)
      [variant] = await db
        .insert(schema.storeProductVariants)
        .values({
          productId: row.id,
          unitId: unit.id,
          name: 'Hộp',
          price: product.price,
        })
        .returning({ id: schema.storeProductVariants.id });

    for (const [farmCode, stock] of Object.entries(product.stock)) {
      const context = contexts.get(farmCode)!;
      const itemCode = product.slug.toUpperCase();
      await db
        .insert(schema.items)
        .values({
          farmId: context.farmId,
          categoryId: category.id,
          unitId: unit.id,
          code: itemCode,
          name: product.name,
          itemType: 'MATERIAL',
          trackingMode: 'QUANTITY',
        })
        .onConflictDoNothing();
      const [item] = await db
        .select({ id: schema.items.id })
        .from(schema.items)
        .where(
          and(
            eq(schema.items.farmId, context.farmId),
            eq(schema.items.code, itemCode),
          ),
        );
      await db
        .insert(schema.storeVariantItems)
        .values({
          variantId: variant.id,
          farmId: context.farmId,
          itemId: item.id,
        })
        .onConflictDoNothing();

      for (const [warehouseCode, quantity] of Object.entries(stock)) {
        const receiptCode = `SD-${itemCode}-${warehouseCode}`.slice(0, 50);
        const [existing] = await db
          .select({ id: schema.stockReceipts.id })
          .from(schema.stockReceipts)
          .where(
            and(
              eq(schema.stockReceipts.farmId, context.farmId),
              eq(schema.stockReceipts.receiptCode, receiptCode),
            ),
          );
        if (existing) continue;
        const created = await receipts.createReceipt(
          context.farmId,
          context.owner,
          {
            warehouseId: context.warehouseIds[warehouseCode],
            note: 'Dữ liệu mẫu cửa hàng theo miền (seed-store-demo)',
            items: [{ itemId: item.id, quantity, unitPrice: '0' }],
          },
        );
        // A fixed code lets a re-run find the receipt instead of adding stock again.
        await db
          .update(schema.stockReceipts)
          .set({ receiptCode })
          .where(eq(schema.stockReceipts.id, created.receipt.id));
        await receipts.confirmReceipt(
          created.receipt.id,
          context.farmId,
          context.owner,
        );
      }
    }
    console.info(`  ${product.slug}`);
  }
  console.info('Store demo ready.');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const remote = !LOCAL_HOSTS.includes(new URL(connectionString).hostname);
  if (remote && !process.argv.includes('--allow-remote'))
    throw new Error(
      'DATABASE_URL points to a remote database; pass --allow-remote to confirm.',
    );
  const pool = new Pool({ connectionString, max: 2 });
  try {
    await seed(drizzle(pool, { schema }));
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

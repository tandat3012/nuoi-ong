import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { seedStorefront } from '../scripts/seed-storefront';

describe('Storefront seed', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const farmId = randomUUID();
  const warehouseId = randomUUID();
  const alternateWarehouseId = randomUUID();
  const categoryId = randomUUID();
  const createdUnitIds: string[] = [];
  let ready = false;

  async function clearStorefront() {
    if (!ready) return;
    for (const table of [
      'store_product_images',
      'store_product_variants',
      'store_products',
      'store_categories',
      'store_settings',
    ]) {
      await pool.query(`DELETE FROM ${table}`);
    }
  }

  beforeAll(async () => {
    const database = await pool.query<{ name: string }>(
      'SELECT current_database() AS name',
    );
    if (!database.rows[0].name.includes('test')) {
      throw new Error(
        'Seed integration tests require a dedicated test database.',
      );
    }
    const existing = await pool.query<{ count: string }>(
      `SELECT ((SELECT count(*) FROM store_products) + (SELECT count(*) FROM store_settings)
              + (SELECT count(*) FROM store_categories)
              + (SELECT count(*) FROM farms WHERE code = 'FARM-DEMO'))::text AS count`,
    );
    if (existing.rows[0].count !== '0') {
      throw new Error(
        'Seed integration tests require empty storefront tables and no FARM-DEMO.',
      );
    }
    await pool.query(
      `INSERT INTO farms (id, code, name) VALUES ($1, 'FARM-DEMO', 'Seed test')`,
      [farmId],
    );
    await pool.query(
      `INSERT INTO warehouses (id, farm_id, code, name)
       VALUES ($1, $3, 'WH-MAIN', 'Main'), ($2, $3, 'WH-ALTERNATE', 'Alternate')`,
      [warehouseId, alternateWarehouseId, farmId],
    );
    await pool.query(
      `INSERT INTO categories (id, code, name) VALUES ($1::uuid, $1::text, 'Seed test')`,
      [categoryId],
    );
    for (const code of ['PIECE', 'KILOGRAM', 'LITER', 'PAIR']) {
      const units = await pool.query<{ id: string }>(
        `INSERT INTO units (code, name, symbol) VALUES ($1, $1, $1)
         ON CONFLICT (code) DO NOTHING RETURNING id`,
        [code],
      );
      createdUnitIds.push(...units.rows.map((row) => row.id));
    }
    await pool.query(
      `INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       SELECT $1, $2, u.id, v.code, v.code, v.type::item_type, v.mode::tracking_mode
       FROM (VALUES ('EQ-EXTRACTOR-01', 'PIECE', 'EQUIPMENT', 'ASSET'),
                    ('TOOL-SMOKER-01', 'PIECE', 'TOOL', 'ASSET'),
                    ('MAT-FEED-SUGAR', 'KILOGRAM', 'MATERIAL', 'LOT'),
                    ('MAT-TREAT-01', 'LITER', 'MATERIAL', 'LOT'),
                    ('MAT-GLOVES-01', 'PAIR', 'MATERIAL', 'QUANTITY'),
                    ('MAT-JAR-500', 'PIECE', 'MATERIAL', 'QUANTITY')) AS v(code, unit, type, mode)
       JOIN units u ON u.code = v.unit`,
      [farmId, categoryId],
    );
    ready = true;
  });

  afterEach(async () => {
    await clearStorefront();
    if (ready)
      await pool.query(
        `UPDATE items SET status = 'ACTIVE' WHERE farm_id = $1`,
        [farmId],
      );
  });

  afterAll(async () => {
    try {
      if (ready) {
        await pool.query('DELETE FROM items WHERE farm_id = $1', [farmId]);
        await pool.query('DELETE FROM warehouses WHERE farm_id = $1', [farmId]);
        await pool.query('DELETE FROM farms WHERE id = $1', [farmId]);
        await pool.query('DELETE FROM categories WHERE id = $1', [categoryId]);
        await pool.query('DELETE FROM units WHERE id = ANY($1::uuid[])', [
          createdUnitIds,
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  it('upserts all five tables twice with stable IDs and unchanged warehouse data', async () => {
    const inventorySql = `SELECT (SELECT count(*) FROM items)::text AS items,
      (SELECT count(*) FROM assets)::text AS assets,
      (SELECT count(*) FROM inventory_balances)::text AS balances`;
    const before = await pool.query(inventorySql);
    await seedStorefront(pool);
    const idsSql = `SELECT 'category' AS kind, id FROM store_categories
      UNION ALL SELECT 'product', id FROM store_products
      UNION ALL SELECT 'variant', id FROM store_product_variants
      UNION ALL SELECT 'image', id FROM store_product_images ORDER BY kind, id`;
    const first = await pool.query(idsSql);
    await seedStorefront(pool);
    expect((await pool.query(idsSql)).rows).toEqual(first.rows);
    expect(first.rows).toHaveLength(23);
    expect(
      (await pool.query('SELECT warehouse_id FROM store_settings')).rows,
    ).toEqual([{ warehouse_id: warehouseId }]);
    expect((await pool.query(inventorySql)).rows).toEqual(before.rows);
    const statuses = await pool.query(
      'SELECT DISTINCT status FROM store_products ORDER BY status',
    );
    expect(statuses.rows).toEqual([
      { status: 'DRAFT' },
      { status: 'PUBLISHED' },
      { status: 'ARCHIVED' },
    ]);
    const step = await pool.query(
      `SELECT v.price, v.quantity_step FROM store_product_variants v JOIN items i ON i.id = v.item_id WHERE i.code = 'MAT-FEED-SUGAR'`,
    );
    expect(step.rows[0]).toEqual({ price: '25000', quantity_step: '0.100' });
  });

  it('reuses existing category and product IDs by slug', async () => {
    const existingCategory = randomUUID();
    const existingProduct = randomUUID();
    await pool.query(
      `INSERT INTO store_categories (id, name, slug) VALUES ($1, 'Old', 'thiet-bi')`,
      [existingCategory],
    );
    await pool.query(
      `INSERT INTO store_products (id, category_id, name, slug) VALUES ($1, $2, 'Old', 'may-quay-mat-ong-4-cau')`,
      [existingProduct, existingCategory],
    );
    await seedStorefront(pool);
    expect(
      (
        await pool.query(
          'SELECT id, category_id, name FROM store_products WHERE id = $1',
          [existingProduct],
        )
      ).rows[0],
    ).toEqual({
      id: existingProduct,
      category_id: existingCategory,
      name: 'Máy quay mật ong 4 cầu',
    });
  });

  it('preserves the configured sales warehouse', async () => {
    await pool.query('INSERT INTO store_settings (warehouse_id) VALUES ($1)', [
      alternateWarehouseId,
    ]);
    await seedStorefront(pool);
    expect(
      (await pool.query('SELECT warehouse_id FROM store_settings')).rows[0],
    ).toEqual({ warehouse_id: alternateWarehouseId });
  });

  it('rejects missing prerequisites without a partial seed', async () => {
    await pool.query(
      `UPDATE items SET status = 'INACTIVE' WHERE farm_id = $1 AND code = 'MAT-TREAT-01'`,
      [farmId],
    );
    await expect(seedStorefront(pool)).rejects.toThrow('MAT-TREAT-01');
    expect((await pool.query('SELECT id FROM store_categories')).rows).toEqual(
      [],
    );
    expect((await pool.query('SELECT id FROM store_settings')).rows).toEqual(
      [],
    );
  });

  it('rolls back instead of reassigning an item already sold by another product', async () => {
    const existingCategory = randomUUID();
    const existingProduct = randomUUID();
    await pool.query(
      `INSERT INTO store_categories (id, name, slug) VALUES ($1, 'Original', 'original')`,
      [existingCategory],
    );
    await pool.query(
      `INSERT INTO store_products (id, category_id, name, slug) VALUES ($1, $2, 'Original', 'original')`,
      [existingProduct, existingCategory],
    );
    await pool.query(
      `INSERT INTO store_product_variants (product_id, item_id, name, price)
       SELECT $1, id, 'Original', 999 FROM items WHERE farm_id = $2 AND code = 'EQ-EXTRACTOR-01'`,
      [existingProduct, farmId],
    );
    await expect(seedStorefront(pool)).rejects.toThrow(
      'already belongs to another storefront product',
    );
    expect(
      (
        await pool.query(
          'SELECT product_id, name, price FROM store_product_variants',
        )
      ).rows,
    ).toEqual([
      { product_id: existingProduct, name: 'Original', price: '999' },
    ]);
    expect((await pool.query('SELECT id FROM store_categories')).rows).toEqual([
      { id: existingCategory },
    ]);
    expect((await pool.query('SELECT id FROM store_settings')).rows).toEqual(
      [],
    );
  });

  it.each([
    {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:unused@localhost:1/test',
    },
    {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:unused@example.invalid/test',
    },
  ])('refuses unsafe CLI destination $NODE_ENV / $DATABASE_URL', (env) => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(__dirname, '../node_modules/ts-node/dist/bin.js'),
        '--transpile-only',
        'scripts/seed-storefront.ts',
      ],
      {
        cwd: resolve(__dirname, '..'),
        env: { ...process.env, ...env },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'requires a local, non-production database',
    );
  });
});

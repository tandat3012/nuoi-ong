import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { Pool, type PoolClient } from 'pg';
import {
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductStatus,
  storeProductVariants,
  storeSettings,
  storeVariantItems,
} from '../src/db/schema';

describe('Storefront schema (migrated PostgreSQL)', () => {
  // PostgreSQL 18 distinguishes RESTRICT violations from other foreign-key errors.
  const restrictViolation = /^(23503|23001)$/;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client: PoolClient;
  const ids = {
    farm: randomUUID(),
    otherFarm: randomUUID(),
    warehouse: randomUUID(),
    category: randomUUID(),
    unit: randomUUID(),
    quantityItem: randomUUID(),
    lotItem: randomUUID(),
    assetItem: randomUUID(),
    storeCategory: randomUUID(),
    product: randomUUID(),
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    client = await pool.connect();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO farms (id, code, name)
       VALUES ($1::uuid, $1::text, 'Store test'), ($2::uuid, $2::text, 'Other farm')`,
      [ids.farm, ids.otherFarm],
    );
    await client.query(
      `INSERT INTO warehouses (id, farm_id, code, name)
       VALUES ($1, $2, 'STORE', 'Sales warehouse')`,
      [ids.warehouse, ids.farm],
    );
    await client.query(
      `INSERT INTO categories (id, code, name) VALUES ($1::uuid, $1::text, 'Internal')`,
      [ids.category],
    );
    await client.query(
      `INSERT INTO units (id, code, name, symbol) VALUES ($1::uuid, 'ST-' || left($1::text, 8), 'Unit', 'u')`,
      [ids.unit],
    );
    await client.query(
      `INSERT INTO items (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $4, $5, $6, 'QUANTITY', 'Tool', 'TOOL', 'QUANTITY'),
              ($2, $4, $5, $6, 'LOT', 'Material', 'MATERIAL', 'LOT'),
              ($3, $4, $5, $6, 'ASSET', 'Equipment', 'EQUIPMENT', 'ASSET')`,
      [
        ids.quantityItem,
        ids.lotItem,
        ids.assetItem,
        ids.farm,
        ids.category,
        ids.unit,
      ],
    );
    await client.query(
      `INSERT INTO store_categories (id, name, slug) VALUES ($1::uuid, 'Tools', $1::text)`,
      [ids.storeCategory],
    );
    await client.query(
      `INSERT INTO store_products (id, category_id, name, slug)
       VALUES ($1::uuid, $2, 'Hive tool', $1::text)`,
      [ids.product, ids.storeCategory],
    );
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  afterAll(async () => {
    client?.release();
    await pool.end();
  });

  async function expectDatabaseError(
    statement: string,
    values: unknown[],
    code: string | RegExp,
  ) {
    const expectedCode: unknown =
      typeof code === 'string' ? code : expect.stringMatching(code);
    await client.query('SAVEPOINT invalid_input');
    try {
      await expect(client.query(statement, values)).rejects.toMatchObject({
        code: expectedCode,
      });
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT invalid_input');
    }
  }

  it.each(
    [
      storeSettings,
      storeCategories,
      storeProducts,
      storeProductImages,
      storeProductVariants,
      storeVariantItems,
    ].map(getTableConfig),
  )('matches Drizzle columns for $name', async (table) => {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
      [table.name],
    );
    expect(result.rows.map((row) => row.column_name)).toEqual(
      table.columns.map((column) => column.name).sort(),
    );
  });

  it('defaults products to drafts and matches the status enum', async () => {
    const product = await client.query(
      'SELECT status, description FROM store_products WHERE id = $1',
      [ids.product],
    );
    expect(product.rows[0]).toEqual({ status: 'DRAFT', description: '' });
    const statuses = await client.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'store_product_status'::regtype ORDER BY enumsortorder`,
    );
    expect(statuses.rows.map((row) => row.enumlabel)).toEqual(
      storeProductStatus.enumValues,
    );
  });

  const insertVariant = (step = '1', price = '100') =>
    client
      .query<{ id: string }>(
        `INSERT INTO store_product_variants (product_id, unit_id, name, price, quantity_step)
         VALUES ($1, $2, 'Default', $3, $4) RETURNING id`,
        [ids.product, ids.unit, price, step],
      )
      .then((result) => result.rows[0].id);
  const mapItem = `INSERT INTO store_variant_items (variant_id, farm_id, item_id) VALUES ($1, $2, $3)`;

  it('permits fractional quantity/lot steps and whole serialized equipment', async () => {
    for (const [step, itemId] of [
      ['0.5', ids.quantityItem],
      ['0.001', ids.lotItem],
      ['1', ids.assetItem],
    ]) {
      await client.query(mapItem, [
        await insertVariant(step),
        ids.farm,
        itemId,
      ]);
    }
    const result = await client.query(
      `SELECT v.quantity_step, v.active FROM store_variant_items m
       JOIN store_product_variants v ON v.id = m.variant_id
       WHERE m.farm_id = $1 ORDER BY v.quantity_step`,
      [ids.farm],
    );
    expect(result.rows).toEqual([
      { quantity_step: '0.001', active: true },
      { quantity_step: '0.500', active: true },
      { quantity_step: '1.000', active: true },
    ]);
  });

  it('defaults the step to one and allows zero-price variants', async () => {
    const result = await client.query(
      `INSERT INTO store_product_variants (product_id, unit_id, name, price)
       VALUES ($1, $2, 'Default', 0) RETURNING quantity_step`,
      [ids.product, ids.unit],
    );
    expect(result.rows[0]).toEqual({ quantity_step: '1.000' });
  });

  it.each(['-1', 'NaN'])('rejects invalid price %s', async (price) => {
    await expectDatabaseError(
      `INSERT INTO store_product_variants (product_id, unit_id, name, price) VALUES ($1, $2, 'Default', $3)`,
      [ids.product, ids.unit, price],
      '23514',
    );
  });

  it.each(['0', '-0.1', 'NaN'])(
    'rejects invalid quantity step %s',
    async (step) => {
      await expectDatabaseError(
        `INSERT INTO store_product_variants (product_id, unit_id, name, price, quantity_step)
       VALUES ($1, $2, 'Default', 100, $3)`,
        [ids.product, ids.unit, step],
        '23514',
      );
    },
  );

  it.each(['0.5', '2'])(
    'requires serialized equipment step one, rejecting %s',
    async (step) => {
      await expectDatabaseError(
        mapItem,
        [await insertVariant(step), ids.farm, ids.assetItem],
        '23514',
      );
    },
  );

  it('protects the serial rule when changing the mapping, the step or the tracking mode', async () => {
    const variantId = await insertVariant('0.5');
    await client.query(mapItem, [variantId, ids.farm, ids.quantityItem]);
    await expectDatabaseError(
      'UPDATE store_variant_items SET item_id = $1 WHERE variant_id = $2',
      [ids.assetItem, variantId],
      '23514',
    );
    await expectDatabaseError(
      `UPDATE items SET tracking_mode = 'ASSET' WHERE id = $1`,
      [ids.quantityItem],
      '23514',
    );
    await client.query(
      'UPDATE store_product_variants SET quantity_step = 1 WHERE id = $1',
      [variantId],
    );
    await client.query(
      `UPDATE items SET tracking_mode = 'ASSET' WHERE id = $1`,
      [ids.quantityItem],
    );
    await expectDatabaseError(
      'UPDATE store_product_variants SET quantity_step = 0.5 WHERE id = $1',
      [variantId],
      '23514',
    );
  });

  it('keeps a mapped item in the unit of its variant', async () => {
    const otherUnit = randomUUID();
    await client.query(
      `INSERT INTO units (id, code, name) VALUES ($1::uuid, 'SU-' || left($1::text, 8), 'Gram')`,
      [otherUnit],
    );
    await client.query(mapItem, [
      await insertVariant(),
      ids.farm,
      ids.quantityItem,
    ]);
    await expectDatabaseError(
      'UPDATE items SET unit_id = $1 WHERE id = $2',
      [otherUnit, ids.quantityItem],
      '23514',
    );
    await client.query('UPDATE items SET unit_id = $1 WHERE id = $2', [
      otherUnit,
      ids.lotItem,
    ]);
  });

  it('maps an item to one variant, only for its own farm, once per farm', async () => {
    const variantId = await insertVariant();
    await client.query(mapItem, [variantId, ids.farm, ids.quantityItem]);
    await expectDatabaseError(
      mapItem,
      [await insertVariant(), ids.farm, ids.quantityItem],
      '23505',
    );
    await expectDatabaseError(
      mapItem,
      [variantId, ids.farm, ids.lotItem],
      '23505',
    );
    await expectDatabaseError(
      mapItem,
      [variantId, ids.otherFarm, ids.lotItem],
      '23503',
    );
    await expectDatabaseError(
      'DELETE FROM items WHERE id = $1',
      [ids.quantityItem],
      restrictViolation,
    );
    await expectDatabaseError(
      'DELETE FROM store_products WHERE id = $1',
      [ids.product],
      restrictViolation,
    );
  });

  it('supports an ordered gallery and rejects duplicate or negative positions', async () => {
    await client.query(
      `INSERT INTO store_product_images (product_id, url, position)
       VALUES ($1, '/second.jpg', 1), ($1, '/cover.jpg', 0)`,
      [ids.product],
    );
    const result = await client.query(
      'SELECT url FROM store_product_images WHERE product_id = $1 ORDER BY position',
      [ids.product],
    );
    expect(result.rows).toEqual([
      { url: '/cover.jpg' },
      { url: '/second.jpg' },
    ]);
    await expectDatabaseError(
      `INSERT INTO store_product_images (product_id, url, position) VALUES ($1, '/duplicate.jpg', 0)`,
      [ids.product],
      '23505',
    );
    await expectDatabaseError(
      `INSERT INTO store_product_images (product_id, url, position) VALUES ($1, '/negative.jpg', -1)`,
      [ids.product],
      '23514',
    );
    await expectDatabaseError(
      'DELETE FROM store_products WHERE id = $1',
      [ids.product],
      restrictViolation,
    );
  });

  it('keeps one sales warehouse per farm, owned by that farm, and enables only complete settings', async () => {
    const insert = `INSERT INTO store_settings (farm_id, sales_warehouse_id, sales_enabled, regions)
                    VALUES ($1, $2, $3, $4)`;
    await expectDatabaseError(
      insert,
      [ids.otherFarm, ids.warehouse, false, '{}'],
      '23503',
    );
    await expectDatabaseError(
      insert,
      [ids.farm, null, true, '{NORTH}'],
      '23514',
    );
    await expectDatabaseError(
      insert,
      [ids.farm, ids.warehouse, true, '{}'],
      '23514',
    );
    await client.query(insert, [
      ids.farm,
      ids.warehouse,
      true,
      '{NORTH,SOUTH}',
    ]);
    await expectDatabaseError(
      insert,
      [ids.farm, ids.warehouse, false, '{}'],
      '23505',
    );
    await expectDatabaseError(
      'DELETE FROM warehouses WHERE id = $1',
      [ids.warehouse],
      restrictViolation,
    );
  });

  it('rejects unknown references', async () => {
    await expectDatabaseError(
      'INSERT INTO store_settings (farm_id, sales_warehouse_id) VALUES ($1, $2)',
      [ids.farm, randomUUID()],
      '23503',
    );
    await expectDatabaseError(
      mapItem,
      [await insertVariant(), ids.farm, randomUUID()],
      '23503',
    );
    await expectDatabaseError(
      `INSERT INTO store_product_variants (product_id, unit_id, name, price) VALUES ($1, $2, 'Missing', 100)`,
      [ids.product, randomUUID()],
      '23503',
    );
    await expectDatabaseError(
      'UPDATE store_products SET category_id = $1 WHERE id = $2',
      [randomUUID(), ids.product],
      '23503',
    );
    await expectDatabaseError(
      'DELETE FROM store_categories WHERE id = $1',
      [ids.storeCategory],
      restrictViolation,
    );
  });

  it('rejects duplicate slugs and invalid public slugs', async () => {
    await expectDatabaseError(
      `INSERT INTO store_categories (name, slug) VALUES ('Duplicate', $1)`,
      [ids.storeCategory],
      '23505',
    );
    await expectDatabaseError(
      `INSERT INTO store_products (category_id, name, slug) VALUES ($1, 'Duplicate', $2)`,
      [ids.storeCategory, ids.product],
      '23505',
    );
    await expectDatabaseError(
      'UPDATE store_products SET slug = $1 WHERE id = $2',
      ['Bad Slug', ids.product],
      '23514',
    );
    await expectDatabaseError(
      'UPDATE store_categories SET name = $1 WHERE id = $2',
      [' ', ids.storeCategory],
      '23514',
    );
  });
});

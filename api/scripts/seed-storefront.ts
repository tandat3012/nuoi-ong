import 'dotenv/config';
import { Pool, type QueryResultRow } from 'pg';

const CATEGORIES = [
  { slug: 'thiet-bi', name: 'Thiết bị' },
  { slug: 'dung-cu', name: 'Dụng cụ' },
  { slug: 'vat-tu', name: 'Vật tư' },
  { slug: 'bao-bi', name: 'Bao bì' },
];

const PRODUCTS = [
  {
    slug: 'may-quay-mat-ong-4-cau',
    name: 'Máy quay mật ong 4 cầu',
    category: 'thiet-bi',
    itemCode: 'EQ-EXTRACTOR-01',
    unitCode: 'PIECE',
    variant: '4 cầu',
    price: '4500000',
    step: '1',
    status: 'PUBLISHED',
    images: 2,
  },
  {
    slug: 'binh-tao-khoi-inox',
    name: 'Bình tạo khói inox',
    category: 'dung-cu',
    itemCode: 'TOOL-SMOKER-01',
    unitCode: 'PIECE',
    variant: 'Inox',
    price: '350000',
    step: '1',
    status: 'ARCHIVED',
    images: 1,
  },
  {
    slug: 'duong-tinh-luyen-cho-ong',
    name: 'Đường tinh luyện cho ong',
    category: 'vat-tu',
    itemCode: 'MAT-FEED-SUGAR',
    unitCode: 'KILOGRAM',
    variant: 'Theo kg',
    price: '25000',
    step: '0.1',
    status: 'PUBLISHED',
    images: 1,
  },
  {
    slug: 'dung-dich-ve-sinh-thung-ong',
    name: 'Dung dịch vệ sinh thùng ong',
    category: 'vat-tu',
    itemCode: 'MAT-TREAT-01',
    unitCode: 'LITER',
    variant: 'Theo lít',
    price: '120000',
    step: '0.5',
    status: 'DRAFT',
    images: 1,
  },
  {
    slug: 'gang-tay-bao-ho',
    name: 'Găng tay bảo hộ',
    category: 'dung-cu',
    itemCode: 'MAT-GLOVES-01',
    unitCode: 'PAIR',
    variant: 'Một đôi',
    price: '65000',
    step: '1',
    status: 'PUBLISHED',
    images: 1,
  },
  {
    slug: 'hu-thuy-tinh-500-ml',
    name: 'Hũ thủy tinh 500 ml',
    category: 'bao-bi',
    itemCode: 'MAT-JAR-500',
    unitCode: 'PIECE',
    variant: '500 ml',
    price: '12000',
    step: '1',
    status: 'PUBLISHED',
    images: 1,
  },
];

type IdRow = QueryResultRow & { id: string };
type ItemRow = IdRow & { code: string; unit_code: string };
type WarehouseRow = IdRow & { farm_id: string };

export async function seedStorefront(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'nuoi-ong-storefront-seed-v1',
    ]);

    const warehouseResult = await client.query<WarehouseRow>(
      `SELECT w.id, w.farm_id FROM warehouses w
       JOIN farms f ON f.id = w.farm_id
       LEFT JOIN store_settings s ON s.id = 1
       WHERE w.status = 'ACTIVE' AND f.status = 'ACTIVE'
         AND (w.id = s.warehouse_id OR
              (s.id IS NULL AND w.code = 'WH-MAIN' AND f.code = 'FARM-DEMO'))
       FOR SHARE OF w, f`,
    );
    const warehouse = warehouseResult.rows[0];
    if (!warehouse) {
      throw new Error(
        'An active configured sales warehouse or FARM-DEMO/WH-MAIN is required. Run db:seed first for demo data.',
      );
    }

    const items = await client.query<ItemRow>(
      `SELECT i.id, i.code, u.code AS unit_code FROM items i
       JOIN units u ON u.id = i.unit_id
       WHERE i.farm_id = $1 AND i.status = 'ACTIVE' AND u.status = 'ACTIVE'
         AND i.code = ANY($2::text[]) FOR SHARE OF i, u`,
      [warehouse.farm_id, PRODUCTS.map((product) => product.itemCode)],
    );
    const itemByCode = new Map(items.rows.map((item) => [item.code, item]));
    for (const product of PRODUCTS) {
      const item = itemByCode.get(product.itemCode);
      if (!item || item.unit_code !== product.unitCode) {
        throw new Error(
          `Missing active item or incorrect unit: ${product.itemCode}. Run db:seed first for demo data.`,
        );
      }
    }

    await client.query(
      `INSERT INTO store_settings (id, warehouse_id) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET warehouse_id = EXCLUDED.warehouse_id, updated_at = now()`,
      [warehouse.id],
    );

    const categoryIds = new Map<string, string>();
    for (const category of CATEGORIES) {
      const result = await client.query<IdRow>(
        `INSERT INTO store_categories (slug, name) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
         RETURNING id`,
        [category.slug, category.name],
      );
      categoryIds.set(category.slug, result.rows[0].id);
    }

    for (const product of PRODUCTS) {
      const result = await client.query<IdRow>(
        `INSERT INTO store_products (category_id, slug, name, description, status)
         VALUES ($1, $2, $3, $4, $5::store_product_status)
         ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id,
           name = EXCLUDED.name, description = EXCLUDED.description,
           status = EXCLUDED.status, updated_at = now()
         RETURNING id`,
        [
          categoryIds.get(product.category),
          product.slug,
          product.name,
          `Dữ liệu mẫu: ${product.name}. Giá minh họa, tính theo đơn vị của mặt hàng kho.`,
          product.status,
        ],
      );
      const productId = result.rows[0].id;
      const variant = await client.query<IdRow & { product_id: string }>(
        `INSERT INTO store_product_variants (product_id, item_id, name, price, quantity_step, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (item_id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price,
           quantity_step = EXCLUDED.quantity_step, active = EXCLUDED.active, updated_at = now()
         RETURNING id, product_id`,
        [
          productId,
          itemByCode.get(product.itemCode)!.id,
          product.variant,
          product.price,
          product.step,
        ],
      );
      if (variant.rows[0].product_id !== productId) {
        throw new Error(
          `Item ${product.itemCode} already belongs to another storefront product.`,
        );
      }

      for (let position = 0; position < product.images; position++) {
        // shortcut: dùng ảnh trại chung, thay khi có bộ ảnh sản phẩm.
        await client.query(
          `INSERT INTO store_product_images (product_id, url, alt, position)
           VALUES ($1, '/assets/bee-farm-hero.jpg', $2, $3)
           ON CONFLICT (product_id, position) DO UPDATE SET
             url = EXCLUDED.url, alt = EXCLUDED.alt, updated_at = now()`,
          [
            productId,
            `Ảnh minh họa ${product.name} (${position + 1})`,
            position,
          ],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required in api/.env.');
  const url = new URL(connectionString);
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname)
  ) {
    throw new Error(
      'Storefront demo seed requires a local, non-production database.',
    );
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    await seedStorefront(pool);
    console.info(
      'Storefront seed completed: 4 categories, 6 products, 6 variants, 7 images and 1 warehouse setting.',
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Storefront seed failed.',
    );
    process.exitCode = 1;
  });
}

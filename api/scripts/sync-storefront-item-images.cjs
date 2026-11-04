// Replace storefront seed placeholders with the image of their uniquely mapped item.
// Run from api/: node scripts/sync-storefront-item-images.cjs --check|--apply
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const mode = process.argv[2];
if (!['--check', '--apply'].includes(mode)) {
  console.error('Usage: node scripts/sync-storefront-item-images.cjs --check|--apply');
  process.exit(2);
}

const placeholder = '/assets/bee-farm-hero.jpg';
const backupPath = path.resolve(__dirname, '../../assets/product-images/storefront-images-before-sync.json');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: products } = await client.query(`
      SELECT p.id AS product_id, p.name AS product_name,
             array_agg(DISTINCT i.id) FILTER (WHERE i.id IS NOT NULL) AS item_ids,
             array_agg(DISTINCT i.code) FILTER (WHERE i.id IS NOT NULL) AS item_codes,
             array_agg(DISTINCT i.image_url) FILTER (WHERE i.image_url IS NOT NULL) AS image_urls
      FROM store_products p
      JOIN store_product_variants v ON v.product_id = p.id
      JOIN store_variant_items m ON m.variant_id = v.id
      JOIN items i ON i.id = m.item_id
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);
    const { rows: existing } = await client.query(`
      SELECT id, product_id, url, public_id, alt, position, created_at, updated_at
      FROM store_product_images ORDER BY product_id, position
    `);
    const imagesByProduct = new Map();
    for (const image of existing) {
      const list = imagesByProduct.get(image.product_id) ?? [];
      list.push(image);
      imagesByProduct.set(image.product_id, list);
    }
    const candidates = [];
    for (const product of products) {
      const images = imagesByProduct.get(product.product_id) ?? [];
      if (product.item_ids.length !== 1 || product.image_urls.length !== 1 ||
          !product.image_urls[0].startsWith('https://res.cloudinary.com/') ||
          !images.length || images.some((image) => image.url !== placeholder || image.public_id)) {
        console.log(`Skipped ${product.product_name}: mapping or existing images need manual review`);
        continue;
      }
      candidates.push({ ...product, images });
      console.log(`${product.product_name} <- ${product.item_codes[0]} (${images.length} placeholder image(s))`);
    }
    console.log(`${candidates.length} products ready to sync`);
    if (mode === '--check' || candidates.length === 0) return;

    // Save all rows first so the original storefront gallery can be restored locally.
    if (fs.existsSync(backupPath)) throw new Error(`Backup already exists: ${backupPath}`);
    fs.writeFileSync(backupPath, JSON.stringify(existing, null, 2) + '\n', { flag: 'wx' });
    await client.query('BEGIN');
    try {
      for (const product of candidates) {
        const first = product.images.find((image) => image.position === 0);
        if (!first) throw new Error(`Missing first image for ${product.product_name}`);
        const updated = await client.query(`
          UPDATE store_product_images SET url = $1, alt = $2, public_id = NULL, updated_at = now()
          WHERE id = $3 AND url = $4 AND public_id IS NULL
        `, [product.image_urls[0], product.product_name, first.id, placeholder]);
        if (updated.rowCount !== 1) throw new Error(`Image changed during sync: ${product.product_name}`);
        for (const extra of product.images.filter((image) => image.id !== first.id)) {
          const deleted = await client.query(`
            DELETE FROM store_product_images WHERE id = $1 AND url = $2 AND public_id IS NULL
          `, [extra.id, placeholder]);
          if (deleted.rowCount !== 1) throw new Error(`Extra image changed during sync: ${product.product_name}`);
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`Synced ${candidates.length} product images; backup: ${backupPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

// One-time, resumable import for assets/product-images/manifest.csv.
// Run from api/: node scripts/import-item-images.cjs --check|--upload
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const cloudinary = require('cloudinary').v2;

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const imageDir = path.resolve(__dirname, '../../assets/product-images');
const mode = process.argv[2];
if (!['--check', '--upload'].includes(mode)) {
  console.error('Usage: node scripts/import-item-images.cjs --check|--upload');
  process.exit(2);
}

function entriesFromManifest() {
  const lines = fs.readFileSync(path.join(imageDir, 'manifest.csv'), 'utf8')
    .replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/).slice(1);
  const filenames = fs.readdirSync(imageDir);
  const entries = lines.map((line) => {
    const match = /^([0-9a-f-]{36}),([^,]+),/.exec(line);
    if (!match) throw new Error('Invalid manifest row');
    const [id, code] = match.slice(1);
    const matches = filenames.filter((name) =>
      name.startsWith(`${id}.`) && /\.(jpg|jpeg|png|webp)$/i.test(name));
    if (matches.length !== 1) throw new Error(`Expected one image for ${code}`);
    const file = path.join(imageDir, matches[0]);
    if (fs.statSync(file).size > 10 * 1024 * 1024) {
      throw new Error(`Image exceeds 10 MB: ${code}`);
    }
    return { id, code, file };
  });
  if (entries.length !== 165 || new Set(entries.map((e) => e.id)).size !== 165) {
    throw new Error('Expected 165 unique non-test image IDs');
  }
  return entries;
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function writeReport(rows) {
  const output = ['item_id,code,secure_url', ...rows.map((row) =>
    [row.id, row.code, row.url].map(csvCell).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(imageDir, 'cloudinary-urls.csv'), output, 'utf8');
}

function safeError(error) {
  let message = String(error?.error?.message || error?.message || error);
  for (const key of ['CLOUDINARY_NAME', 'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET', 'DATABASE_URL']) {
    const value = process.env[key];
    if (value) message = message.replaceAll(value, '[redacted]');
  }
  return message;
}

async function remoteImage(publicId) {
  try {
    return await cloudinary.api.resource(publicId, { resource_type: 'image' });
  } catch (error) {
    if (error?.error?.http_code === 404) return null;
    throw error;
  }
}

async function main() {
  const entries = entriesFromManifest();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const dbRows = (await client.query('SELECT id, code, image_url FROM items')).rows;
    const byId = new Map(dbRows.map((row) => [row.id, row]));
    for (const entry of entries) {
      const item = byId.get(entry.id);
      if (!item || item.code !== entry.code) {
        throw new Error(`DB item mismatch: ${entry.code}`);
      }
    }
    const pending = entries.filter((entry) => !byId.get(entry.id).image_url);
    console.log(`Matched ${entries.length} images to DB; ${pending.length} missing URLs; 1 test item excluded.`);
    if (mode === '--check') return;

    for (const key of ['CLOUDINARY_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (!process.env[key]) throw new Error(`${key} is missing`);
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    await cloudinary.api.ping();

    const report = entries.filter((entry) => byId.get(entry.id).image_url)
      .map((entry) => ({ ...entry, url: byId.get(entry.id).image_url }));
    writeReport(report);
    for (const [index, entry] of pending.entries()) {
      const publicId = `nuoi-ong/items/${entry.id}`;
      const existing = await remoteImage(publicId);
      const uploaded = existing || await cloudinary.uploader.upload(entry.file, {
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        resource_type: 'image',
        transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
        format: 'webp',
      });
      if (!uploaded.secure_url) throw new Error(`Cloudinary returned no URL: ${entry.code}`);
      const result = await client.query(
        `UPDATE items SET image_url = $1, updated_at = now()
         WHERE id = $2 AND image_url IS NULL`,
        [uploaded.secure_url, entry.id],
      );
      if (result.rowCount !== 1) throw new Error(`DB update did not change ${entry.code}`);
      report.push({ ...entry, url: uploaded.secure_url });
      writeReport(report);
      console.log(`${index + 1}/${pending.length} ${entry.code}`);
    }
    console.log(`Done: ${report.length} item URLs saved to DB and cloudinary-urls.csv.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Import stopped:', safeError(error));
  process.exitCode = 1;
});

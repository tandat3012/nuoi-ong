// Upload the 336 image mappings approved in assets/product-images/gallery-review.html.
// This script only reads the local DB to resolve item IDs; it never writes to the DB.
// Run from api/: node scripts/upload-336-item-images.cjs --check|--upload
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const cloudinary = require('cloudinary').v2;

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const mode = process.argv[2];
if (!['--check', '--upload'].includes(mode)) {
  console.error('Usage: node scripts/upload-336-item-images.cjs --check|--upload');
  process.exit(2);
}

const projectRoot = path.resolve(__dirname, '../..');
const imageRoot = path.join(projectRoot, 'assets/product-images');
const candidateRoot = path.resolve(imageRoot, 'candidates');
const manifestPath = path.join(
  imageRoot,
  'review-downloads/items-import-336-approved-image-manifest.csv',
);
const outputPath = path.join(imageRoot, 'review-downloads/cloudinary-urls-336.csv');
const farmCode = 'FARM-DEMO';
const expectedDatabase = 'nuoi_ong_local';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted value');
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  if (rows.length < 2) throw new Error('Approved image manifest is empty');
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ''));
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? '']),
  ));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function writeReport(rows) {
  const headers = [
    'item_id', 'farm_code', 'final_code', 'name', 'candidate_code',
    'image_candidate_file', 'image_source_url', 'public_id', 'image_url', 'image_sha256',
  ];
  const content = [headers.join(','), ...rows.map((row) =>
    headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf8');
}

function resolveImage(entry) {
  const imagePath = path.resolve(imageRoot, entry.image_candidate_file);
  const relative = path.relative(candidateRoot, imagePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Image path escapes candidate folder: ${entry.final_code}`);
  }
  if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
    throw new Error(`Approved image file is missing: ${entry.final_code}`);
  }
  const size = fs.statSync(imagePath).size;
  if (size <= 0 || size > 10 * 1024 * 1024) {
    throw new Error(`Invalid image size for ${entry.final_code}`);
  }
  const digest = crypto.createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex');
  if (digest !== entry.image_sha256) {
    throw new Error(`Image changed after the review manifest was created: ${entry.final_code}`);
  }
  return imagePath;
}

function validateManifest(entries) {
  if (entries.length !== 336) throw new Error(`Expected 336 manifest rows, found ${entries.length}`);
  if (new Set(entries.map((entry) => entry.final_code)).size !== 336) {
    throw new Error('Manifest has duplicate final item codes');
  }
  if (new Set(entries.map((entry) => entry.candidate_code)).size !== 336) {
    throw new Error('Manifest has duplicate candidate codes');
  }
  if (entries.some((entry) => entry.reviewed_in_gallery !== 'yes')) {
    throw new Error('Manifest contains an image absent from the approved review gallery');
  }
  return entries.map((entry) => ({ ...entry, imagePath: resolveImage(entry) }));
}

function requireLocalDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  let parsed;
  try {
    parsed = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL is invalid');
  }
  if (parsed.pathname.replace(/^\//, '') !== expectedDatabase) {
    throw new Error(`Refusing unexpected database target; expected ${expectedDatabase}`);
  }
}

function safeError(error) {
  let message = String(error?.error?.message || error?.message || error);
  for (const key of ['CLOUDINARY_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'DATABASE_URL']) {
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

async function uploadOrReuse(entry, item) {
  const publicId = `nuoi-ong/items/${item.id}`;
  const existing = await remoteImage(publicId);
  const uploaded = existing || await cloudinary.uploader.upload(entry.imagePath, {
    public_id: publicId,
    overwrite: false,
    unique_filename: false,
    resource_type: 'image',
    transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
    format: 'webp',
  });
  if (!uploaded.secure_url || !uploaded.secure_url.startsWith('https://res.cloudinary.com/')) {
    throw new Error(`Cloudinary returned an invalid secure URL for ${entry.final_code}`);
  }
  return { publicId, url: uploaded.secure_url };
}

async function main() {
  requireLocalDatabase();
  const entries = validateManifest(parseCsv(fs.readFileSync(manifestPath, 'utf8')));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(
      `SELECT i.id, i.code, i.name, i.image_url
       FROM items i JOIN farms f ON f.id=i.farm_id
       WHERE f.code=$1 AND i.code = ANY($2::text[])`,
      [farmCode, entries.map((entry) => entry.final_code)],
    );
    await client.query('COMMIT');

    const dbByCode = new Map(rows.map((row) => [row.code, row]));
    if (dbByCode.size !== 336 || entries.some((entry) => !dbByCode.has(entry.final_code))) {
      throw new Error(`Expected all 336 final codes in ${farmCode}; found ${dbByCode.size}`);
    }
    const dbMismatches = entries.filter((entry) => dbByCode.get(entry.final_code).name !== entry.name);
    if (dbMismatches.length) {
      throw new Error(`DB name mismatch for ${dbMismatches.slice(0, 5).map((entry) => entry.final_code).join(', ')}`);
    }
    const alreadyMapped = entries.filter((entry) => dbByCode.get(entry.final_code).image_url);
    if (alreadyMapped.length) {
      throw new Error(`Refusing to replace existing DB image URLs: ${alreadyMapped.slice(0, 5).map((entry) => entry.final_code).join(', ')}`);
    }

    const uniqueContents = new Set(entries.map((entry) => entry.image_sha256)).size;
    console.log(`Approved gallery images: ${entries.length}; exact DB matches: ${dbByCode.size}`);
    console.log(`Local files verified: ${entries.length}; distinct image contents: ${uniqueContents}`);
    console.log(`DB image_url values are blank for all ${entries.length} items; no DB writes will be performed.`);
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

    const resultRows = [];
    for (const [index, entry] of entries.entries()) {
      const item = dbByCode.get(entry.final_code);
      const { publicId, url } = await uploadOrReuse(entry, item);
      resultRows.push({
        item_id: item.id,
        farm_code: farmCode,
        final_code: entry.final_code,
        name: item.name,
        candidate_code: entry.candidate_code,
        image_candidate_file: entry.image_candidate_file,
        image_source_url: entry.image_source_url,
        public_id: publicId,
        image_url: url,
        image_sha256: entry.image_sha256,
      });
      writeReport(resultRows);
      console.log(`${index + 1}/${entries.length} ${entry.final_code}`);
    }
    if (resultRows.length !== 336 || new Set(resultRows.map((row) => row.final_code)).size !== 336) {
      throw new Error('Final Cloudinary URL map is incomplete or has duplicate codes');
    }
    console.log(`Done: ${resultRows.length} URL mappings written to ${path.relative(projectRoot, outputPath)}.`);
    console.log('Database image_url fields remain unchanged.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Image mapping stopped:', safeError(error));
  process.exitCode = 1;
});

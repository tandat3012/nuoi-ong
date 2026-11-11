// Applies the approved Cloudinary URL map to the 336 FARM-DEMO items.
// The transaction updates only items.image_url and aborts on any mismatch.
// Run from api/: node scripts/apply-336-image-urls.cjs
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const projectRoot = path.resolve(__dirname, '../..');
const inputPath = path.join(
  projectRoot,
  'assets/product-images/review-downloads/cloudinary-urls-336.csv',
);
const backupDirectory = path.join(projectRoot, 'assets/product-images/review-downloads');
const expectedDatabase = 'nuoi_ong_local';
const expectedFarm = 'FARM-DEMO';
const expectedRows = 336;

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
  if (rows.length < 2) throw new Error('Cloudinary URL CSV is empty');
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ''));
  return rows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? '']),
  ));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function asCsv(headers, rows) {
  return [headers.join(','), ...rows.map((row) =>
    headers.map((header) => csvCell(row[header])).join(','))].join('\n') + '\n';
}

function validateInput(entries) {
  if (entries.length !== expectedRows) {
    throw new Error(`Expected ${expectedRows} CSV rows, found ${entries.length}`);
  }
  for (const key of ['item_id', 'farm_code', 'final_code', 'name', 'image_url']) {
    if (entries.some((entry) => !entry[key])) throw new Error(`CSV has an empty ${key}`);
  }
  if (entries.some((entry) => entry.farm_code !== expectedFarm)) {
    throw new Error(`CSV contains a farm other than ${expectedFarm}`);
  }
  if (new Set(entries.map((entry) => entry.item_id)).size !== expectedRows) {
    throw new Error('CSV has duplicate item_id values');
  }
  if (new Set(entries.map((entry) => entry.final_code)).size !== expectedRows) {
    throw new Error('CSV has duplicate final_code values');
  }
  if (entries.some((entry) => !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(entry.image_url))) {
    throw new Error('CSV contains an invalid Cloudinary HTTPS URL');
  }
}

function validateDatabaseTarget() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  let parsed;
  try {
    parsed = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL is invalid');
  }
  if (parsed.pathname.replace(/^\//, '') !== expectedDatabase) {
    throw new Error(`Refusing unexpected DB; expected ${expectedDatabase}`);
  }
}

function safeError(error) {
  let message = String(error?.message || error);
  for (const key of ['DATABASE_URL']) {
    const value = process.env[key];
    if (value) message = message.replaceAll(value, '[redacted]');
  }
  return message;
}

async function main() {
  validateDatabaseTarget();
  const entries = parseCsv(fs.readFileSync(inputPath, 'utf8'));
  validateInput(entries);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await client.query(`
      CREATE TEMP TABLE image_url_import (
        item_id uuid PRIMARY KEY,
        final_code text UNIQUE NOT NULL,
        name text NOT NULL,
        image_url text NOT NULL
      ) ON COMMIT DROP
    `);
    await client.query(
      `INSERT INTO image_url_import (item_id, final_code, name, image_url)
       SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[])`,
      [
        entries.map((entry) => entry.item_id),
        entries.map((entry) => entry.final_code),
        entries.map((entry) => entry.name),
        entries.map((entry) => entry.image_url),
      ],
    );

    const { rows: dbRows } = await client.query(
      `SELECT s.item_id AS expected_id, s.final_code, s.name AS expected_name,
              s.image_url AS expected_url, i.id AS db_id, i.code AS db_code,
              i.name AS db_name, i.image_url AS db_url, f.code AS db_farm_code
       FROM image_url_import s
       JOIN items i ON i.id = s.item_id AND i.code = s.final_code
       JOIN farms f ON f.id = i.farm_id AND f.code = 'FARM-DEMO'
       ORDER BY s.final_code
       FOR UPDATE OF i`,
    );
    if (dbRows.length !== expectedRows) {
      throw new Error(`DB match count is ${dbRows.length}; expected ${expectedRows}`);
    }

    const mismatches = dbRows.filter((row) =>
      row.db_id !== row.expected_id
      || row.db_code !== row.final_code
      || row.db_name !== row.expected_name
      || row.db_farm_code !== expectedFarm
      || (row.db_url && row.db_url !== row.expected_url));
    if (mismatches.length) {
      throw new Error(
        `Refusing update: ${mismatches.length} rows mismatch; examples: ${mismatches.slice(0, 5).map((row) => row.final_code).join(', ')}`,
      );
    }
    const expectedToUpdate = dbRows.filter((row) =>
      row.db_url === null || String(row.db_url).trim() === '').length;

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupPath = path.join(backupDirectory, `image-url-before-update-336-${stamp}.csv`);
    const backupHeaders = ['item_id', 'farm_code', 'final_code', 'name', 'image_url'];
    fs.writeFileSync(backupPath, asCsv(backupHeaders, dbRows.map((row) => ({
      item_id: row.db_id,
      farm_code: row.db_farm_code,
      final_code: row.db_code,
      name: row.db_name,
      image_url: row.db_url,
    }))), { encoding: 'utf8', flag: 'wx' });

    const { rows: updatedRows } = await client.query(
      `UPDATE items i
       SET image_url = s.image_url
       FROM image_url_import s, farms f
       WHERE i.id = s.item_id
         AND i.code = s.final_code
         AND f.id = i.farm_id
         AND f.code = $1
         AND (i.image_url IS NULL OR btrim(i.image_url) = '')
       RETURNING i.id, i.code, i.image_url`,
      [expectedFarm],
    );

    const { rows: verificationRows } = await client.query(
      `SELECT s.item_id, s.final_code, s.image_url AS expected_url,
              i.image_url AS actual_url, f.code AS farm_code
       FROM image_url_import s
       JOIN items i ON i.id = s.item_id AND i.code = s.final_code
       JOIN farms f ON f.id = i.farm_id
       WHERE f.code = $1`,
      [expectedFarm],
    );
    const verificationFailures = verificationRows.filter((row) =>
      row.farm_code !== expectedFarm || row.actual_url !== row.expected_url);
    if (verificationRows.length !== expectedRows || verificationFailures.length) {
      throw new Error(
        `In-transaction verification failed: ${verificationRows.length}/${expectedRows} rows match; ${verificationFailures.length} URL mismatches`,
      );
    }
    if (updatedRows.length !== expectedToUpdate) {
      throw new Error(`Updated ${updatedRows.length} rows; expected ${expectedToUpdate} blank URLs`);
    }

    await client.query('COMMIT');
    inTransaction = false;
    console.log(`Database: ${expectedDatabase}; farm: ${expectedFarm}`);
    console.log(`Updated image_url rows: ${updatedRows.length}; already correct: ${expectedRows - expectedToUpdate}`);
    console.log(`Verified URL mappings: ${verificationRows.length}/${expectedRows}`);
    console.log(`Before-update snapshot: ${path.relative(projectRoot, backupPath)}`);
    console.log('Only items.image_url was updated; no inventory values or other item fields were changed.');
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Image URL update stopped:', safeError(error));
  process.exitCode = 1;
});

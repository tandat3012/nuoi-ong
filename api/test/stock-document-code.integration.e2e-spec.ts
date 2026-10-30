import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import {
  allocateDocumentCode,
  formatDocumentCode,
  numberingYear,
} from '../src/modules/warehouses/stock-document-code';

describe('Stock document code allocator', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
  });
  const db = drizzle(pool, { schema });
  const tag = `NUM-${randomUUID().slice(0, 8)}`;
  const farm = randomUUID(),
    otherFarm = randomUUID(),
    user = randomUUID(),
    member = randomUUID(),
    warehouse = randomUUID();
  const at2026 = new Date('2026-06-15T03:00:00Z');

  const allocate = (
    prefix: 'PN' | 'PX' | 'KK' | 'CK',
    at = at2026,
    farmId = farm,
  ) => db.transaction((tx) => allocateDocumentCode(tx, farmId, prefix, at));
  const counter = async (prefix: string, year = 2026) =>
    (
      await pool.query<{ last_value: number }>(
        'SELECT last_value FROM stock_document_counters WHERE farm_id=$1 AND prefix=$2 AND year=$3',
        [farm, prefix, year],
      )
    ).rows[0]?.last_value;
  const receipt = (code: string) =>
    pool.query(
      'INSERT INTO stock_receipts (farm_id, warehouse_id, receipt_code, created_by_member_id) VALUES ($1,$2,$3,$4)',
      [farm, warehouse, code, member],
    );

  beforeAll(async () => {
    await pool.query(
      'INSERT INTO farms (id, code, name) VALUES ($1,$2,$2), ($3,$4,$4)',
      [farm, tag, otherFarm, `${tag}-B`],
    );
    await pool.query(
      'INSERT INTO users (id, auth_provider_user_id, email) VALUES ($1,$2,$3)',
      [user, tag, `${tag}@example.test`],
    );
    await pool.query(
      'INSERT INTO farm_members (id, farm_id, user_id) VALUES ($1,$2,$3)',
      [member, farm, user],
    );
    await pool.query(
      `INSERT INTO warehouses (id, farm_id, code, name) VALUES ($1,$2,'W','W')`,
      [warehouse, farm],
    );
  });

  beforeEach(async () => {
    await pool.query(
      'DELETE FROM stock_document_counters WHERE farm_id IN ($1,$2)',
      [farm, otherFarm],
    );
    await pool.query('DELETE FROM stock_receipts WHERE farm_id=$1', [farm]);
  });

  afterAll(async () => {
    try {
      await pool.query(
        'DELETE FROM stock_document_counters WHERE farm_id IN ($1,$2)',
        [farm, otherFarm],
      );
      for (const table of ['stock_receipts', 'warehouses', 'farm_members'])
        await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
      await pool.query('DELETE FROM users WHERE id=$1', [user]);
      await pool.query('DELETE FROM farms WHERE id IN ($1,$2)', [
        farm,
        otherFarm,
      ]);
    } finally {
      await pool.end();
    }
  });

  it('formats at least six digits and keeps growing past 999999', () => {
    expect(formatDocumentCode('PN', 2026, 1)).toBe('PN-2026-000001');
    expect(formatDocumentCode('PX', 2026, 999999)).toBe('PX-2026-999999');
    expect(formatDocumentCode('PX', 2026, 1000000)).toBe('PX-2026-1000000');
  });

  it('uses the Asia/Ho_Chi_Minh year', () => {
    expect(numberingYear(new Date('2026-12-31T16:59:59Z'))).toBe(2026);
    expect(numberingYear(new Date('2026-12-31T17:00:00Z'))).toBe(2027);
  });

  it('starts each scope at 1 and counts up', async () => {
    expect(await allocate('PN')).toBe('PN-2026-000001');
    expect(await allocate('PN')).toBe('PN-2026-000002');
    expect(await counter('PN')).toBe(2);
  });

  it('keeps farms, prefixes and years independent', async () => {
    await allocate('PN');
    expect(await allocate('PX')).toBe('PX-2026-000001');
    expect(await allocate('PN', at2026, otherFarm)).toBe('PN-2026-000001');
    expect(await allocate('PN', new Date('2026-12-31T17:00:00Z'))).toBe(
      'PN-2027-000001',
    );
    expect(await allocate('PN')).toBe('PN-2026-000002');
  });

  it('skips codes already held by any document, including mixed case', async () => {
    await receipt('PN-2026-000001');
    await receipt(' pn-2026-000002 ');
    expect(await allocate('PN')).toBe('PN-2026-000003');
    expect(await counter('PN')).toBe(3);
  });

  it('is not pushed ahead by a high existing code', async () => {
    await receipt('PN-2026-999999');
    expect(await allocate('PN')).toBe('PN-2026-000001');
    expect(await counter('PN')).toBe(1);
  });

  it('rolls the counter back with a failed transaction', async () => {
    await allocate('PN');
    await expect(
      db.transaction(async (tx) => {
        await allocateDocumentCode(tx, farm, 'PN', at2026);
        throw new Error('confirmation failed after allocation');
      }),
    ).rejects.toThrow('confirmation failed after allocation');
    expect(await counter('PN')).toBe(1);
    expect(await allocate('PN')).toBe('PN-2026-000002');
  });

  it('rolls back a counter created by a failed first use', async () => {
    await expect(
      db.transaction(async (tx) => {
        await allocateDocumentCode(tx, farm, 'KK', at2026);
        throw new Error('first use failed');
      }),
    ).rejects.toThrow('first use failed');
    expect(await counter('KK')).toBeUndefined();
  });

  it('gives concurrent confirmations distinct consecutive codes', async () => {
    const codes = await Promise.all(
      Array.from({ length: 10 }, () => allocate('CK')),
    );
    expect(new Set(codes).size).toBe(10);
    expect([...codes].sort()).toEqual(
      Array.from({ length: 10 }, (_, i) =>
        formatDocumentCode('CK', 2026, i + 1),
      ),
    );
    expect(await counter('CK')).toBe(10);
  });
});

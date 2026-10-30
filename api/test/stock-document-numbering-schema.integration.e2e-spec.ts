import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';

// Direct database writes; every test runs in a transaction that is rolled back.
describe('Stock document numbering schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let db: PoolClient;
  let farmId: string;
  let otherFarmId: string;
  let warehouseId: string;
  let otherWarehouseId: string;
  let memberId: string;
  let otherMemberId: string;

  const tables = [
    { table: 'stock_receipts', code: 'receipt_code', name: 'receipt' },
    { table: 'stock_issues', code: 'issue_code', name: 'issue' },
    { table: 'stock_counts', code: 'count_code', name: 'count' },
    { table: 'stock_transfers', code: 'transfer_code', name: 'transfer' },
  ];
  type Table = (typeof tables)[number];

  async function createFarm() {
    const suffix = randomUUID().slice(0, 8);
    const farm = await db.query<{ id: string }>(
      `INSERT INTO farms (code, name) VALUES ($1, $1) RETURNING id`,
      [`NUM-${suffix}`],
    );
    const id = farm.rows[0].id;
    const warehouses = await db.query<{ id: string }>(
      `INSERT INTO warehouses (farm_id, code, name)
       VALUES ($1, 'A', 'A'), ($1, 'B', 'B') RETURNING id`,
      [id],
    );
    const user = await db.query<{ id: string }>(
      `INSERT INTO users (auth_provider_user_id, email) VALUES ($1, $2) RETURNING id`,
      [`numbering-${suffix}`, `numbering-${suffix}@example.test`],
    );
    const member = await db.query<{ id: string }>(
      `INSERT INTO farm_members (farm_id, user_id) VALUES ($1, $2) RETURNING id`,
      [id, user.rows[0].id],
    );
    return {
      id,
      warehouseId: warehouses.rows[0].id,
      secondWarehouseId: warehouses.rows[1].id,
      memberId: member.rows[0].id,
    };
  }

  function insert(
    t: Table,
    code: string | null,
    options: {
      farm?: 'main' | 'other';
      status?: string;
      confirmed?: boolean;
    } = {},
  ) {
    const other = options.farm === 'other';
    const farm = other ? otherFarmId : farmId;
    const member = other ? otherMemberId : memberId;
    const warehouse = other ? otherWarehouseId : warehouseId;
    const status = options.status ?? 'DRAFT';
    const confirmed = options.confirmed ?? status === 'CONFIRMED';
    const warehouseColumns =
      t.table === 'stock_transfers'
        ? 'from_warehouse_id, to_warehouse_id'
        : 'warehouse_id';
    const warehouseValues =
      t.table === 'stock_transfers'
        ? `$3, (SELECT id FROM warehouses WHERE farm_id = $1 AND id <> $3 LIMIT 1)`
        : '$3';
    return db.query(
      `INSERT INTO ${t.table}
         (farm_id, ${t.code}, ${warehouseColumns}, created_by_member_id, status,
          confirmed_by_member_id, confirmed_at)
       VALUES ($1, $2, ${warehouseValues}, $4, $5,
          CASE WHEN $6 THEN $4::uuid END, CASE WHEN $6 THEN now() END)`,
      [farm, code, warehouse, member, status, confirmed],
    );
  }

  async function expectViolation(
    run: () => Promise<unknown>,
    constraint: string,
  ) {
    await db.query('SAVEPOINT attempt');
    await expect(run()).rejects.toMatchObject({ constraint });
    await db.query('ROLLBACK TO SAVEPOINT attempt');
  }

  beforeEach(async () => {
    db = await pool.connect();
    await db.query('BEGIN');
    const main = await createFarm();
    const other = await createFarm();
    farmId = main.id;
    warehouseId = main.warehouseId;
    memberId = main.memberId;
    otherFarmId = other.id;
    otherWarehouseId = other.warehouseId;
    otherMemberId = other.memberId;
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
    db.release();
  });

  afterAll(() => pool.end());

  describe.each(tables)('$table', (t) => {
    it('allows several uncoded drafts in one farm', async () => {
      await insert(t, null);
      await insert(t, null);
      await insert(t, null, { status: 'CANCELLED' });
    });

    it('rejects a confirmed row without a code', async () => {
      await expectViolation(
        () => insert(t, null, { status: 'CONFIRMED' }),
        `ck_${t.name}_confirmed_code`,
      );
      await insert(t, 'PX-2026-000001', { status: 'CONFIRMED' });
    });

    it.each(['', '   '])(
      'rejects a blank code %j in any status, so drafts store NULL',
      async (code) => {
        for (const status of ['DRAFT', 'CANCELLED', 'CONFIRMED'])
          await expectViolation(
            () => insert(t, code, { status }),
            `ck_${t.name}_code_not_blank`,
          );
      },
    );

    it('keeps codes unique per farm, ignoring case and outer whitespace', async () => {
      await insert(t, 'legacy-01');
      await expectViolation(
        () => insert(t, ' LEGACY-01 '),
        `uq_${t.name}_code_per_farm`,
      );
      await insert(t, 'legacy-01', { farm: 'other' });
    });

    it('still requires confirmation metadata', async () => {
      await expectViolation(
        () =>
          insert(t, 'NO-META-01', { status: 'CONFIRMED', confirmed: false }),
        `ck_${t.name}_confirm_fields`,
      );
    });
  });

  it('keeps counters nonnegative and unique per farm, prefix and year', async () => {
    await db.query(
      `INSERT INTO stock_document_counters (farm_id, prefix, year) VALUES ($1, 'PN', 2026)`,
      [farmId],
    );
    await expectViolation(
      () =>
        db.query(
          `INSERT INTO stock_document_counters (farm_id, prefix, year) VALUES ($1, 'PN', 2026)`,
          [farmId],
        ),
      'stock_document_counters_pkey',
    );
    await expectViolation(
      () =>
        db.query(
          `INSERT INTO stock_document_counters (farm_id, prefix, year, last_value)
           VALUES ($1, 'PX', 2026, -1)`,
          [farmId],
        ),
      'ck_stock_document_counter_nonnegative',
    );
  });

  it('seeds counters from canonical codes only, in every status', async () => {
    const [receipts, issues, counts, transfers] = tables;
    await insert(receipts, 'PN-2026-000007', { status: 'CANCELLED' });
    await insert(receipts, ' pn-2026-000012 ');
    await insert(receipts, 'PN-2025-000003', { status: 'CONFIRMED' });
    await insert(receipts, 'PN-demo-001');
    await insert(receipts, 'PX-2026-000099');
    await insert(issues, 'XB-DH000082');
    await insert(issues, 'PX-2026-1234567', { status: 'CONFIRMED' });
    await insert(counts, 'KK-01', { status: 'CONFIRMED' });
    await insert(transfers, 'CK-2026-00001');
    await insert(transfers, 'CK-2026-000004', { farm: 'other' });

    const migration = readFileSync(
      join(__dirname, '../drizzle/0023_stock-document-numbering.sql'),
      'utf8',
    );
    const seed = migration.slice(
      migration.indexOf('INSERT INTO "stock_document_counters"'),
    );
    await db.query('DELETE FROM stock_document_counters');
    await db.query(seed);

    const rows = await db.query<{
      farm: string;
      prefix: string;
      year: number;
      last_value: number;
    }>(
      `SELECT CASE farm_id WHEN $1 THEN 'main' ELSE 'other' END AS farm,
              prefix, year, last_value
         FROM stock_document_counters
        WHERE farm_id IN ($1, $2)
        ORDER BY farm, prefix, year`,
      [farmId, otherFarmId],
    );
    expect(rows.rows).toEqual([
      { farm: 'main', prefix: 'PN', year: 2025, last_value: 3 },
      { farm: 'main', prefix: 'PN', year: 2026, last_value: 12 },
      { farm: 'main', prefix: 'PX', year: 2026, last_value: 1234567 },
      { farm: 'other', prefix: 'CK', year: 2026, last_value: 4 },
    ]);
  });
});

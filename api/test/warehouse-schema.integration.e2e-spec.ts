import 'dotenv/config';
import { Pool } from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  documentStatus,
  notifications,
  stockCounts,
  stockCountStatus,
  stockIssues,
  stockReceipts,
  stockTransfers,
} from '../src/db/schema';

describe('Warehouse migration and application schema compatibility', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(() => pool.end());

  it.each([documentStatus, stockCountStatus])(
    'matches database enum $enumName',
    async (definition) => {
      const result = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
       JOIN pg_namespace n ON n.oid=t.typnamespace
       WHERE n.nspname='public' AND t.typname=$1 ORDER BY e.enumsortorder`,
        [definition.enumName],
      );
      expect(result.rows.map((row) => row.enumlabel)).toEqual(
        definition.enumValues,
      );
    },
  );

  it.each(
    [
      stockCounts,
      stockIssues,
      stockReceipts,
      stockTransfers,
      notifications,
    ].map(getTableConfig),
  )('matches migrated columns of $name', async (table) => {
    const result = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`,
      [table.name],
    );
    expect(result.rows.map((row) => row.column_name)).toEqual(
      table.columns.map((column) => column.name).sort(),
    );
  });
});

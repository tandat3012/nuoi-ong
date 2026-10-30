import { Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import {
  stockCounts,
  stockDocumentCounters,
  stockDocumentPrefix,
  stockIssues,
  stockReceipts,
  stockTransfers,
} from '../../db/schema';

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

export type StockDocumentPrefix =
  (typeof stockDocumentPrefix.enumValues)[number];

const DOCUMENTS = {
  PN: { table: stockReceipts, code: stockReceipts.receiptCode },
  PX: { table: stockIssues, code: stockIssues.issueCode },
  KK: { table: stockCounts, code: stockCounts.countCode },
  CK: { table: stockTransfers, code: stockTransfers.transferCode },
};

const legacyCodes = new Logger('LegacyDocumentCode');

// shortcut: stale web bundles may still send a code; it is logged and dropped.
// Reject the field once these warnings stop.
export function ignoreLegacyCode(field: string, value: unknown) {
  if (value !== undefined) legacyCodes.warn(`Ignored client-supplied ${field}`);
}

const yearInVietnam = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
});

export function numberingYear(confirmedAt: Date) {
  return Number(yearInVietnam.format(confirmedAt));
}

// Six digits minimum; larger values keep growing instead of wrapping.
export function formatDocumentCode(
  prefix: StockDocumentPrefix,
  year: number,
  value: number,
) {
  return `${prefix}-${year}-${String(value).padStart(6, '0')}`;
}

function counterScope(
  farmId: string,
  prefix: StockDocumentPrefix,
  year: number,
) {
  return and(
    eq(stockDocumentCounters.farmId, farmId),
    eq(stockDocumentCounters.prefix, prefix),
    eq(stockDocumentCounters.year, year),
  );
}

// Creates the scope's counter on first use, then locks it until commit.
async function lockCounter(
  tx: Transaction,
  farmId: string,
  prefix: StockDocumentPrefix,
  year: number,
) {
  await tx
    .insert(stockDocumentCounters)
    .values({ farmId, prefix, year })
    .onConflictDoNothing();
  const [counter] = await tx
    .select({ lastValue: stockDocumentCounters.lastValue })
    .from(stockDocumentCounters)
    .where(counterScope(farmId, prefix, year))
    .for('update');
  return counter.lastValue;
}

/**
 * A written code in the automatic format (e.g. PN-2026-000005) locks the
 * counter of its own prefix and encoded year before the write, so it
 * serializes with automatic allocation instead of racing it. The counter
 * value is not changed. Other codes can never collide with automatic ones.
 */
export async function lockManualCodeScope(
  tx: Transaction,
  farmId: string,
  prefix: StockDocumentPrefix,
  code: string | null | undefined,
) {
  const year = code
    ?.trim()
    .toUpperCase()
    .match(new RegExp(`^${prefix}-(\\d{4})-\\d{6,}$`))?.[1];
  if (year) await lockCounter(tx, farmId, prefix, Number(year));
}

/**
 * Takes the next free automatic code for a confirmation, inside the caller's
 * transaction so a rollback also rolls back the counter. Call it after the
 * stock effects: the counter row stays locked until commit. Codes already
 * held by any document (legacy or manual) are skipped, not reused.
 */
export async function allocateDocumentCode(
  tx: Transaction,
  farmId: string,
  prefix: StockDocumentPrefix,
  confirmedAt: Date,
) {
  const year = numberingYear(confirmedAt);
  const { table, code: column } = DOCUMENTS[prefix];
  let value = await lockCounter(tx, farmId, prefix, year);
  let code: string;
  let taken: boolean;
  do {
    value += 1;
    code = formatDocumentCode(prefix, year, value);
    const existing = await tx.execute(
      sql`SELECT 1 FROM ${table} WHERE ${table.farmId} = ${farmId} AND upper(btrim(${column})) = ${code} LIMIT 1`,
    );
    taken = existing.rows.length > 0;
  } while (taken);
  await tx
    .update(stockDocumentCounters)
    .set({ lastValue: value, updatedAt: confirmedAt.toISOString() })
    .where(counterScope(farmId, prefix, year));
  return code;
}

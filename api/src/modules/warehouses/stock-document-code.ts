import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
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
import type { DocumentWriter } from './warehouses.service';

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
  let value = await lockCounter(tx, farmId, prefix, year);
  let code: string;
  let taken: boolean;
  do {
    value += 1;
    code = formatDocumentCode(prefix, year, value);
    taken = await codeTaken(tx, farmId, prefix, code);
  } while (taken);
  await tx
    .update(stockDocumentCounters)
    .set({ lastValue: value, updatedAt: confirmedAt.toISOString() })
    .where(counterScope(farmId, prefix, year));
  return code;
}

async function codeTaken(
  tx: Transaction,
  farmId: string,
  prefix: StockDocumentPrefix,
  code: string,
) {
  const { table, code: column } = DOCUMENTS[prefix];
  const existing = await tx.execute(
    sql`SELECT 1 FROM ${table} WHERE ${table.farmId} = ${farmId} AND upper(btrim(${column})) = upper(btrim(${code})) LIMIT 1`,
  );
  return existing.rows.length > 0;
}

/** Requested codes are stored trimmed and uppercased, like the unique index compares them. */
export function normalizeRequestedCode(code: string) {
  return code.trim().toUpperCase();
}

export type NumberingOptionsInput = {
  externalReference?: string | null;
  requestedCode?: string | null;
  requestedCodeReason?: string | null;
};

/**
 * Columns to write for the owner-only numbering options, or {} when the
 * request sends none. Only an active FARM_OWNER may set, change or clear them.
 * A requested code needs a reason in the same request; null clears both.
 */
export function numberingOptionChanges(
  input: NumberingOptionsInput,
  writer: DocumentWriter,
) {
  const { externalReference, requestedCode, requestedCodeReason } = input;
  if (
    externalReference === undefined &&
    requestedCode === undefined &&
    requestedCodeReason === undefined
  )
    return {};
  if (!writer.isOwner)
    throw new ForbiddenException(
      'Only the farm owner can set document numbering options',
    );
  const changes: {
    externalReference?: string | null;
    requestedCode?: string | null;
    requestedCodeReason?: string | null;
    requestedByMemberId?: string | null;
  } = {};
  if (externalReference !== undefined)
    changes.externalReference = externalReference?.trim() || null;
  if (requestedCode === null) {
    Object.assign(changes, {
      requestedCode: null,
      requestedCodeReason: null,
      requestedByMemberId: null,
    });
  } else if (requestedCode !== undefined) {
    const reason = requestedCodeReason?.trim();
    if (!reason)
      throw new BadRequestException(
        'A reason is required for a requested document code',
      );
    Object.assign(changes, {
      requestedCode: normalizeRequestedCode(requestedCode),
      requestedCodeReason: reason,
      requestedByMemberId: writer.memberId,
    });
  } else if (requestedCodeReason !== undefined) {
    throw new BadRequestException(
      'requestedCodeReason must be sent together with requestedCode',
    );
  }
  return changes;
}

/**
 * Permanent code for a confirmation: a legacy code is kept, an owner-requested
 * code is used only if still free, otherwise the next automatic number.
 * Call it after the stock effects, inside the confirm transaction.
 */
export async function confirmationCode(
  tx: Transaction,
  farmId: string,
  prefix: StockDocumentPrefix,
  current: { code: string | null; requestedCode: string | null },
  confirmedAt: Date,
): Promise<{ code: string; codeSource?: 'AUTO' | 'MANUAL' }> {
  if (current.code) return { code: current.code };
  if (current.requestedCode) {
    await lockManualCodeScope(tx, farmId, prefix, current.requestedCode);
    if (await codeTaken(tx, farmId, prefix, current.requestedCode))
      throw new ConflictException(
        `Requested code ${current.requestedCode} is already in use`,
      );
    return { code: current.requestedCode, codeSource: 'MANUAL' };
  }
  return {
    code: await allocateDocumentCode(tx, farmId, prefix, confirmedAt),
    codeSource: 'AUTO',
  };
}

/**
 * Two confirmations requesting the same free code race past the check; the
 * loser fails on the unique index after its transaction rolled back.
 */
export function rethrowCodeConflict(error: unknown): never {
  const failure = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = failure.cause?.code ?? failure.code;
  const constraint = failure.cause?.constraint ?? failure.constraint ?? '';
  if (
    code === '23505' &&
    /^uq_(receipt|issue|count|transfer)_code_per_farm$/.test(constraint)
  )
    throw new ConflictException('This document code is already in use');
  throw error;
}

import { sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { auditLogs } from '../../db/schema';

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

export type StockDocumentType =
  'STOCK_RECEIPT' | 'STOCK_ISSUE' | 'STOCK_TRANSFER' | 'STOCK_COUNT';

export type StockDocumentAction =
  'CREATE' | 'UPDATE' | 'CANCEL' | 'SUBMIT' | 'CONFIRM' | 'REJECT';

type DocumentRow = {
  id: string;
  farmId: string;
  createdByMemberId: string | null;
};

const COMMON_FIELDS = ['status', 'rejectionReason', 'createdByMemberId'];
const DOCUMENT_FIELDS: Record<StockDocumentType, string[]> = {
  STOCK_RECEIPT: [
    'receiptCode',
    'warehouseId',
    'supplierId',
    'receiptDate',
    'note',
  ],
  STOCK_ISSUE: [
    'issueCode',
    'warehouseId',
    'issueType',
    'maintenanceRecordId',
    'reason',
    'note',
  ],
  STOCK_TRANSFER: [
    'transferCode',
    'fromWarehouseId',
    'toWarehouseId',
    'transferDate',
    'note',
  ],
  STOCK_COUNT: ['countCode', 'warehouseId', 'note'],
};
const LINE_FIELDS = [
  'itemId',
  'quantity',
  'systemQuantity',
  'actualQuantity',
  'unitPrice',
  'lotId',
  'lotNumber',
  'assetId',
  'assetCode',
];

function pick(source: object, keys: string[]) {
  const values = source as Record<string, unknown>;
  return Object.fromEntries(
    keys
      .filter((key) => values[key] !== undefined && values[key] !== null)
      .map((key) => [key, values[key]]),
  );
}

function snapshot(type: StockDocumentType, row: object, lines?: object[]) {
  return {
    ...pick(row, [...DOCUMENT_FIELDS[type], ...COMMON_FIELDS]),
    ...(lines ? { items: lines.map((line) => pick(line, LINE_FIELDS)) } : {}),
  };
}

/**
 * Written inside the document transaction after the row is locked, so `before` is
 * the state this operation changed. Every snapshot carries `createdByMemberId`:
 * employees may only read the history of documents they created.
 */
export async function auditStockDocument<Row extends DocumentRow>(
  tx: Transaction,
  actorMemberId: string,
  type: StockDocumentType,
  action: StockDocumentAction,
  before: Row | null,
  after: Row,
  lines: { before?: object[]; after?: object[] } = {},
) {
  await tx.insert(auditLogs).values({
    farmId: after.farmId,
    userId: sql`(SELECT user_id FROM farm_members WHERE id = ${actorMemberId})`,
    action,
    entityType: type,
    entityId: after.id,
    oldData: before && snapshot(type, before, lines.before),
    newData: {
      createdByMemberId: after.createdByMemberId,
      ...snapshot(type, after, lines.after),
    },
  });
}

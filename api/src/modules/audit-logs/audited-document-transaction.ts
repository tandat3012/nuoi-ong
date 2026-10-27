import { eq, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { auditLogs, users } from '../../db/schema';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
const documents = {
  STOCK_RECEIPT: {
    table: 'stock_receipts',
    lines: 'stock_receipt_items',
    foreignKey: 'stock_receipt_id',
  },
  STOCK_ISSUE: {
    table: 'stock_issues',
    lines: 'stock_issue_items',
    foreignKey: 'stock_issue_id',
  },
  STOCK_COUNT: {
    table: 'stock_counts',
    lines: 'stock_count_items',
    foreignKey: 'stock_count_id',
  },
  STOCK_TRANSFER: {
    table: 'stock_transfers',
    lines: 'stock_transfer_items',
    foreignKey: 'stock_transfer_id',
  },
} as const;
type AuditOperation = {
  farmId: string;
  clerkUserId: string;
  entityType: keyof typeof documents;
  action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'SUBMIT' | 'CONFIRM' | 'REJECT';
  entityId?: string;
};

async function snapshot(
  tx: Transaction,
  metadata: AuditOperation,
  id: string,
  lock = false,
) {
  const config = documents[metadata.entityType];
  const result = await tx.execute<{ document: Record<string, unknown> }>(sql`
    select to_jsonb(document) as document from ${sql.identifier(config.table)} as document
    where document.id = ${id}::uuid and document.farm_id = ${metadata.farmId}::uuid
    ${lock ? sql`for update` : sql``}
  `);
  const document = result.rows[0]?.document;
  if (!document) return null;
  const lines = await tx.execute<{ line: Record<string, unknown> }>(sql`
    select to_jsonb(line) || jsonb_build_object('item_name', item.name, 'item_code', item.code) as line
    from ${sql.identifier(config.lines)} as line
    left join items as item on item.id = line.item_id and item.farm_id = ${metadata.farmId}::uuid
    where ${sql.identifier(config.foreignKey)} = ${id}::uuid order by line.id
  `);
  return { ...document, items: lines.rows.map((row) => row.line) };
}

// The business operation and its snapshots commit together; failures roll back both.
export function auditedDocumentTransaction<T>(
  db: Db,
  metadata: AuditOperation,
  operation: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const before = metadata.entityId
      ? await snapshot(tx, metadata, metadata.entityId, true)
      : null;
    const result = await operation(tx);
    const entityId =
      metadata.entityId ?? (typeof result === 'string' ? result : undefined);
    if (!entityId)
      throw new Error('Audited document operation must return its ID');
    const after = await snapshot(tx, metadata, entityId);
    if (!after)
      throw new Error('Audited document was not found after mutation');
    // An idempotent confirmation must not create a second audit record.
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authProviderUserId, metadata.clerkUserId))
        .limit(1);
      await tx.insert(auditLogs).values({
        farmId: metadata.farmId,
        userId: actor?.id ?? null,
        action: metadata.action,
        entityType: metadata.entityType,
        entityId,
        oldData: before,
        newData: after,
      });
    }
    return result;
  });
}

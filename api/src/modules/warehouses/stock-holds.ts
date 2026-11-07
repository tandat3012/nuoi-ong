import { ConflictException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  stockIssueItems,
  stockIssues,
  stockTransferItems,
  stockTransfers,
  storeOrderReplenishments,
  storeOrders,
  storeWarrantyRequests,
} from '../../db/schema';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

const OPEN = sql`('DRAFT', 'PENDING_APPROVAL')`;

/** An open issue promised to a customer: a store order's SALE issue or a warranty exchange issue. */
const customerIssue = sql`(EXISTS (SELECT 1 FROM ${storeOrders} WHERE ${storeOrders.stockIssueId} = ${stockIssues.id})
  OR EXISTS (SELECT 1 FROM ${storeWarrantyRequests} WHERE ${storeWarrantyRequests.exchangeIssueId} = ${stockIssues.id}))`;

/**
 * Call right after a stock-out has debited (and so row-locked) `balanceId`:
 * what remains must still cover the quantity held for customers by other
 * documents, otherwise a confirmed order would lose its stock. Manual drafts
 * hold nothing, so two of them cannot block each other. `excluding` is the
 * document being confirmed, which uses its own hold.
 */
export async function assertHoldsStillCovered(
  tx: Transaction,
  balanceId: string,
  excluding: {
    issueId?: string;
    transferId?: string;
    assetId?: string | null;
    /** Editing a hold: its own lines count as held, but not against its own asset. */
    ownIssueId?: string;
  },
) {
  const issueId = excluding.issueId ?? null;
  const transferId = excluding.transferId ?? null;
  const heldIssues = sql`COALESCE((
    SELECT SUM(${stockIssueItems.quantity}) FROM ${stockIssueItems}
    JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
    WHERE ${stockIssues.warehouseId} = ${inventoryBalances.warehouseId}
      AND ${stockIssues.status} IN ${OPEN}
      AND ${stockIssues.id} IS DISTINCT FROM ${issueId}::uuid
      AND ${stockIssueItems.itemId} = ${inventoryBalances.itemId}
      AND ${stockIssueItems.lotId} IS NOT DISTINCT FROM ${inventoryBalances.lotId}
      AND ${customerIssue}), 0)`;
  // Legacy PREPARING orders still hold stock through their replenishment transfers.
  const heldTransfers = sql`COALESCE((
    SELECT SUM(${stockTransferItems.quantity}) FROM ${stockTransferItems}
    JOIN ${stockTransfers} ON ${stockTransfers.id} = ${stockTransferItems.stockTransferId}
    WHERE ${stockTransfers.fromWarehouseId} = ${inventoryBalances.warehouseId}
      AND ${stockTransfers.status} IN ${OPEN}
      AND ${stockTransfers.id} IS DISTINCT FROM ${transferId}::uuid
      AND ${stockTransferItems.itemId} = ${inventoryBalances.itemId}
      AND ${stockTransferItems.lotId} IS NOT DISTINCT FROM ${inventoryBalances.lotId}
      AND EXISTS (SELECT 1 FROM ${storeOrderReplenishments}
        WHERE ${storeOrderReplenishments.stockTransferId} = ${stockTransfers.id})), 0)`;
  const [row] = await tx
    .select({
      covered: sql<boolean>`${inventoryBalances.quantityOnHand} >= ${heldIssues} + ${heldTransfers}`,
    })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.id, balanceId));
  if (!row?.covered)
    throw new ConflictException(
      'Insufficient available inventory: the stock is held for customer orders',
    );
  if (!excluding.assetId) return;
  const [heldAsset] = await tx
    .select({ id: stockIssueItems.id })
    .from(stockIssueItems)
    .innerJoin(stockIssues, eq(stockIssues.id, stockIssueItems.stockIssueId))
    .where(
      sql`${stockIssueItems.assetId} = ${excluding.assetId}
        AND ${stockIssues.status} IN ${OPEN}
        AND ${stockIssues.id} IS DISTINCT FROM ${excluding.ownIssueId ?? issueId}::uuid
        AND ${customerIssue}`,
    )
    .limit(1);
  if (heldAsset)
    throw new ConflictException('ASSET is held for a customer order');
}

import { inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { WarehouseScope } from '../warehouses/warehouse-scope';

/**
 * The warehouse an asset belongs to: its current location's warehouse, else the
 * warehouse of its latest stock move (handed out to a field location or out for repair).
 */
// Column names are written out: drizzle renders a column of a single-table query unqualified, which a subquery would rebind.
export const assetWarehouseId = sql<string | null>`COALESCE(
  (SELECT l.warehouse_id FROM locations l WHERE l.id = assets.current_location_id),
  (SELECT t.warehouse_id FROM inventory_transactions t
    WHERE t.asset_id = assets.id
    ORDER BY t.created_at DESC, t.id DESC LIMIT 1)
)`;

/** WHERE condition: the asset id in `column` belongs to a warehouse in scope; undefined = no limit. */
export function assetInScope(
  column: AnyPgColumn | SQL,
  scope: WarehouseScope,
): SQL | undefined {
  if (scope === null) return undefined;
  if (!scope.length) return sql`false`;
  return sql`${column} IN (SELECT assets.id FROM assets WHERE ${inArray(assetWarehouseId, scope)})`;
}

/**
 * Assets a scoped member may read: in their warehouses, or on their way to one
 * (P1-02: the destination opens and scans what it is about to receive).
 */
export function assetReadableInScope(scope: string[]): SQL {
  return sql`(${inArray(assetWarehouseId, scope)} OR EXISTS (SELECT 1 FROM asset_transfer_requests r WHERE r.asset_id = assets.id AND r.status = 'IN_TRANSIT' AND ${inArray(sql`r.to_warehouse_id`, scope)}))`;
}

import { sql } from 'drizzle-orm';
import { maintenanceRecords } from '../../db/schema';

export const activeMaintenanceCondition = sql`(
  (${maintenanceRecords.completedAt} IS NULL AND ${maintenanceRecords.status} <> 'CANCELLED')
  OR (${maintenanceRecords.receivedAt} IS NOT NULL AND ${maintenanceRecords.returnStatus} IS DISTINCT FROM 'CONFIRMED')
  -- NV04: a passed repair back in stock is still open until the owner decides on reuse.
  OR (${maintenanceRecords.status} = 'COMPLETED' AND ${maintenanceRecords.returnStatus} = 'CONFIRMED'
    AND ${maintenanceRecords.finalDecision} IS NULL
    AND EXISTS (SELECT 1 FROM assets pending_asset
      WHERE pending_asset.id = ${maintenanceRecords.assetId} AND pending_asset.status = 'MAINTENANCE'))
)`;

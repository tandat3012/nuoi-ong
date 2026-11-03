import { sql } from 'drizzle-orm';
import { maintenanceRecords } from '../../db/schema';

export const activeMaintenanceCondition = sql`(
  (${maintenanceRecords.completedAt} IS NULL AND ${maintenanceRecords.status} <> 'CANCELLED')
  OR (${maintenanceRecords.receivedAt} IS NOT NULL AND ${maintenanceRecords.returnStatus} IS DISTINCT FROM 'CONFIRMED')
)`;

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import {
  assetTransferRequests,
  devicePushTokens,
  farms,
  farmMembers,
  farmMemberRoles,
  notifications,
  notificationPushOutbox,
  roles,
  stockCounts,
  stockIssues,
  stockReceipts,
  stockTransfers,
  maintenanceRequests,
  maintenanceRecords,
  users,
} from '../../db/schema';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

export const PUSH_CATCH_UP_LIMIT = 5;

// Shared by device binding changes and event fan-out. Lock before touching device
// rows, in UUID order, so registration cannot miss an event in both directions.
export async function lockPushUsers(tx: Transaction, userIds: string[]) {
  for (const userId of [...new Set(userIds)].sort()) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'notification-push:user:' + userId}, 0))`,
    );
  }
}

const documents = [
  { type: 'STOCK_RECEIPT', table: stockReceipts },
  { type: 'STOCK_ISSUE', table: stockIssues },
  { type: 'STOCK_TRANSFER', table: stockTransfers },
  { type: 'STOCK_COUNT', table: stockCounts },
] as const;

const requests = [
  { type: 'MAINTENANCE_REQUEST', table: maintenanceRequests },
  { type: 'ASSET_TRANSFER_REQUEST', table: assetTransferRequests },
] as const;

// Correlated to `notifications`. Never infer authorization from a route supplied
// by a client, or from the title/body/JSON payload of an old notification.
export function documentPushEligibility() {
  const isApprover = sql`EXISTS (
    SELECT 1 FROM ${farmMembers} AS push_member
    JOIN ${farmMemberRoles} AS push_link ON push_link.farm_member_id = push_member.id
    JOIN ${roles} AS push_role ON push_role.id = push_link.role_id
    WHERE push_member.user_id = ${notifications.userId}
      AND push_member.farm_id = ${notifications.farmId}
      AND push_member.status = 'ACTIVE'
      AND push_role.code IN (${sql.join(
        WAREHOUSE_MANAGE_ROLES.map((code) => sql`${code}`),
        sql`, `,
      )})
  )`;
  const documentConditions = documents.map(
    ({ type, table }) => sql`(
    ${notifications.entityType} = ${type} AND EXISTS (
      SELECT 1 FROM ${table} AS push_document
      WHERE push_document.id = ${notifications.entityId}
        AND push_document.farm_id = ${notifications.farmId}
        AND (
          (${notifications.type} = ${type + '_PENDING_APPROVAL'}
            AND push_document.status = 'PENDING_APPROVAL' AND ${isApprover})
          -- Dispatched transfers wait for the destination to count them in.
          OR (${notifications.type} = ${type + '_IN_TRANSIT'}
            AND push_document.status::text = 'IN_TRANSIT' AND ${isApprover})
          OR (
            ((${notifications.type} = ${type + '_CONFIRMED'} AND push_document.status = 'CONFIRMED')
              OR (${notifications.type} = ${type + '_REJECTED'} AND push_document.status = 'REJECTED'))
            AND EXISTS (
              SELECT 1 FROM ${farmMembers} AS push_creator
              WHERE push_creator.id = push_document.created_by_member_id
                AND push_creator.user_id = ${notifications.userId}
                AND push_creator.farm_id = ${notifications.farmId}
                AND push_creator.status = 'ACTIVE'
            )
          )
        )
    )
  )`,
  );
  // Requests carry the requester instead of a document creator.
  const requestConditions = requests.map(
    ({ type, table }) => sql`(
    ${notifications.entityType} = ${type} AND EXISTS (
      SELECT 1 FROM ${table} AS push_request
      WHERE push_request.id = ${notifications.entityId}
        AND push_request.farm_id = ${notifications.farmId}
        AND (
          (${notifications.type} = ${type + '_PENDING_APPROVAL'}
            AND push_request.status = 'PENDING_APPROVAL' AND ${isApprover})
          OR (
            ((${notifications.type} = ${type + '_CONFIRMED'} AND push_request.status = 'CONFIRMED')
              OR (${notifications.type} = ${type + '_REJECTED'} AND push_request.status = 'REJECTED'))
            AND EXISTS (
              SELECT 1 FROM ${farmMembers} AS push_creator
              WHERE push_creator.id = push_request.requested_by_member_id
                AND push_creator.user_id = ${notifications.userId}
                AND push_creator.farm_id = ${notifications.farmId}
                AND push_creator.status = 'ACTIVE'
            )
          )
        )
    )
  )`,
  );
  const maintenanceMember = sql`EXISTS (SELECT 1 FROM farm_members mm JOIN farm_member_roles mr ON mr.farm_member_id=mm.id JOIN roles rr ON rr.id=mr.role_id WHERE mm.user_id=${notifications.userId} AND mm.farm_id=${notifications.farmId} AND mm.status='ACTIVE' AND rr.code IN ('ADMIN','FARM_OWNER','WAREHOUSE_MANAGER','MAINTENANCE_STAFF'))`;
  const maintenanceCondition = sql`(${maintenanceMember} AND (
    (${notifications.entityType} = 'MAINTENANCE_RETURN' AND EXISTS (
      SELECT 1 FROM ${maintenanceRecords} m WHERE m.id=${notifications.entityId} AND m.farm_id=${notifications.farmId}
      AND ((m.return_status='PENDING_APPROVAL' AND ${notifications.type}='MAINTENANCE_RETURN_PENDING_APPROVAL' AND ${isApprover})
      OR (m.return_status::text IN ('CONFIRMED','REJECTED') AND ${notifications.type}='MAINTENANCE_RETURN_' || m.return_status::text AND EXISTS (SELECT 1 FROM farm_members c WHERE c.id=m.return_created_by_member_id AND c.user_id=${notifications.userId} AND c.status='ACTIVE')))))
    OR (${notifications.entityType} = 'MAINTENANCE_RECORD' AND EXISTS (
      SELECT 1 FROM maintenance_records m JOIN assets a ON a.id=m.asset_id WHERE m.id=${notifications.entityId} AND m.farm_id=${notifications.farmId}
      AND ${notifications.data}->>'milestone' = CASE WHEN m.status='SCHEDULED' THEN m.scheduled_at::text WHEN m.status='IN_PROGRESS' THEN m.expected_return_at::text ELSE NULL END
      AND ((${notifications.type}='MAINTENANCE_RECORD_UPCOMING' AND m.status='SCHEDULED' AND (m.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
       OR (${notifications.type}='MAINTENANCE_RECORD_DUE' AND m.status='SCHEDULED' AND (m.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
       OR (${notifications.type}='MAINTENANCE_RECORD_OVERDUE' AND m.status='SCHEDULED' AND (m.scheduled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
       OR (${notifications.type}='MAINTENANCE_RECORD_RETURN_OVERDUE' AND m.status='IN_PROGRESS' AND (m.expected_return_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
    ))
    OR (${notifications.entityType}='MAINTENANCE_ASSET' AND EXISTS (SELECT 1 FROM assets a WHERE a.id=${notifications.entityId} AND a.farm_id=${notifications.farmId} AND a.status NOT IN ('LOST','RETIRED','MAINTENANCE') AND a.next_maintenance_date::text=${notifications.data}->>'milestone' AND ((${notifications.type}='MAINTENANCE_ASSET_UPCOMING' AND a.next_maintenance_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) OR (${notifications.type}='MAINTENANCE_ASSET_DUE' AND a.next_maintenance_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) OR (${notifications.type}='MAINTENANCE_ASSET_OVERDUE' AND a.next_maintenance_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) AND NOT EXISTS (SELECT 1 FROM maintenance_records m WHERE m.asset_id=a.id AND ((m.completed_at IS NULL AND m.status<>'CANCELLED') OR (m.received_at IS NOT NULL AND m.return_status IS DISTINCT FROM 'CONFIRMED')))))
  ))`;
  return sql`(
    EXISTS (SELECT 1 FROM ${users} AS push_user
      WHERE push_user.id = ${notifications.userId} AND push_user.status = 'ACTIVE')
    AND EXISTS (SELECT 1 FROM ${farms} AS push_farm
      WHERE push_farm.id = ${notifications.farmId} AND push_farm.status = 'ACTIVE')
    AND (${sql.join([...documentConditions, ...requestConditions, maintenanceCondition], sql` OR `)})
  )`;
}

async function insertJobs(
  tx: Transaction,
  pairs: { notificationId: string; devicePushTokenId: string }[],
) {
  if (!pairs.length) return 0;
  const inserted = await tx
    .insert(notificationPushOutbox)
    .values(pairs)
    .onConflictDoNothing({
      target: [
        notificationPushOutbox.notificationId,
        notificationPushOutbox.devicePushTokenId,
      ],
    })
    .returning({ id: notificationPushOutbox.id });
  return inserted.length;
}

export async function enqueueDocumentPushes(
  tx: Transaction,
  notificationIds: string[],
) {
  if (!notificationIds.length) return 0;
  const recipients = await tx
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(inArray(notifications.id, notificationIds));
  await lockPushUsers(
    tx,
    recipients.map(({ userId }) => userId),
  );
  const pairs = await tx
    .select({
      notificationId: notifications.id,
      devicePushTokenId: devicePushTokens.id,
    })
    .from(notifications)
    .innerJoin(
      devicePushTokens,
      eq(devicePushTokens.userId, notifications.userId),
    )
    .where(
      and(
        inArray(notifications.id, notificationIds),
        eq(devicePushTokens.isActive, true),
        isNull(notifications.readAt),
        documentPushEligibility(),
      ),
    );
  return insertJobs(tx, pairs);
}

// Called inside the registration transaction, after the new binding is saved.
// Limit the newest eligible notifications BEFORE ON CONFLICT: a token rotation
// must not resurrect cancelled jobs or drain five older messages on every PUT.
export async function enqueueDeviceCatchUp(
  tx: Transaction,
  deviceId: string,
  userId: string,
) {
  await lockPushUsers(tx, [userId]);
  const pairs = await tx
    .select({
      notificationId: notifications.id,
      devicePushTokenId: devicePushTokens.id,
    })
    .from(notifications)
    .innerJoin(
      devicePushTokens,
      eq(devicePushTokens.userId, notifications.userId),
    )
    .where(
      and(
        eq(devicePushTokens.id, deviceId),
        eq(devicePushTokens.userId, userId),
        eq(devicePushTokens.isActive, true),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        // Registration may have waited for an event's user lock. Its transaction
        // start (now()) can predate that newly committed notification.
        sql`${notifications.createdAt} >= statement_timestamp() - interval '24 hours'`,
        sql`${notifications.createdAt} <= statement_timestamp()`,
        documentPushEligibility(),
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(PUSH_CATCH_UP_LIMIT);
  return insertJobs(tx, pairs);
}

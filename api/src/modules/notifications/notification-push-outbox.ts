import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import {
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
  users,
} from '../../db/schema';

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
      AND push_role.code IN ('ADMIN', 'FARM_OWNER')
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
  const maintenanceRequestCondition = sql`(
    ${notifications.entityType} = 'MAINTENANCE_REQUEST' AND EXISTS (
      SELECT 1 FROM ${maintenanceRequests} AS push_request
      WHERE push_request.id = ${notifications.entityId}
        AND push_request.farm_id = ${notifications.farmId}
        AND (
          (${notifications.type} = 'MAINTENANCE_REQUEST_PENDING_APPROVAL'
            AND push_request.status = 'PENDING_APPROVAL' AND ${isApprover})
          OR (
            ((${notifications.type} = 'MAINTENANCE_REQUEST_CONFIRMED' AND push_request.status = 'CONFIRMED')
              OR (${notifications.type} = 'MAINTENANCE_REQUEST_REJECTED' AND push_request.status = 'REJECTED'))
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
  )`;
  return sql`(
    EXISTS (SELECT 1 FROM ${users} AS push_user
      WHERE push_user.id = ${notifications.userId} AND push_user.status = 'ACTIVE')
    AND EXISTS (SELECT 1 FROM ${farms} AS push_farm
      WHERE push_farm.id = ${notifications.farmId} AND push_farm.status = 'ACTIVE')
    AND (${sql.join([...documentConditions, maintenanceRequestCondition], sql` OR `)})
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

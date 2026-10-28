import { and, eq, inArray, ne } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { enqueueDocumentPushes } from './notification-push-outbox';
import {
  farmMemberRoles as farmMemberRoleLink,
  farmMembers,
  notifications,
  roles,
  users,
} from '../../db/schema';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

type DocumentNotification = {
  farmId: string;
  entityType: string;
  entityId: string;
  documentCode: string;
  documentKind: string;
  status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED';
  rejectionReason?: string;
};

async function insertForUsers(
  tx: Transaction,
  userIds: string[],
  notification: DocumentNotification,
) {
  const distinctUserIds = [...new Set(userIds)];
  if (!distinctUserIds.length) return;

  const labels = {
    PENDING_APPROVAL: {
      type: `${notification.entityType}_PENDING_APPROVAL`,
      title: 'Phiếu cần duyệt',
      body: `${notification.documentKind} ${notification.documentCode} đang chờ duyệt.`,
    },
    CONFIRMED: {
      type: `${notification.entityType}_CONFIRMED`,
      title: 'Phiếu đã được duyệt',
      body: `${notification.documentKind} ${notification.documentCode} đã được duyệt.`,
    },
    REJECTED: {
      type: `${notification.entityType}_REJECTED`,
      title: 'Phiếu bị từ chối',
      body: `${notification.documentKind} ${notification.documentCode} bị từ chối${notification.rejectionReason ? `: ${notification.rejectionReason}` : '.'}`,
    },
  }[notification.status];

  const inserted = await tx
    .insert(notifications)
    .values(
      distinctUserIds.map((userId) => ({
        userId,
        farmId: notification.farmId,
        type: labels.type,
        title: labels.title,
        body: labels.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        data: {
          documentType: notification.entityType,
          documentId: notification.entityId,
          documentCode: notification.documentCode,
          status: notification.status,
          rejectionReason: notification.rejectionReason ?? null,
        },
      })),
    )
    .returning({ id: notifications.id });
  await enqueueDocumentPushes(
    tx,
    inserted.map(({ id }) => id),
  );
}

export async function notifyFarmApprovers(
  tx: Transaction,
  notification: DocumentNotification,
  submittedByMemberId: string,
) {
  const recipients = await tx
    .select({ userId: farmMembers.userId })
    .from(farmMembers)
    .innerJoin(users, eq(users.id, farmMembers.userId))
    .innerJoin(
      farmMemberRoleLink,
      eq(farmMemberRoleLink.farmMemberId, farmMembers.id),
    )
    .innerJoin(roles, eq(roles.id, farmMemberRoleLink.roleId))
    .where(
      and(
        eq(farmMembers.farmId, notification.farmId),
        eq(farmMembers.status, 'ACTIVE'),
        eq(users.status, 'ACTIVE'),
        inArray(roles.code, ['ADMIN', 'FARM_OWNER']),
        ne(farmMembers.id, submittedByMemberId),
      ),
    );
  await insertForUsers(
    tx,
    recipients.map(({ userId }) => userId),
    notification,
  );
}

export async function notifyDocumentCreator(
  tx: Transaction,
  notification: DocumentNotification,
  createdByMemberId: string | null,
) {
  if (!createdByMemberId) return;
  const recipients = await tx
    .select({ userId: farmMembers.userId })
    .from(farmMembers)
    .innerJoin(users, eq(users.id, farmMembers.userId))
    .where(
      and(
        eq(farmMembers.id, createdByMemberId),
        eq(farmMembers.farmId, notification.farmId),
        eq(farmMembers.status, 'ACTIVE'),
        eq(users.status, 'ACTIVE'),
      ),
    )
    .limit(1);
  await insertForUsers(
    tx,
    recipients.map(({ userId }) => userId),
    notification,
  );
}

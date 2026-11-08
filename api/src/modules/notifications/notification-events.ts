import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { enqueueDocumentPushes } from './notification-push-outbox';
import {
  farmMemberRoles as farmMemberRoleLink,
  farmMembers,
  notifications,
  roles,
  users,
} from '../../db/schema';
import {
  FARM_ADMIN_ROLES,
  MAINTENANCE_WORK_ROLES,
  WAREHOUSE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

type DocumentNotification = {
  farmId: string;
  entityType: string;
  entityId: string;
  documentCode: string | null;
  documentKind: string;
  status:
    | 'PENDING_APPROVAL'
    | 'IN_TRANSIT'
    | 'SCHEDULED'
    | 'READY_TO_SEND'
    | 'IN_PROGRESS'
    | 'CONFIRMED'
    | 'REJECTED';
  rejectionReason?: string;
  /** Overrides the default stock-document title ("Phiếu …"). */
  title?: string;
};

export const NOTIFICATION_DOCUMENT_PREFIXES: Record<string, string> = {
  STOCK_RECEIPT: 'PN',
  STOCK_ISSUE: 'PX',
  STOCK_COUNT: 'KK',
  STOCK_TRANSFER: 'CK',
  MAINTENANCE_REQUEST: 'MNT',
  ASSET_TRANSFER_REQUEST: 'ATR',
  MAINTENANCE_RETURN: 'BT',
  MAINTENANCE_RECORD: 'BT',
};

export const NOTIFICATION_DOCUMENT_KINDS: Record<string, string> = {
  STOCK_RECEIPT: 'Phiếu nhập kho',
  STOCK_ISSUE: 'Phiếu xuất kho',
  STOCK_COUNT: 'Phiếu kiểm kê kho',
  STOCK_TRANSFER: 'Phiếu chuyển kho',
  MAINTENANCE_REQUEST: 'Yêu cầu bảo trì tài sản',
  ASSET_TRANSFER_REQUEST: 'Yêu cầu chuyển tài sản',
  MAINTENANCE_RETURN: 'Phiếu nhập lại bảo trì',
  MAINTENANCE_RECORD: 'Hồ sơ bảo trì',
};

export function formatNotificationDocumentCode(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  documentCode?: string | null,
): string {
  if (entityId) {
    const shortId = entityId.slice(0, 8);
    const prefix = entityType ? NOTIFICATION_DOCUMENT_PREFIXES[entityType] : undefined;
    return prefix ? `${prefix}-${shortId}` : `#${shortId}`;
  }
  return documentCode?.trim() ?? '';
}

export function formatNotificationBody(
  documentKind: string,
  code: string,
  status: string | null | undefined,
  rejectionReason?: string | null,
): string | null {
  switch (status) {
    case 'PENDING_APPROVAL':
      return `${documentKind} ${code} đang chờ duyệt.`;
    case 'IN_TRANSIT':
      return `${documentKind} ${code} đã xuất, chờ kho nhận xác nhận số thực nhận.`;
    case 'SCHEDULED':
      return `${documentKind} ${code} đã được lên lịch, chờ chọn đơn vị và ngày hẹn trả.`;
    case 'READY_TO_SEND':
      return `${documentKind} ${code} đã có đơn vị sửa và ngày hẹn trả, chờ kho xác nhận xuất.`;
    case 'IN_PROGRESS':
      return `${documentKind} ${code} đã được kho xác nhận xuất đi sửa, chờ nhận lại thiết bị.`;
    case 'CONFIRMED':
      return `${documentKind} ${code} đã được duyệt.`;
    case 'REJECTED':
      return `${documentKind} ${code} bị từ chối${rejectionReason ? `: ${rejectionReason}` : '.'}`;
    default:
      return null;
  }
}

async function insertForUsers(
  tx: Transaction,
  userIds: string[],
  notification: DocumentNotification,
) {
  const distinctUserIds = [...new Set(userIds)];
  if (!distinctUserIds.length) return;
  const code = formatNotificationDocumentCode(
    notification.entityType,
    notification.entityId,
    notification.documentCode,
  );

  const labels = {
    PENDING_APPROVAL: {
      type: `${notification.entityType}_PENDING_APPROVAL`,
      title: 'Phiếu cần duyệt',
      body: `${notification.documentKind} ${code} đang chờ duyệt.`,
    },
    IN_TRANSIT: {
      type: `${notification.entityType}_IN_TRANSIT`,
      title: 'Hàng đang chuyển đến kho',
      body: `${notification.documentKind} ${code} đã xuất, chờ kho nhận xác nhận số thực nhận.`,
    },
    SCHEDULED: {
      type: `${notification.entityType}_SCHEDULED`,
      title: 'Lịch bảo trì mới',
      body: `${notification.documentKind} ${code} đã được lên lịch, chờ chọn đơn vị và ngày hẹn trả.`,
    },
    READY_TO_SEND: {
      type: `${notification.entityType}_READY_TO_SEND`,
      title: 'Thiết bị chờ xuất đi sửa',
      body: `${notification.documentKind} ${code} đã có đơn vị sửa và ngày hẹn trả, chờ kho xác nhận xuất.`,
    },
    IN_PROGRESS: {
      type: `${notification.entityType}_IN_PROGRESS`,
      title: 'Kho đã xuất thiết bị đi sửa',
      body: `${notification.documentKind} ${code} đã được kho xác nhận xuất đi sửa, chờ nhận lại thiết bị.`,
    },
    CONFIRMED: {
      type: `${notification.entityType}_CONFIRMED`,
      title: 'Phiếu đã được duyệt',
      body: `${notification.documentKind} ${code} đã được duyệt.`,
    },
    REJECTED: {
      type: `${notification.entityType}_REJECTED`,
      title: 'Phiếu bị từ chối',
      body: `${notification.documentKind} ${code} bị từ chối${notification.rejectionReason ? `: ${notification.rejectionReason}` : '.'}`,
    },
  }[notification.status];

  const inserted = await tx
    .insert(notifications)
    .values(
      distinctUserIds.map((userId) => ({
        userId,
        farmId: notification.farmId,
        type: labels.type,
        title: notification.title ?? labels.title,
        body: labels.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        data: {
          documentType: notification.entityType,
          documentId: notification.entityId,
          documentCode: code,
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

/** Owners and admins always; warehouse managers only when assigned to `warehouseId` (when given). */
export async function notifyFarmApprovers(
  tx: Transaction,
  notification: DocumentNotification,
  submittedByMemberId: string,
  warehouseId?: string | null,
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
        inArray(roles.code, WAREHOUSE_MANAGE_ROLES),
        ne(farmMembers.id, submittedByMemberId),
        warehouseId
          ? or(
              inArray(roles.code, FARM_ADMIN_ROLES),
              sql`EXISTS (SELECT 1 FROM farm_member_warehouses fmw
                WHERE fmw.farm_member_id = farm_members.id
                  AND fmw.warehouse_id = ${warehouseId})`,
            )
          : undefined,
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

export async function notifyMaintenanceStaff(
  tx: Transaction,
  notification: DocumentNotification,
  excludedUserId?: string | null,
  excludedMemberId?: string | null,
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
        inArray(roles.code, MAINTENANCE_WORK_ROLES),
        excludedUserId ? ne(users.id, excludedUserId) : undefined,
        excludedMemberId ? ne(farmMembers.id, excludedMemberId) : undefined,
      ),
    );
  await insertForUsers(
    tx,
    recipients.map(({ userId }) => userId),
    notification,
  );
}

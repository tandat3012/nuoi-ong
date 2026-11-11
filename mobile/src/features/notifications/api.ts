import { apiRequest } from '@/src/shared/api/client';

export type AppNotification = {
  id: string;
  farmId: string | null;
  type: string;
  title: string;
  body: string;
  data: {
    documentType?: string;
    documentId?: string;
    documentCode?: string | null;
    status?: string;
    rejectionReason?: string | null;
  } | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  data: AppNotification[];
  unreadCount: number;
  page: { number: number; size: number; totalItems: number; totalPages: number };
};

const NOTIFICATION_DOCUMENT_PREFIXES: Record<string, string> = {
  STOCK_RECEIPT: 'PN',
  STOCK_ISSUE: 'PX',
  STOCK_COUNT: 'KK',
  STOCK_TRANSFER: 'CK',
  MAINTENANCE_REQUEST: 'MNT',
  ASSET_TRANSFER_REQUEST: 'ATR',
  MAINTENANCE_RETURN: 'BT',
  MAINTENANCE_RECORD: 'BT',
};

const NOTIFICATION_DOCUMENT_KINDS: Record<string, string> = {
  STOCK_RECEIPT: 'Phiếu nhập kho',
  STOCK_ISSUE: 'Phiếu xuất kho',
  STOCK_COUNT: 'Phiếu kiểm kê kho',
  STOCK_TRANSFER: 'Phiếu chuyển kho',
  MAINTENANCE_REQUEST: 'Yêu cầu bảo trì tài sản',
  ASSET_TRANSFER_REQUEST: 'Yêu cầu chuyển tài sản',
  MAINTENANCE_RETURN: 'Phiếu nhập lại bảo trì',
  MAINTENANCE_RECORD: 'Hồ sơ bảo trì',
};

export function notificationDocumentCode(notification: AppNotification): string | null {
  const entityType = notification.data?.documentType ?? notification.entityType;
  const entityId = notification.data?.documentId ?? notification.entityId;
  if (entityId) {
    const shortId = entityId.slice(0, 8);
    const prefix = entityType ? NOTIFICATION_DOCUMENT_PREFIXES[entityType] : undefined;
    return prefix ? `${prefix}-${shortId}` : `#${shortId}`;
  }
  const rawCode = notification.data?.documentCode?.trim() ?? '';
  return rawCode || null;
}

export function notificationBodyText(notification: AppNotification): string {
  const code = notificationDocumentCode(notification);
  if (!code) return notification.body;
  const entityType = notification.data?.documentType ?? notification.entityType;
  const status =
    notification.data?.status ??
    (entityType && notification.type.startsWith(`${entityType}_`)
      ? notification.type.slice(entityType.length + 1)
      : undefined);
  const rejectionReason = notification.data?.rejectionReason;
  const documentKind = entityType
    ? NOTIFICATION_DOCUMENT_KINDS[entityType]
    : undefined;
  if (!documentKind) return notification.body;
  if (entityType === 'MAINTENANCE_REQUEST' && (notification.title.includes('Kết quả bảo trì') || notification.title.includes('quyết định cuối')))
    return notification.body;
  if (entityType === 'MAINTENANCE_REQUEST' && status === 'PENDING_APPROVAL')
    return `${documentKind} ${code} đã được gửi. Mở phiếu để xem tiến độ hiện tại.`;

  switch (status) {
    case 'PENDING_APPROVAL':
      return `${documentKind} ${code} đang chờ duyệt.`;
    case 'IN_TRANSIT':
      return `${documentKind} ${code} đã xuất, chờ kho nhận xác nhận số thực nhận.`;
    case 'DISCREPANCY':
      return `${documentKind} ${code} đã nhận thiếu hoặc có sai lệch, đang chờ quản lý xử lý.`;
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
      return notification.body;
  }
}

export function notificationRoute(notification: AppNotification) {
  const entityType = notification.data?.documentType ?? notification.entityType;
  const entityId = notification.data?.documentId ?? notification.entityId;
  if (!entityId) return null;
  switch (entityType) {
    case 'STOCK_RECEIPT': return `/receipts/${entityId}?type=receipt`;
    case 'STOCK_ISSUE': return `/receipts/${entityId}?type=issue`;
    case 'STOCK_COUNT': return `/counts/${entityId}`;
    case 'STOCK_TRANSFER': return `/transfers/${entityId}`;
    case 'MAINTENANCE_REQUEST': return `/maintenance/requests/${entityId}`;
    case 'MAINTENANCE_RETURN': return `/maintenance/history?recordId=${encodeURIComponent(entityId)}`;
    case 'MAINTENANCE_RECORD': return `/maintenance/history?recordId=${encodeURIComponent(entityId)}`;
    case 'ASSET_TRANSFER_REQUEST': return `/assets/transfer-requests/${entityId}`;
    default: return null;
  }
}

export function listNotifications(
  token: string,
  farmId: string,
  page = 1,
  unreadOnly = false,
) {
  return apiRequest<NotificationPage>('/notifications', {
    token,
    params: { farmId, page, pageSize: 30, unreadOnly: unreadOnly ? 'true' : undefined },
    skipCache: true,
  });
}

export function markNotificationRead(token: string, farmId: string, id: string) {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH', token, params: { farmId },
  });
}

export function markAllNotificationsRead(token: string, farmId: string) {
  return apiRequest('/notifications/read-all', {
    method: 'PATCH', token, params: { farmId },
  });
}

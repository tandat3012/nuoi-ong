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
    documentCode?: string;
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

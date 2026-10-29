import type { ApiRequestOptions } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = PaginatedResponse<Notification> & {
  unreadCount: number;
};

export function getNotifications(
  request: AuthenticatedRequest,
  farmId: string,
  filters: { page: number; unreadOnly: boolean },
) {
  return request<NotificationsResponse>('/notifications', {
    method: 'GET',
    params: { farmId, unreadOnly: filters.unreadOnly, page: filters.page, pageSize: 10 },
  });
}

export function markNotificationRead(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: { id: string }; alreadyRead?: boolean }>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH', params: { farmId } },
  );
}

export function markAllNotificationsRead(request: AuthenticatedRequest, farmId: string) {
  return request<{ updatedCount: number }>('/notifications/read-all', {
    method: 'PATCH',
    params: { farmId },
  });
}

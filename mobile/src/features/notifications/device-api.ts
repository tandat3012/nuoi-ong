import { apiRequest } from '@/src/shared/api/client';

export type NotificationDevice = {
  id: string;
  userId: string;
  installationId: string;
  platform: 'ANDROID' | 'IOS';
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export function registerNotificationDevice(
  token: string,
  installationId: string,
  expoPushToken: string,
  platform: NotificationDevice['platform'],
  signal?: AbortSignal,
) {
  return apiRequest<{ data: NotificationDevice }>(
    `/notifications/devices/${encodeURIComponent(installationId)}`,
    { method: 'PUT', token, body: { expoPushToken, platform }, signal },
  );
}

export function unregisterNotificationDevice(
  token: string,
  installationId: string,
  signal?: AbortSignal,
) {
  return apiRequest<{ data: NotificationDevice }>(
    `/notifications/devices/${encodeURIComponent(installationId)}`,
    { method: 'DELETE', token, signal },
  );
}

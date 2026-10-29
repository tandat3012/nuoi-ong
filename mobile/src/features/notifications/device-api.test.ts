import { describe, expect, it, jest } from '@jest/globals';
import { apiRequest } from '@/src/shared/api/client';
import {
  registerNotificationDevice,
  unregisterNotificationDevice,
} from './device-api';

jest.mock('@/src/shared/api/client', () => ({ apiRequest: jest.fn() }));

describe('notification device API contract', () => {
  it('registers via PUT with only the Expo token and platform in the body', async () => {
    await registerNotificationDevice(
      'jwt',
      'installation-id',
      'ExponentPushToken[test]',
      'ANDROID',
    );
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/notifications/devices/installation-id',
      {
        method: 'PUT',
        token: 'jwt',
        body: { expoPushToken: 'ExponentPushToken[test]', platform: 'ANDROID' },
        signal: undefined,
      },
    );
  });

  it('unregisters only the specified installation with the provided session', async () => {
    await unregisterNotificationDevice('jwt-a', 'installation-id');
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/notifications/devices/installation-id',
      {
        method: 'DELETE',
        token: 'jwt-a',
        signal: undefined,
      },
    );
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPushRegistrationRuntime } from './push-registration-runtime';

const mockStorage = new Map<string, string>();
const mockInstallationId = 'aed4fbdf-4021-427f-8837-d7da03f8a035';
let mockExpoGo = false;
let mockNotificationsLoaded = 0;
const mockUuid = jest.fn(() => mockInstallationId);
const mockChannel = jest.fn(async () => null);
const mockPermissions = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
}));
const mockRequestPermissions = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
}));
const mockNativeToken = jest.fn(async () => ({
  type: 'android',
  data: 'native-test-token',
}));
const mockExpoToken = jest.fn(async (_options: unknown) => ({
  type: 'expo',
  data: 'ExponentPushToken[test]',
}));
const mockRegister = jest.fn(async () => ({
  data: {
    id: 'device-id',
    userId: 'db-a',
    installationId: mockInstallationId,
    platform: 'ANDROID',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    lastSeenAt: '',
  },
}));
const mockUnregister = jest.fn(async () => ({ data: { isActive: false } }));

jest.mock('expo', () => ({ isRunningInExpoGo: () => mockExpoGo }));
jest.mock('expo-modules-core', () => ({ uuid: { v4: () => mockUuid() } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'eas-project-id' } },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStorage.delete(key);
  },
}));
jest.mock('expo-notifications', () => {
  mockNotificationsLoaded += 1;
  return {
    setNotificationChannelAsync: mockChannel,
    AndroidImportance: { HIGH: 4 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    getPermissionsAsync: mockPermissions,
    requestPermissionsAsync: mockRequestPermissions,
    getDevicePushTokenAsync: mockNativeToken,
    getExpoPushTokenAsync: mockExpoToken,
  };
});
jest.mock('./device-api', () => ({
  registerNotificationDevice: (...args: unknown[]) =>
    (mockRegister as (...values: unknown[]) => unknown)(...args),
  unregisterNotificationDevice: (...args: unknown[]) =>
    (mockUnregister as (...values: unknown[]) => unknown)(...args),
}));
jest.mock('@/src/shared/api/client', () => ({
  MobileApiError: class extends Error {
    status = 0;
  },
}));

const account = {
  key: 'clerk-a:session-a',
  clerkUserId: 'clerk-a',
  dbUserId: 'db-a',
  getToken: async () => 'jwt-a',
};

beforeEach(() => {
  // No real network is used; avoid Expo's lazy native fetch getter in this adapter test.
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
  jest.clearAllMocks();
  mockStorage.clear();
  mockExpoGo = false;
  mockNotificationsLoaded = 0;
  mockPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
});

describe('native push registration adapter', () => {
  it('creates one secure installation ID for concurrent callers and reuses it after module reload', async () => {
    const runtime = createPushRegistrationRuntime();
    expect(
      await Promise.all([
        runtime.getPushInstallationId(),
        runtime.getPushInstallationId(),
      ]),
    ).toEqual([mockInstallationId, mockInstallationId]);
    expect(mockUuid).toHaveBeenCalledTimes(1);
    const reloaded = createPushRegistrationRuntime();
    expect(await reloaded.getPushInstallationId()).toBe(mockInstallationId);
    expect(mockUuid).toHaveBeenCalledTimes(1);
  });

  it('never imports the remote notification module or requests permission in Expo Go', async () => {
    mockExpoGo = true;
    const { pushRegistrationManager } = createPushRegistrationRuntime();
    pushRegistrationManager.setSession(account);
    await pushRegistrationManager.sync('automatic');
    expect(pushRegistrationManager.state.status).toBe('unsupported');
    expect(mockNotificationsLoaded).toBe(0);
    expect(mockNativeToken).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('sets the Android channel before native token retrieval and passes the EAS project ID explicitly', async () => {
    const { pushRegistrationManager } = createPushRegistrationRuntime();
    pushRegistrationManager.setSession(account);
    await pushRegistrationManager.sync('automatic');
    expect(mockChannel).toHaveBeenCalledWith(
      'stock-documents',
      expect.objectContaining({ name: 'Phiếu kho', importance: 4 }),
    );
    expect(mockChannel.mock.invocationCallOrder[0]).toBeLessThan(
      mockNativeToken.mock.invocationCallOrder[0],
    );
    expect(mockExpoToken).toHaveBeenCalledWith({
      projectId: 'eas-project-id',
      devicePushToken: { type: 'android', data: 'native-test-token' },
    });
    expect(mockRegister).toHaveBeenCalledWith(
      'jwt-a',
      mockInstallationId,
      'ExponentPushToken[test]',
      'ANDROID',
      expect.any(AbortSignal),
    );
    expect(pushRegistrationManager.state.status).toBe('registered');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('does not repeat the automatic permission prompt after denial, but permits an explicit retry', async () => {
    mockPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    const { pushRegistrationManager } = createPushRegistrationRuntime();
    pushRegistrationManager.setSession(account);
    await pushRegistrationManager.sync('automatic');
    await pushRegistrationManager.sync('automatic');
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockRegister).not.toHaveBeenCalled();
    mockRequestPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    await pushRegistrationManager.sync('manual');
    expect(mockRequestPermissions).toHaveBeenCalledTimes(2);
    expect(pushRegistrationManager.state.status).toBe('registered');
  });

  it('keeps the installation ID but clears the owner binding before logout', async () => {
    const { pushRegistrationManager } = createPushRegistrationRuntime();
    pushRegistrationManager.setSession(account);
    await pushRegistrationManager.sync();
    await pushRegistrationManager.beforeSignOut(
      account.getToken,
      account.clerkUserId,
    );
    expect(mockUnregister).toHaveBeenCalledWith(
      'jwt-a',
      mockInstallationId,
      expect.any(AbortSignal),
    );
    expect(mockStorage.get('nuoi-ong.push.installation-id')).toBe(
      mockInstallationId,
    );
    expect(mockStorage.has('nuoi-ong.push.device-binding')).toBe(false);
    expect(
      [...mockStorage.values()].some(
        (value) =>
          value.includes('jwt-a') || value.includes('ExponentPushToken['),
      ),
    ).toBe(false);
  });
});

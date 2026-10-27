import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { uuid } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { MobileApiError } from '@/src/shared/api/client';
import {
  registerNotificationDevice,
  unregisterNotificationDevice,
} from './device-api';
import {
  PushRegistrationError,
  PushRegistrationManager,
  withPushDeadline,
  type DeviceBinding,
  type NativePushToken,
  type PermissionPrompt,
} from './push-registration-manager';

const INSTALLATION_KEY = 'nuoi-ong.push.installation-id';
const BINDING_KEY = 'nuoi-ong.push.device-binding';
const PERMISSION_ASKED_KEY = 'nuoi-ong.push.permission-asked';
export const STOCK_NOTIFICATION_CHANNEL = 'stock-documents';
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function supportsDevicePush() {
  return (
    (Platform.OS === 'android' || Platform.OS === 'ios') && !isRunningInExpoGo()
  );
}

export function createPushRegistrationRuntime() {
  let installationPromise: Promise<string> | null = null;
  let notificationsPromise: Promise<
    typeof import('expo-notifications')
  > | null = null;

  function loadPushNotifications() {
    // Avoid importing the native push module in Expo Go or web.
    notificationsPromise ??= Promise.resolve()
      .then(
        () =>
          require('expo-notifications') as typeof import('expo-notifications'),
      )
      .catch((error: unknown) => {
        notificationsPromise = null;
        throw error;
      });
    return notificationsPromise;
  }

  async function readPushInstallationId() {
    const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
    return saved && UUID_V4.test(saved) ? saved.toLowerCase() : null;
  }

  function getPushInstallationId() {
    installationPromise ??= (async () => {
      const saved = await readPushInstallationId();
      if (saved) return saved;
      const created = uuid.v4();
      await SecureStore.setItemAsync(INSTALLATION_KEY, created);
      return created;
    })().catch((error: unknown) => {
      installationPromise = null;
      throw error;
    });
    return installationPromise;
  }

  async function readBinding(): Promise<DeviceBinding | null> {
    const saved = await SecureStore.getItemAsync(BINDING_KEY);
    if (!saved) return null;
    try {
      const binding = JSON.parse(saved) as Partial<DeviceBinding>;
      if (
        typeof binding.clerkUserId !== 'string' ||
        typeof binding.installationId !== 'string'
      )
        return null;
      return {
        clerkUserId: binding.clerkUserId,
        installationId: binding.installationId,
        deviceId:
          typeof binding.deviceId === 'string' ? binding.deviceId : null,
        needsUnregister: binding.needsUnregister === true,
      };
    } catch {
      return null;
    }
  }

  async function writeBinding(binding: DeviceBinding) {
    await SecureStore.setItemAsync(BINDING_KEY, JSON.stringify(binding));
  }

  async function permission(prompt: PermissionPrompt) {
    const notifications = await loadPushNotifications();
    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync(
        STOCK_NOTIFICATION_CHANNEL,
        {
          name: 'Phiếu kho',
          importance: notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        },
      );
    }
    let settings = await notifications.getPermissionsAsync();
    const allowed = () =>
      settings.granted ||
      settings.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!allowed() && settings.canAskAgain && prompt !== 'never') {
      const asked = await SecureStore.getItemAsync(PERMISSION_ASKED_KEY);
      if (prompt === 'manual' || !asked) {
        await SecureStore.setItemAsync(PERMISSION_ASKED_KEY, '1');
        settings = await notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }
    }
    return { granted: allowed(), canAskAgain: settings.canAskAgain };
  }

  async function apiWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      return await operation(controller.signal);
    } catch (error: unknown) {
      if (error instanceof MobileApiError) {
        const message =
          error.status === 401
            ? 'Phiên đăng nhập chưa sẵn sàng để đồng bộ thông báo.'
            : error.status === 403
              ? 'Tài khoản chưa được phép đăng ký thông báo.'
              : error.status === 409
                ? 'Đăng ký thiết bị đang xung đột. Hãy thử lại.'
                : 'Chưa kết nối được máy chủ để đồng bộ thông báo.';
        throw new PushRegistrationError(
          message,
          error.status === 0 || error.status === 401 || error.status >= 500,
          error.status,
        );
      }
      throw new PushRegistrationError(
        'Chưa kết nối được máy chủ để đồng bộ thông báo.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  const pushRegistrationManager = new PushRegistrationManager({
    supported: supportsDevicePush(),
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    getInstallationId: getPushInstallationId,
    readInstallationId: readPushInstallationId,
    getPermission: permission,
    async getNativeToken() {
      const notifications = await loadPushNotifications();
      try {
        const token = await withPushDeadline(
          notifications.getDevicePushTokenAsync(),
          15_000,
        );
        if (
          (token.type !== 'android' && token.type !== 'ios') ||
          typeof token.data !== 'string'
        ) {
          throw new Error('Unsupported native token');
        }
        return { type: token.type, data: token.data };
      } catch {
        throw new PushRegistrationError(
          'Chưa lấy được token thông báo. Kiểm tra kết nối và dịch vụ thông báo trên điện thoại.',
        );
      }
    },
    async getExpoToken(devicePushToken: NativePushToken) {
      const projectId: unknown =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId !== 'string' || !projectId)
        throw new PushRegistrationError(
          'Ứng dụng chưa có cấu hình nhận thông báo hợp lệ.',
          false,
        );
      const notifications = await loadPushNotifications();
      try {
        // Pass the listener token through to avoid triggering another native token event.
        const token = await withPushDeadline(
          notifications.getExpoPushTokenAsync({ projectId, devicePushToken }),
          15_000,
        );
        return token.data;
      } catch {
        throw new PushRegistrationError(
          'Chưa kết nối được dịch vụ đăng ký thông báo. Hãy thử lại.',
        );
      }
    },
    readBinding,
    writeBinding,
    async clearBinding(clerkUserId: string) {
      if ((await readBinding())?.clerkUserId === clerkUserId)
        await SecureStore.deleteItemAsync(BINDING_KEY);
    },
    async register(jwt, installationId, expoToken, platform) {
      return (
        await apiWithTimeout((signal) =>
          registerNotificationDevice(
            jwt,
            installationId,
            expoToken,
            platform,
            signal,
          ),
        )
      ).data;
    },
    async unregister(jwt, installationId) {
      await apiWithTimeout((signal) =>
        unregisterNotificationDevice(jwt, installationId, signal),
      );
    },
  });

  return {
    pushRegistrationManager,
    loadPushNotifications,
    readPushInstallationId,
    getPushInstallationId,
  };
}

export const {
  pushRegistrationManager,
  loadPushNotifications,
  readPushInstallationId,
  getPushInstallationId,
} = createPushRegistrationRuntime();

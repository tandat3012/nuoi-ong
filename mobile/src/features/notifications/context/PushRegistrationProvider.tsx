import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { markNotificationRead } from '../api';
import { resolvePushResponse, type PushResponsePayload } from '../push-response';
import type { PushRegistrationState } from '../push-registration-manager';
import { foregroundPushBehavior } from '../foreground-push';
import {
  loadPushNotifications,
  pushRegistrationManager,
  supportsDevicePush,
} from '../push-registration-runtime';

type PushRegistrationContextValue = {
  state: PushRegistrationState;
  retry: () => void;
  openSettings: () => void;
};

type PendingPushTap = {
  responseKey: string;
  sessionKey: string;
  payload: PushResponsePayload;
  route: string;
};

function responseKey(response: NotificationResponse) {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

const PushRegistrationContext =
  createContext<PushRegistrationContextValue | null>(null);

export function PushRegistrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const {
    data,
    currentFarmId,
    isLoading: authDataLoading,
    error: authDataError,
    getAccessToken,
    selectFarm,
  } = useAuthContext();
  const [state, setState] = useState(pushRegistrationManager.state);
  const [responseRevision, setResponseRevision] = useState(0);
  const [pendingTap, setPendingTap] = useState<PendingPushTap | null>(null);
  const retries = useRef(0);
  const responseQueue = useRef<NotificationResponse[]>([]);
  const seenResponseKeys = useRef(new Set<string>());
  const activeTapKey = useRef<string | null>(null);
  const navigationInFlight = useRef<string | null>(null);
  const audience = useRef<{ userId: string | null; farmIds: string[] }>({
    userId: null,
    farmIds: [],
  });
  audience.current =
    isSignedIn && data?.user.clerkUserId === userId
      ? {
          userId: data.user.id,
          farmIds: data.memberships.map(({ farm }) => farm.id),
        }
      : { userId: null, farmIds: [] };

  function enqueueResponse(response: NotificationResponse) {
    const key = responseKey(response);
    if (seenResponseKeys.current.has(key)) return;
    seenResponseKeys.current.add(key);
    if (seenResponseKeys.current.size > 100) {
      const oldest = seenResponseKeys.current.values().next().value;
      if (oldest) seenResponseKeys.current.delete(oldest);
    }
    responseQueue.current = [...responseQueue.current, response].slice(-10);
    setResponseRevision((revision) => revision + 1);
  }

  function consumeResponse(key: string) {
    responseQueue.current = responseQueue.current.filter(
      (response) => responseKey(response) !== key,
    );
    if (activeTapKey.current === key) activeTapKey.current = null;
    setPendingTap((current) => current?.responseKey === key ? null : current);
    setResponseRevision((revision) => revision + 1);
  }

  useEffect(
    () =>
      pushRegistrationManager.subscribe((next) => {
        setState(next);
        if (__DEV__ && next.status === 'registered')
          console.info('[Push registration]', {
            status: next.status,
            installationId: next.installationId,
            deviceId: next.deviceId,
          });
      }),
    [],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId || !sessionId) {
      retries.current = 0;
      void pushRegistrationManager.sessionEnded();
      return;
    }
    if (!data || data.user.clerkUserId !== userId) {
      pushRegistrationManager.setSession(null);
      return;
    }
    const changed = pushRegistrationManager.setSession({
      key: `${userId}:${sessionId}`,
      clerkUserId: userId,
      dbUserId: data.user.id,
      getToken: () => getToken({ skipCache: true }),
    });
    if (changed) {
      retries.current = 0;
      void pushRegistrationManager.sync('automatic');
    }
  }, [
    data?.user.id,
    data?.user.clerkUserId,
    getToken,
    isLoaded,
    isSignedIn,
    sessionId,
    userId,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        retries.current = 0;
        void pushRegistrationManager.sync('never');
      }
    });
    let disposed = false;
    let removeTokenListener: (() => void) | undefined;
    let clearPresentationHandler: (() => void) | undefined;
    if (supportsDevicePush()) {
      void loadPushNotifications()
        .then((notifications) => {
          if (disposed) return;
          notifications.setNotificationHandler({
            handleNotification: async (notification) =>
              foregroundPushBehavior(
                notification.request.content.data,
                audience.current,
              ),
          });
          clearPresentationHandler = () =>
            notifications.setNotificationHandler(null);
          const listener = notifications.addPushTokenListener((token) => {
            if (
              (token.type === 'android' || token.type === 'ios') &&
              typeof token.data === 'string'
            ) {
              void pushRegistrationManager.sync('never', {
                type: token.type,
                data: token.data,
              });
            }
          });
          removeTokenListener = () => listener.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      disposed = true;
      subscription.remove();
      removeTokenListener?.();
      clearPresentationHandler?.();
      pushRegistrationManager.setSession(null);
    };
  }, []);

  // Listen for taps while running and recover the single response that launched
  // a cold app. The response is held only in memory until Clerk and /auth/me settle.
  useEffect(() => {
    if (!supportsDevicePush()) return;
    let disposed = false;
    let removeResponseListener: (() => void) | undefined;
    void loadPushNotifications().then(async (notifications) => {
      if (disposed) return;
      const listener = notifications.addNotificationResponseReceivedListener(
        enqueueResponse,
      );
      removeResponseListener = () => listener.remove();
      const lastResponse = await notifications.getLastNotificationResponseAsync();
      if (disposed || !lastResponse) return;
      enqueueResponse(lastResponse);
      await notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      disposed = true;
      removeResponseListener?.();
    };
  }, []);

  // Validate the payload against the active Clerk account and /auth/me farm
  // memberships before choosing a fixed, allowlisted route.
  useEffect(() => {
    if (pendingTap || activeTapKey.current) return;
    const response = responseQueue.current[0];
    if (!response || !isLoaded) return;
    const key = responseKey(response);
    if (!isSignedIn || !userId || !sessionId) {
      consumeResponse(key);
      return;
    }
    if (authDataLoading) return;
    if (!data) {
      if (authDataError) {
        Alert.alert('Không thể mở thông báo', 'Chưa tải được tài khoản hiện tại.');
        consumeResponse(key);
      }
      return;
    }

    const resolution = resolvePushResponse(
      response.notification.request.content.data,
      {
        dbUserId: data.user.id,
        clerkUserId: data.user.clerkUserId,
        signedInClerkUserId: userId,
        activeFarmIds: data.memberships.map(({ farm }) => farm.id),
      },
    );
    if (resolution.status === 'recipient-mismatch' || resolution.status === 'invalid-payload') {
      consumeResponse(key);
      return;
    }
    if (resolution.status === 'farm-unavailable') {
      Alert.alert('Không có quyền truy cập', 'Farm của thông báo không còn thuộc tài khoản này.');
      consumeResponse(key);
      return;
    }
    if (resolution.status === 'unsupported-route') {
      Alert.alert('Không thể mở thông báo', 'Loại phiếu này chưa có màn hình chi tiết trên Mobile.');
      consumeResponse(key);
      return;
    }

    activeTapKey.current = key;
    setPendingTap({
      responseKey: key,
      sessionKey: `${userId}:${sessionId}`,
      payload: resolution.payload,
      route: resolution.route,
    });
    if (currentFarmId !== resolution.payload.farmId) {
      void selectFarm(resolution.payload.farmId).catch(() => {
        Alert.alert('Không thể chuyển farm', 'Hãy chọn lại farm có quyền truy cập rồi mở thông báo.');
        consumeResponse(key);
      });
    }
  }, [
    authDataError,
    authDataLoading,
    currentFarmId,
    data,
    isLoaded,
    isSignedIn,
    pendingTap,
    responseRevision,
    selectFarm,
    sessionId,
    userId,
  ]);

  // Wait for a requested farm switch to reach AuthContext, then mark only this
  // user's notification read. A PATCH failure does not block safe navigation.
  useEffect(() => {
    if (!pendingTap || !isLoaded) return;
    const key = pendingTap.responseKey;
    if (
      !isSignedIn ||
      !userId ||
      !sessionId ||
      `${userId}:${sessionId}` !== pendingTap.sessionKey
    ) {
      consumeResponse(key);
      return;
    }
    if (authDataLoading) return;
    if (
      !data ||
      data.user.clerkUserId !== userId ||
      data.user.id !== pendingTap.payload.recipientUserId ||
      !data.memberships.some(({ farm }) => farm.id === pendingTap.payload.farmId)
    ) {
      consumeResponse(key);
      return;
    }
    if (currentFarmId !== pendingTap.payload.farmId || navigationInFlight.current === key) return;

    let cancelled = false;
    navigationInFlight.current = key;
    void (async () => {
      let readError: unknown;
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
        await markNotificationRead(token, pendingTap.payload.farmId, pendingTap.payload.notificationId);
      } catch (cause: unknown) {
        readError = cause;
      }
      if (cancelled) return;
      if (readError) {
        Alert.alert(
          'Không thể cập nhật trạng thái đọc',
          readError instanceof Error ? readError.message : 'Thông báo vẫn sẽ được mở.',
        );
      }
      router.push(pendingTap.route as never);
      navigationInFlight.current = null;
      consumeResponse(key);
    })();

    return () => {
      cancelled = true;
      if (navigationInFlight.current === key) navigationInFlight.current = null;
    };
  }, [
    authDataLoading,
    currentFarmId,
    data,
    getAccessToken,
    isLoaded,
    isSignedIn,
    pendingTap,
    router,
    sessionId,
    userId,
  ]);

  useEffect(() => {
    if (
      !state.retryable ||
      !['error', 'denied'].includes(state.status) ||
      retries.current >= 3 ||
      AppState.currentState !== 'active'
    )
      return;
    const timer = setTimeout(() => {
      retries.current += 1;
      void pushRegistrationManager.sync('never');
    }, [5000, 15000, 45000][retries.current]);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <PushRegistrationContext.Provider
      value={{
        state,
        retry() {
          retries.current = 0;
          void pushRegistrationManager.sync('manual');
        },
        openSettings() {
          void Linking.openSettings().catch(() => undefined);
        },
      }}
    >
      {children}
    </PushRegistrationContext.Provider>
  );
}

export function usePushRegistration() {
  const context = useContext(PushRegistrationContext);
  if (!context)
    throw new Error(
      'usePushRegistration must be used within PushRegistrationProvider',
    );
  return context;
}

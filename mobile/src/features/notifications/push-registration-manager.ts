import type { NotificationDevice } from './device-api';

export type NativePushToken = { type: 'android' | 'ios'; data: string };
export type PermissionPrompt = 'automatic' | 'manual' | 'never';
export type PushSession = {
  key: string;
  clerkUserId: string;
  dbUserId: string;
  getToken: () => Promise<string | null>;
};
export type DeviceBinding = {
  clerkUserId: string;
  installationId: string;
  deviceId: string | null;
  needsUnregister: boolean;
};
export type PushRegistrationState = {
  status:
    'idle' | 'unsupported' | 'registering' | 'registered' | 'denied' | 'error';
  message: string;
  retryable?: boolean;
  canAskAgain?: boolean;
  installationId?: string;
  deviceId?: string;
};

export class PushRegistrationError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface PushRegistrationDependencies {
  supported: boolean;
  platform: NotificationDevice['platform'];
  getInstallationId: () => Promise<string>;
  readInstallationId: () => Promise<string | null>;
  getPermission: (
    prompt: PermissionPrompt,
  ) => Promise<{ granted: boolean; canAskAgain: boolean }>;
  getNativeToken: () => Promise<NativePushToken>;
  getExpoToken: (nativeToken: NativePushToken) => Promise<string>;
  readBinding: () => Promise<DeviceBinding | null>;
  writeBinding: (binding: DeviceBinding) => Promise<void>;
  clearBinding: (clerkUserId: string) => Promise<void>;
  register: (
    jwt: string,
    installationId: string,
    expoToken: string,
    platform: NotificationDevice['platform'],
  ) => Promise<NotificationDevice>;
  unregister: (jwt: string, installationId: string) => Promise<void>;
}

export function withPushDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new PushRegistrationError('Kết nối đăng ký thông báo quá thời gian.'),
        ),
      milliseconds,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class PushRegistrationManager {
  private session: PushSession | null = null;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<(state: PushRegistrationState) => void>();
  private nativeToken: NativePushToken | null = null;
  private expoToken: string | null = null;
  state: PushRegistrationState = {
    status: 'idle',
    message: 'Đăng nhập để bật thông báo trên điện thoại.',
  };

  constructor(private readonly dependencies: PushRegistrationDependencies) {}

  subscribe(listener: (state: PushRegistrationState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSession(session: PushSession | null) {
    const changed = session?.key !== this.session?.key;
    this.session = session;
    if (changed) {
      this.generation += 1;
      this.update({
        status: 'idle',
        message: session
          ? 'Đang chuẩn bị thông báo trên điện thoại.'
          : 'Đăng nhập để bật thông báo trên điện thoại.',
      });
    }
    return changed;
  }

  private update(state: PushRegistrationState) {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }

  private enqueue(operation: () => Promise<void>) {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private current(session: PushSession, generation: number) {
    return generation === this.generation && this.session?.key === session.key;
  }

  private async revoke(
    installationId: string,
    clerkUserId: string,
    jwt: string | null,
  ) {
    const stored = await this.dependencies.readBinding();
    if (stored && stored.clerkUserId !== clerkUserId) return;
    await this.dependencies.writeBinding({
      clerkUserId,
      installationId,
      deviceId: stored?.deviceId ?? null,
      needsUnregister: true,
    });
    if (!jwt)
      throw new PushRegistrationError(
        'Chưa thể hủy đăng ký thiết bị do phiên đăng nhập đã hết hạn.',
      );
    try {
      await this.dependencies.unregister(jwt, installationId);
    } catch (error: unknown) {
      if (!(error instanceof PushRegistrationError && error.status === 404))
        throw error;
    }
    await this.dependencies.clearBinding(clerkUserId);
  }

  sync(prompt: PermissionPrompt = 'never', receivedToken?: NativePushToken) {
    const session = this.session;
    const generation = this.generation;
    if (!session) return Promise.resolve();
    return this.enqueue(async () => {
      if (!this.current(session, generation)) return;
      if (!this.dependencies.supported) {
        this.update({
          status: 'unsupported',
          message:
            'Dùng ứng dụng Nuôi Ong đã cài trên điện thoại để bật thông báo.',
        });
        return;
      }
      // A native token fetch can also emit a listener event. Do not register twice.
      if (
        receivedToken &&
        receivedToken.data === this.nativeToken?.data &&
        receivedToken.type === this.nativeToken.type &&
        this.state.status === 'registered'
      )
        return;
      this.update({
        status: 'registering',
        message: 'Đang đăng ký thông báo trên điện thoại.',
      });
      try {
        const installationId = await this.dependencies.getInstallationId();
        const permission = await this.dependencies.getPermission(prompt);
        if (!this.current(session, generation)) return;
        if (!permission.granted) {
          let cleanupFailed = false;
          const binding = await this.dependencies.readBinding();
          if (binding?.clerkUserId === session.clerkUserId) {
            try {
              await this.revoke(
                installationId,
                session.clerkUserId,
                await withPushDeadline(session.getToken(), 5000),
              );
            } catch {
              cleanupFailed = true;
            }
          }
          if (this.current(session, generation))
            this.update({
              status: 'denied',
              message:
                'Thông báo trên điện thoại đang tắt. Bạn vẫn xem được thông báo trong ứng dụng.',
              canAskAgain: permission.canAskAgain,
              retryable: cleanupFailed,
              installationId,
            });
          return;
        }
        const nativeToken =
          receivedToken ?? (await this.dependencies.getNativeToken());
        if (!this.current(session, generation)) return;
        const sameNativeToken =
          nativeToken.data === this.nativeToken?.data &&
          nativeToken.type === this.nativeToken.type;
        const expoToken =
          sameNativeToken && this.expoToken
            ? this.expoToken
            : await this.dependencies.getExpoToken(nativeToken);
        this.nativeToken = nativeToken;
        this.expoToken = expoToken;
        if (!this.current(session, generation)) return;
        const jwt = await withPushDeadline(session.getToken(), 5000);
        if (!this.current(session, generation)) return;
        if (!jwt)
          throw new PushRegistrationError(
            'Phiên đăng nhập chưa sẵn sàng để đăng ký thông báo.',
          );
        const device = await this.dependencies.register(
          jwt,
          installationId,
          expoToken,
          this.dependencies.platform,
        );
        if (!this.current(session, generation)) {
          try {
            await this.dependencies.unregister(jwt, installationId);
          } catch {
            /* A later session will rebind the installation atomically on the API. */
          }
          return;
        }
        if (
          device.userId !== session.dbUserId ||
          device.installationId !== installationId ||
          !device.isActive
        ) {
          throw new PushRegistrationError(
            'Máy chủ chưa xác nhận đúng đăng ký của tài khoản hiện tại.',
            false,
          );
        }
        await this.dependencies.writeBinding({
          clerkUserId: session.clerkUserId,
          installationId,
          deviceId: device.id,
          needsUnregister: false,
        });
        if (this.current(session, generation))
          this.update({
            status: 'registered',
            message: 'Điện thoại đã đăng ký nhận thông báo.',
            installationId,
            deviceId: device.id,
          });
      } catch (error: unknown) {
        if (!this.current(session, generation)) return;
        this.update({
          status: 'error',
          message:
            error instanceof PushRegistrationError
              ? error.message
              : 'Chưa đăng ký được thông báo trên điện thoại. Hãy thử lại.',
          retryable:
            error instanceof PushRegistrationError ? error.retryable : true,
        });
      }
    });
  }

  async beforeSignOut(
    getToken: () => Promise<string | null>,
    clerkUserId: string,
  ) {
    this.setSession(null);
    if (!this.dependencies.supported) return;
    // Capture the old session token before Clerk removes it; serialize DELETE
    // after any pending PUT so switching accounts cannot end on the old owner.
    const cleanup = (async () => {
      const installationId = await this.dependencies.readInstallationId();
      if (!installationId) return;
      const jwt = await withPushDeadline(getToken(), 1500).catch(() => null);
      return this.enqueue(() => this.revoke(installationId, clerkUserId, jwt));
    })();
    await withPushDeadline(cleanup, 3000).catch(() => undefined);
  }

  sessionEnded() {
    const previous = this.session;
    if (previous)
      return this.beforeSignOut(previous.getToken, previous.clerkUserId);
    this.setSession(null);
    return Promise.resolve();
  }
}

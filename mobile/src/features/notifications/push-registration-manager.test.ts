import { describe, expect, it, jest } from '@jest/globals';
import type { NotificationDevice } from './device-api';
import {
  PushRegistrationError,
  PushRegistrationManager,
  type DeviceBinding,
  type NativePushToken,
  type PushRegistrationDependencies,
  type PushSession,
} from './push-registration-manager';

const installationId = '07bd9ffe-0900-459a-8500-9fb1f33c0b71';
const nativeToken: NativePushToken = {
  type: 'android',
  data: 'native-token-1',
};
const result = (owner = 'a'): NotificationDevice => ({
  id: 'device-id',
  userId: `db-${owner}`,
  installationId,
  platform: 'ANDROID',
  isActive: true,
  lastSeenAt: '2026-10-26T12:00:00.000Z',
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
});
const session = (owner = 'a'): PushSession => ({
  key: `clerk-${owner}:session-${owner}`,
  clerkUserId: `clerk-${owner}`,
  dbUserId: `db-${owner}`,
  getToken: async () => `jwt-${owner}`,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup() {
  let binding: DeviceBinding | null = null;
  const dependencies = {
    supported: true as boolean,
    platform: 'ANDROID' as const,
    getInstallationId: jest.fn(async () => installationId),
    readInstallationId: jest.fn(
      async (): Promise<string | null> => installationId,
    ),
    getPermission: jest.fn(
      async (_prompt: 'automatic' | 'manual' | 'never') => ({
        granted: true,
        canAskAgain: true,
      }),
    ),
    getNativeToken: jest.fn(async () => nativeToken),
    getExpoToken: jest.fn(
      async (_token: NativePushToken) => 'ExponentPushToken[test]',
    ),
    readBinding: jest.fn(async () => binding),
    writeBinding: jest.fn(async (value: DeviceBinding) => {
      binding = value;
    }),
    clearBinding: jest.fn(async (user: string) => {
      if (binding?.clerkUserId === user) binding = null;
    }),
    register: jest.fn(
      async (
        jwt: string,
        _installation: string,
        _expo: string,
        _platform: NotificationDevice['platform'],
      ) => result(jwt === 'jwt-b' ? 'b' : 'a'),
    ),
    unregister: jest.fn(
      async (_jwt: string, _installation: string) => undefined,
    ),
  } satisfies PushRegistrationDependencies;
  const manager = new PushRegistrationManager(dependencies);
  return {
    manager,
    dependencies,
    readBinding: () => binding,
    saveBinding: (value: DeviceBinding) => {
      binding = value;
    },
  };
}

describe('push device registration lifecycle', () => {
  it('does nothing while signed out and skips native work in unsupported runtimes', async () => {
    const { manager, dependencies } = setup();
    await manager.sync('automatic');
    expect(dependencies.getPermission).not.toHaveBeenCalled();
    dependencies.supported = false;
    manager.setSession(session());
    await manager.sync('automatic');
    expect(manager.state.status).toBe('unsupported');
    expect(dependencies.getInstallationId).not.toHaveBeenCalled();
    expect(dependencies.register).not.toHaveBeenCalled();
  });

  it('registers the current session and persists only binding metadata, not JWT or Expo token', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession(session());
    await manager.sync('automatic');
    expect(dependencies.getPermission).toHaveBeenCalledWith('automatic');
    expect(dependencies.register).toHaveBeenCalledWith(
      'jwt-a',
      installationId,
      'ExponentPushToken[test]',
      'ANDROID',
    );
    expect(readBinding()).toEqual({
      clerkUserId: 'clerk-a',
      installationId,
      deviceId: 'device-id',
      needsUnregister: false,
    });
    expect(manager.state).toMatchObject({
      status: 'registered',
      installationId,
      deviceId: 'device-id',
    });
  });

  it('keeps the installation stable on refresh and reuses an unchanged Expo token', async () => {
    const { manager, dependencies } = setup();
    manager.setSession(session());
    await manager.sync('automatic');
    await manager.sync('never');
    expect(dependencies.getExpoToken).toHaveBeenCalledTimes(1);
    expect(dependencies.register).toHaveBeenCalledTimes(2);
    expect(
      dependencies.register.mock.calls.every(
        (call) => call[1] === installationId,
      ),
    ).toBe(true);
    expect(manager.setSession(session())).toBe(false);
  });

  it('handles a rolled listener token without fetching another native token or looping', async () => {
    const { manager, dependencies } = setup();
    manager.setSession(session());
    await manager.sync();
    const rolled = { type: 'android' as const, data: 'native-token-2' };
    await manager.sync('never', rolled);
    await manager.sync('never', rolled);
    expect(dependencies.getNativeToken).toHaveBeenCalledTimes(1);
    expect(dependencies.getExpoToken).toHaveBeenLastCalledWith(rolled);
    expect(dependencies.register).toHaveBeenCalledTimes(2);
  });

  it('does not register if permission is denied', async () => {
    const { manager, dependencies } = setup();
    dependencies.getPermission.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    manager.setSession(session());
    await manager.sync('automatic');
    expect(manager.state).toMatchObject({
      status: 'denied',
      canAskAgain: false,
    });
    expect(dependencies.getNativeToken).not.toHaveBeenCalled();
    expect(dependencies.register).not.toHaveBeenCalled();
  });

  it('unregisters an existing device when permission is revoked in Settings', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession(session());
    await manager.sync();
    dependencies.getPermission.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await manager.sync('never');
    expect(dependencies.unregister).toHaveBeenCalledWith(
      'jwt-a',
      installationId,
    );
    expect(readBinding()).toBeNull();
    expect(manager.state.status).toBe('denied');
  });

  it('remembers failed permission-revocation cleanup and retries it', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession(session());
    await manager.sync();
    dependencies.getPermission.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    dependencies.unregister.mockRejectedValueOnce(
      new PushRegistrationError('Offline'),
    );
    await manager.sync('never');
    expect(readBinding()?.needsUnregister).toBe(true);
    expect(manager.state).toMatchObject({ status: 'denied', retryable: true });
    await manager.sync('never');
    expect(readBinding()).toBeNull();
    expect(manager.state).toMatchObject({ status: 'denied', retryable: false });
  });

  it('recovers after an API network failure without storing a false success', async () => {
    const { manager, dependencies, readBinding } = setup();
    dependencies.register.mockRejectedValueOnce(
      new PushRegistrationError('Offline'),
    );
    manager.setSession(session());
    await manager.sync();
    expect(manager.state).toMatchObject({ status: 'error', retryable: true });
    expect(readBinding()).toBeNull();
    await manager.sync('manual');
    expect(manager.state.status).toBe('registered');
  });

  it('does not register without a JWT and rejects a wrong owner in the response', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession({ ...session(), getToken: async () => null });
    await manager.sync();
    expect(dependencies.register).not.toHaveBeenCalled();
    expect(manager.state.status).toBe('error');
    manager.setSession(session());
    dependencies.register.mockResolvedValueOnce(result('b'));
    await manager.sync();
    expect(manager.state).toMatchObject({ status: 'error', retryable: false });
    expect(readBinding()).toBeNull();
  });

  it('ignores stale native work from A when B signs in before the token arrives', async () => {
    const { manager, dependencies, readBinding } = setup();
    const waiting = deferred<NativePushToken>();
    const started = deferred<void>();
    dependencies.getNativeToken.mockImplementationOnce(() => {
      started.resolve();
      return waiting.promise;
    });
    manager.setSession(session());
    const oldSync = manager.sync();
    await started.promise;
    manager.setSession(session('b'));
    const newSync = manager.sync();
    waiting.resolve(nativeToken);
    await Promise.all([oldSync, newSync]);
    expect(dependencies.register).toHaveBeenCalledTimes(1);
    expect(dependencies.register.mock.calls[0][0]).toBe('jwt-b');
    expect(readBinding()?.clerkUserId).toBe('clerk-b');
  });

  it('cleans up a late PUT using A credentials before registering B', async () => {
    const { manager, dependencies, readBinding } = setup();
    const waiting = deferred<NotificationDevice>();
    const started = deferred<void>();
    const calls: string[] = [];
    dependencies.register.mockImplementation(async (jwt) => {
      calls.push(`PUT ${jwt}`);
      if (jwt === 'jwt-a') {
        started.resolve();
        return waiting.promise;
      }
      return result('b');
    });
    dependencies.unregister.mockImplementation(async (jwt) => {
      calls.push(`DELETE ${jwt}`);
    });
    manager.setSession(session());
    const oldSync = manager.sync();
    await started.promise;
    manager.setSession(session('b'));
    const newSync = manager.sync();
    waiting.resolve(result());
    await Promise.all([oldSync, newSync]);
    expect(calls).toEqual(['PUT jwt-a', 'DELETE jwt-a', 'PUT jwt-b']);
    expect(readBinding()?.clerkUserId).toBe('clerk-b');
    expect(manager.state.status).toBe('registered');
  });

  it('unregisters before a normal sign-out without deleting the installation', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession(session());
    await manager.sync();
    await manager.beforeSignOut(session().getToken, 'clerk-a');
    expect(dependencies.unregister).toHaveBeenCalledWith(
      'jwt-a',
      installationId,
    );
    expect(readBinding()).toBeNull();
    expect(await dependencies.readInstallationId()).toBe(installationId);
    expect(manager.state.status).toBe('idle');
    await manager.sync();
    expect(dependencies.register).toHaveBeenCalledTimes(1);
  });

  it('treats DELETE 404 as already unregistered and retains pending cleanup on network failure', async () => {
    const { manager, dependencies, readBinding } = setup();
    manager.setSession(session());
    await manager.sync();
    dependencies.unregister.mockRejectedValueOnce(
      new PushRegistrationError('Offline'),
    );
    await manager.beforeSignOut(session().getToken, 'clerk-a');
    expect(readBinding()?.needsUnregister).toBe(true);
    dependencies.unregister.mockRejectedValueOnce(
      new PushRegistrationError('Not found', false, 404),
    );
    await manager.beforeSignOut(session().getToken, 'clerk-a');
    expect(readBinding()).toBeNull();
  });

  it('does not clear or unregister an already saved binding belonging to another account', async () => {
    const { manager, dependencies, saveBinding, readBinding } = setup();
    saveBinding({
      clerkUserId: 'clerk-b',
      installationId,
      deviceId: 'b-device',
      needsUnregister: false,
    });
    await manager.beforeSignOut(session().getToken, 'clerk-a');
    expect(dependencies.unregister).not.toHaveBeenCalled();
    expect(readBinding()?.clerkUserId).toBe('clerk-b');
  });

  it('lets sign-out finish within three seconds even if earlier native work is waiting', async () => {
    jest.useFakeTimers();
    try {
      const { manager, dependencies } = setup();
      const waiting = deferred<NativePushToken>();
      const started = deferred<void>();
      dependencies.getNativeToken.mockImplementationOnce(() => {
        started.resolve();
        return waiting.promise;
      });
      manager.setSession(session());
      const syncing = manager.sync();
      await started.promise;
      let signedOut = false;
      const logout = manager
        .beforeSignOut(session().getToken, 'clerk-a')
        .then(() => {
          signedOut = true;
        });
      await jest.advanceTimersByTimeAsync(3000);
      await logout;
      expect(signedOut).toBe(true);
      manager.setSession(session('b'));
      const next = manager.sync();
      waiting.resolve(nativeToken);
      await Promise.all([syncing, next]);
      expect(dependencies.register).toHaveBeenCalledTimes(1);
      expect(dependencies.register.mock.calls[0][0]).toBe('jwt-b');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not create a new installation just to log out', async () => {
    const { manager, dependencies } = setup();
    dependencies.readInstallationId.mockResolvedValueOnce(null);
    await manager.beforeSignOut(session().getToken, 'clerk-a');
    expect(dependencies.getInstallationId).not.toHaveBeenCalled();
    expect(dependencies.unregister).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { completeSessionStartup } from './startup-runtime';

const mockRead = jest.fn(async () => 'activity-a' as string | null);
const mockWrite = jest.fn(async (_key: string, _value: string) => undefined);
const mockLaunch = jest.fn(() => 'activity-a');
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({ getLaunchId: () => mockLaunch() }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: () => mockRead(),
  setItemAsync: (key: string, value: string) => mockWrite(key, value),
}));

type SessionGlobals = typeof globalThis & {
  __nuoiOngStartup?: unknown;
  __nuoiOngStartupTask?: unknown;
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
  delete (globalThis as SessionGlobals).__nuoiOngStartup;
  delete (globalThis as SessionGlobals).__nuoiOngStartupTask;
  jest.clearAllMocks();
  mockRead.mockResolvedValue('activity-a');
});

describe('session startup runtime', () => {
  it('does not repeat a Reload sign-out after concurrent renders or a subsequent remount', async () => {
    const signOut = jest.fn(async () => undefined);
    const start = async (decision: { shouldSignOut: boolean }) => {
      if (decision.shouldSignOut) await signOut();
    };
    await Promise.all([
      completeSessionStartup(start),
      completeSessionStartup(start),
    ]);
    await completeSessionStartup(start);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });
  it('permits a retry if the sign-out operation fails', async () => {
    const action = jest.fn(async () => undefined);
    action.mockRejectedValueOnce(new Error('temporary Clerk failure'));
    await expect(completeSessionStartup(action)).rejects.toThrow(
      'temporary Clerk failure',
    );
    await completeSessionStartup(action);
    expect(action).toHaveBeenCalledTimes(2);
  });
  it('preserves a login when the native Activity changed between app opens', async () => {
    mockRead.mockResolvedValue('older-activity');
    const action = jest.fn(
      async (_decision: { shouldSignOut: boolean }) => undefined,
    );
    await completeSessionStartup(action);
    expect(action).toHaveBeenCalledWith({
      shouldSignOut: false,
      nativeAvailable: true,
    });
  });
});

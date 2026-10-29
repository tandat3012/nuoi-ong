import { describe, expect, it, jest } from '@jest/globals';
import { signOutDevice } from './sign-out-device';

describe('current device sign-out', () => {
  it('revokes push before removing the Clerk session, then clears cached account data', async () => {
    const calls: string[] = [];
    await signOutDevice({
      unregisterDevice: async () => {
        calls.push('device');
      },
      signOut: async () => {
        calls.push('clerk');
      },
      clearCache: () => {
        calls.push('cache');
      },
    });
    expect(calls).toEqual(['device', 'clerk', 'cache']);
  });
  it('does not clear cache or claim success when Clerk sign-out fails', async () => {
    const clearCache = jest.fn();
    await expect(
      signOutDevice({
        unregisterDevice: async () => undefined,
        signOut: async () => {
          throw new Error('offline');
        },
        clearCache,
      }),
    ).rejects.toThrow('offline');
    expect(clearCache).not.toHaveBeenCalled();
  });
});

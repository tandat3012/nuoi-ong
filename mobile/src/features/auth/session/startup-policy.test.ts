import { describe, expect, it, jest } from '@jest/globals';
import { evaluateSessionStartup } from './startup-policy';

describe('session startup policy', () => {
  function scenario(
    previous: string | null,
    current: string | null,
    development = true,
  ) {
    return {
      development,
      launchId: current,
      readPreviousLaunch: jest.fn(async () => previous),
      writeLaunch: jest.fn(async (_id: string) => undefined),
    };
  }
  it('preserves an existing login on the first native launch after upgrading', async () => {
    const options = scenario(null, 'activity-a');
    expect(await evaluateSessionStartup(options)).toEqual({
      shouldSignOut: false,
      nativeAvailable: true,
    });
    expect(options.writeLaunch).toHaveBeenCalledWith('activity-a');
  });
  it('preserves a login when the app is closed and reopened in a new Activity', async () => {
    expect(
      (await evaluateSessionStartup(scenario('activity-a', 'activity-b')))
        .shouldSignOut,
    ).toBe(false);
  });
  it('resets a login after a full JS reload inside the same Activity', async () => {
    expect(
      (await evaluateSessionStartup(scenario('activity-a', 'activity-a')))
        .shouldSignOut,
    ).toBe(true);
  });
  it('never auto signs out in production, including a JS restart in the same Activity', async () => {
    const options = scenario('activity-a', 'activity-a', false);
    expect((await evaluateSessionStartup(options)).shouldSignOut).toBe(false);
    expect(options.readPreviousLaunch).not.toHaveBeenCalled();
    expect(options.writeLaunch).not.toHaveBeenCalled();
  });
  it('preserves login on an older APK or Expo Go without the native module', async () => {
    const options = scenario('activity-a', null);
    expect(await evaluateSessionStartup(options)).toEqual({
      shouldSignOut: false,
      nativeAvailable: false,
    });
    expect(options.writeLaunch).not.toHaveBeenCalled();
  });
  it('does not treat unreadable storage as permission to log out', async () => {
    const options = scenario('activity-a', 'activity-a');
    options.readPreviousLaunch.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    await expect(evaluateSessionStartup(options)).rejects.toThrow(
      'storage unavailable',
    );
    expect(options.writeLaunch).not.toHaveBeenCalled();
  });
});

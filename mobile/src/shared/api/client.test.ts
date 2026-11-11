import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from './client';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

describe('apiRequest abort & dedupe handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearApiCache();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('rethrows AbortError without wrapping it in MobileApiError', async () => {
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    global.fetch = jest.fn(async () => {
      throw abortError;
    }) as typeof fetch;

    const controller = new AbortController();
    await expect(
      apiRequest('/items', { token: 't', signal: controller.signal, skipCache: true }),
    ).rejects.toBe(abortError);
    expect(isAbortError(abortError)).toBe(true);
  });

  it('throws AbortError immediately if signal is already aborted', async () => {
    const fetchSpy = jest.fn() as typeof fetch;
    global.fetch = fetchSpy;
    const controller = new AbortController();
    controller.abort();

    await expect(
      apiRequest('/items', { token: 't', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not deduplicate in-flight GET requests when an explicit signal is passed', async () => {
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    })) as unknown as typeof fetch;
    global.fetch = fetchSpy;

    const c1 = new AbortController();
    const c2 = new AbortController();
    await Promise.all([
      apiRequest('/items', { token: 't', signal: c1.signal }),
      apiRequest('/items', { token: 't', signal: c2.signal }),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('still wraps non-abort network errors into MobileApiError', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;

    await expect(apiRequest('/items', { token: 't', skipCache: true })).rejects.toBeInstanceOf(
      MobileApiError,
    );
  });
});

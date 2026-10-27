import Constants from 'expo-constants';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '5050';

function resolveApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const runtimeConstants = Constants as typeof Constants & {
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    manifest?: { debuggerHost?: string };
  };
  const hostUri =
    Constants.expoConfig?.hostUri ??
    runtimeConstants.manifest2?.extra?.expoGo?.debuggerHost ??
    runtimeConstants.manifest?.debuggerHost;
  const host = hostUri?.split(':')[0];

  // Expo Go advertises the Metro host in LAN mode. Reusing it keeps the API
  // reachable when the computer changes networks without editing .env.
  if (__DEV__ && host && !host.endsWith('.exp.direct')) {
    return `http://${host}:${API_PORT}/api/v1`;
  }

  return configuredUrl || `http://localhost:${API_PORT}/api/v1`;
}

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_GET_CACHE_TTL_MS = 8_000;
const MAX_CACHED_RESPONSES = 128;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const inFlightGets = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

export function clearApiCache() {
  cacheGeneration += 1;
  responseCache.clear();
  inFlightGets.clear();
}

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'headers' | 'body'> & {
  token: string;
  params?: Record<string, string | number | undefined>;
  body?: unknown;
  cacheTtlMs?: number;
  skipCache?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions) {
  const { token, params, body, cacheTtlMs, skipCache, ...requestInit } = options;
  const url = new URL(path.replace(/^\/+/, ''), `${API_BASE_URL.replace(/\/$/, '')}/`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });

  const method = (requestInit.method ?? 'GET').toUpperCase();
  const isAuthMe = url.pathname.endsWith('/auth/me');
  const shouldCache = method === 'GET' && !skipCache && !isAuthMe;
  const cacheKey = `${token}\n${url.href}`;

  if (shouldCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) responseCache.delete(cacheKey);
    const inFlight = inFlightGets.get(cacheKey);
    if (inFlight) return inFlight as Promise<T>;
  }

  const performRequest = async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        ...requestInit,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (cause) {
      throw new MobileApiError('Không thể kết nối máy chủ API.', 0, cause);
    }

    const text = await response.text();
    let details: unknown;
    try {
      details = text ? JSON.parse(text) : undefined;
    } catch {
      details = text;
    }
    if (!response.ok) {
      const message =
        details && typeof details === 'object' && 'message' in details
          ? Array.isArray(details.message)
            ? details.message.join(', ')
            : String(details.message)
          : `API trả về lỗi ${response.status}.`;
      throw new MobileApiError(message, response.status, details);
    }
    if (method !== 'GET') clearApiCache();
    return details;
  };

  if (!shouldCache) return (await performRequest()) as T;

  const generation = cacheGeneration;
  let request: Promise<unknown>;
  request = performRequest()
    .then((value) => {
      const ttl = Math.max(0, cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS);
      if (ttl > 0 && generation === cacheGeneration) {
        responseCache.set(cacheKey, { value, expiresAt: Date.now() + ttl });
        if (responseCache.size > MAX_CACHED_RESPONSES) {
          const oldestKey = responseCache.keys().next().value;
          if (oldestKey) responseCache.delete(oldestKey);
        }
      }
      return value;
    })
    .finally(() => {
      if (inFlightGets.get(cacheKey) === request) inFlightGets.delete(cacheKey);
    });
  inFlightGets.set(cacheKey, request);
  return (await request) as T;
}

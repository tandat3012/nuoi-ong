const DEFAULT_API_URL = 'http://localhost:5050';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
};

export async function apiRequest<T>(
  path: string,
  { accessToken, headers, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const details = await response.json().catch(() => undefined);
    throw new ApiError(
      `API request failed with status ${response.status}`,
      response.status,
      details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

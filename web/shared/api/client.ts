import axios, {
  type AxiosRequestConfig,
  type RawAxiosRequestHeaders,
} from 'axios';

import { FULL_API_URL } from '../config/api';

export const API_UNAUTHORIZED_EVENT = 'api:unauthorized';

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

const apiClient = axios.create({
  baseURL: FULL_API_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export type ApiRequestOptions = Omit<
  AxiosRequestConfig,
  'headers' | 'url'
> & {
  accessToken?: string;
  headers?: RawAxiosRequestHeaders;
};

export async function apiRequest<T>(
  path: string,
  { accessToken, headers, ...config }: ApiRequestOptions = {},
): Promise<T> {
  try {
    const response = await apiClient.request<T>({
      ...config,
      url: path,
      headers: {
        ...headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    return response.data;
  } catch (error: unknown) {
    throw toApiError(error);
  }
}

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError('Unexpected error', 0, error);
  }

  const status = error.response?.status ?? 0;
  const details = error.response?.data ?? error.request;
  const message = getErrorMessage(details, error.message);

  if (status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
  }

  return new ApiError(message, status, details);
}

function getErrorMessage(details: unknown, fallback: string): string {
  if (!details || typeof details !== 'object' || !('message' in details)) {
    return fallback || 'Unexpected error';
  }

  const message = details.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }

  return fallback || 'Unexpected error';
}

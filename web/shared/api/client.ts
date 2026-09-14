import axios, { type AxiosRequestConfig } from 'axios';

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

export type ApiRequestOptions = Pick<
  AxiosRequestConfig,
  'method' | 'headers' | 'data' | 'params'
> & {
  accessToken?: string;
};

export async function apiRequest<T>(
  path: string,
  { accessToken, headers, ...options }: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  try {
    const response = await axios.request<T>({
      baseURL: baseUrl,
      url: path,
      ...options,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json',
        ...(options.data ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });

    if (response.status >= 400) {
      throw new ApiError(
        `API request failed with status ${response.status}`,
        response.status,
        response.data,
      );
    }

    return response.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (axios.isAxiosError(error)) {
      throw new ApiError(
        error.message,
        error.response?.status ?? 0,
        error.response?.data,
      );
    }
    throw error;
  }
}

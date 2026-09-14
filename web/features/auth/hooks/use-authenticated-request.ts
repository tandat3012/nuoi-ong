'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

import { apiRequest, type ApiRequestOptions } from '@/shared/api/client';

type RequestOptions = Omit<ApiRequestOptions, 'accessToken'>;

export function useAuthenticatedRequest() {
  const { getToken } = useAuth();

  return useCallback(async function request<T>(path: string, options: RequestOptions = {}) {
    const accessToken = await getToken();

    try {
      return await apiRequest<T>(path, {
        ...options,
        accessToken: accessToken ?? undefined,
      });
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('API request failed');
    }
  }, [getToken]);
}

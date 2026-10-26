'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

import {
  API_UNAUTHORIZED_EVENT,
  API_ACCESS_CHANGED_EVENT,
  ApiError,
  apiRequest,
  ApiRequestOptions,
} from '@/shared/api/client';

type AuthenticatedRequestOptions = Omit<ApiRequestOptions, 'accessToken'>;

export function useAuthenticatedRequest() {
  const { getToken } = useAuth();

  return useCallback(
    async <T>(
      path: string,
      options: AuthenticatedRequestOptions = {},
    ): Promise<T> => {
      const accessToken = await getToken();

      if (!accessToken) {
        window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
        throw new ApiError('Authentication is required', 401);
      }

      try {
        return await apiRequest<T>(path, { ...options, accessToken });
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          path !== '/auth/me'
        )
          window.dispatchEvent(new Event(API_ACCESS_CHANGED_EVENT));
        throw error;
      }
    },
    [getToken],
  );
}

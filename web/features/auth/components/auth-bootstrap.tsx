'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { apiRequest } from '@/shared/api/client';

export function AuthBootstrap() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    void (async () => {
      const accessToken = await getToken();
      await apiRequest('/auth/me', {
        accessToken: accessToken ?? undefined,
      });
    })().catch((error: unknown) => {
      console.error('Unable to initialize the authenticated user', error);
    });
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}

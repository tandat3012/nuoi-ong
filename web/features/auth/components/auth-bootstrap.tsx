'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  API_UNAUTHORIZED_EVENT,
  apiRequest,
} from '@/shared/api/client';

export function AuthBootstrap() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const redirectToSignIn = () => {
      router.replace('/sign-in');
    };

    window.addEventListener(API_UNAUTHORIZED_EVENT, redirectToSignIn);
    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, redirectToSignIn);
    };
  }, [router]);

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

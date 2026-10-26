'use client';

import { SignOutButton, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthenticatedRequest } from '../hooks/use-authenticated-request';
import type { AuthContextResponse } from '../types/auth-context';
import { resolvePostSignInPath, safeNextPath } from '../utils/post-sign-in';

export function PostSignInRedirect({ next }: { next: string | null }) {
  const { isLoaded, isSignedIn } = useAuth();
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    const target = safeNextPath(next, window.location.origin);
    void request<AuthContextResponse>('/auth/me')
      .then((me) => {
        if (!cancelled) router.replace(resolvePostSignInPath(me, target));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, next, request, router]);

  if (!failed) return <p role="status">Đang chuyển hướng…</p>;
  return (
    <section role="alert">
      <p>Không thể tải thông tin tài khoản.</p>
      <SignOutButton>
        <button type="button">Đăng xuất</button>
      </SignOutButton>
    </section>
  );
}

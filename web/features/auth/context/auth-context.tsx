'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AuthContextResponse } from '../types/auth-context';
import { SignOutButton, useAuth } from '@clerk/nextjs';
import { useAuthenticatedRequest } from '../hooks/use-authenticated-request';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  API_ACCESS_CHANGED_EVENT,
  API_UNAUTHORIZED_EVENT,
  ApiError,
} from '@/shared/api/client';

type AuthContextValue = {
  data: AuthContextResponse;
  selectedFarmId: string | null;
  selectFarm: (farmId: string) => void;
  isLoading: boolean;
  error: ApiError | null;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  if (!isLoaded) return <p>Đang tải...</p>;
  if (!isSignedIn || !userId) return null;
  return (
    <SessionContextProvider key={`${userId}:${sessionId}`} userId={userId}>
      {children}
    </SessionContextProvider>
  );
}

function SessionContextProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const request = useAuthenticatedRequest();
  const router = useRouter();

  const { isSignedIn, isLoaded } = useAuth();
  const [data, setData] = useState<AuthContextResponse | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    window.addEventListener(API_ACCESS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(API_ACCESS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => router.replace('/sign-in');
    window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);

    return () =>
      window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  useEffect(() => {
    if (!isSignedIn || !isLoaded) return;

    let cancelled = false;

    void request<AuthContextResponse>('/auth/me')
      .then((res) => {
        if (cancelled) return;

        const strorageKey = `farm:selected-farm:${res.user.id}`;
        if (res.user.clerkUserId !== userId) {
          throw new ApiError('Unexpected user context', 403);
        }
        let savedFarmId: string | null = null;
        try {
          savedFarmId = localStorage.getItem(strorageKey);
        } catch {}
        const savedFarmIsValid =
          savedFarmId &&
          res.memberships.some(({ farm }) => farm.id === savedFarmId);

        setData(res);
        if (res.user.mustChangePassword)
          router.replace('/account/change-password');
        const defaultFarmId = res.memberships.some(
          ({ farm }) => farm.id === res.defaultFarmId,
        )
          ? res.defaultFarmId
          : (res.memberships[0]?.farm.id ?? null);
        setSelectedFarmId(savedFarmIsValid ? savedFarmId : defaultFarmId);
        setError(null);
      })

      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError('Cannot load authenticated user data', 0, cause),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, request, userId, attempt, router]);

  const value = useMemo(() => {
    if (!data) return null;

    return {
      data,
      selectedFarmId,
      isLoading: false,
      error,
      refresh,
      selectFarm(farmId: string) {
        const isAllowed = data.memberships.some(
          ({ farm }) => farm.id === farmId,
        );
        if (!isAllowed) throw new Error('Farm is not available to this user');

        try {
          window.localStorage.setItem(
            `farm:selected-farm:${data.user.id}`,
            farmId,
          );
        } catch {}
        setSelectedFarmId(farmId);
      },
    };
  }, [data, selectedFarmId, error, refresh]);
  if (!isLoaded || (isSignedIn && !data && !error)) return <p>Đang tải...</p>;
  if (!isSignedIn) return null;
  const retry = () => {
    setError(null);
    setAttempt((previous) => previous + 1);
  };
  if (error)
    return (
      <section role="alert">
        <p>
          {error.status === 403
            ? 'Bạn không có quyền truy cập.'
            : 'Không thể tải thông tin người dùng.'}
        </p>
        <button type="button" onClick={retry}>
          Thử lại
        </button>
        <SignOutButton>
          <button type="button">Đăng xuất</button>
        </SignOutButton>
      </section>
    );
  if (!value) return null;
  if (data?.user.mustChangePassword)
    return <p role="status">Vui lòng đổi mật khẩu ban đầu…</p>;
  if (!selectedFarmId)
    return (
      <section>
        <p>Bạn chưa được cấp quyền vào trại. Vui lòng liên hệ chủ trại.</p>
        <Link href="/">Về cửa hàng</Link>
        <button type="button" onClick={retry}>
          Kiểm tra lại
        </button>
        <SignOutButton>
          <button type="button">Đăng xuất</button>
        </SignOutButton>
      </section>
    );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuthContext must be used within an AuthContextProvider',
    );
  }

  return context;
}

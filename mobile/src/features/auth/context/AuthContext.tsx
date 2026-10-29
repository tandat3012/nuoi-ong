import { useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import type { AuthContextResponse } from '../types';

type AuthContextValue = {
  data: AuthContextResponse | null;
  currentFarmId: string | null;
  selectFarm: (farmId: string) => Promise<void>;
  reload: () => void;
  isLoading: boolean;
  error: MobileApiError | null;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const FARM_KEY = 'nuoi-ong.current-farm-id';

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const loadedSession = useRef<string | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [data, setData] = useState<AuthContextResponse | null>(null);
  const [currentFarmId, setCurrentFarmId] = useState<string | null>(null);
  const [error, setError] = useState<MobileApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return;
    if (!isSignedIn) {
      loadedSession.current = null;
      clearApiCache();
      setData(null);
      setCurrentFarmId(null);
      setError(null);
      setLoading(false);
      return;
    }

    const identity = `${userId}:${sessionId}`;
    if (loadedSession.current !== identity) {
      loadedSession.current = identity;
      clearApiCache();
      setData(null);
      setCurrentFarmId(null);
      setError(null);
    }

    setLoading(true);
    void getTokenRef.current()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên Clerk chưa sẵn sàng.', 401);
        return apiRequest<AuthContextResponse>('/auth/me', {
          method: 'GET',
          token,
        });
      })
      .then(async (context) => {
        if (cancelled) return;
        if (context.user.clerkUserId !== userId) {
          throw new MobileApiError('Thông tin tài khoản không khớp phiên đăng nhập.', 401);
        }
        const saved = await SecureStore.getItemAsync(FARM_KEY);
        if (cancelled) return;
        const savedIsValid = context.memberships.some(
          ({ farm }) => farm.id === saved,
        );
        setData(context);
        const nextFarmId = savedIsValid
          ? saved
          : context.memberships.length === 1
            ? context.memberships[0]?.farm.id ?? null
            : null;
        setCurrentFarmId(nextFarmId);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof MobileApiError
            ? cause
            : new MobileApiError('Không thể tải thông tin tài khoản.', 0, cause),
        );
        setData(null);
        setCurrentFarmId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, reloadNonce, sessionId, userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      data,
      currentFarmId,
      reload() {
        clearApiCache();
        setError(null);
        setLoading(true);
        setReloadNonce((value) => value + 1);
      },
      isLoading: !isLoaded || loading,
      error,
      getAccessToken: getToken,
      async selectFarm(farmId: string) {
        if (!data?.memberships.some(({ farm }) => farm.id === farmId)) {
          throw new Error('Trang trại không thuộc tài khoản hiện tại.');
        }
        await SecureStore.setItemAsync(FARM_KEY, farmId);
        setCurrentFarmId(farmId);
      },
    }),
    [data, currentFarmId, error, getToken, isLoaded, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthContext must be used within AuthContextProvider');
  return value;
}

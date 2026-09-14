'use client';

import { useAuth } from '@clerk/nextjs';
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from 'react';

import { apiRequest, ApiError } from '@/shared/api/client';
import type { AuthMeResponse } from '@/shared/api/contracts';

type AuthContextValue = {
  data: AuthMeResponse | null;
  selectedFarmId: string | null;
  setSelectedFarmId: (farmId: string) => void;
  isLoading: boolean;
  error: ApiError | Error | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'nuoi-ong.selected-farm-id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<AuthMeResponse | null>(null);
  const [selectedFarmId, setSelectedFarmIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      startTransition(() => {
        setData(null);
        setSelectedFarmIdState(null);
        setIsLoading(false);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setIsLoading(true);
      setError(null);
    });

    void (async () => {
      const accessToken = await getToken();
      const response = await apiRequest<AuthMeResponse>('/auth/me', {
        accessToken: accessToken ?? undefined,
      });
      if (cancelled) return;

      setData(response);
      const savedFarmId = window.localStorage.getItem(STORAGE_KEY);
      const availableFarmId = response.memberships.some(
        ({ farm }) => farm.id === savedFarmId,
      )
        ? savedFarmId
        : response.memberships[0]?.farm.id ?? null;
      setSelectedFarmIdState(availableFarmId);
      if (availableFarmId) window.localStorage.setItem(STORAGE_KEY, availableFarmId);
    })()
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError
              : new Error('Không thể tải thông tin tài khoản.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  function setSelectedFarmId(farmId: string) {
    if (!data?.memberships.some(({ farm }) => farm.id === farmId)) return;
    setSelectedFarmIdState(farmId);
    window.localStorage.setItem(STORAGE_KEY, farmId);
  }

  return (
    <AuthContext.Provider
      value={{ data, selectedFarmId, setSelectedFarmId, isLoading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthContext must be used inside AuthProvider');
  return value;
}

export function FarmSelector() {
  const { data, selectedFarmId, setSelectedFarmId, isLoading } = useAuthContext();
  const memberships = data?.memberships ?? [];

  if (isLoading || memberships.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Farm</span>
      <select
        value={selectedFarmId ?? ''}
        onChange={(event) => setSelectedFarmId(event.target.value)}
        className="min-h-10 rounded-lg border bg-background px-3 font-medium"
      >
        {memberships.map(({ farm, roles }) => (
          <option key={farm.id} value={farm.id}>
            {farm.name} ({roles.join(', ') || 'READ_ONLY'})
          </option>
        ))}
      </select>
    </label>
  );
}

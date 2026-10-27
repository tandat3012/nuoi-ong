'use client';

import { useEffect, useState } from 'react';
import type { ApiRequestOptions } from '@/shared/api/client';
import type { CategoryReference } from '../types/material';
import { getMaterialFilterCategories } from '../api/materials.api';
import { formatApiError } from './format-api-error';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function useMaterialFilterCategories(
  request: AuthenticatedRequest,
  farmId: string | null,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    categories: CategoryReference[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    void getMaterialFilterCategories(request, farmId)
      .then(({ data }) => {
        if (!cancelled) setResult({ farmId, categories: data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ farmId, categories: [], error: formatApiError(error) });
      });
    return () => { cancelled = true; };
  }, [farmId, request, attempt]);

  const current = result?.farmId === farmId;
  return {
    filterCategories: current ? result.categories : [],
    filterCategoriesLoading: Boolean(farmId) && !current,
    filterCategoriesError: current ? result.error ?? null : null,
    onReloadFilterCategories: () => {
      setResult(null);
      setAttempt((value) => value + 1);
    },
  };
}

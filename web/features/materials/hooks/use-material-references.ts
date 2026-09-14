'use client';

import { useEffect, useState } from 'react';
import type { ApiRequestOptions } from '@/shared/api/client';
import type { CategoryReference, UnitReference } from '../types/material';
import { getCategories, getUnits } from '../api/materials.api';
import { formatApiError } from './format-api-error';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function useMaterialReferences(request: AuthenticatedRequest) {
  const [referencesAttempt, setReferencesAttempt] = useState(0);
  const [references, setReferences] = useState<{
    categories: CategoryReference[];
    units: UnitReference[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCategories(request), getUnits(request)])
      .then(([categories, units]) => {
        if (!cancelled)
          setReferences({
            categories: categories.data,
            units: units.data,
          });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setReferences({
            categories: [],
            units: [],
            error: formatApiError(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [request, referencesAttempt]);

  return {
    categories: references?.categories ?? [],
    units: references?.units ?? [],
    referencesLoading: !references,
    referencesError: references?.error ?? null,
    onReloadReferences: () => {
      setReferences(null);
      setReferencesAttempt((count) => count + 1);
    },
  };
}

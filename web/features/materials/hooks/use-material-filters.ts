'use client';

import { useCallback, useState } from 'react';
import type { MaterialFilterParams } from '../types/material';

export const initialFilters: MaterialFilterParams = { page: 1, pageSize: 20 };

export function useMaterialFilters() {
  const [filters, setFilters] = useState(initialFilters);

  function changeFilter(patch: Partial<MaterialFilterParams>) {
    setFilters((previous) => ({ ...previous, ...patch, page: 1 }));
  }

  return {
    filters,
    setFilters,
    onSearchChange: useCallback((search: string) => {
      const normalizedSearch = search.trim().slice(0, 100);
      setFilters((previous) =>
        (previous.search ?? '') === normalizedSearch
          ? previous
          : { ...previous, search: normalizedSearch || undefined, page: 1 },
      );
    }, []),
    onStatusChange: (status?: MaterialFilterParams['status']) =>
      changeFilter({ status }),
    onKindChange: (kind?: MaterialFilterParams['kind']) => changeFilter({ kind }),
    onTrackingModeChange: (trackingMode?: MaterialFilterParams['trackingMode']) =>
      changeFilter({ trackingMode }),
    onCategoryChange: (categoryId?: string) => changeFilter({ categoryId }),
    onResetFilters: () => {
      setFilters({ ...initialFilters });
    },
    onPageChange: (page: number) =>
      setFilters((previous) => ({ ...previous, page: Math.max(1, page) })),
    onReload: () => setFilters((previous) => ({ ...previous })),
  };
}

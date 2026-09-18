'use client';

import { useCallback, useState } from 'react';
import type {
  WarehouseFilterParams,
  WarehouseStatus,
} from '../types/warehouse';

export const initialWarehouseFilters: WarehouseFilterParams = {
  page: 1,
  pageSize: 20,
};

export function useWarehouseFilters() {
  const [filters, setFilters] = useState(initialWarehouseFilters);

  const changeFilter = useCallback((patch: Partial<WarehouseFilterParams>) => {
    setFilters((previous) => ({ ...previous, ...patch, page: 1 }));
  }, []);

  return {
    filters,
    setFilters,
    onSearchChange: useCallback((search: string) => {
      const normalizedSearch = search.trim().slice(0, 100);
      setFilters((previous) =>
        (previous.search ?? '') === normalizedSearch
          ? previous
          : {
              ...previous,
              search: normalizedSearch || undefined,
              page: 1,
            },
      );
    }, []),
    onStatusChange: (status?: WarehouseStatus) => changeFilter({ status }),
    onResetFilters: () => setFilters({ ...initialWarehouseFilters }),
    onPageChange: (page: number) =>
      setFilters((previous) => ({ ...previous, page: Math.max(1, page) })),
    onReload: () => setFilters((previous) => ({ ...previous })),
  };
}

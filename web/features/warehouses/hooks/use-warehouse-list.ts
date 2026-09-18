'use client';

import { useEffect, useRef, useState } from 'react';
import type { PageInfo } from '@/shared/api/contracts';
import {
  getWarehouses,
  type AuthenticatedRequest,
} from '../api/warehouses.api';
import type { Warehouse, WarehouseFilterParams } from '../types/warehouse';
import { formatWarehouseApiError } from './format-api-error';

const emptyPage: PageInfo = {
  number: 1,
  size: 20,
  totalItems: 0,
  totalPages: 0,
};

export function useWarehouseList(
  request: AuthenticatedRequest,
  selectedFarmId: string | null,
  filters: WarehouseFilterParams,
  setFilters: React.Dispatch<React.SetStateAction<WarehouseFilterParams>>,
) {
  const [result, setResult] = useState<{
    filters: WarehouseFilterParams;
    farmId: string;
    data?: Warehouse[];
    page?: PageInfo;
    error?: string;
  } | null>(null);
  const aliveRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!selectedFarmId) return;
    const requestId = ++requestIdRef.current;
    void getWarehouses(request, { farmId: selectedFarmId, ...filters })
      .then((response) => {
        if (!aliveRef.current || requestId !== requestIdRef.current) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (filters.page > lastPage) {
          setFilters((previous) => ({ ...previous, page: lastPage }));
          return;
        }
        setResult({
          filters,
          farmId: selectedFarmId,
          data: response.data,
          page: response.page,
        });
      })
      .catch((error: unknown) => {
        if (aliveRef.current && requestId === requestIdRef.current) {
          setResult({
            filters,
            farmId: selectedFarmId,
            error: formatWarehouseApiError(error),
          });
        }
      });
  }, [filters, request, selectedFarmId, setFilters]);

  const current =
    result?.filters === filters && result.farmId === selectedFarmId
      ? result
      : null;
  return {
    warehouses: current?.data ?? [],
    pageInfo: current?.page ?? {
      ...emptyPage,
      number: filters.page,
      size: filters.pageSize,
    },
    isLoading: Boolean(selectedFarmId) && !current,
    errorMessage: current?.error ?? null,
  };
}

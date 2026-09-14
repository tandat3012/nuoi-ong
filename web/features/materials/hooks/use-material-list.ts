'use client';

import { useEffect, useState } from 'react';
import type { ApiRequestOptions } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import type { MaterialFilterParams, MaterialListRow } from '../types/material';
import { getMaterials } from '../api/materials.api';
import { formatApiError } from './format-api-error';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function useMaterialList(
  request: AuthenticatedRequest,
  selectedFarmId: string | null,
  filters: MaterialFilterParams,
  setFilters: React.Dispatch<React.SetStateAction<MaterialFilterParams>>,
) {
  const [list, setList] = useState<{
    filters: MaterialFilterParams;
    response?: PaginatedResponse<MaterialListRow>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void getMaterials(request, { farmId: selectedFarmId, ...filters })
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (filters.page > lastPage) {
          setFilters((previous) => ({ ...previous, page: lastPage }));
          return;
        }
        setList({ filters, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setList({ filters, error: formatApiError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId, filters, setFilters]);

  // Chỉ hiển thị response của bộ lọc hiện tại, không hiện dữ liệu request trước.
  const currentList = list?.filters === filters ? list : null;

  return {
    materials: currentList?.response?.data ?? [],
    pageInfo: currentList?.response?.page ?? {
      number: filters.page,
      size: filters.pageSize,
      totalItems: 0,
      totalPages: 0,
    },
    isLoading: Boolean(selectedFarmId) && !currentList,
    errorMessage: currentList?.error ?? null,
  };
}

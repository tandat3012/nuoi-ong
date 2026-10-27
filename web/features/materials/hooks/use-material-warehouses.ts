'use client';

import { useEffect, useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { getWarehouses } from '@/features/warehouses/api/warehouses.api';
import type { Warehouse } from '@/features/warehouses/types/warehouse';

export function useMaterialWarehouses(farmId: string | null) {
  const request = useAuthenticatedRequest();
  const [result, setResult] = useState<{ farmId: string; data: Warehouse[] } | null>(null);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    void getWarehouses(request, { farmId, page: 1, pageSize: 100, status: 'ACTIVE' })
      .then((response) => {
        if (!cancelled) setResult({ farmId, data: response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ farmId, data: [] });
      });
    return () => { cancelled = true; };
  }, [farmId, request]);

  const current = result?.farmId === farmId;
  return {
    warehouses: current ? result.data : [],
    warehousesLoading: Boolean(farmId) && !current,
  };
}

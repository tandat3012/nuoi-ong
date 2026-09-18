'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getWarehouseById,
  type AuthenticatedRequest,
} from '../api/warehouses.api';
import type { Warehouse } from '../types/warehouse';
import { formatWarehouseApiError } from './format-api-error';

export type WarehouseViewMode = 'list' | 'detail' | 'create' | 'edit';

export function useWarehouseDetail(
  request: AuthenticatedRequest,
  selectedFarmId: string | null,
  canWrite: boolean,
  isSubmitting: boolean,
) {
  const [viewMode, setViewMode] = useState<WarehouseViewMode>('list');
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    null,
  );
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      detailRequestRef.current += 1;
    };
  }, []);

  async function openWarehouse(id: string, mode: 'detail' | 'edit') {
    if (!selectedFarmId || (mode === 'edit' && !canWrite) || isSubmitting)
      return;
    const requestId = ++detailRequestRef.current;
    setWarehouseId(id);
    setSelectedWarehouse(null);
    setViewMode(mode);
    setDetailError(null);
    setSaveError(null);
    setNotice(null);
    setIsDetailLoading(true);
    try {
      const response = await getWarehouseById(request, id, selectedFarmId);
      if (!aliveRef.current || requestId !== detailRequestRef.current) return;
      setSelectedWarehouse(response.data);
    } catch (error: unknown) {
      if (aliveRef.current && requestId === detailRequestRef.current) {
        setDetailError(formatWarehouseApiError(error));
      }
    } finally {
      if (aliveRef.current && requestId === detailRequestRef.current) {
        setIsDetailLoading(false);
      }
    }
  }

  function backToList() {
    if (isSubmitting) return;
    detailRequestRef.current += 1;
    setSelectedWarehouse(null);
    setWarehouseId(null);
    setDetailError(null);
    setSaveError(null);
    setIsDetailLoading(false);
    setViewMode('list');
  }

  return {
    viewMode,
    setViewMode,
    selectedWarehouse,
    setSelectedWarehouse,
    warehouseId,
    isDetailLoading,
    detailError,
    saveError,
    setSaveError,
    notice,
    setNotice,
    aliveRef,
    openWarehouse,
    backToList,
    onViewDetail: (warehouse: Warehouse) =>
      void openWarehouse(warehouse.id, 'detail'),
    onStartEdit: (warehouse: Warehouse) =>
      void openWarehouse(warehouse.id, 'edit'),
    onStartCreate: () => {
      if (!canWrite || isSubmitting) return;
      detailRequestRef.current += 1;
      setSelectedWarehouse(null);
      setWarehouseId(null);
      setDetailError(null);
      setSaveError(null);
      setNotice(null);
      setIsDetailLoading(false);
      setViewMode('create');
    },
    onRetryDetail: () => {
      if (warehouseId)
        void openWarehouse(
          warehouseId,
          viewMode === 'edit' ? 'edit' : 'detail',
        );
    },
    onBackToList: backToList,
  };
}

'use client';

import {
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { WarehouseFilterParams } from '../types/warehouse';
import type {
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from '../types/warehouse';
import {
  createWarehouse,
  deactivateWarehouse,
  updateWarehouse,
  type AuthenticatedRequest,
} from '../api/warehouses.api';
import { formatWarehouseApiError } from './format-api-error';
import type { WarehouseViewMode } from './use-warehouse-detail';

export function useWarehouseMutations(options: {
  request: AuthenticatedRequest;
  selectedFarmId: string | null;
  canWrite: boolean;
  viewMode: WarehouseViewMode;
  selectedWarehouse: Warehouse | null;
  aliveRef: MutableRefObject<boolean>;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setSaveError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  setFilters: Dispatch<SetStateAction<WarehouseFilterParams>>;
  setViewMode: (mode: WarehouseViewMode) => void;
  setSelectedWarehouse: (warehouse: Warehouse | null) => void;
  initialFilters: WarehouseFilterParams;
  reloadList: () => void;
}) {
  const submittingRef = useRef(false);

  async function submit(payload: CreateWarehouseInput | UpdateWarehouseInput) {
    const {
      request,
      selectedFarmId,
      canWrite,
      viewMode,
      selectedWarehouse,
      aliveRef,
      setIsSubmitting,
      setSaveError,
      setNotice,
      setFilters,
      setViewMode,
      setSelectedWarehouse,
      initialFilters,
      reloadList,
    } = options;

    if (submittingRef.current) return;

    if (!selectedFarmId || !canWrite) {
      setSaveError('Bạn không có quyền quản lý kho trong trang trại này.');
      return;
    }

    if (viewMode !== 'create' && (viewMode !== 'edit' || !selectedWarehouse)) return;

    if (Object.keys(payload).length === 0) {
      setSaveError('Chưa có thay đổi để lưu.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSaveError(null);
    setNotice(null);

    try {
      const response =
        viewMode === 'create'
          ? await createWarehouse(
              request,
              selectedFarmId,
              payload as CreateWarehouseInput,
            )
          : await updateWarehouse(
              request,
              selectedWarehouse!.id,
              selectedFarmId,
              payload,
            );
      if (!aliveRef.current) return;
      setNotice(
        `Đã ${viewMode === 'create' ? 'tạo' : 'cập nhật'} kho ${response.data.code}.`,
      );
      if (viewMode === 'create') {
        setFilters({ ...initialFilters });
        setViewMode('list');
      } else {
        setSelectedWarehouse(response.data);
        setViewMode('detail');
        reloadList();
      }
    } catch (error: unknown) {
      if (aliveRef.current) setSaveError(formatWarehouseApiError(error, true));
    } finally {
      submittingRef.current = false;
      if (aliveRef.current) setIsSubmitting(false);
    }
  }

  async function deactivate() {
    const {
      request,
      selectedFarmId,
      canWrite,
      selectedWarehouse,
      aliveRef,
      setIsSubmitting,
      setSaveError,
      setNotice,
      setSelectedWarehouse,
      setViewMode,
      reloadList,
    } = options;
    if (submittingRef.current || !selectedFarmId || !canWrite || !selectedWarehouse)
      return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSaveError(null);
    setNotice(null);
    try {
      const response = await deactivateWarehouse(
        request,
        selectedWarehouse.id,
        selectedFarmId,
      );
      if (!aliveRef.current) return;
      setSelectedWarehouse(response.data);
      setViewMode('detail');
      setNotice(`Đã vô hiệu hóa kho ${response.data.code}.`);
      reloadList();
    } catch (error: unknown) {
      if (aliveRef.current) setSaveError(formatWarehouseApiError(error, true));
    } finally {
      submittingRef.current = false;
      if (aliveRef.current) setIsSubmitting(false);
    }
  }

  return {
    isSubmitting: options.isSubmitting,
    onFormSubmit: submit,
    onDeactivate: deactivate,
  };
}

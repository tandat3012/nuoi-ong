"use client";

import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import {
  initialWarehouseFilters,
  useWarehouseFilters,
} from "./use-warehouse-filters";
import { useWarehousePermissions } from "./use-warehouse-permissions";
import { useWarehouseList } from "./use-warehouse-list";
import { useWarehouseDetail } from "./use-warehouse-detail";
import { useWarehouseMutations } from "./use-warehouse-mutations";
import { useState } from "react";

export function useWarehouses() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId, farmName, canWrite } = useWarehousePermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    filters,
    setFilters,
    onSearchChange,
    onStatusChange,
    onResetFilters,
    onPageChange,
    onReload,
  } = useWarehouseFilters();

  const list = useWarehouseList(request, selectedFarmId, filters, setFilters);

  const detail = useWarehouseDetail(
    request,
    selectedFarmId,
    canWrite,
    isSubmitting,
  );

  const mutations = useWarehouseMutations({
    request,
    selectedFarmId,
    canWrite,
    viewMode: detail.viewMode,
    selectedWarehouse: detail.selectedWarehouse,
    aliveRef: detail.aliveRef,
    isSubmitting,
    setIsSubmitting,
    setSaveError: detail.setSaveError,
    setNotice: detail.setNotice,
    setFilters,
    setViewMode: detail.setViewMode,
    setSelectedWarehouse: detail.setSelectedWarehouse,
    initialFilters: initialWarehouseFilters,
    reloadList: onReload,
  });

  return {
    farmName,
    canWrite,
    filters,
    ...list,
    ...detail,
    ...mutations,
    isBusy: mutations.isSubmitting,
    onSearchChange,
    onStatusChange,
    onResetFilters,
    onPageChange,
    onReload,
  };
}

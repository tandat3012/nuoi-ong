"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type {
  InventoryFilters,
  InventoryListResponse,
} from "../types/inventory";
import { getInventoryBalances } from "../api/inventory.api";
import {
  changeInventoryItem,
  changeInventoryLot,
  changeInventoryWarehouse,
} from "../inventory.logic";

function inventoryError(error: unknown) {
  if (error instanceof ApiError && error.status === 403)
    return "Bạn không có quyền xem tồn kho của trang trại này.";
  if (error instanceof ApiError && error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return "Không thể tải tồn kho hiện tại. Vui lòng thử lại.";
}

export function useInventoryList(
  farmId: string,
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">,
  refreshToken = 0,
) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<InventoryFilters>({
    ...initialFilters,
    page: 1,
    pageSize: 20,
  });
  const [result, setResult] = useState<{
    farmId: string;
    refreshToken: number;
    filters: InventoryFilters;
    response?: InventoryListResponse;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getInventoryBalances(request, farmId, filters)
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (filters.page > lastPage) {
          setFilters((previous) => ({ ...previous, page: lastPage }));
          return;
        }
        setResult({ farmId, refreshToken, filters, response });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setResult({
            farmId,
            refreshToken,
            filters,
            error: inventoryError(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, filters, refreshToken, request]);

  const current =
    result?.farmId === farmId &&
    result.refreshToken === refreshToken &&
    result.filters === filters
      ? result
      : null;
  return {
    filters,
    balances: current?.response?.data ?? [],
    pageInfo: current?.response?.page,
    isLoading: !current,
    error: current?.error,
    changeWarehouse: (warehouseId?: string) =>
      setFilters((previous) => changeInventoryWarehouse(previous, warehouseId)),
    changeItem: (itemId?: string) =>
      setFilters((previous) => changeInventoryItem(previous, itemId)),
    changeLot: (lotId?: string) =>
      setFilters((previous) => changeInventoryLot(previous, lotId)),
    changePage: (page: number) =>
      setFilters((previous) => ({ ...previous, page: Math.max(1, page) })),
    reload: () => setFilters((previous) => ({ ...previous })),
  };
}

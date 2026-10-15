"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type {
  InventoryLedgerFilters,
  InventoryLedgerResponse,
  InventoryTransactionType,
} from "../types/inventory";
import { getInventoryTransactions } from "../api/inventory.api";
import {
  changeInventoryLedgerItem,
  changeInventoryLedgerType,
  changeInventoryLedgerWarehouse,
} from "../inventory.logic";

function inventoryLedgerError(error: unknown) {
  if (error instanceof ApiError && error.status === 403)
    return "Bạn không có quyền xem lịch sử biến động của trang trại này.";
  if (error instanceof ApiError && error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return "Không thể tải lịch sử biến động. Vui lòng thử lại.";
}

export function useInventoryLedger(
  farmId: string,
  initialFilters: Pick<InventoryLedgerFilters, "warehouseId" | "itemId">,
  refreshToken = 0,
) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<InventoryLedgerFilters>({
    ...initialFilters,
    page: 1,
    pageSize: 20,
  });
  const [result, setResult] = useState<{
    farmId: string;
    refreshToken: number;
    filters: InventoryLedgerFilters;
    response?: InventoryLedgerResponse;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getInventoryTransactions(request, farmId, filters)
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
            error: inventoryLedgerError(error),
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
    transactions: current?.response?.data ?? [],
    pageInfo: current?.response?.page,
    isLoading: !current,
    error: current?.error,
    changeWarehouse: (warehouseId?: string) =>
      setFilters((previous) =>
        changeInventoryLedgerWarehouse(previous, warehouseId),
      ),
    changeItem: (itemId?: string) =>
      setFilters((previous) => changeInventoryLedgerItem(previous, itemId)),
    changeType: (transactionType?: InventoryTransactionType) =>
      setFilters((previous) =>
        changeInventoryLedgerType(previous, transactionType),
      ),
    changePage: (page: number) =>
      setFilters((previous) => ({ ...previous, page: Math.max(1, page) })),
    reload: () => setFilters((previous) => ({ ...previous })),
  };
}

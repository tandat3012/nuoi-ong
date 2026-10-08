import type { PaginatedResponse } from "@/shared/api/contracts";
import {
  getWarehouses,
  type AuthenticatedRequest,
} from "@/features/warehouses/api/warehouses.api";
import type {
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentResponse,
  InventoryFilters,
  InventoryItemOption,
  InventoryLedgerFilters,
  InventoryLedgerResponse,
  InventoryListResponse,
  InventoryLotOption,
} from "../types/inventory";

export function getInventoryBalances(
  request: AuthenticatedRequest,
  farmId: string,
  filters: InventoryFilters,
) {
  return request<InventoryListResponse>("/inventory", {
    params: { farmId, ...filters },
  });
}

export function createInventoryAdjustment(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateInventoryAdjustmentInput,
) {
  return request<{ data: InventoryAdjustmentResponse }>(
    "/inventory/adjustments",
    {
      method: "POST",
      params: { farmId },
      data: input,
    },
  );
}

export function getInventoryTransactions(
  request: AuthenticatedRequest,
  farmId: string,
  filters: InventoryLedgerFilters,
) {
  return request<InventoryLedgerResponse>("/inventory/transactions", {
    params: { farmId, ...filters },
  });
}

export function getInventoryItems(
  request: AuthenticatedRequest,
  farmId: string,
  page: number,
) {
  return request<PaginatedResponse<InventoryItemOption>>("/items", {
    params: { farmId, page, pageSize: 100 },
  });
}

export function getInventoryWarehouses(
  request: AuthenticatedRequest,
  farmId: string,
  page: number,
) {
  return getWarehouses(request, { farmId, page, pageSize: 100 });
}

export function getInventoryLots(
  request: AuthenticatedRequest,
  farmId: string,
  itemId: string,
  page: number,
) {
  return request<PaginatedResponse<InventoryLotOption>>("/lots", {
    params: { farmId, itemId, page, pageSize: 100 },
  });
}

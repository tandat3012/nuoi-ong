import type { PaginatedResponse } from "@/shared/api/contracts";
import {
  getWarehouses,
  type AuthenticatedRequest,
} from "@/features/warehouses/api/warehouses.api";
import type {
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentListResponse,
  InventoryAdjustmentResponse,
  InventoryAdjustmentStatus,
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

export function getInventoryAdjustments(
  request: AuthenticatedRequest,
  farmId: string,
  filters: {
    status?: InventoryAdjustmentStatus;
    warehouseId?: string;
    itemId?: string;
    mine?: boolean;
    page: number;
    pageSize?: number;
  },
) {
  return request<InventoryAdjustmentListResponse>("/inventory/adjustments", {
    params: { farmId, pageSize: 20, ...filters },
  });
}

export function reviewInventoryAdjustment(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  decision: { action: "approve" } | { action: "reject"; reason: string },
) {
  return request<{ data: InventoryAdjustmentResponse }>(
    `/inventory/adjustments/${id}/${decision.action}`,
    {
      method: "POST",
      params: { farmId },
      data: decision.action === "reject" ? { reason: decision.reason } : {},
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

import type { PaginatedResponse } from "@/shared/api/contracts";
import {
  getWarehouses,
  type AuthenticatedRequest,
} from "@/features/warehouses/api/warehouses.api";
import type {
  ReceiptItemReference,
  ReceiptLocationReference,
} from "@/features/receipts/types/receipt";
import type {
  Asset,
  AssetChoice,
  AssetFilters,
  AssetLookupKind,
  AssetView,
  ReturnAssetInput,
  AssetHistoryEntry,
  AssetHistoryKind,
  AssetHolder,
  AssetMetadataInput,
  CreateAssetInput,
} from "../types/asset";

export function getAssets(
  request: AuthenticatedRequest,
  farmId: string,
  filters: AssetFilters,
) {
  return request<PaginatedResponse<AssetView>>("/assets", {
    params: { ...filters, search: filters.search?.trim() || undefined, farmId },
  });
}

export function getAsset(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: AssetView }>(`/assets/${encodeURIComponent(id)}`, {
    params: { farmId },
  });
}

export function getAssetByCode(
  request: AuthenticatedRequest,
  farmId: string,
  code: string,
) {
  return request<{ data: AssetView }>(
    `/assets/by-code/${encodeURIComponent(code)}`,
    { params: { farmId } },
  );
}

export function returnAsset(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  input: ReturnAssetInput,
) {
  return request<{ data: Asset }>(`/assets/${encodeURIComponent(id)}/return`, {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export async function getAssetChoices(
  request: AuthenticatedRequest,
  farmId: string,
  kind: AssetLookupKind,
  filters: {
    page: number;
    search: string;
    warehouseId?: string;
    activeOnly?: boolean;
  },
): Promise<PaginatedResponse<AssetChoice>> {
  const params = {
    page: filters.page,
    pageSize: 10,
    search: filters.search.trim() || undefined,
    status: filters.activeOnly ? ("ACTIVE" as const) : undefined,
  };
  if (kind === "warehouse") {
    const response = await getWarehouses(request, { ...params, farmId });
    return {
      ...response,
      data: response.data.map((row) => ({
        id: row.id,
        label: `${row.code} — ${row.name}`,
      })),
    };
  }
  if (kind === "item") {
    const response = await request<PaginatedResponse<ReceiptItemReference>>(
      "/items",
      {
        params: { ...params, trackingMode: "ASSET", farmId },
      },
    );
    return {
      ...response,
      data: response.data.map(({ item }) => ({
        id: item.id,
        label: `${item.code} — ${item.name}`,
      })),
    };
  }
  if (kind === "member") {
    const response = await request<
      PaginatedResponse<{ id: string; name: string; email: string | null }>
    >("/assets/members", {
      params: { ...params, farmId },
    });
    return {
      ...response,
      data: response.data.map((member) => ({
        id: member.id,
        label: member.name || member.email || "Thành viên",
      })),
    };
  }
  const response = await request<PaginatedResponse<ReceiptLocationReference>>(
    "/locations",
    {
      params: { ...params, warehouseId: filters.warehouseId, farmId },
    },
  );
  return {
    ...response,
    data: response.data.map((row) => ({
      id: row.id,
      label: `${row.code} — ${row.name}`,
    })),
  };
}

export function getAssetHolder(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: AssetHolder | null }>(
    `/assets/${encodeURIComponent(id)}/holder`,
    { params: { farmId } },
  );
}

export function getAssetHistory(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  kind: AssetHistoryKind,
  page: number,
) {
  return request<PaginatedResponse<AssetHistoryEntry>>(
    `/assets/${encodeURIComponent(id)}/history`,
    { params: { farmId, kind, page, pageSize: 10 } },
  );
}

export function createAsset(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateAssetInput,
) {
  return request<{ data: Asset }>("/assets", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function updateAsset(
  request: AuthenticatedRequest,
  farmId: string,
  asset: Asset,
  input: AssetMetadataInput,
) {
  return request<{ data: Asset }>(`/assets/${encodeURIComponent(asset.id)}`, {
    method: "PATCH",
    params: { farmId },
    data: { ...input, updatedAt: asset.updatedAt },
  });
}

export function assetAction(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  action: string,
  input: object,
) {
  return request<unknown>(`/assets/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function maintenanceAction(
  request: AuthenticatedRequest,
  farmId: string,
  id: string | null,
  action: "create" | "start" | "complete" | "cancel",
  input: object = {},
) {
  return request<unknown>(
    id
      ? `/maintenance-records/${encodeURIComponent(id)}/${action}`
      : "/maintenance-records",
    { method: "POST", params: { farmId }, data: input },
  );
}

export function getAssetLabel(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: { assetCode: string; svg: string } }>(
    `/assets/${encodeURIComponent(id)}/label`,
    { params: { farmId } },
  );
}

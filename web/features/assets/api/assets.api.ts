import type { PaginatedResponse } from "@/shared/api/contracts";
import { getWarehouses, type AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { ReceiptItemReference, ReceiptLocationReference } from "@/features/receipts/types/receipt";
import type { AssetChoice, AssetLookupKind } from "../types/asset";

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

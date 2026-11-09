import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  WarrantyAction,
  WarrantyKind,
  WarrantyRequest,
  WarrantyStatus,
} from "./warranty.logic";

export function getWarranties(
  request: AuthenticatedRequest,
  farmId: string,
  filters: { page: number; status?: WarrantyStatus; orderId?: string },
) {
  return request<PaginatedResponse<WarrantyRequest>>("/store-warranties", {
    params: { farmId, pageSize: 20, ...filters },
  });
}

export function createWarranty(
  request: AuthenticatedRequest,
  farmId: string,
  body: {
    orderId: string;
    orderItemId: string;
    quantity: number;
    assetId?: string;
    kind: WarrantyKind;
    issueDescription: string;
    intakeNote?: string;
  },
) {
  return request<{ data: WarrantyRequest }>("/store-warranties", {
    method: "POST",
    params: { farmId },
    data: body,
  });
}

export function runWarrantyAction(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  body: { action: WarrantyAction } & Record<string, string | boolean | undefined>,
) {
  return request<{ data: WarrantyRequest }>(
    `/store-warranties/${encodeURIComponent(id)}/actions`,
    { method: "POST", params: { farmId }, data: body },
  );
}

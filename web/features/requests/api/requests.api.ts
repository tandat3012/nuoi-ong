import type { ApiRequestOptions } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  MaintenanceRequestRecord,
  RequestedMaintenanceType,
  RequestDetail,
  RequestRow,
  RequestStatusFilter,
  RequestType,
  TransferRequestRecord,
} from "../types/request";

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, "accessToken">,
) => Promise<T>;

const PATHS = {
  maintenance: "/maintenance-requests",
  transfer: "/asset-transfer-requests",
} as const;

export function getRequests(
  request: AuthenticatedRequest,
  farmId: string,
  type: RequestType,
  filters: { page: number; status: RequestStatusFilter; assetId?: string },
) {
  return request<PaginatedResponse<RequestRow>>(PATHS[type], {
    params: {
      farmId,
      assetId: filters.assetId,
      status: filters.status === "ALL" ? undefined : filters.status,
      page: filters.page,
      pageSize: 20,
    },
  });
}

export function getRequestById(
  request: AuthenticatedRequest,
  farmId: string,
  type: RequestType,
  id: string,
) {
  return request<{ data: RequestDetail }>(`${PATHS[type]}/${encodeURIComponent(id)}`, {
    params: { farmId },
  });
}

export function createMaintenanceRequest(
  request: AuthenticatedRequest,
  farmId: string,
  input: { assetId: string; maintenanceType: RequestedMaintenanceType; description: string },
) {
  return request<{ data: MaintenanceRequestRecord }>(PATHS.maintenance, {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function createTransferRequest(
  request: AuthenticatedRequest,
  farmId: string,
  input: { assetId: string; warehouseId: string; locationId: string; note?: string },
) {
  return request<{ data: TransferRequestRecord }>(PATHS.transfer, {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function approveMaintenanceRequest(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  scheduledAt: string,
) {
  return request<{
    data: { request: MaintenanceRequestRecord; maintenanceRecord: { id: string } };
  }>(`${PATHS.maintenance}/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    params: { farmId },
    data: { scheduledAt },
  });
}

export function approveTransferRequest(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: { request: TransferRequestRecord; asset: { id: string } } }>(
    `${PATHS.transfer}/${encodeURIComponent(id)}/approve`,
    { method: "POST", params: { farmId } },
  );
}

export function rejectRequest(
  request: AuthenticatedRequest,
  farmId: string,
  type: RequestType,
  id: string,
  rejectionReason: string,
) {
  return request<{ data: MaintenanceRequestRecord | TransferRequestRecord }>(
    `${PATHS[type]}/${encodeURIComponent(id)}/reject`,
    { method: "POST", params: { farmId }, data: { rejectionReason } },
  );
}

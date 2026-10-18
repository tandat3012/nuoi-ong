import type { ApiRequestOptions } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  CreateIssueInput,
  Issue,
  IssueDetail,
  IssueDraftTrackingMode,
  IssueFilters,
  IssueItemReference,
  IssueLotSuggestion,
  IssueAssetReference,
  IssueMaintenanceReference,
} from "../types/issue";

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, "accessToken">,
) => Promise<T>;

export function getIssues(
  request: AuthenticatedRequest,
  farmId: string,
  filters: IssueFilters,
) {
  return request<PaginatedResponse<Issue>>("/stock-issues", {
    params: {
      farmId,
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
    },
  });
}

export function getIssueById(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: IssueDetail }>(`/stock-issues/${id}`, {
    params: { farmId },
  });
}

export function createIssue(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateIssueInput,
) {
  return request<{ data: IssueDetail }>("/stock-issues", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function updateIssue(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  input: CreateIssueInput,
) {
  return request<{ data: IssueDetail }>(`/stock-issues/${id}`, {
    method: "PATCH",
    params: { farmId },
    data: input,
  });
}

export function confirmIssue(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: IssueDetail }>(`/stock-issues/${id}/confirm`, {
    method: "POST",
    params: { farmId },
  });
}

export function cancelIssue(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: IssueDetail }>(`/stock-issues/${id}/cancel`, {
    method: "POST",
    params: { farmId },
  });
}

export function getIssueCatalogItems(
  request: AuthenticatedRequest,
  farmId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    trackingMode?: IssueDraftTrackingMode;
  },
) {
  return request<PaginatedResponse<IssueItemReference>>("/items", {
    params: {
      farmId,
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search?.trim() || undefined,
      status: "ACTIVE",
      trackingMode: filters.trackingMode ?? "QUANTITY",
    },
  });
}

export function getIssueLotSuggestions(
  request: AuthenticatedRequest,
  farmId: string,
  warehouseId: string,
  itemId: string,
) {
  return request<IssueLotSuggestion[]>("/lots/suggestions", {
    params: { farmId, warehouseId, itemId },
  });
}

export function getIssueAssets(
  request: AuthenticatedRequest,
  farmId: string,
  warehouseId: string,
  itemId: string,
  filters: { page: number; pageSize: number; search?: string },
) {
  return request<PaginatedResponse<IssueAssetReference>>("/assets", {
    params: {
      farmId,
      warehouseId,
      itemId,
      status: "AVAILABLE",
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search?.trim() || undefined,
    },
  });
}

export function getIssueAsset(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: IssueAssetReference }>(`/assets/${id}`, {
    params: { farmId },
  });
}

export function getIssueMaintenanceRecords(
  request: AuthenticatedRequest,
  farmId: string,
  filters: { page: number; pageSize: number },
) {
  return request<PaginatedResponse<IssueMaintenanceReference>>(
    "/maintenance-records",
    {
      params: { farmId, page: filters.page, pageSize: filters.pageSize },
    },
  );
}

export function getIssueMaintenanceRecord(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: IssueMaintenanceReference }>(
    `/maintenance-records/${id}`,
    {
      params: { farmId },
    },
  );
}

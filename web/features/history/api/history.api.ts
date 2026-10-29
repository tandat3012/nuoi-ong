import type { ApiRequestOptions } from "@/shared/api/client";
import type { AuditLogPage, HistoryFilters } from "../types/history";

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, "accessToken">,
) => Promise<T>;

export function getAuditLogs(
  request: AuthenticatedRequest,
  farmId: string,
  filters: HistoryFilters,
) {
  return request<AuditLogPage>("/audit-logs", {
    params: {
      farmId,
      page: filters.page,
      pageSize: filters.pageSize,
      ...(filters.entityType?.trim() ? { entityType: filters.entityType.trim() } : {}),
      ...(filters.action?.trim() ? { action: filters.action.trim() } : {}),
      ...(filters.entityId?.trim() ? { entityId: filters.entityId.trim() } : {}),
    },
  });
}

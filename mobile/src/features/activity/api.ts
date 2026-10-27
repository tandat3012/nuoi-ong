import { apiRequest } from '@/src/shared/api/client';

export type AuditLog = {
  id: string;
  farmId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
};

export type AuditLogPage = {
  data: AuditLog[];
  scope: 'FARM' | 'CREATED_BY_ME';
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

export type AuditLogFilters = { page?: number; action?: string; entityType?: string };

export function listAuditLogs(token: string, farmId: string, pageSize = 20, filters: AuditLogFilters = {}) {
  return apiRequest<AuditLogPage>('/audit-logs', {
    token,
    params: { farmId, page: filters.page ?? 1, pageSize, action: filters.action || undefined, entityType: filters.entityType || undefined },
  });
}

export async function getAuditLog(token: string, farmId: string, id: string) {
  const response = await apiRequest<{ data: AuditLog }>(`/audit-logs/${encodeURIComponent(id)}`, {
    token,
    params: { farmId },
  });
  return response.data;
}

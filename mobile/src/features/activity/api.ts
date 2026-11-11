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
  scope: 'FARM' | 'PERFORMED_BY_ME';
  references?: Record<string, string>;
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

export type AuditLogDetail = {
  data: AuditLog;
  references: Record<string, string>;
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

export async function getAuditLogDetail(token: string, farmId: string, id: string): Promise<AuditLogDetail> {
  const response = await apiRequest<{ data: AuditLog; references?: Record<string, string> }>(
    `/audit-logs/${encodeURIComponent(id)}`,
    {
      token,
      params: { farmId },
    },
  );
  if (response.references !== undefined) {
    return { data: response.data, references: response.references };
  }
  let fallbackReferences: Record<string, string> = {};
  if (response.data.entityId) {
    try {
      const list = await apiRequest<AuditLogPage>('/audit-logs', {
        token,
        params: { farmId, entityId: response.data.entityId, page: 1, pageSize: 20 },
      });
      fallbackReferences = list.references ?? {};
    } catch {
      fallbackReferences = {};
    }
  }
  return { data: response.data, references: fallbackReferences };
}

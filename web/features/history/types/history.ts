import type { PaginatedResponse } from "@/shared/api/contracts";

export type AuditLog = {
  id: string;
  farmId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
};

export type AuditLogPage = PaginatedResponse<AuditLog> & {
  /** Codes or names for the ids in this page, keyed by id. */
  references: Record<string, string>;
};

export type HistoryQuery = {
  entityType: string;
  action: string;
  entityId: string;
  page: number;
};

export type HistoryFilters = {
  entityType?: string;
  action?: string;
  entityId?: string;
  page: number;
  pageSize: number;
};

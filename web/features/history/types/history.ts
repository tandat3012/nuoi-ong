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

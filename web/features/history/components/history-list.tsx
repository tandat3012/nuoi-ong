"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { getAuditLogs } from "../api/history.api";
import { historyEntityIdError, historyErrorMessage } from "../history.logic";
import type { AuditLog, HistoryFilters } from "../types/history";
import { HistoryEntry } from "./history-entry";

export function HistoryList({ farmId, filters, revision, onPageChange, showEntity = false }: {
  farmId: string;
  filters: HistoryFilters;
  revision: number;
  onPageChange: (page: number) => void;
  showEntity?: boolean;
}) {
  const request = useAuthenticatedRequest();
  const { entityType, entityId, action, page, pageSize } = filters;
  const invalid = historyEntityIdError(entityId ?? "");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response?: PaginatedResponse<AuditLog>;
    error?: string;
    status?: number | null;
  } | null>(null);
  const key = JSON.stringify([farmId, entityType, entityId, action, page, pageSize, revision, attempt]);

  useEffect(() => {
    if (invalid) return;
    let cancelled = false;
    void getAuditLogs(request, farmId, { entityType, entityId, action, page, pageSize })
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (page > lastPage) {
          onPageChange(lastPage);
          return;
        }
        setResult({ key, response });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const status = failure instanceof ApiError ? failure.status : null;
        setResult({ key, status, error: historyErrorMessage(status, failure instanceof ApiError ? failure.message : "") });
      });
    return () => { cancelled = true; };
  }, [request, farmId, entityType, entityId, action, page, pageSize, key, invalid, onPageChange]);

  const current = result?.key === key ? result : null;
  if (invalid) return <ErrorAlert className="m-4" message={invalid} />;
  if (!current) return <p role="status" className="p-5">Đang tải lịch sử thay đổi…</p>;
  if (current.error) return <ErrorAlert className="m-4" message={current.error}
    onRetry={current.status === 401 || current.status === 403 ? undefined : () => setAttempt((value) => value + 1)} />;
  if (!current.response) return null;
  return (
    <>
      {!current.response.data.length && <p role="status" className="p-5 text-sm text-muted-foreground">Chưa có lịch sử thay đổi phù hợp.</p>}
      <ul aria-label="Các thay đổi" className="divide-y">
        {current.response.data.map((log) => <li key={log.id}><HistoryEntry log={log} showEntity={showEntity} /></li>)}
      </ul>
      <Pagination pageInfo={current.response.page} itemLabel="thay đổi" onPageChange={onPageChange} />
    </>
  );
}

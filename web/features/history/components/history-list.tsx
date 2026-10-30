"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { getAuditLogs } from "../api/history.api";
import { historyEntityIdError, historyErrorMessage } from "../history.logic";
import type { AuditLogPage, HistoryFilters } from "../types/history";
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
    response?: AuditLogPage;
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
  if (!current) return (
    <div role="status" className="space-y-6 p-4 sm:p-6">
      <span className="sr-only">Đang tải lịch sử thay đổi…</span>
      {[0, 1].map((index) => (
        <div key={index} aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-32 rounded-lg border bg-muted/40" />
        </div>
      ))}
    </div>
  );
  if (current.error) return <ErrorAlert className="m-4" message={current.error}
    onRetry={current.status === 401 || current.status === 403 ? undefined : () => setAttempt((value) => value + 1)} />;
  if (!current.response) return null;
  const references = current.response.references ?? {};
  return (
    <>
      {!current.response.data.length && (
        <div role="status" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <History className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Chưa có lịch sử thay đổi phù hợp.</p>
          <p className="max-w-sm text-sm text-muted-foreground">Các thao tác được ghi nhận sẽ xuất hiện tại đây.</p>
        </div>
      )}
      <ul aria-label="Các thay đổi" className="divide-y bg-card text-card-foreground">
        {current.response.data.map((log) => <li key={log.id}><HistoryEntry log={log} references={references} showEntity={showEntity} /></li>)}
      </ul>
      <Pagination pageInfo={current.response.page} itemLabel="thay đổi" onPageChange={onPageChange} />
    </>
  );
}

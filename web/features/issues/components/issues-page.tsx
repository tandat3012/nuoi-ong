"use client";

import { useState } from "react";
import { useAuthContext } from "@/features/auth/context/auth-context";
import { useIssueList } from "../hooks/use-issue-list";
import {
  ISSUE_STATUS_LABELS,
  type IssueStatus,
  type IssueDetail as IssueDetailData,
} from "../types/issue";
import { IssueDetail } from "./issue-detail";
import { IssueTable } from "./issue-table";
import { IssueDraftForm } from "./issue-draft-form";

export function IssuesPage() {
  const { selectedFarmId } = useAuthContext();
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem phiếu xuất.</p>;
  return <FarmIssuesPage key={selectedFarmId} farmId={selectedFarmId} />;
}

function FarmIssuesPage({ farmId }: { farmId: string }) {
  const { data } = useAuthContext();
  const canWrite =
    data.memberships
      .find(({ farm }) => farm.id === farmId)
      ?.roles.some((role) => role === "ADMIN" || role === "FARM_OWNER") ??
    false;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IssueDetailData | null>(null);
  const {
    filters,
    issues,
    pageInfo,
    isLoading,
    error,
    changeStatus,
    changePage,
    reload,
  } = useIssueList(farmId);
  if (creating || editing)
    return (
      <IssueDraftForm
        key={editing?.issue.id ?? "new"}
        farmId={farmId}
        canWrite={canWrite}
        initial={editing ?? undefined}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
          reload();
        }}
        onSaved={(id) => {
          setCreating(false);
          setEditing(null);
          setSelectedId(id);
          reload();
        }}
      />
    );
  if (selectedId)
    return (
      <IssueDetail
        key={selectedId}
        farmId={farmId}
        id={selectedId}
        canWrite={canWrite}
        onEdit={setEditing}
        onChanged={reload}
        onBack={() => {
          setSelectedId(null);
          reload();
        }}
      />
    );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Phiếu xuất kho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi phiếu xuất và các dòng vật tư, lô, tài sản của trang trại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Tạo phiếu nháp
            </button>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Tải lại
          </button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <label htmlFor="issue-status" className="text-sm font-medium">
          Trạng thái
        </label>
        <select
          id="issue-status"
          value={filters.status ?? ""}
          onChange={(event) =>
            changeStatus(
              (event.target.value || undefined) as IssueStatus | undefined,
            )
          }
          className="rounded-lg border bg-background p-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(ISSUE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <p role="status">Đang tải danh sách phiếu xuất...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline">
            Thử lại
          </button>
        </div>
      ) : issues.length === 0 ? (
        <p role="status">
          {filters.status
            ? "Không có phiếu xuất phù hợp với trạng thái đã chọn."
            : "Chưa có phiếu xuất trong trang trại."}
        </p>
      ) : (
        <IssueTable issues={issues} onOpen={setSelectedId} />
      )}
      {pageInfo && (
        <nav
          aria-label="Phân trang phiếu xuất"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {pageInfo.totalItems === 0
              ? "0 phiếu xuất"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (${pageInfo.totalItems} phiếu xuất)`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pageInfo.number <= 1}
              onClick={() => changePage(pageInfo.number - 1)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => changePage(pageInfo.number + 1)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

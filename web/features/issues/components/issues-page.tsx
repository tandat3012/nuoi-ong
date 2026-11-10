"use client";

import { useState, useMemo } from "react";
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
import { IssueSummaryBar } from "./issue-summary-bar";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Select } from "@/shared/components/ui/select";
import { DateRangeFilter } from "@/shared/components/ui/date-range-filter";
import { canCreateStockDocuments } from "@/features/stock-documents";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Plus, RefreshCw, Search, RotateCcw, X, FileSpreadsheet } from "lucide-react";

export function IssuesPage() {
  const { selectedFarmId } = useAuthContext();
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem phiếu xuất.</p>;
  return <FarmIssuesPage key={selectedFarmId} farmId={selectedFarmId} />;
}

function FarmIssuesPage({ farmId }: { farmId: string }) {
  const { data } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === farmId);
  const viewer = {
    roles: membership?.roles ?? [],
    memberId: membership?.memberId,
  };
  const canWrite = canCreateStockDocuments(viewer.roles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IssueDetailData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    filters,
    issues,
    pageInfo,
    isLoading,
    error,
    changeStatus,
    changeDateRange,
    changePage,
    reload,
  } = useIssueList(farmId);

  const hasActiveFilters = Boolean(
    filters.status || filters.dateFrom || filters.dateTo || searchQuery.trim()
  );

  const resetAllFilters = () => {
    changeStatus(undefined);
    changeDateRange({ dateFrom: "", dateTo: "" });
    setSearchQuery("");
  };

  const displayedIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues;
    const query = searchQuery.trim().toLowerCase();
    return issues.filter((issue) => {
      const code = (issue.issueCode ?? "").toLowerCase();
      const warehouse = (issue.warehouseName ?? "").toLowerCase();
      const warehouseCode = (issue.warehouseCode ?? "").toLowerCase();
      const recipient = (issue.recipientName ?? "").toLowerCase();
      const reason = (issue.reason ?? "").toLowerCase();
      const note = (issue.note ?? "").toLowerCase();
      return (
        code.includes(query) ||
        warehouse.includes(query) ||
        warehouseCode.includes(query) ||
        recipient.includes(query) ||
        reason.includes(query) ||
        note.includes(query)
      );
    });
  }, [issues, searchQuery]);

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
        viewer={viewer}
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
      <PageHeader
        title="Phiếu xuất kho"
        description="Theo dõi phiếu xuất và các dòng vật tư, lô, tài sản của trang trại."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={reload}
              disabled={isLoading}
              className="gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>Tải lại</span>
            </Button>
            {canWrite && (
              <Button
                onClick={() => setCreating(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Tạo phiếu xuất</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPI Bar */}
      <IssueSummaryBar issues={issues} totalItems={pageInfo?.totalItems} />

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, kho xuất, người nhận, lý do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-8 text-xs font-normal text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Status and Date Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-44">
              <Select
                id="issue-status"
                value={filters.status ?? ""}
                onChange={(event) =>
                  changeStatus(
                    (event.target.value || undefined) as IssueStatus | undefined,
                  )
                }
                className="h-9 text-xs font-medium"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(ISSUE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <DateRangeFilter onApply={changeDateRange} />

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllFilters}
                className="h-9 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Đặt lại</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <BeeLoader label="Đang tải danh sách phiếu xuất..." />
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 text-xs font-semibold underline">
            Thử lại
          </button>
        </div>
      ) : displayedIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
          <FileSpreadsheet className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {hasActiveFilters ? "Không tìm thấy phiếu xuất phù hợp" : "Chưa có phiếu xuất kho nào"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilters
              ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh khoảng thời gian lọc."
              : "Lập phiếu xuất mới để theo dõi vật tư và tài sản xuất dùng hoặc bán."}
          </p>
          {hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={resetAllFilters}
              className="mt-4 gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </Button>
          ) : canWrite ? (
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="mt-4 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Tạo phiếu xuất đầu tiên</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <IssueTable issues={displayedIssues} onOpen={setSelectedId} />
      )}

      {pageInfo && (
        <nav
          aria-label="Phân trang phiếu xuất"
          className="flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <p className="text-muted-foreground">
            {pageInfo.totalItems === 0
              ? "0 phiếu xuất"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (Tổng ${pageInfo.totalItems} phiếu)`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number <= 1}
              onClick={() => changePage(pageInfo.number - 1)}
              className="h-8 text-xs font-medium"
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => changePage(pageInfo.number + 1)}
              className="h-8 text-xs font-medium"
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

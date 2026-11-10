'use client';

import { useAuthContext } from '@/features/auth/context/auth-context';
import { useFarmMembership } from '@/features/auth/hooks/use-farm-membership';
import { startTransition, useEffect, useState, useMemo } from 'react';
import { ReceiptDetail } from './receipt-detail';
import { ReceiptDraftForm } from './receipt-draft-form';
import { ReceiptSummaryBar } from './receipt-summary-bar';
import { useReceiptList } from '../hooks/use-receipt-list';
import {
  RECEIPT_STATUS_LABELS,
  type ReceiptDraftInitial,
  type ReceiptStatus,
} from '../types/receipt';
import { ReceiptTable } from './receipt-table';
import { ReceiptDraftPicker, type DraftChoice } from './receipt-draft-picker';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/select';
import { DateRangeFilter } from '@/shared/components/ui/date-range-filter';
import { canCreateReceipts, useStockDocumentQuery } from '@/features/stock-documents';
import { useSearchParams } from 'next/navigation';
import { receiptPresetFromQuery } from './receipt-draft.logic';
import { useNotificationRefresh } from '@/features/notifications';
import { BeeLoader } from '@/shared/components/ui/bee-loader';
import { Plus, RefreshCw, Search, RotateCcw, X } from 'lucide-react';

export function ReceiptsPage() {
  const { selectedFarmId } = useAuthContext();
  const notificationRevision = useNotificationRefresh();

  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem phiếu nhập.</p>;

  return <FarmReceiptsPage key={`${selectedFarmId}:${notificationRevision}`} farmId={selectedFarmId} />;
}

function FarmReceiptsPage({ farmId }: { farmId: string }) {
  const { membership } = useFarmMembership();
  const roles = membership?.roles ?? [];
  const canCreate = canCreateReceipts(roles);
  const searchParams = useSearchParams();
  const [presetDraft, setPresetDraft] = useState(() =>
    receiptPresetFromQuery(searchParams),
  );
  const viewer = { roles, memberId: membership?.memberId };
  const [selectedId, setSelectedId] = useStockDocumentQuery();
  const [creating, setCreating] = useState(Boolean(presetDraft));
  const [editing, setEditing] = useState<ReceiptDraftInitial | null>(null);
  const [warehouseFilter, setWarehouseFilter] =
    useState<DraftChoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    startTransition(() => { setCreating(false); setEditing(null); });
  }, [selectedId]);

  const {
    filters,
    receipts,
    pageInfo,
    isLoading,
    error,
    changeStatus,
    changeWarehouse,
    changeDateRange,
    changePage,
    reload,
  } = useReceiptList(farmId);

  const hasActiveFilters = Boolean(
    filters.status ||
    filters.warehouseId ||
    filters.dateFrom ||
    filters.dateTo ||
    searchQuery.trim()
  );

  const resetAllFilters = () => {
    changeStatus(undefined);
    changeWarehouse(undefined);
    setWarehouseFilter(null);
    changeDateRange({ dateFrom: '', dateTo: '' });
    setSearchQuery('');
  };

  const displayedReceipts = useMemo(() => {
    if (!searchQuery.trim()) return receipts;
    const query = searchQuery.trim().toLowerCase();
    return receipts.filter((r) => {
      const code = (r.receiptCode ?? '').toLowerCase();
      const warehouse = (r.warehouseName ?? '').toLowerCase();
      const supplier = (r.supplierName ?? '').toLowerCase();
      const note = (r.note ?? '').toLowerCase();
      return (
        code.includes(query) ||
        warehouse.includes(query) ||
        supplier.includes(query) ||
        note.includes(query)
      );
    });
  }, [receipts, searchQuery]);

  if (creating || editing) {
    return (
      <ReceiptDraftForm
        farmId={farmId}
        canWrite={canCreate}
        initial={editing ?? undefined}
        preset={presetDraft ?? undefined}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
          setPresetDraft(null);
          reload();
        }}
        onSaved={(id) => {
          setCreating(false);
          setEditing(null);
          setPresetDraft(null);
          reload();
          setSelectedId(id);
        }}
      />
    );
  }

  if (selectedId)
    return (
      <ReceiptDetail
        key={selectedId}
        farmId={farmId}
        id={selectedId}
        viewer={viewer}
        onBack={() => setSelectedId(null)}
        onEdit={setEditing}
        onConfirmed={reload}
        onCancelled={() => {
          setSelectedId(null);
          reload();
        }}
      />
    );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Phiếu nhập kho"
        description="Lập phiếu nháp, quản lý dòng hàng và xác nhận nhập kho, cập nhật lô hoặc tài sản."
        actions={
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button
                onClick={() => setCreating(true)}
                className="h-9 gap-1.5 shadow-xs font-semibold text-xs"
              >
                <Plus className="size-4" />
                <span>Tạo phiếu nhập</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={isLoading}
              className="h-9 gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </Button>
          </div>
        }
      />

      {/* Summary KPI Bar */}
      <ReceiptSummaryBar
        receipts={receipts}
        totalItems={pageInfo?.totalItems}
        isLoading={isLoading}
      />

      {/* Filter & Search Bar */}
      <section
        aria-label="Lọc danh sách phiếu nhập"
        className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bộ lọc & Tìm kiếm chứng từ
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh theo mã phiếu (PN-), tên nhà cung cấp, tên kho hoặc ghi chú..."
            className="w-full h-9.5 rounded-lg border border-border bg-background pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Status filter */}
          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Trạng thái phiếu
            <Select
              id="receipt-status"
              value={filters.status ?? ''}
              onChange={(event) =>
                changeStatus(
                  (event.target.value || undefined) as ReceiptStatus | undefined,
                )
              }
              className="h-9 font-normal text-xs"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(RECEIPT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          {/* Warehouse filter */}
          <div className="grid gap-1.5 text-xs font-medium text-foreground">
            <div className="flex items-center justify-between">
              <span>Kho nhập</span>
              {warehouseFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setWarehouseFilter(null);
                    changeWarehouse(undefined);
                  }}
                  className="text-[0.7rem] text-primary hover:underline"
                >
                  Bỏ chọn kho
                </button>
              )}
            </div>
            <ReceiptDraftPicker
              kind="warehouse-filter"
              farmId={farmId}
              value={warehouseFilter}
              placeholder="Tất cả kho nhập"
              onSelect={(choice) => {
                setWarehouseFilter(choice);
                changeWarehouse(choice.id);
              }}
            />
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="pt-2 border-t border-border/40">
          <DateRangeFilter onApply={changeDateRange} />
        </div>
      </section>

      {/* Content area */}
      {isLoading ? (
        <BeeLoader label="Đang tải danh sách phiếu nhập..." />
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline font-medium">
            Thử lại
          </button>
        </div>
      ) : displayedReceipts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            {hasActiveFilters
              ? 'Không có phiếu nhập nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.'
              : 'Chưa có phiếu nhập nào trong trang trại.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc để xem toàn bộ</span>
            </button>
          )}
        </div>
      ) : (
        <ReceiptTable receipts={displayedReceipts} onOpen={setSelectedId} />
      )}

      {/* Pagination */}
      {pageInfo && (
        <nav
          aria-label="Phân trang phiếu nhập"
          className="flex flex-wrap items-center justify-between gap-3 pt-2"
        >
          <p className="text-xs text-muted-foreground font-medium">
            {pageInfo.totalItems === 0
              ? '0 phiếu nhập'
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (Tổng cộng ${pageInfo.totalItems} phiếu nhập)`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number <= 1}
              onClick={() => changePage(pageInfo.number - 1)}
              className="text-xs font-medium"
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => changePage(pageInfo.number + 1)}
              className="text-xs font-medium"
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

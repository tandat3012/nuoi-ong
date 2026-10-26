'use client';

import { useAuthContext } from '@/features/auth/context/auth-context';
import { useFarmMembership } from '@/features/auth/hooks/use-farm-membership';
import { useState } from 'react';
import { ReceiptDetail } from './receipt-detail';
import { ReceiptDraftForm } from './receipt-draft-form';
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

export function ReceiptsPage() {
  const { selectedFarmId } = useAuthContext();

  if (!selectedFarmId)
    return <p>Vui lòng chọn trang trại để xem phiếu nhập.</p>;

  return <FarmReceiptsPage key={selectedFarmId} farmId={selectedFarmId} />;
}

function FarmReceiptsPage({ farmId }: { farmId: string }) {
  const { canManageFarm: canWrite } = useFarmMembership();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReceiptDraftInitial | null>(null);
  const [warehouseFilter, setWarehouseFilter] =
    useState<DraftChoice | null>(null);
  const [selectingWarehouse, setSelectingWarehouse] = useState(false);

  const {
    filters,
    receipts,
    pageInfo,
    isLoading,
    error,
    changeStatus,
    changeWarehouse,
    changePage,
    reload,
  } = useReceiptList(farmId);

  if (creating || editing) {
    return (
      <ReceiptDraftForm
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
        canWrite={canWrite}
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
    <div className="space-y-6">
      <PageHeader
        title="Phiếu nhập kho"
        description="Lập phiếu nháp, xác nhận để cập nhật tồn kho, lô hoặc tài sản."
        actions={
          <>
            {canWrite && <Button onClick={() => setCreating(true)}>Tạo phiếu nháp</Button>}
            <Button variant="outline" onClick={reload} disabled={isLoading}>
              Tải lại
            </Button>
          </>
        }
      />
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="receipt-status" className="text-sm font-medium">
            Trạng thái
          </label>
          <div className="w-44"><Select
            id="receipt-status"
            value={filters.status ?? ''}
            onChange={(event) =>
              changeStatus(
                (event.target.value || undefined) as ReceiptStatus | undefined,
              )
            }
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(RECEIPT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select></div>
          <span className="text-sm font-medium">
            Kho: {warehouseFilter?.label ?? 'Tất cả kho'}
          </span>
          <Button variant="outline"
            onClick={() => setSelectingWarehouse(true)}
          >
            Lọc theo kho
          </Button>
          {warehouseFilter && (
            <button
              type="button"
              onClick={() => {
                setWarehouseFilter(null);
                changeWarehouse(undefined);
              }}
              className="text-sm underline"
            >
              Bỏ lọc kho
            </button>
          )}
        </div>
        {selectingWarehouse && (
          <ReceiptDraftPicker
            kind="warehouse-filter"
            farmId={farmId}
            onSelect={(choice) => {
              setWarehouseFilter(choice);
              changeWarehouse(choice.id);
              setSelectingWarehouse(false);
            }}
            onClose={() => setSelectingWarehouse(false)}
          />
        )}
      </div>
      {isLoading ? (
        <p role="status">Đang tải danh sách phiếu nhập...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline">
            Thử lại
          </button>
        </div>
      ) : receipts.length === 0 ? (
        <p role="status">
          {filters.status
            ? 'Không có phiếu nhập phù hợp với trạng thái đã chọn.'
            : filters.warehouseId
              ? 'Không có phiếu nhập trong kho đã chọn.'
              : 'Chưa có phiếu nhập trong trang trại.'}
        </p>
      ) : (
        <ReceiptTable receipts={receipts} onOpen={setSelectedId} />
      )}
      {pageInfo && (
        <nav
          aria-label="Phân trang phiếu nhập"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {pageInfo.totalItems === 0
              ? '0 phiếu nhập'
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (${pageInfo.totalItems} phiếu nhập)`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline"
              disabled={pageInfo.number <= 1}
              onClick={() => changePage(pageInfo.number - 1)}
            >
              Trang trước
            </Button>
            <Button variant="outline"
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => changePage(pageInfo.number + 1)}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

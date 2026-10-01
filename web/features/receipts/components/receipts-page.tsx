'use client';

import { useAuthContext } from '@/features/auth/context/auth-context';
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

export function ReceiptsPage() {
  const { selectedFarmId } = useAuthContext();

  if (!selectedFarmId)
    return <p>Vui lòng chọn trang trại để xem phiếu nhập.</p>;

  return <FarmReceiptsPage key={selectedFarmId} farmId={selectedFarmId} />;
}

function FarmReceiptsPage({ farmId }: { farmId: string }) {
  const { data } = useAuthContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReceiptDraftInitial | null>(null);
  const [warehouseFilter, setWarehouseFilter] =
    useState<DraftChoice | null>(null);
  const [selectingWarehouse, setSelectingWarehouse] = useState(false);
  const canWrite =
    data.memberships
      .find(({ farm }) => farm.id === farmId)
      ?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ??
    false;

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

  const buttonClass =
    'rounded-xl border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50';
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Phiếu nhập kho</h1>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => setCreating(true)}
            >
              Tạo phiếu nháp
            </button>
          )}
          <button
            type="button"
            className={buttonClass}
            onClick={reload}
            disabled={isLoading}
          >
            Tải lại
          </button>
        </div>
      </header>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="receipt-status" className="text-sm font-medium">
            Trạng thái
          </label>
          <select
            id="receipt-status"
            className="rounded-lg border bg-background p-2 text-sm"
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
          </select>
          <span className="text-sm font-medium">
            Kho: {warehouseFilter?.label ?? 'Tất cả kho'}
          </span>
          <button
            type="button"
            onClick={() => setSelectingWarehouse(true)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Lọc theo kho
          </button>
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
          className="rounded-xl border border-destructive/30 p-4 text-destructive"
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
            <button
              type="button"
              className={buttonClass}
              disabled={pageInfo.number <= 1}
              onClick={() => changePage(pageInfo.number - 1)}
            >
              Trang trước
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => changePage(pageInfo.number + 1)}
            >
              Trang sau
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

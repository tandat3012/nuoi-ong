'use client';

import { useAuthContext } from '@/features/auth/context/auth-context';
import { useWarehouses } from '../hooks/use-warehouses';
import { WarehouseDetail } from './warehouse-detail';
import { WarehouseFilterToolbar } from './warehouse-filter-toolbar';
import { WarehouseForm } from './warehouse-form';
import { WarehousePagination } from './warehouse-pagination';
import { WarehouseTable } from './warehouse-table';

export function WarehousesPage() {
  const { selectedFarmId } = useAuthContext();
  if (!selectedFarmId) return <p>Vui lòng chọn trang trại để xem kho.</p>;
  return <FarmWarehousesPage key={selectedFarmId} />;
}

function FarmWarehousesPage() {
  const warehouse = useWarehouses();
  const {
    farmName,
    canWrite,
    viewMode,
    selectedWarehouse,
    filters,
    warehouses,
    pageInfo,
    isLoading,
    isDetailLoading,
    isSubmitting,
    errorMessage,
    detailError,
    saveError,
    notice,
    onSearchChange,
    onStatusChange,
    onResetFilters,
    onPageChange,
    onViewDetail,
    onStartCreate,
    onStartEdit,
    onBackToList,
    onFormSubmit,
    onDeactivate,
    onRetryDetail,
    onReload,
  } = warehouse;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Quản lý kho
            </h1>
            <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
              {farmName}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý thông tin các kho lưu trữ của trang trại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={viewMode === 'detail' ? onRetryDetail : onReload}
            disabled={
              isLoading ||
              isDetailLoading ||
              isSubmitting ||
              viewMode === 'create' ||
              viewMode === 'edit'
            }
            className="rounded-xl border px-3.5 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            ↻ Tải lại
          </button>
          {canWrite && viewMode === 'list' && (
            <button
              type="button"
              onClick={onStartCreate}
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              + Thêm kho
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border bg-secondary p-4 text-sm">
          {notice}
        </p>
      )}
      {viewMode !== 'create' && viewMode !== 'edit' && saveError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {saveError}
        </p>
      )}

      {(viewMode === 'detail' || viewMode === 'edit') &&
      (isDetailLoading || detailError || !selectedWarehouse) ? (
        <section className="rounded-xl border p-5">
          {isDetailLoading ? (
            <p role="status">Đang tải chi tiết kho...</p>
          ) : (
            <div role="alert">
              <p>{detailError ?? 'Không có dữ liệu chi tiết.'}</p>
              <button
                type="button"
                onClick={onRetryDetail}
                className="mt-2 underline"
              >
                Thử lại
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onBackToList}
            disabled={isSubmitting}
            className="mt-4 underline disabled:opacity-50"
          >
            Quay lại danh sách
          </button>
        </section>
      ) : viewMode === 'detail' && selectedWarehouse ? (
        <WarehouseDetail
          warehouse={selectedWarehouse}
          canWrite={canWrite}
          isSubmitting={isSubmitting}
          onBack={onBackToList}
          onEdit={() => onStartEdit(selectedWarehouse)}
          onDeactivate={onDeactivate}
        />
      ) : (viewMode === 'create' || viewMode === 'edit') && !canWrite ? (
        <section role="alert" className="rounded-xl border p-5">
          <p>Bạn không có quyền tạo hoặc sửa kho trong trang trại này.</p>
          <button
            type="button"
            onClick={onBackToList}
            className="mt-2 underline"
          >
            Quay lại danh sách
          </button>
        </section>
      ) : viewMode === 'create' || viewMode === 'edit' ? (
        viewMode === 'edit' && (isDetailLoading || !selectedWarehouse) ? (
          <p role="status">Đang tải thông tin kho...</p>
        ) : (
          <WarehouseForm
            key={`${viewMode}:${selectedWarehouse?.id ?? 'new'}`}
            mode={viewMode}
            farmName={farmName}
            initialWarehouse={viewMode === 'edit' ? selectedWarehouse : null}
            isSubmitting={isSubmitting}
            errorMessage={saveError}
            onSubmit={onFormSubmit}
            onCancel={onBackToList}
          />
        )
      ) : (
        <div className="space-y-6">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <div>
                <p className="font-semibold">Đã xảy ra lỗi:</p>
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={onReload}
                className="rounded-xl border border-destructive/40 bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-destructive/10"
              >
                Thử lại
              </button>
            </div>
          )}
          <WarehouseFilterToolbar
            filters={filters}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onResetFilters={onResetFilters}
          />
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <WarehouseTable
              warehouses={warehouses}
              filters={filters}
              canWrite={canWrite}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onStartCreate={onStartCreate}
              onViewDetail={onViewDetail}
              onStartEdit={onStartEdit}
            />
            <WarehousePagination
              pageInfo={pageInfo}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

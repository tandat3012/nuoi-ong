'use client';

import * as React from 'react';
import { useAuthContext } from '@/features/auth/context/auth-context';
import { useWarehouses } from '../hooks/use-warehouses';
import { WarehouseDetail } from './warehouse-detail';
import { WarehouseFilterToolbar } from './warehouse-filter-toolbar';
import { WarehouseForm } from './warehouse-form';
import { WarehouseTable } from './warehouse-table';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Pagination } from '@/shared/components/ui/pagination';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { Card } from '@/shared/components/ui/card';
import { RotateCcw, Plus, AlertCircle } from 'lucide-react';
import { BeeLoader } from '@/shared/components/ui/bee-loader';

export function WarehousesPage() {
  const { selectedFarmId } = useAuthContext();
  const [previousFarmId, setPreviousFarmId] = React.useState(selectedFarmId);
  const [farmChanged, setFarmChanged] = React.useState(false);

  if (previousFarmId !== selectedFarmId) {
    setPreviousFarmId(selectedFarmId);
    setFarmChanged(true);
  }

  if (!selectedFarmId) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        Vui lòng chọn trang trại để xem kho.
      </p>
    );
  }

  return (
    <>
      {farmChanged && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-border bg-secondary p-3.5 text-xs text-secondary-foreground"
        >
          Đã đổi trang trại. Biểu mẫu cũ đã đóng; thay đổi chưa lưu không được
          giữ. Yêu cầu lưu đã gửi (nếu có) vẫn được xử lý ở trang trại trước.
        </div>
      )}
      <FarmWarehousesPage key={selectedFarmId} />
    </>
  );
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
      <Card className="p-5 sm:p-6">
        <PageHeader
          title="Quản lý kho"
          badge={
            <Badge variant="secondary" className="font-semibold">
              {farmName}
            </Badge>
          }
          description="Quản lý địa điểm lưu trữ, tiếp nhận vật tư và điều kiện bảo quản của trang trại."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={viewMode === 'detail' ? onRetryDetail : onReload}
                disabled={
                  isLoading ||
                  isDetailLoading ||
                  isSubmitting ||
                  viewMode === 'create' ||
                  viewMode === 'edit'
                }
                isLoading={isLoading}
                title="Tải lại danh sách"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Tải lại</span>
              </Button>
              {canWrite && viewMode === 'list' && (
                <Button
                  size="sm"
                  onClick={onStartCreate}
                  disabled={isSubmitting}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Thêm kho</span>
                </Button>
              )}
            </>
          }
        />
      </Card>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground"
        >
          {notice}
        </div>
      )}

      {viewMode !== 'create' && viewMode !== 'edit' && saveError && (
        <ErrorAlert message={saveError} />
      )}

      {(viewMode === 'detail' || viewMode === 'edit') &&
      (isDetailLoading || detailError || !selectedWarehouse) ? (
        <Card className="p-6">
          {isDetailLoading ? (
            <BeeLoader label="Đang tải chi tiết kho..." size="sm" />
          ) : (
            <div role="alert" className="space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="size-4 shrink-0" />
                <p>{detailError ?? 'Không có dữ liệu chi tiết.'}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetryDetail}
              >
                Thử lại
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onBackToList}
            disabled={isSubmitting}
            className="mt-4"
          >
            ← Quay lại danh sách
          </Button>
        </Card>
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
        <Card className="p-6" role="alert">
          <p className="text-sm text-destructive font-medium">
            Bạn không có quyền tạo hoặc sửa kho trong trang trại này.
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onBackToList}
            className="mt-3"
          >
            ← Quay lại danh sách
          </Button>
        </Card>
      ) : viewMode === 'create' || viewMode === 'edit' ? (
        viewMode === 'edit' && (isDetailLoading || !selectedWarehouse) ? (
          <BeeLoader label="Đang tải thông tin kho..." />
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
            <ErrorAlert
              message={errorMessage}
              onRetry={onReload}
            />
          )}
          <WarehouseFilterToolbar
            filters={filters}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onResetFilters={onResetFilters}
          />
          <Card className="overflow-hidden">
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
            <Pagination
              pageInfo={pageInfo}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onPageChange={onPageChange}
              itemLabel="kho"
            />
          </Card>
        </div>
      )}
    </div>
  );
}

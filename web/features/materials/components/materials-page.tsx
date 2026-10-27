"use client";

import React, { useState } from "react";
import { useAuthContext } from "@/features/auth/context/auth-context";
import { useMaterials } from "../hooks/use-materials";
import { MaterialDetailView } from "./material-detail";
import { MaterialFilterToolbar } from "./material-filter-toolbar";
import { MaterialForm } from "./material-form";
import { MaterialTable } from "./material-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Card } from "@/shared/components/ui/card";
import { RotateCcw, Plus, AlertCircle } from "lucide-react";

export function MaterialsPage() {
  const { selectedFarmId } = useAuthContext();
  const [previousFarmId, setPreviousFarmId] = useState(selectedFarmId);
  const [farmChanged, setFarmChanged] = useState(false);

  if (previousFarmId !== selectedFarmId) {
    setPreviousFarmId(selectedFarmId);
    setFarmChanged(true);
  }

  if (!selectedFarmId)
    return <p className="text-sm text-muted-foreground p-4">Vui lòng chọn trang trại để xem vật tư.</p>;

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
      <FarmMaterialsPage key={selectedFarmId} farmId={selectedFarmId} />
    </>
  );
}

function FarmMaterialsPage({ farmId }: { farmId: string }) {
  const {
    farmName,
    canWrite,
    viewMode,
    selectedMaterial,
    filters,
    pageInfo,
    materials,
    categories,
    filterCategories,
    filterCategoriesLoading,
    filterCategoriesError,
    warehouses,
    warehousesLoading,
    units,
    isLoading,
    isDetailLoading,
    isSubmitting,
    detailError,
    saveError,
    notice,
    referencesLoading,
    referencesError,
    errorMessage,
    onSearchChange,
    onStatusChange,
    onKindChange,
    onTrackingModeChange,
    onCategoryChange,
    onWarehouseChange,
    onResetFilters,
    onPageChange,
    onViewDetail,
    onStartCreate,
    onStartEdit,
    onBackToList,
    onFormSubmit,
    onReload,
    onRetryDetail,
    onReloadReferences,
    onReloadFilterCategories,
  } = useMaterials();

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <PageHeader
          title="Quản lý vật tư"
          badge={
            <Badge variant="secondary" className="font-semibold">
              {farmName}
            </Badge>
          }
          description="Theo dõi vật tư theo farm đang chọn; số tồn thay đổi theo kho được chọn trong bộ lọc."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={viewMode === "detail" ? onRetryDetail : onReload}
                disabled={
                  isLoading ||
                  isDetailLoading ||
                  viewMode === "create" ||
                  viewMode === "edit"
                }
                isLoading={isLoading}
                title="Tải lại danh sách"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Tải lại</span>
              </Button>
              {canWrite && viewMode === "list" && (
                <Button size="sm" onClick={onStartCreate}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Thêm vật tư</span>
                </Button>
              )}
            </>
          }
        />
      </Card>

      {notice && (
        <div role="status" className="rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          {notice}
        </div>
      )}

      {referencesError && (
        <ErrorAlert
          title="Không thể tải danh mục / đơn vị tính:"
          message={referencesError}
          onRetry={onReloadReferences}
          retryLabel="Tải lại danh mục"
        />
      )}
      {filterCategoriesError && (
        <ErrorAlert
          title="Không thể tải danh mục vật tư của farm:"
          message={filterCategoriesError}
          onRetry={onReloadFilterCategories}
          retryLabel="Tải lại danh mục lọc"
        />
      )}

      {(viewMode === "edit" || viewMode === "create") && !canWrite ? (
        <Card className="p-6" role="alert">
          <p className="text-sm text-destructive font-medium">Bạn không có quyền tạo hoặc sửa vật tư trong trang trại này.</p>
          <Button
            variant="link"
            size="sm"
            onClick={onBackToList}
            className="mt-3"
          >
            ← Quay lại danh sách
          </Button>
        </Card>
      ) : (viewMode === "detail" || viewMode === "edit") &&
        (isDetailLoading || detailError || !selectedMaterial) ? (
        <Card className="p-6">
          {isDetailLoading ? (
            <p role="status" className="text-sm text-muted-foreground">Đang tải chi tiết vật tư...</p>
          ) : (
            <div role="alert" className="space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="size-4 shrink-0" />
                <p>{detailError ?? "Không có dữ liệu chi tiết."}</p>
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
            className="mt-4"
          >
            ← Quay lại danh sách
          </Button>
        </Card>
      ) : viewMode === "detail" && selectedMaterial ? (
        <MaterialDetailView
          material={selectedMaterial}
          farmId={farmId}
          canWrite={canWrite}
          onBack={onBackToList}
          onEdit={() => onStartEdit(selectedMaterial)}
        />
      ) : viewMode === "create" || viewMode === "edit" ? (
        referencesLoading || referencesError ? (
          <Card className="p-6">
            {referencesLoading && (
              <p role="status" className="text-sm text-muted-foreground">Đang tải danh mục và đơn vị tính...</p>
            )}
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
        ) : (
          <MaterialForm
            key={`${viewMode}:${selectedMaterial?.item.id ?? "new"}`}
            mode={viewMode}
            farmName={farmName}
            initialMaterial={viewMode === "edit" ? selectedMaterial : null}
            categories={categories}
            units={units}
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
          <MaterialFilterToolbar
            filters={filters}
            categories={filterCategories}
            filterCategoriesLoading={filterCategoriesLoading}
            warehouses={warehouses}
            warehousesLoading={warehousesLoading}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onKindChange={onKindChange}
            onTrackingModeChange={onTrackingModeChange}
            onCategoryChange={onCategoryChange}
            onWarehouseChange={onWarehouseChange}
            onResetFilters={onResetFilters}
          />
          <Card className="overflow-hidden">
            <MaterialTable
              materials={materials}
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
              itemLabel="vật tư"
            />
          </Card>
        </div>
      )}
    </div>
  );
}

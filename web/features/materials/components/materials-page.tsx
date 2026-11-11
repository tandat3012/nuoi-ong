"use client";

import React, { useState } from "react";
import { useAuthContext } from "@/features/auth/context/auth-context";
import { useMaterials } from "../hooks/use-materials";
import { MaterialDetailView } from "./material-detail";
import { MaterialFilterToolbar } from "./material-filter-toolbar";
import { MaterialForm } from "./material-form";
import { MaterialTable } from "./material-table";
import { MaterialSummaryBar } from "./material-summary-bar";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Card } from "@/shared/components/ui/card";
import { RefreshCw, Plus, AlertCircle } from "lucide-react";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

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
      <FarmMaterialsPage key={selectedFarmId} />
    </>
  );
}

function FarmMaterialsPage() {
  const {
    farmName,
    canWrite,
    viewMode,
    selectedMaterial,
    filters,
    pageInfo,
    materials,
    summary,
    categories,
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
  } = useMaterials();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý danh mục vật tư"
        badge={
          <Badge variant="secondary" className="font-semibold text-xs">
            {farmName}
          </Badge>
        }
        description="Theo dõi danh mục vật tư nông trại, quy cách đóng gói, định mức an toàn và hồ sơ hạn sử dụng."
        actions={
          <div className="flex items-center gap-2">
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
              className="h-9 gap-1.5 text-xs font-medium"
              title="Tải lại danh sách"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>Tải lại</span>
            </Button>
            {canWrite && viewMode === "list" && (
              <Button
                size="sm"
                onClick={onStartCreate}
                className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="size-4" aria-hidden="true" />
                <span>Thêm vật tư</span>
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300">
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
            <BeeLoader label="Đang tải chi tiết vật tư..." size="sm" />
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
          canWrite={canWrite}
          onBack={onBackToList}
          onEdit={() => onStartEdit(selectedMaterial)}
        />
      ) : viewMode === "create" || viewMode === "edit" ? (
        referencesLoading || referencesError ? (
          <Card className="p-6">
            {referencesLoading && (
              <BeeLoader label="Đang tải danh mục và đơn vị tính..." size="sm" />
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
          {/* Summary KPI Bar */}
          <MaterialSummaryBar
            materials={materials}
            totalItems={pageInfo?.totalItems}
            summary={summary}
          />

          {errorMessage && (
            <ErrorAlert
              message={errorMessage}
              onRetry={onReload}
            />
          )}

          {/* Filter Toolbar */}
          <MaterialFilterToolbar
            filters={filters}
            categories={categories}
            referencesLoading={referencesLoading}
            referencesError={referencesError}
            onSearchChange={onSearchChange}
            onStatusChange={onStatusChange}
            onKindChange={onKindChange}
            onTrackingModeChange={onTrackingModeChange}
            onCategoryChange={onCategoryChange}
            onResetFilters={onResetFilters}
          />

          {/* Table Container Section */}
          <section
            aria-label="Danh sách vật tư nông trại"
            aria-busy={isLoading}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Danh sách vật tư</h2>
                {pageInfo?.totalItems !== undefined && (
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {pageInfo.totalItems} vật tư
                  </span>
                )}
              </div>
            </div>

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

            <div className="border-t border-border p-4">
              <Pagination
                pageInfo={pageInfo}
                isLoading={isLoading}
                errorMessage={errorMessage}
                onPageChange={onPageChange}
                itemLabel="vật tư"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useAuthContext } from "@/features/auth/context/auth-context";
import { useMaterials } from "../hooks/use-materials";
import { MaterialDetailView } from "./material-detail";
import { MaterialFilterToolbar } from "./material-filter-toolbar";
import { MaterialForm } from "./material-form";
import { MaterialPagination } from "./material-pagination";
import { MaterialTable } from "./material-table";

export function MaterialsPage() {
  const { selectedFarmId } = useAuthContext();
  const [previousFarmId, setPreviousFarmId] = useState(selectedFarmId);
  const [farmChanged, setFarmChanged] = useState(false);

  if (previousFarmId !== selectedFarmId) {
    setPreviousFarmId(selectedFarmId);
    setFarmChanged(true);
  }

  if (!selectedFarmId) return <p>Vui lòng chọn trang trại để xem vật tư.</p>;
  return (
    <>
      {farmChanged && (
        <p
          role="status"
          className="mb-4 rounded-xl border bg-muted p-3 text-sm"
        >
          Đã đổi trang trại. Biểu mẫu cũ đã đóng; thay đổi chưa lưu không được
          giữ. Yêu cầu lưu đã gửi (nếu có) vẫn được xử lý ở trang trại trước.
        </p>
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
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Quản lý vật tư
            </h1>
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
              {farmName}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi, định mức tồn kho và hồ sơ quản lý hạn sử dụng vật tư nông
            trại.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={viewMode === "detail" ? onRetryDetail : onReload}
            disabled={
              isLoading ||
              isDetailLoading ||
              viewMode === "create" ||
              viewMode === "edit"
            }
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 disabled:opacity-50"
            title="Tải lại danh sách"
          >
            <span
              className={`size-4 text-xs ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              ↻
            </span>
            <span>Tải lại</span>
          </button>
          {canWrite && viewMode === "list" && (
            <button
              type="button"
              onClick={onStartCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2"
            >
              <span aria-hidden="true">+</span>
              <span>Thêm vật tư</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border bg-secondary p-4 text-sm">
          {notice}
        </p>
      )}
      {referencesError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          <p>Không thể tải danh mục/đơn vị tính. {referencesError}</p>
          <button
            type="button"
            onClick={onReloadReferences}
            className="mt-2 underline focus-visible:ring-2"
          >
            Thử tải lại danh mục
          </button>
        </div>
      )}

      {(viewMode === "edit" || viewMode === "create") && !canWrite ? (
        <section role="alert">
          <p>Bạn không có quyền tạo hoặc sửa vật tư trong trang trại này.</p>
          <button
            type="button"
            onClick={onBackToList}
            className="mt-2 underline"
          >
            Quay lại danh sách
          </button>
        </section>
      ) : (viewMode === "detail" || viewMode === "edit") &&
        (isDetailLoading || detailError || !selectedMaterial) ? (
        <section className="rounded-xl border p-5">
          {isDetailLoading ? (
            <p role="status">Đang tải chi tiết vật tư...</p>
          ) : (
            <div role="alert">
              <p>{detailError ?? "Không có dữ liệu chi tiết."}</p>
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
            className="mt-4 underline"
          >
            Quay lại danh sách
          </button>
        </section>
      ) : viewMode === "detail" && selectedMaterial ? (
        <MaterialDetailView
          material={selectedMaterial}
          canWrite={canWrite}
          onBack={onBackToList}
          onEdit={() => onStartEdit(selectedMaterial)}
        />
      ) : viewMode === "create" || viewMode === "edit" ? (
        referencesLoading || referencesError ? (
          <section>
            {referencesLoading && (
              <p role="status">Đang tải danh mục và đơn vị tính...</p>
            )}
            <button
              type="button"
              onClick={onBackToList}
              className="mt-2 underline"
            >
              Quay lại danh sách
            </button>
          </section>
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
            <div
              role="alert"
              className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <div>
                <p className="font-semibold">Đã xảy ra lỗi:</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={onReload}
                className="rounded-xl border border-destructive/40 bg-card px-3.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:ring-2"
              >
                Thử lại
              </button>
            </div>
          )}
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
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
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
            <MaterialPagination
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

"use client";

import type { MaterialFilterParams, MaterialListRow } from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";

interface MaterialTableProps {
  materials: MaterialListRow[];
  filters: MaterialFilterParams;
  canWrite: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onStartCreate: () => void;
  onViewDetail: (row: MaterialListRow) => void;
  onStartEdit: (row: MaterialListRow) => void;
}

export function MaterialTable({
  materials,
  filters,
  canWrite,
  isLoading,
  errorMessage,
  onStartCreate,
  onViewDetail,
  onStartEdit,
}: MaterialTableProps) {
  const hasFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.kind ||
    filters.trackingMode ||
    filters.categoryId,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3.5">
              Mã
            </th>
            <th scope="col" className="px-4 py-3.5">
              Tên vật tư
            </th>
            <th scope="col" className="px-4 py-3.5">
              Danh mục
            </th>
            <th scope="col" className="px-4 py-3.5">
              Phân loại
            </th>
            <th scope="col" className="px-4 py-3.5">
              Theo dõi
            </th>
            <th scope="col" className="px-4 py-3.5 text-right">
              Tồn hiện tại
            </th>
            <th scope="col" className="px-4 py-3.5 text-center">
              Trạng thái
            </th>
            <th scope="col" className="px-4 py-3.5 text-right">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {isLoading ? (
            <tr>
              <td
                colSpan={8}
                className="py-12 text-center text-muted-foreground"
              >
                <div className="inline-flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Đang tải danh sách vật tư...</span>
                </div>
              </td>
            </tr>
          ) : errorMessage ? (
            <tr>
              <td colSpan={8} className="py-12 text-center">
                Không thể hiển thị danh sách. Vui lòng thử lại.
              </td>
            </tr>
          ) : materials.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-16 text-center">
                <div className="mx-auto max-w-sm space-y-2">
                  <div className="text-2xl" aria-hidden="true">
                    📦
                  </div>
                  <p className="font-semibold text-foreground">
                    {hasFilters
                      ? "Không tìm thấy vật tư phù hợp"
                      : "Chưa có vật tư nào trong nông trại"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasFilters
                      ? "Thử điều chỉnh lại từ khóa hoặc xóa bớt tiêu chí lọc."
                      : "Bắt đầu bằng cách thêm vật tư đầu tiên cho trang trại của bạn."}
                  </p>
                  {canWrite && !filters.search && (
                    <button
                      type="button"
                      onClick={onStartCreate}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    >
                      + Thêm vật tư mới
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            materials.map((row) => (
              <tr
                key={row.item.id}
                className="transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3.5 font-mono text-xs font-medium text-foreground">
                  {row.item.code}
                </td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => onViewDetail(row)}
                    className="text-left font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {row.item.name}
                  </button>
                  {row.item.barcode && (
                    <p className="font-mono text-[0.7rem] text-muted-foreground">
                      {row.item.barcode}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  {row.categoryName || "—"}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {row.profile?.kind
                      ? MATERIAL_KIND_LABELS[row.profile.kind]
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {MATERIAL_TRACKING_MODE_LABELS[row.item.trackingMode]}
                </td>
                <td className="px-4 py-3.5 text-right font-medium text-foreground">
                  {row.quantityOnHand}{" "}
                  <span className="text-xs text-muted-foreground">
                    {row.unitSymbol ?? row.unitName ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      row.item.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                        : "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20"
                    }`}
                  >
                    {RECORD_STATUS_LABELS[row.item.status]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onViewDetail(row)}
                      className="rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2"
                    >
                      Chi tiết
                    </button>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => onStartEdit(row)}
                        className="rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted focus-visible:ring-2"
                      >
                        Sửa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import type { MaterialFilterParams, MaterialListRow } from "../types/material";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Boxes, Eye, Edit, Plus, Barcode } from "lucide-react";
import { formatInventoryQuantity } from "@/features/inventory";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import {
  MaterialKindBadge,
  MaterialStatusBadge,
  MaterialTrackingBadge,
} from "./material-badges";

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
    <div className="relative overflow-x-auto">
      <Table className="min-w-[820px]">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-36 font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Mã vật tư
            </TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Tên vật tư
            </TableHead>
            <TableHead className="w-36 font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Danh mục
            </TableHead>
            <TableHead className="w-36 font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Phân loại
            </TableHead>
            <TableHead className="w-36 font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Theo dõi
            </TableHead>
            <TableHead className="w-32 text-right font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Tồn hiện tại
            </TableHead>
            <TableHead className="w-32 text-center font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Trạng thái
            </TableHead>
            <TableHead className="w-36 text-right font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                <BeeLoader label="Đang tải danh sách vật tư..." size="sm" />
              </TableCell>
            </TableRow>
          ) : errorMessage ? (
            <TableRow>
              <TableCell colSpan={8} className="py-16 text-center text-destructive">
                Không thể hiển thị danh sách vật tư. Vui lòng thử tải lại.
              </TableCell>
            </TableRow>
          ) : materials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  icon={Boxes}
                  title={
                    hasFilters
                      ? "Không tìm thấy vật tư phù hợp"
                      : "Chưa có vật tư nào trong nông trại"
                  }
                  description={
                    hasFilters
                      ? "Thử điều chỉnh lại từ khóa hoặc xóa bớt tiêu chí lọc."
                      : "Bắt đầu bằng cách thêm vật tư đầu tiên cho trang trại của bạn."
                  }
                  action={
                    canWrite && !filters.search ? (
                      <Button size="sm" onClick={onStartCreate} className="gap-1.5 shadow-xs">
                        <Plus className="size-3.5" aria-hidden="true" />
                        <span>Thêm vật tư mới</span>
                      </Button>
                    ) : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            materials.map((row) => {
              const qtyNum = parseFloat(row.quantityOnHand) || 0;
              const isZero = qtyNum <= 0;

              return (
                <TableRow
                  key={row.item.id}
                  className="transition-colors hover:bg-muted/30 focus-within:bg-muted/30"
                >
                  {/* Code */}
                  <TableCell className="align-top py-3.5">
                    <button
                      type="button"
                      onClick={() => onViewDetail(row)}
                      className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-bold text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                    >
                      {row.item.code}
                    </button>
                  </TableCell>

                  {/* Name & Barcode */}
                  <TableCell className="align-top py-3.5">
                    <button
                      type="button"
                      onClick={() => onViewDetail(row)}
                      className="text-left font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                    >
                      <p className="text-xs font-semibold leading-snug">{row.item.name}</p>
                      {row.item.barcode && (
                        <span className="mt-1 inline-flex items-center gap-1 font-mono text-[0.6875rem] text-muted-foreground">
                          <Barcode className="size-3 shrink-0" aria-hidden="true" />
                          <span>{row.item.barcode}</span>
                        </span>
                      )}
                    </button>
                  </TableCell>

                  {/* Category */}
                  <TableCell className="align-top py-3.5 text-xs text-muted-foreground">
                    {row.categoryName || "—"}
                  </TableCell>

                  {/* Kind */}
                  <TableCell className="align-top py-3.5">
                    <MaterialKindBadge kind={row.profile?.kind} />
                  </TableCell>

                  {/* Tracking Mode */}
                  <TableCell className="align-top py-3.5">
                    <MaterialTrackingBadge mode={row.item.trackingMode} />
                  </TableCell>

                  {/* Stock Quantity */}
                  <TableCell className="align-top py-3.5 text-right tabular-nums">
                    <span
                      className={`text-xs font-bold ${
                        isZero
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {formatInventoryQuantity(row.quantityOnHand)}
                    </span>{" "}
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {row.unitSymbol ?? row.unitName ?? ""}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="align-top py-3.5 text-center">
                    <MaterialStatusBadge status={row.item.status} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="align-top py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 font-medium"
                        onClick={() => onViewDetail(row)}
                      >
                        <Eye className="size-3" aria-hidden="true" />
                        <span>Chi tiết</span>
                      </Button>
                      {canWrite && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 font-medium text-foreground hover:border-primary hover:text-primary"
                          onClick={() => onStartEdit(row)}
                        >
                          <Edit className="size-3" aria-hidden="true" />
                          <span>Sửa</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

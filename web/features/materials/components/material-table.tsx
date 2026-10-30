"use client";

import type { MaterialFilterParams, MaterialListRow } from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Loader2, Boxes, Eye, Edit } from "lucide-react";
import { formatInventoryQuantity } from "@/features/inventory";

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
    <Table className="min-w-[780px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-32 font-semibold uppercase tracking-wider text-[0.7rem]">
            Mã
          </TableHead>
          <TableHead className="font-semibold uppercase tracking-wider text-[0.7rem]">
            Tên vật tư
          </TableHead>
          <TableHead className="font-semibold uppercase tracking-wider text-[0.7rem]">
            Danh mục
          </TableHead>
          <TableHead className="w-32 font-semibold uppercase tracking-wider text-[0.7rem]">
            Phân loại
          </TableHead>
          <TableHead className="w-32 font-semibold uppercase tracking-wider text-[0.7rem]">
            Theo dõi
          </TableHead>
          <TableHead className="w-32 text-right font-semibold uppercase tracking-wider text-[0.7rem]">
            Tồn hiện tại
          </TableHead>
          <TableHead className="w-28 text-center font-semibold uppercase tracking-wider text-[0.7rem]">
            Trạng thái
          </TableHead>
          <TableHead className="w-36 text-right font-semibold uppercase tracking-wider text-[0.7rem]">
            Thao tác
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
              <div className="inline-flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                <span role="status">Đang tải danh sách vật tư...</span>
              </div>
            </TableCell>
          </TableRow>
        ) : errorMessage ? (
          <TableRow>
            <TableCell colSpan={8} className="py-12 text-center text-destructive">
              Không thể hiển thị danh sách vật tư.
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
                    <Button size="sm" onClick={onStartCreate}>
                      + Thêm vật tư mới
                    </Button>
                  ) : undefined
                }
              />
            </TableCell>
          </TableRow>
        ) : (
          materials.map((row) => (
            <TableRow key={row.item.id}>
              <TableCell className="font-mono text-xs font-semibold text-foreground">
                {row.item.code}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onViewDetail(row)}
                  className="text-left font-medium text-foreground transition-colors hover:text-primary hover:underline cursor-pointer"
                >
                  <p className="leading-tight">{row.item.name}</p>
                  {row.item.barcode && (
                    <p className="font-mono text-[0.65rem] text-muted-foreground mt-0.5">
                      {row.item.barcode}
                    </p>
                  )}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {row.categoryName || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal text-[0.7rem]">
                  {row.profile?.kind
                    ? MATERIAL_KIND_LABELS[row.profile.kind]
                    : "—"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {MATERIAL_TRACKING_MODE_LABELS[row.item.trackingMode]}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-foreground">
                {formatInventoryQuantity(row.quantityOnHand)}{" "}
                <span className="text-[0.7rem] font-normal text-muted-foreground">
                  {row.unitSymbol ?? row.unitName ?? "—"}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={row.item.status === "ACTIVE" ? "success" : "warning"}
                >
                  {RECORD_STATUS_LABELS[row.item.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
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
                      className="h-7 px-2.5 text-xs gap-1 text-primary hover:text-primary"
                      onClick={() => onStartEdit(row)}
                    >
                      <Edit className="size-3" aria-hidden="true" />
                      <span>Sửa</span>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

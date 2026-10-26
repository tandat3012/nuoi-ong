"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/client";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import {
  getInventoryAdjustments,
  reviewInventoryAdjustment,
} from "../api/inventory.api";
import type {
  InventoryAdjustmentListItem,
  InventoryAdjustmentListResponse,
  InventoryAdjustmentStatus,
} from "../types/inventory";
import {
  formatInventoryMovement,
  inventoryAdjustmentReasonLabel,
  inventoryUnitLabel,
} from "../inventory.logic";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Select } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Combobox } from "@/shared/components/ui/combobox";
import { useInventoryReferences } from "../hooks/use-inventory-references";

const STATUS_LABELS: Record<
  InventoryAdjustmentStatus,
  { label: string; variant: "warning" | "success" | "destructive" }
> = {
  PENDING_APPROVAL: { label: "Chờ duyệt", variant: "warning" },
  CONFIRMED: { label: "Đã ghi nhận", variant: "success" },
  REJECTED: { label: "Từ chối", variant: "destructive" },
};

function loadError(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error instanceof ApiError && error.status === 403)
    return "Bạn không có quyền xem đề xuất điều chỉnh của trang trại này.";
  return "Không thể tải danh sách đề xuất. Vui lòng thử lại.";
}

function reviewError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Chỉ chủ trại hoặc quản trị viên được duyệt đề xuất.";
    if (error.status === 404) return "Không tìm thấy đề xuất này nữa.";
    if (error.status === 409)
      return error.message.toLowerCase().includes("reviewed")
        ? "Đề xuất đã được người khác xử lý. Danh sách đã được tải lại."
        : "Không thể ghi nhận: tồn kho, kho, vật tư hoặc lô đã thay đổi. Hãy kiểm tra lại hoặc từ chối đề xuất.";
  }
  return "Chưa xác nhận được kết quả. Tải lại danh sách để kiểm tra trước khi thử lại.";
}

export function InventoryAdjustmentsView({
  farmId,
  canApprove,
  refreshToken,
  onReviewed,
}: {
  farmId: string;
  canApprove: boolean;
  refreshToken: number;
  onReviewed: () => void;
}) {
  const request = useAuthenticatedRequest();
  const references = useInventoryReferences(farmId);
  const [filters, setFilters] = useState<{
    status: InventoryAdjustmentStatus | "";
    warehouseId: string;
    itemId: string;
    mine: boolean;
  }>({ status: "PENDING_APPROVAL", warehouseId: "", itemId: "", mine: false });
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response?: InventoryAdjustmentListResponse;
    error?: string;
  } | null>(null);
  const [approving, setApproving] = useState<InventoryAdjustmentListItem | null>(
    null,
  );
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const key = JSON.stringify([farmId, filters, page, attempt, refreshToken]);
  const { status } = filters;

  function changeFilters(next: Partial<typeof filters>) {
    setFilters((previous) => ({ ...previous, ...next }));
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    getInventoryAdjustments(request, farmId, {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
      ...(filters.mine ? { mine: true } : {}),
      page,
    })
      .then((response) => {
        if (!cancelled) setResult({ key, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, error: loadError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, filters, key, page, request]);

  const current = result?.key === key ? result : null;
  const rows = current?.response?.data ?? [];
  const pageInfo = current?.response?.page;

  async function review(
    adjustment: InventoryAdjustmentListItem,
    decision: { action: "approve" } | { action: "reject"; reason: string },
  ) {
    setBusy(true);
    setMessage(null);
    try {
      await reviewInventoryAdjustment(request, farmId, adjustment.id, decision);
      setApproving(null);
      setRejectingId(null);
      setRejectReason("");
      onReviewed();
    } catch (error: unknown) {
      setApproving(null);
      setMessage(reviewError(error));
      // Someone else may have reviewed it: refresh the list and the pending badge.
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đề xuất điều chỉnh tồn"
        description={
          canApprove
            ? "Duyệt hoặc từ chối các đề xuất điều chỉnh do nhân viên gửi."
            : "Theo dõi trạng thái các đề xuất điều chỉnh tồn kho."
        }
        actions={
          <Button variant="outline" onClick={onReviewed} disabled={!current}>
            Tải lại
          </Button>
        }
      />

      <section
        aria-label="Lọc đề xuất điều chỉnh"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Trạng thái
          <Select
            value={filters.status}
            onChange={(event) =>
              changeFilters({
                status: event.target.value as InventoryAdjustmentStatus | "",
              })
            }
            className="font-normal"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Kho
          <Select
            value={filters.warehouseId}
            onChange={(event) =>
              changeFilters({ warehouseId: event.target.value })
            }
            disabled={references.isLoading || Boolean(references.error)}
            className="font-normal"
          >
            <option value="">Tất cả kho</option>
            {references.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Vật tư
          <Combobox
            value={filters.itemId}
            onChange={(itemId) => changeFilters({ itemId })}
            disabled={references.isLoading || Boolean(references.error)}
            placeholder="Tìm theo mã hoặc tên vật tư"
            emptyText="Không có vật tư khớp từ khóa."
            options={[
              { value: "", label: "Tất cả vật tư" },
              ...references.items.map(({ item }) => ({
                value: item.id,
                label: `${item.code} · ${item.name}`,
              })),
            ]}
            className="font-normal"
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={filters.mine}
            onChange={(event) => changeFilters({ mine: event.target.checked })}
            className="size-4"
          />
          Chỉ đề xuất của tôi
        </label>
      </section>
      {references.error && (
        <p role="alert" className="text-sm text-destructive">
          {references.error}{" "}
          <button
            type="button"
            onClick={references.reload}
            className="underline"
          >
            Tải lại danh sách kho và vật tư
          </button>
        </p>
      )}

      {message && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          {message}
        </p>
      )}

      {!current ? (
        <p role="status">Đang tải đề xuất điều chỉnh...</p>
      ) : current.error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{current.error}</p>
          <button
            type="button"
            onClick={() => setAttempt((previous) => previous + 1)}
            className="mt-2 underline"
          >
            Thử lại
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p role="status">
          {status === "PENDING_APPROVAL" &&
          !filters.warehouseId &&
          !filters.itemId &&
          !filters.mine
            ? "Không có đề xuất nào đang chờ duyệt."
            : "Không có đề xuất phù hợp."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => {
            const unit = inventoryUnitLabel(row.unit.symbol, row.unit.name);
            const statusInfo = STATUS_LABELS[row.status];
            return (
              <li key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      {row.item.code} · {row.item.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.warehouse.code} · {row.warehouse.name}
                      {row.lot ? ` · Lô ${row.lot.lotNumber ?? "—"}` : ""}
                    </p>
                    <p className="text-sm">
                      {inventoryAdjustmentReasonLabel(row.reasonCode)}
                      {row.note ? `: ${row.note}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Đề xuất bởi {row.requester.displayName ?? "—"} lúc{" "}
                      {new Date(row.createdAt).toLocaleString("vi-VN")}
                      {row.reviewer &&
                        ` · Xử lý bởi ${row.reviewer.displayName ?? "—"}`}
                    </p>
                    {row.rejectionReason && (
                      <p className="text-sm text-destructive">
                        Lý do từ chối: {row.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`text-lg font-semibold tabular-nums ${
                        row.quantityChange.startsWith("-")
                          ? "text-destructive"
                          : "text-success"
                      }`}
                    >
                      {formatInventoryMovement(row.quantityChange)} {unit}
                    </span>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>

                {canApprove && row.status === "PENDING_APPROVAL" && (
                  <div className="mt-3 border-t pt-3">
                    {rejectingId === row.id ? (
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const reason = rejectReason.trim();
                          if (reason)
                            void review(row, { action: "reject", reason });
                        }}
                      >
                        <label className="grid min-w-48 flex-1 gap-1.5 text-sm font-medium">
                          Lý do từ chối
                          <Input
                            required
                            maxLength={1000}
                            value={rejectReason}
                            onChange={(event) =>
                              setRejectReason(event.target.value)
                            }
                            disabled={busy}
                            className="font-normal"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRejectingId(null)}
                          disabled={busy}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={busy || rejectReason.trim().length === 0}
                        >
                          Xác nhận từ chối
                        </Button>
                      </form>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRejectingId(row.id);
                            setRejectReason("");
                          }}
                          disabled={busy}
                        >
                          Từ chối
                        </Button>
                        <Button
                          onClick={() => setApproving(row)}
                          disabled={busy}
                        >
                          Duyệt
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pageInfo && pageInfo.totalPages > 1 && (
        <nav
          aria-label="Phân trang đề xuất điều chỉnh"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            Trang {pageInfo.number} / {pageInfo.totalPages} (
            {pageInfo.totalItems} đề xuất)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pageInfo.number <= 1}
              onClick={() => setPage(pageInfo.number - 1)}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              disabled={pageInfo.number >= pageInfo.totalPages}
              onClick={() => setPage(pageInfo.number + 1)}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => !open && !busy && setApproving(null)}
        title="Duyệt đề xuất điều chỉnh?"
        description={
          approving &&
          `${approving.item.code} · ${approving.item.name}: ${formatInventoryMovement(
            approving.quantityChange,
          )} ${inventoryUnitLabel(approving.unit.symbol, approving.unit.name)}. Tồn kho sẽ được cập nhật ngay.`
        }
        confirmLabel="Duyệt và ghi tồn"
        variant="default"
        isLoading={busy}
        onConfirm={async () => {
          if (approving) await review(approving, { action: "approve" });
        }}
      />
    </div>
  );
}

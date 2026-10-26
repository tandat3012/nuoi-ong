"use client";

import { ApiError } from "@/shared/api/client";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  createInventoryAdjustment,
  getInventoryBalances,
} from "../api/inventory.api";
import { useInventoryReferences } from "../hooks/use-inventory-references";
import type {
  InventoryAdjustmentReasonCode,
  InventoryBalance,
  InventoryListResponse,
  InventoryTrackingMode,
} from "../types/inventory";
import {
  INVENTORY_ADJUSTMENT_REASONS,
  adjustmentIncreaseBlocked,
  formatInventoryExpiry,
  formatInventoryQuantity,
  inventoryUnitLabel,
  isValidInventoryAdjustmentQuantity,
  sumInventoryByItem,
} from "../inventory.logic";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select } from "@/shared/components/ui/select";
import { Combobox } from "@/shared/components/ui/combobox";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

type StockLookup = {
  key: string;
  attempt: number;
  response?: InventoryListResponse;
  error?: string;
};

function lookupError(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error instanceof ApiError && error.status === 403)
    return "Bạn không có quyền xem tồn kho của trang trại này.";
  return "Không thể kiểm tra tồn hiện tại. Vui lòng thử lại.";
}

function submitError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400)
      return {
        message:
          "Dữ liệu chưa hợp lệ. Kiểm tra số lượng, lý do và ghi chú điều chỉnh.",
        uncertain: false,
      };
    if (error.status === 401)
      return {
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        uncertain: false,
      };
    if (error.status === 403)
      return {
        message: "Bạn không có quyền điều chỉnh tồn kho của trang trại này.",
        uncertain: false,
      };
    if (error.status === 404)
      return {
        message:
          "Không tìm thấy kho, vật tư hoặc lô đã chọn. Hãy tải lại danh sách.",
        uncertain: false,
      };
    if (error.status === 409) {
      const message = error.message.toLowerCase();
      if (message.includes("warehouse"))
        return {
          message:
            "Kho đã chọn không còn hoạt động. Chọn một kho đang hoạt động.",
          uncertain: false,
        };
      if (message.includes("asset"))
        return {
          message: "Vật tư theo dõi tài sản không thể điều chỉnh thủ công.",
          uncertain: false,
        };
      if (message.includes("precision"))
        return {
          message: "Mức tồn sau điều chỉnh vượt quá độ chính xác được hỗ trợ.",
          uncertain: false,
        };
      if (message.includes("inactive"))
        return {
          message: "Vật tư đã ngừng hoạt động chỉ được điều chỉnh giảm.",
          uncertain: false,
        };
      if (message.includes("expired"))
        return {
          message: "Lô đã hết hạn chỉ được điều chỉnh giảm.",
          uncertain: false,
        };
      if (message.includes("idempotency"))
        return {
          message:
            "Lần gửi này trùng với một điều chỉnh khác. Đóng biểu mẫu và thử lại.",
          uncertain: false,
        };
      return {
        message:
          "Tồn kho đã thay đổi hoặc không đủ cho mức giảm này. Vui lòng kiểm tra lại số tồn hiện tại.",
        uncertain: false,
      };
    }
  }
  // Retrying the same form reuses its idempotency key, so a second POST cannot double-apply.
  return {
    message:
      "Chưa xác nhận được kết quả. Bấm gửi lại để thử tiếp; hệ thống sẽ không ghi trùng lần điều chỉnh này.",
    uncertain: true,
  };
}

export function InventoryAdjustmentDialog({
  farmId,
  requiresApproval,
  onClose,
  onSuccess,
}: {
  farmId: string;
  /** Employees submit a request that an owner must approve before stock changes. */
  requiresApproval: boolean;
  onClose: () => void;
  onSuccess: (pending: boolean) => void;
}) {
  const request = useAuthenticatedRequest();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mountedRef = useRef(false);
  const submittingRef = useRef(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [lotId, setLotId] = useState("");
  const [quantityChange, setQuantityChange] = useState("");
  const [reasonCode, setReasonCode] = useState<
    InventoryAdjustmentReasonCode | ""
  >("");
  const [note, setNote] = useState("");
  const [stockAttempt, setStockAttempt] = useState(0);
  const [stockLookup, setStockLookup] = useState<StockLookup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  // One key per distinct payload: an unchanged retry replays, an edited form is a new adjustment.
  const attemptRef = useRef<{ payload: string; key: string } | null>(null);
  const references = useInventoryReferences(farmId, itemId || undefined);
  // Whole-warehouse stock, only to label picker rows; the "Tồn hiện tại" box stays the source of truth.
  const [warehouseStock, setWarehouseStock] = useState<{
    warehouseId: string;
    balances?: InventoryBalance[];
    error?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    void (async () => {
      try {
        const balances: InventoryBalance[] = [];
        // shortcut: pages through every balance of the warehouse; switch to a per-item stock endpoint if warehouses hold thousands of rows.
        for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
          const response = await getInventoryBalances(request, farmId, {
            warehouseId,
            page,
            pageSize: 100,
          });
          if (cancelled) return;
          balances.push(...response.data);
          totalPages = response.page.totalPages;
        }
        setWarehouseStock({ warehouseId, balances });
      } catch {
        if (!cancelled) setWarehouseStock({ warehouseId, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [farmId, request, warehouseId]);

  const stockRows =
    warehouseStock?.warehouseId === warehouseId ? warehouseStock : null;
  const stockByItem = stockRows?.balances
    ? sumInventoryByItem(stockRows.balances)
    : null;
  function stockHint(
    trackingMode: InventoryTrackingMode,
    unit: string,
    quantity: string | undefined,
  ) {
    if (!warehouseId) return `Đơn vị: ${unit}`;
    if (trackingMode === "ASSET") return "Theo dõi tài sản";
    if (stockRows?.error) return "Không tải được tồn";
    if (!stockByItem) return "Đang tải tồn...";
    return `Tồn: ${quantity ?? "0"} ${unit}`;
  }

  useEffect(() => {
    mountedRef.current = true;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      mountedRef.current = false;
      dialog?.close();
    };
  }, []);

  const selectedItem = references.items.find(({ item }) => item.id === itemId);
  const trackingMode: InventoryTrackingMode | undefined =
    selectedItem?.item.trackingMode;
  const selectedWarehouse = references.warehouses.find(
    (warehouse) => warehouse.id === warehouseId,
  );
  const selectedLot = references.lots.find((lot) => lot.id === lotId);
  const validSelection =
    selectedWarehouse?.status === "ACTIVE" &&
    selectedItem !== undefined &&
    (trackingMode === "QUANTITY" ||
      (trackingMode === "LOT" && selectedLot !== undefined));
  const lookupKey = JSON.stringify([farmId, warehouseId, itemId, lotId]);

  useEffect(() => {
    if (!validSelection) return;
    let cancelled = false;
    void getInventoryBalances(request, farmId, {
      warehouseId,
      itemId,
      ...(trackingMode === "LOT" ? { lotId } : {}),
      page: 1,
      pageSize: 1,
    })
      .then((response) => {
        if (!cancelled)
          setStockLookup({ key: lookupKey, attempt: stockAttempt, response });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setStockLookup({
            key: lookupKey,
            attempt: stockAttempt,
            error: lookupError(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [
    farmId,
    itemId,
    lotId,
    lookupKey,
    request,
    stockAttempt,
    trackingMode,
    validSelection,
    warehouseId,
  ]);

  const currentLookup =
    stockLookup?.key === lookupKey && stockLookup.attempt === stockAttempt
      ? stockLookup
      : null;
  const stockIsLoading = validSelection && !currentLookup;
  const stockError = currentLookup?.error;
  const currentQuantity =
    currentLookup?.response?.data[0]?.quantityOnHand ?? "0";
  const noteLength = note.trim().length;
  const noteRequired = reasonCode === "OTHER";
  const quantityInvalid =
    quantityChange.length > 0 &&
    !isValidInventoryAdjustmentQuantity(quantityChange);
  const increaseBlocked = selectedItem
    ? adjustmentIncreaseBlocked(
        quantityChange,
        {
          itemInactive: selectedItem.item.status === "INACTIVE",
          lotExpiryDate: trackingMode === "LOT" ? selectedLot?.expiryDate : null,
        },
        new Date().toLocaleDateString("sv-SE"),
      )
    : null;
  const canSubmit =
    validSelection &&
    !stockIsLoading &&
    !stockError &&
    isValidInventoryAdjustmentQuantity(quantityChange) &&
    !increaseBlocked &&
    reasonCode !== "" &&
    (!noteRequired || noteLength > 0) &&
    noteLength <= 4000 &&
    !submitting;

  function closeDialog() {
    if (submittingRef.current) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !canSubmit || !selectedItem) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitMessage(null);

    const payload = {
      warehouseId,
      itemId,
      ...(trackingMode === "LOT" ? { lotId } : {}),
      quantityChange,
      reasonCode,
      ...(noteLength > 0 ? { note: note.trim() } : {}),
    };
    const payloadKey = JSON.stringify(payload);
    if (attemptRef.current?.payload !== payloadKey)
      attemptRef.current = { payload: payloadKey, key: crypto.randomUUID() };

    try {
      const { data } = await createInventoryAdjustment(request, farmId, {
        ...payload,
        idempotencyKey: attemptRef.current.key,
      });
      if (mountedRef.current)
        onSuccess(data.adjustment.status === "PENDING_APPROVAL");
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const result = submitError(error);
      setSubmitMessage(result.message);
      if (
        result.uncertain ||
        (error instanceof ApiError && error.status === 409)
      )
        setStockAttempt((previous) => previous + 1);
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="inventory-adjustment-title"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) closeDialog();
      }}
      className="m-auto max-h-[90vh] w-[min(100%-2rem,36rem)] overflow-y-auto rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="inventory-adjustment-title" className="text-xl font-bold">
              {requiresApproval ? "Đề xuất điều chỉnh tồn" : "Điều chỉnh tồn kho"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {requiresApproval
                ? "Đề xuất sẽ chờ chủ trại duyệt; tồn kho chỉ thay đổi sau khi được duyệt."
                : "Ghi nhận chênh lệch kiểm kê bằng một giao dịch kho."}
            </p>
          </div>
          <Button variant="outline"
            aria-label="Đóng điều chỉnh tồn kho"
            onClick={closeDialog}
            disabled={submitting}
          >
            Đóng
          </Button>
        </header>

        <label className="grid gap-1.5 text-sm font-medium">
          Kho đang hoạt động
          <Select
            required
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value);
              setStockAttempt((previous) => previous + 1);
              setSubmitMessage(null);
            }}
            disabled={
              submitting || references.isLoading || Boolean(references.error)
            }
            className="font-normal"
          >
            <option value="">Chọn kho</option>
            {references.warehouses
              .filter(({ status }) => status === "ACTIVE")
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
          </Select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Vật tư
          <Combobox
            required
            value={itemId}
            onChange={(value) => {
              setItemId(value);
              setLotId("");
              setStockAttempt((previous) => previous + 1);
              setSubmitMessage(null);
            }}
            disabled={
              submitting || references.isLoading || Boolean(references.error)
            }
            placeholder="Tìm theo mã hoặc tên vật tư"
            emptyText="Không có vật tư khớp từ khóa."
            options={references.items.map(({ item, unitName, unitSymbol }) => ({
              value: item.id,
              label: `${item.code} · ${item.name}${
                item.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""
              }`,
              hint: stockHint(
                item.trackingMode,
                inventoryUnitLabel(unitSymbol, unitName),
                stockByItem?.get(item.id),
              ),
            }))}
            className="font-normal"
          />
        </label>

        {trackingMode === "LOT" && (
          <label className="grid gap-1.5 text-sm font-medium">
            Lô
            <Select
              required
              value={lotId}
              onChange={(event) => {
                setLotId(event.target.value);
                setStockAttempt((previous) => previous + 1);
                setSubmitMessage(null);
              }}
              disabled={
                submitting ||
                references.lotsLoading ||
                Boolean(references.lotsError)
              }
              className="font-normal"
            >
              <option value="">
                {references.lotsLoading
                  ? "Đang tải lô..."
                  : references.lots.length === 0
                    ? "Không có lô"
                    : "Chọn lô"}
              </option>
              {references.lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber} · HSD {formatInventoryExpiry(lot.expiryDate)}
                  {stockRows?.balances && selectedItem
                    ? ` · Tồn ${formatInventoryQuantity(
                        stockRows.balances.find(
                          (balance) => balance.lot?.id === lot.id,
                        )?.quantityOnHand ?? "0",
                      )} ${inventoryUnitLabel(
                        selectedItem.unitSymbol,
                        selectedItem.unitName,
                      )}`
                    : ""}
                </option>
              ))}
            </Select>
            {!references.lotsLoading &&
              !references.lotsError &&
              references.lots.length === 0 && (
                <span
                  role="status"
                  className="font-normal text-muted-foreground"
                >
                  Vật tư này chưa có lô để điều chỉnh.
                </span>
              )}
          </label>
        )}

        {references.error && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <p>{references.error}</p>
            <button
              type="button"
              onClick={references.reload}
              className="mt-1 underline"
            >
              Tải lại danh sách vật tư và kho
            </button>
          </div>
        )}
        {references.isLoading && !references.error && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải danh sách vật tư và kho...
          </p>
        )}
        {references.lotsError && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <p>{references.lotsError}</p>
            <button
              type="button"
              onClick={references.reloadLots}
              className="mt-1 underline"
            >
              Tải lại danh sách lô
            </button>
          </div>
        )}

        {trackingMode === "ASSET" ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            Vật tư theo dõi tài sản không thể điều chỉnh bằng số lượng tổng hợp.
          </p>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">Tồn hiện tại</p>
            {!validSelection ? (
              <p className="mt-1 text-sm">
                Chọn kho, vật tư và lô để kiểm tra tồn.
              </p>
            ) : stockIsLoading ? (
              <p role="status" className="mt-1 text-sm">
                Đang kiểm tra tồn hiện tại...
              </p>
            ) : stockError ? (
              <div role="alert" className="mt-1 text-sm text-destructive">
                <p>{stockError}</p>
                <button
                  type="button"
                  onClick={() => setStockAttempt((previous) => previous + 1)}
                  className="mt-1 underline"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatInventoryQuantity(currentQuantity)}{" "}
                {selectedItem &&
                  inventoryUnitLabel(
                    selectedItem.unitSymbol,
                    selectedItem.unitName,
                  )}
              </p>
            )}
          </div>
        )}

        <label className="grid gap-1.5 text-sm font-medium">
          Mức điều chỉnh
          <Input
            required
            type="text"
            inputMode="decimal"
            value={quantityChange}
            onChange={(event) => {
              setQuantityChange(event.target.value);
              setSubmitMessage(null);
            }}
            disabled={submitting}
            aria-describedby="inventory-adjustment-quantity-help"
            className="font-normal"
          />
          <span
            id="inventory-adjustment-quantity-help"
            className="font-normal text-muted-foreground"
          >
            Mức điều chỉnh phải khác 0. Dùng số dương để tăng, số âm để giảm;
            tối đa 15 chữ số nguyên và 3 chữ số thập phân.
          </span>
          {quantityInvalid && (
            <span className="font-normal text-destructive">
              Nhập một mức khác 0, không dùng dấu phẩy hoặc ký hiệu khoa học.
            </span>
          )}
          {!quantityInvalid && increaseBlocked && (
            <span role="alert" className="font-normal text-destructive">
              {increaseBlocked}
            </span>
          )}
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Lý do
          <Select
            required
            value={reasonCode}
            onChange={(event) => {
              setReasonCode(
                event.target.value as InventoryAdjustmentReasonCode | "",
              );
              setSubmitMessage(null);
            }}
            disabled={submitting}
            className="font-normal"
          >
            <option value="">Chọn lý do</option>
            {INVENTORY_ADJUSTMENT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Ghi chú{noteRequired ? "" : " (không bắt buộc)"}
          <Textarea
            required={noteRequired}
            maxLength={4000}
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setSubmitMessage(null);
            }}
            disabled={submitting}
            className="resize-y font-normal"
          />
          <span className="font-normal text-muted-foreground">
            {noteLength}/4000 ký tự
            {noteRequired ? ". Bắt buộc khi chọn lý do Khác." : "."}
          </span>
          {noteRequired && note.length > 0 && noteLength === 0 && (
            <span className="font-normal text-destructive">
              Vui lòng nhập ghi chú không chỉ gồm khoảng trắng.
            </span>
          )}
        </label>

        {submitMessage && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {submitMessage}
          </p>
        )}

        <footer className="flex justify-end gap-2">
          <Button variant="outline"
            onClick={closeDialog}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
          >
            {submitting
              ? "Đang gửi..."
              : requiresApproval
                ? "Gửi đề xuất"
                : "Lưu điều chỉnh"}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}

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
  InventoryListResponse,
  InventoryTrackingMode,
} from "../types/inventory";
import {
  formatInventoryExpiry,
  formatInventoryQuantity,
  inventoryUnitLabel,
  isValidInventoryAdjustmentQuantity,
} from "../inventory.logic";

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
        message: "Dữ liệu chưa hợp lệ. Kiểm tra số lượng và lý do điều chỉnh.",
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
      return {
        message:
          "Tồn kho đã thay đổi hoặc không đủ cho mức giảm này. Vui lòng kiểm tra lại số tồn hiện tại.",
        uncertain: false,
      };
    }
    if (error.status === 0 || error.status >= 500)
      return {
        message:
          "Chưa xác nhận được kết quả điều chỉnh. Hãy kiểm tra Lịch sử biến động trước khi gửi lại.",
        uncertain: true,
      };
  }
  return {
    message:
      "Chưa xác nhận được kết quả điều chỉnh. Hãy kiểm tra Lịch sử biến động trước khi gửi lại.",
    uncertain: true,
  };
}

export function InventoryAdjustmentDialog({
  farmId,
  hasAmbiguousOutcome,
  onAmbiguousOutcome,
  onClose,
  onSuccess,
}: {
  farmId: string;
  hasAmbiguousOutcome: boolean;
  onAmbiguousOutcome: () => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const request = useAuthenticatedRequest();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mountedRef = useRef(false);
  const submittingRef = useRef(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [lotId, setLotId] = useState("");
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [stockAttempt, setStockAttempt] = useState(0);
  const [stockLookup, setStockLookup] = useState<StockLookup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [checkedLedger, setCheckedLedger] = useState(false);
  const references = useInventoryReferences(farmId, itemId || undefined);

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
  const reasonLength = reason.trim().length;
  const quantityInvalid =
    quantityChange.length > 0 &&
    !isValidInventoryAdjustmentQuantity(quantityChange);
  const reasonOnlyWhitespace = reason.length > 0 && reasonLength === 0;
  const canSubmit =
    validSelection &&
    !stockIsLoading &&
    !stockError &&
    isValidInventoryAdjustmentQuantity(quantityChange) &&
    reasonLength > 0 &&
    reason.trim().length <= 4000 &&
    !submitting &&
    (!hasAmbiguousOutcome || checkedLedger);

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

    try {
      await createInventoryAdjustment(request, farmId, {
        warehouseId,
        itemId,
        ...(trackingMode === "LOT" ? { lotId } : {}),
        quantityChange,
        reason: reason.trim(),
      });
      if (mountedRef.current) onSuccess();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const result = submitError(error);
      setSubmitMessage(result.message);
      if (result.uncertain) {
        // ponytail: no idempotency key; verify the ledger before a new POST until replay protection exists.
        setCheckedLedger(false);
        onAmbiguousOutcome();
      }
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
              Điều chỉnh tồn kho
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ghi nhận chênh lệch kiểm kê bằng một giao dịch kho.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng điều chỉnh tồn kho"
            onClick={closeDialog}
            disabled={submitting}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
          >
            Đóng
          </button>
        </header>

        <label className="grid gap-1.5 text-sm font-medium">
          Kho đang hoạt động
          <select
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
            className="rounded-lg border bg-background p-2 font-normal"
          >
            <option value="">Chọn kho</option>
            {references.warehouses
              .filter(({ status }) => status === "ACTIVE")
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Vật tư
          <select
            required
            value={itemId}
            onChange={(event) => {
              setItemId(event.target.value);
              setLotId("");
              setStockAttempt((previous) => previous + 1);
              setSubmitMessage(null);
            }}
            disabled={
              submitting || references.isLoading || Boolean(references.error)
            }
            className="rounded-lg border bg-background p-2 font-normal"
          >
            <option value="">Chọn vật tư</option>
            {references.items.map(({ item }) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
                {item.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""}
              </option>
            ))}
          </select>
        </label>

        {trackingMode === "LOT" && (
          <label className="grid gap-1.5 text-sm font-medium">
            Lô
            <select
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
              className="rounded-lg border bg-background p-2 font-normal disabled:opacity-60"
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
                </option>
              ))}
            </select>
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
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
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
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
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
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
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
              <div role="alert" className="mt-1 text-sm text-red-700">
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
          <input
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
            className="rounded-lg border bg-background p-2 font-normal"
          />
          <span
            id="inventory-adjustment-quantity-help"
            className="font-normal text-muted-foreground"
          >
            Mức điều chỉnh phải khác 0. Dùng số dương để tăng, số âm để giảm;
            tối đa 15 chữ số nguyên và 3 chữ số thập phân.
          </span>
          {quantityInvalid && (
            <span className="font-normal text-red-700">
              Nhập một mức khác 0, không dùng dấu phẩy hoặc ký hiệu khoa học.
            </span>
          )}
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Lý do
          <textarea
            required
            maxLength={4000}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setSubmitMessage(null);
            }}
            disabled={submitting}
            className="resize-y rounded-lg border bg-background p-2 font-normal"
          />
          <span className="font-normal text-muted-foreground">
            {reasonLength}/4000 ký tự sau khi bỏ khoảng trắng đầu cuối.
          </span>
          {reasonLength === 0 && (
            <span className="font-normal text-muted-foreground">
              Lý do bắt buộc, từ 1 đến 4000 ký tự.
            </span>
          )}
          {reasonOnlyWhitespace && (
            <span className="font-normal text-red-700">
              Vui lòng nhập lý do không chỉ gồm khoảng trắng.
            </span>
          )}
        </label>

        {hasAmbiguousOutcome && (
          <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={checkedLedger}
              onChange={(event) => setCheckedLedger(event.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            Tôi đã kiểm tra Lịch sử biến động và xác nhận lần gửi trước chưa
            được ghi nhận.
          </label>
        )}

        {submitMessage && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {submitMessage}
          </p>
        )}

        <footer className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            disabled={submitting}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Đang lưu..." : "Lưu điều chỉnh"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

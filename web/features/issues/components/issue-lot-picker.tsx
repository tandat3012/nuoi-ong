"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { getIssueLotSuggestions } from "../api/issues.api";
import type { IssueLotSuggestion } from "../types/issue";
import { selectableIssueLotSuggestions } from "./issue-draft.logic";
import { Combobox } from "@/shared/components/ui/combobox";
import { formatInventoryQuantity } from "@/features/inventory";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export type IssueLotChoice = {
  id: string;
  lotCode: string;
  expiryDate: string | null;
  quantityOnHand: string | null;
};

export function IssueLotPicker({
  farmId,
  warehouseId,
  itemId,
  selected,
  onSelect,
}: {
  farmId: string;
  warehouseId: string | null;
  itemId: string;
  selected: IssueLotChoice | null;
  onSelect: (lot: IssueLotChoice) => void;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    warehouseId: string | null;
    itemId: string;
    attempt: number;
    suggestions?: IssueLotSuggestion[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    void getIssueLotSuggestions(request, farmId, warehouseId, itemId)
      .then((suggestions) => {
        if (!Array.isArray(suggestions))
          throw new Error("Unexpected lot suggestions response");
        if (!cancelled)
          setResult({ farmId, warehouseId, itemId, attempt, suggestions });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setResult({
          farmId,
          warehouseId,
          itemId,
          attempt,
          error:
            failure instanceof ApiError && failure.status === 403
              ? "Bạn không có quyền xem tình trạng lô trong trang trại này."
              : failure instanceof ApiError && failure.status === 401
                ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                : "Không thể kiểm tra tình trạng lô. Vui lòng thử lại.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, warehouseId, itemId, attempt]);

  const current =
    result?.farmId === farmId &&
    result.warehouseId === warehouseId &&
    result.itemId === itemId &&
    result.attempt === attempt
      ? result
      : null;
  const choices = current?.suggestions
    ? selectableIssueLotSuggestions(
        current.suggestions,
        farmId,
        warehouseId ?? "",
        itemId,
      )
    : [];
  const selectedSuggestion = choices.find(({ lot }) => lot.id === selected?.id);
  const options = choices.map(({ lot, balance }) => ({
    value: lot.id,
    label: lot.supplierLotNumber
      ? `${lot.lotCode} · ${lot.supplierLotNumber}`
      : lot.lotCode,
    hint: `Tồn ${formatInventoryQuantity(balance.quantityOnHand)} · HSD ${formatExpiry(lot.expiryDate)}`,
  }));
  const ready = Boolean(warehouseId && current && !current.error);

  return (
    <section aria-label={`Lô cho vật tư ${itemId}`} className="space-y-1.5">
      <Combobox
        aria-label="Chọn lô xuất"
        options={options}
        value={selected?.id ?? ""}
        selectedLabel={selected?.lotCode}
        placeholder={
          !warehouseId
            ? "Chọn kho xuất trước"
            : !current
              ? "Đang tải lô..."
              : "Tìm theo mã lô hoặc số lô nhà cung cấp..."
        }
        emptyText="Không có lô khả dụng trong kho này."
        disabled={!ready}
        onChange={(id) => {
          const entry = choices.find(({ lot }) => lot.id === id);
          if (entry)
            onSelect({
              id: entry.lot.id,
              lotCode: entry.lot.lotCode,
              expiryDate: entry.lot.expiryDate,
              quantityOnHand: entry.balance.quantityOnHand,
            });
        }}
      />
      {warehouseId && !current && (
        <BeeLoader size="sm" label="Đang tải lô khả dụng..." />
      )}
      {selected && (
        <p className="text-xs text-muted-foreground">
          HSD {formatExpiry(selected.expiryDate)}
          {selectedSuggestion
            ? ` · Tồn hiện tại ${formatInventoryQuantity(selectedSuggestion.balance.quantityOnHand)}`
            : current?.error && selected.quantityOnHand
              ? ` · Tồn lần chọn trước ${formatInventoryQuantity(selected.quantityOnHand)}`
              : ""}
        </p>
      )}
      {current?.error && (
        <p role="status" className="text-xs text-destructive">
          {current.error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((previous) => previous + 1)}
            className="font-medium underline"
          >
            Thử lại
          </button>
        </p>
      )}
      {ready && selected && !selectedSuggestion && (
        <p role="status" className="text-xs text-warning">
          Lô {selected.lotCode || selected.id} đã hết hạn, hết tồn hoặc không
          còn ở kho. Phiếu nháp vẫn giữ lô đã lưu; sẽ kiểm tra lại khi xác
          nhận.
        </p>
      )}
      {ready && (
        <p className="text-xs text-muted-foreground">
          {choices.length} lô khả dụng, xuất trước lô hết hạn sớm. Tồn chỉ để
          tham khảo, kiểm tra lại khi xác nhận.
        </p>
      )}
    </section>
  );
}

function formatExpiry(date: string | null) {
  if (!date) return "không có";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

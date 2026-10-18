"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { getIssueLotSuggestions } from "../api/issues.api";
import type { IssueLotSuggestion } from "../types/issue";
import { selectableIssueLotSuggestions } from "./issue-draft.logic";

export type IssueLotChoice = {
  id: string;
  lotNumber: string;
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
  const [open, setOpen] = useState(false);
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

  return (
    <section
      aria-label={`Lô cho vật tư ${itemId}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <p>
        Lô đã chọn: {selected ? selected.lotNumber || selected.id : "Chưa chọn"}
      </p>
      {selected && (
        <p className="text-sm text-muted-foreground">
          Hạn dùng: {selected.expiryDate ?? "Không có hạn"}
          {selectedSuggestion
            ? ` · Tồn hiện tại: ${selectedSuggestion.balance.quantityOnHand}`
            : current?.error && selected.quantityOnHand
              ? ` · Số tồn lần chọn trước: ${selected.quantityOnHand}`
              : ""}
        </p>
      )}
      {!warehouseId ? (
        <p role="status">Chọn kho xuất trước khi chọn lô.</p>
      ) : !current ? (
        <p role="status">
          {selected
            ? "Đang kiểm tra tình trạng lô đã lưu..."
            : "Đang tải lô khả dụng..."}
        </p>
      ) : current.error ? (
        <div role="status" className="space-y-1">
          <p>{current.error}</p>
          {selected && (
            <p>Chưa xác định được lô đã lưu còn khả dụng hay không.</p>
          )}
          <button
            type="button"
            onClick={() => setAttempt((previous) => previous + 1)}
            className="underline"
          >
            Thử lại
          </button>
        </div>
      ) : selected && !selectedSuggestion ? (
        <p role="status" className="text-sm text-amber-700">
          Lô {selected.lotNumber || selected.id} đã hết hạn, hết tồn hoặc không
          còn ở kho. Phiếu nháp vẫn giữ lô đã lưu; tình trạng sẽ được kiểm tra
          khi xác nhận.
        </p>
      ) : null}
      {warehouseId && current?.suggestions && (
        <p className="text-xs text-muted-foreground">
          Tồn hiển thị chỉ để tham khảo; tồn được kiểm tra khi xác nhận.
        </p>
      )}
      <button
        type="button"
        disabled={!warehouseId}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
      >
        {open ? "Ẩn danh sách lô" : selected ? "Thay lô" : "Chọn lô"}
      </button>
      {open && current && !current.error && (
        <>
          {choices.length === 0 ? (
            <p role="status">Không có lô khả dụng trong kho này.</p>
          ) : (
            <ul className="space-y-2">
              {choices.map(({ lot, balance }) => (
                <li key={lot.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({
                        id: lot.id,
                        lotNumber: lot.lotNumber,
                        expiryDate: lot.expiryDate,
                        quantityOnHand: balance.quantityOnHand,
                      });
                      setOpen(false);
                    }}
                    className="text-left underline"
                  >
                    {lot.lotNumber} · Hạn: {lot.expiryDate ?? "Không có hạn"} ·
                    Tồn: {balance.quantityOnHand}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

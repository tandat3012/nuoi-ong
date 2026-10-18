"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { getIssueAsset, getIssueAssets } from "../api/issues.api";
import type { IssueAssetReference } from "../types/issue";
import { isIssueAssetAvailable } from "./issue-draft.logic";

export type IssueAssetChoice = {
  id: string;
  assetCode: string;
  serialNumber: string | null;
};

export function IssueAssetPicker({
  farmId,
  warehouseId,
  itemId,
  selected,
  excludedIds,
  onSelect,
}: {
  farmId: string;
  warehouseId: string | null;
  itemId: string;
  selected: IssueAssetChoice | null;
  excludedIds: readonly string[];
  onSelect: (asset: IssueAssetChoice) => void;
}) {
  const request = useAuthenticatedRequest();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ page: 1, search: "" });
  const [attempt, setAttempt] = useState(0);
  const scope = `${farmId}:${warehouseId ?? ""}:${itemId}:${attempt}`;
  const selectedId = selected?.id;
  const [availability, setAvailability] = useState<{
    scope: string;
    id: string;
    available?: boolean;
    error?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    scope: string;
    query: typeof query;
    response?: PaginatedResponse<IssueAssetReference>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!warehouseId || !selectedId) return;
    let cancelled = false;
    void getIssueAsset(request, farmId, selectedId)
      .then(({ data }) => {
        if (!cancelled)
          setAvailability({
            scope,
            id: selectedId,
            available:
              data.asset.id === selectedId &&
              isIssueAssetAvailable(data, farmId, warehouseId, itemId),
          });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setAvailability(
          failure instanceof ApiError && failure.status === 404
            ? { scope, id: selectedId, available: false }
            : { scope, id: selectedId, error: pickerError(failure) },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, warehouseId, itemId, selectedId, scope]);

  useEffect(() => {
    if (!warehouseId || !open) return;
    let cancelled = false;
    void getIssueAssets(request, farmId, warehouseId, itemId, {
      ...query,
      pageSize: 10,
    })
      .then((response) => {
        if (!cancelled) setResult({ scope, query, response });
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setResult({ scope, query, error: pickerError(failure) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, warehouseId, itemId, open, query, scope]);

  const checked =
    availability?.scope === scope && availability.id === selectedId
      ? availability
      : null;
  const current =
    result?.scope === scope && result.query === query ? result : null;
  const rows =
    current?.response?.data.filter((row) =>
      isIssueAssetAvailable(row, farmId, warehouseId ?? "", itemId),
    ) ?? [];
  return (
    <section
      aria-label={`Tài sản cho vật tư ${itemId}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <p>
        Tài sản đã chọn:{" "}
        {selected ? selected.assetCode || selected.id : "Chưa chọn"}
      </p>
      {selected?.serialNumber && (
        <p className="text-sm text-muted-foreground">
          Serial: {selected.serialNumber}
        </p>
      )}
      {!warehouseId ? (
        <p role="status">Chọn kho xuất trước khi chọn tài sản.</p>
      ) : (
        selected &&
        (!checked ? (
          <p role="status">Đang kiểm tra tài sản đã lưu...</p>
        ) : checked.error ? (
          <div role="status">
            <p>
              {checked.error} Chưa xác định được tài sản còn khả dụng hay không.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="underline"
            >
              Thử lại
            </button>
          </div>
        ) : !checked.available ? (
          <p role="status" className="text-sm text-amber-700">
            Tài sản đã lưu không còn khả dụng tại kho xuất hoặc không còn tồn
            tại. Phiếu nháp vẫn giữ tham chiếu; tài sản được kiểm tra lại khi
            xác nhận.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tài sản khả dụng tại kho xuất.
          </p>
        ))
      )}
      <button
        type="button"
        disabled={!warehouseId}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        onClick={() => {
          setOpen((value) => !value);
          setAttempt((value) => value + 1);
        }}
      >
        {open
          ? "Ẩn danh sách tài sản"
          : selected
            ? "Thay tài sản"
            : "Chọn tài sản"}
      </button>
      {open && warehouseId && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Từ khóa tài sản"
              value={search}
              maxLength={100}
              placeholder="Mã hoặc serial..."
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setQuery({ page: 1, search: search.trim() });
                }
              }}
              className="rounded-lg border bg-background p-2"
            />
            <button
              type="button"
              onClick={() => setQuery({ page: 1, search: search.trim() })}
              className="rounded-lg border px-3 py-2"
            >
              Tìm tài sản
            </button>
          </div>
          {!current ? (
            <p role="status">Đang tải tài sản...</p>
          ) : current.error ? (
            <div role="alert">
              <p>{current.error}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="underline"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {rows.length === 0 && (
                <p role="status">Không có tài sản khả dụng trong kho này.</p>
              )}
              <ul className="space-y-2">
                {rows.map(({ asset, locationCode, locationName }) => {
                  const duplicate = excludedIds.includes(asset.id);
                  return (
                    <li key={asset.id}>
                      <button
                        type="button"
                        disabled={duplicate}
                        onClick={() => {
                          onSelect({
                            id: asset.id,
                            assetCode: asset.assetCode,
                            serialNumber: asset.serialNumber,
                          });
                          setOpen(false);
                        }}
                        className="text-left underline disabled:opacity-50"
                      >
                        {asset.assetCode} · Serial: {asset.serialNumber ?? "—"}{" "}
                        · Vị trí: {locationCode ?? ""} {locationName ?? "—"}
                        {duplicate ? " · Đã chọn ở dòng khác" : ""}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {current.response && (
                <nav aria-label="Phân trang tài sản" className="flex gap-3">
                  <button
                    type="button"
                    disabled={query.page <= 1}
                    onClick={() => setQuery({ ...query, page: query.page - 1 })}
                    className="disabled:opacity-40"
                  >
                    Trang trước
                  </button>
                  <span>
                    Trang {query.page} /{" "}
                    {Math.max(1, current.response.page.totalPages)}
                  </span>
                  <button
                    type="button"
                    disabled={query.page >= current.response.page.totalPages}
                    onClick={() => setQuery({ ...query, page: query.page + 1 })}
                    className="disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Mỗi tài sản là một dòng, số lượng 1. Lưu nháp không giữ chỗ tài sản.
      </p>
    </section>
  );
}

function pickerError(failure: unknown): string {
  return failure instanceof ApiError && failure.status === 403
    ? "Bạn không có quyền xem tài sản trong trang trại này."
    : failure instanceof ApiError && failure.status === 401
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : "Không thể tải thông tin tài sản. Vui lòng thử lại.";
}

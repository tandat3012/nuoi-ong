"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { getWarehouses } from "@/features/warehouses/api/warehouses.api";
import { ApiError } from "@/shared/api/client";
import type { PageInfo } from "@/shared/api/contracts";
import { getIssueCatalogItems } from "../api/issues.api";
import type { IssueDraftTrackingMode } from "../types/issue";

export type IssueChoice = {
  id: string;
  label: string;
  trackingMode?: IssueDraftTrackingMode;
};

export function IssueDraftPicker({
  farmId,
  kind,
  onSelect,
  onClose,
}: {
  farmId: string;
  kind: "warehouse" | "item";
  onSelect: (choice: IssueChoice) => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [trackingMode, setTrackingMode] =
    useState<IssueDraftTrackingMode>("QUANTITY");
  const [result, setResult] = useState<{
    farmId: string;
    kind: typeof kind;
    trackingMode: IssueDraftTrackingMode;
    query: typeof query;
    choices?: IssueChoice[];
    page?: PageInfo;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = { ...query, pageSize: 10, status: "ACTIVE" as const };
        let choices: IssueChoice[];
        let page: PageInfo;
        if (kind === "warehouse") {
          const response = await getWarehouses(request, { ...params, farmId });
          page = response.page;
          choices = response.data.map((row) => ({
            id: row.id,
            label: `${row.code} — ${row.name}`,
          }));
        } else {
          const response = await getIssueCatalogItems(request, farmId, {
            ...query,
            pageSize: 10,
            trackingMode,
          });
          page = response.page;
          choices = response.data
            .filter(({ item }) => item.trackingMode === trackingMode)
            .map(({ item, unitSymbol, unitName }) => ({
              id: item.id,
              label: `${item.code} — ${item.name} (${unitSymbol || unitName || "—"}; ${trackingMode === "LOT" ? "theo lô" : trackingMode === "ASSET" ? "tài sản" : "số lượng"})`,
              trackingMode,
            }));
        }
        if (!cancelled)
          setResult({ farmId, kind, trackingMode, query, choices, page });
      } catch (error: unknown) {
        if (!cancelled)
          setResult({
            farmId,
            kind,
            trackingMode,
            query,
            error:
              error instanceof ApiError && error.status === 403
                ? "Bạn không có quyền xem dữ liệu lựa chọn."
                : error instanceof ApiError && error.status === 401
                  ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                  : "Không thể tải dữ liệu lựa chọn. Vui lòng thử lại.",
          });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [request, farmId, kind, query, trackingMode]);
  const current =
    result?.farmId === farmId &&
    result.kind === kind &&
    result.trackingMode === trackingMode &&
    result.query === query
      ? result
      : null;
  return (
    <section
      aria-label={
        kind === "warehouse"
          ? "Chọn kho xuất"
          : trackingMode === "LOT"
            ? "Chọn vật tư theo lô"
            : trackingMode === "ASSET"
              ? "Chọn vật tư tài sản"
              : "Chọn vật tư theo số lượng"
      }
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
    >
      <h2 className="font-semibold">
        {kind === "warehouse"
          ? "Chọn kho xuất"
          : trackingMode === "LOT"
            ? "Chọn vật tư theo lô"
            : trackingMode === "ASSET"
              ? "Chọn vật tư tài sản"
              : "Chọn vật tư theo số lượng"}
      </h2>
      <div className="flex flex-wrap gap-2">
        {kind === "item" && (
          <label className="flex items-center gap-2 text-sm">
            <span>Theo dõi vật tư</span>
            <select
              aria-label="Theo dõi vật tư"
              value={trackingMode}
              onChange={(event) => {
                setSearch("");
                setQuery({ search: "", page: 1 });
                setTrackingMode(event.target.value as IssueDraftTrackingMode);
              }}
              className="rounded-lg border bg-background p-2"
            >
              <option value="QUANTITY">Số lượng</option>
              <option value="LOT">Theo lô</option>
              <option value="ASSET">Tài sản</option>
            </select>
          </label>
        )}
        <input
          aria-label="Từ khóa lựa chọn"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setQuery({ search: search.trim(), page: 1 });
            }
          }}
          placeholder="Mã hoặc tên..."
          className="rounded-lg border bg-background p-2"
        />
        <button
          type="button"
          onClick={() => setQuery({ search: search.trim(), page: 1 })}
          className="rounded-lg border px-3 py-2"
        >
          Tìm
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-3 py-2"
        >
          Đóng lựa chọn
        </button>
      </div>
      {!current ? (
        <p role="status">Đang tải...</p>
      ) : current.error ? (
        <div role="alert">
          <p>{current.error}</p>
          <button
            type="button"
            onClick={() => setQuery({ ...query })}
            className="underline"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {current.choices?.length === 0 && (
            <p role="status">Không có kết quả phù hợp.</p>
          )}
          <ul className="space-y-2">
            {current.choices?.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  onClick={() => onSelect(choice)}
                  className="text-left underline"
                >
                  {choice.label}
                </button>
              </li>
            ))}
          </ul>
          {current.page && (
            <nav aria-label="Phân trang lựa chọn" className="flex gap-3">
              <button
                type="button"
                disabled={query.page <= 1}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}
                className="disabled:opacity-40"
              >
                Trang trước
              </button>
              <span>
                Trang {query.page} / {Math.max(1, current.page.totalPages)}
              </span>
              <button
                type="button"
                disabled={query.page >= current.page.totalPages}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}
                className="disabled:opacity-40"
              >
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

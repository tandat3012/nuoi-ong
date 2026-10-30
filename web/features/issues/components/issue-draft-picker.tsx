"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { getWarehouses } from "@/features/warehouses/api/warehouses.api";
import { ApiError } from "@/shared/api/client";
import type { PageInfo } from "@/shared/api/contracts";
import { getIssueCatalogItems } from "../api/issues.api";
import type { IssueDraftTrackingMode } from "../types/issue";
import { Select } from "@/shared/components/ui/select";
import { Combobox } from "@/shared/components/ui/combobox";

export type IssueChoice = {
  id: string;
  label: string;
  trackingMode?: IssueDraftTrackingMode;
};

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 250;

/** Searchable dropdown backed by the paged API; typing searches by code or name. */
export function IssueDraftPicker({
  farmId,
  kind,
  value,
  disabled,
  autoFocus,
  onSelect,
}: {
  farmId: string;
  kind: "warehouse" | "item";
  /** Current choice; leave empty for the "add item" picker that resets after each pick. */
  value?: IssueChoice | null;
  disabled?: boolean;
  autoFocus?: boolean;
  onSelect: (choice: IssueChoice) => void;
}) {
  const request = useAuthenticatedRequest();
  // A new object per keystroke/open, so reopening refetches (e.g. after an error).
  const [query, setQuery] = useState({ search: "", page: 1 });
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [active, setActive] = useState(false);
  const [trackingMode, setTrackingMode] =
    useState<IssueDraftTrackingMode>("QUANTITY");
  const [result, setResult] = useState<{
    trackingMode: IssueDraftTrackingMode;
    query: typeof query;
    choices?: IssueChoice[];
    page?: PageInfo;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!active) return;
    const current = debouncedQuery;
    let cancelled = false;
    async function load() {
      try {
        const params = { ...current, pageSize: PAGE_SIZE, status: "ACTIVE" as const };
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
            ...current,
            pageSize: PAGE_SIZE,
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
          setResult({ trackingMode, query: current, choices, page });
      } catch (error: unknown) {
        if (!cancelled)
          setResult({
            trackingMode,
            query: current,
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
  }, [request, farmId, kind, debouncedQuery, trackingMode, active]);
  const current =
    result?.trackingMode === trackingMode && result.query === query
      ? result
      : null;
  const choices = current?.choices ?? [];
  const combobox = (
    <Combobox
      aria-label={
        kind === "warehouse"
          ? "Chọn kho xuất"
          : trackingMode === "LOT"
            ? "Chọn vật tư theo lô"
            : trackingMode === "ASSET"
              ? "Chọn vật tư tài sản"
              : "Chọn vật tư theo số lượng"
      }
      options={choices.map((choice) => ({
        value: choice.id,
        label: choice.label,
      }))}
      value={value?.id ?? ""}
      selectedLabel={value?.label}
      placeholder={
        kind === "warehouse"
          ? "Tìm kho theo mã hoặc tên..."
          : "Tìm vật tư theo mã hoặc tên..."
      }
      disabled={disabled}
      autoFocus={autoFocus}
      loading={!current}
      total={current?.page?.totalItems}
      emptyText={current?.error ?? "Không có kết quả phù hợp."}
      onSearchChange={(search) => {
        setActive(true);
        setQuery({ search: search.trim(), page: 1 });
      }}
      onChange={(id) => {
        const choice = choices.find((row) => row.id === id);
        if (choice) onSelect(choice);
      }}
    />
  );
  if (kind === "warehouse") return combobox;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        aria-label="Theo dõi vật tư"
        value={trackingMode}
        disabled={disabled}
        onChange={(event) => {
          setQuery({ search: "", page: 1 });
          setTrackingMode(event.target.value as IssueDraftTrackingMode);
        }}
        className="sm:w-40"
      >
        <option value="QUANTITY">Số lượng</option>
        <option value="LOT">Theo lô</option>
        <option value="ASSET">Tài sản</option>
      </Select>
      {combobox}
    </div>
  );
}

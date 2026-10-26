"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getAssets } from "../api/assets.api";
import {
  assetError,
  changeAssetFilters,
  formatAssetDate,
  canWriteAssets,
} from "../asset.logic";
import {
  ASSET_STATUS_LABELS,
  type AssetChoice,
  type AssetFilters,
  type AssetStatus,
  type AssetView,
} from "../types/asset";
import { AssetLookup } from "./asset-lookup";
import { AssetStatusBadge } from "./asset-status-badge";
import { AssetEditor } from "./asset-editor";
import type { AssetWriteError } from "./asset-mutation-dialog";

export function AssetList({
  farmId,
  roles = [],
}: {
  farmId: string;
  roles?: readonly string[];
}) {
  const request = useAuthenticatedRequest();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<AssetWriteError>(null);
  const [created, setCreated] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const refreshTrigger = useRef<HTMLButtonElement>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AssetFilters>({
    page: 1,
    pageSize: 20,
  });
  const [choices, setChoices] = useState<{
    item: AssetChoice | null;
    warehouse: AssetChoice | null;
    location: AssetChoice | null;
  }>({ item: null, warehouse: null, location: null });
  const [result, setResult] = useState<{
    filters: AssetFilters;
    response?: PaginatedResponse<AssetView>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getAssets(request, farmId, filters)
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (filters.page > lastPage) {
          setFilters({ ...filters, page: lastPage });
          return;
        }
        setResult({ filters, response });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ filters, error: assetError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters]);
  const current = result?.filters === filters ? result : null;
  const reload = () => {
    setCreateOpen(false);
    setCreateError(null);
    setFilters({ ...filters });
  };
  const change = (value: Partial<AssetFilters>) =>
    setFilters(changeAssetFilters(filters, value));
  const isFiltered = Boolean(
    filters.search ||
    filters.status ||
    filters.itemId ||
    filters.warehouseId ||
    filters.locationId,
  );
  const moreFilterCount = [
    choices.item,
    choices.warehouse,
    choices.location,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setChoices({ item: null, warehouse: null, location: null });
    setFilters({ page: 1, pageSize: 20 });
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Tài sản"
        description="Tra cứu thiết bị, trạng thái và vị trí trong trang trại đang chọn."
        actions={
          <>
            <Button
              ref={refreshTrigger}
              variant="outline"
              onClick={reload}
              disabled={!current}
              className="h-10"
            >
              <RefreshCw
                className={`size-4 ${!current ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              Tải lại
            </Button>
            {canWriteAssets(roles) && (
              <Button
                ref={createTrigger}
                onClick={() => setCreateOpen(true)}
                disabled={createError?.reloadRequired}
              >
                Thêm tài sản
              </Button>
            )}
          </>
        }
      />
      {created && (
        <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
          Đã tạo tài sản và ghi nhận nhập kho. Danh sách được tải lại theo bộ
          lọc hiện tại.
        </p>
      )}
      {createError?.reloadRequired && !createOpen && (
        <ErrorAlert
          message={createError.message}
          onRetry={reload}
          retryLabel="Tải lại dữ liệu"
        />
      )}
      {createOpen && (
        <AssetEditor
          farmId={farmId}
          error={createError}
          onError={setCreateError}
          onClose={() => setCreateOpen(false)}
          onCloseFocus={() => {
            if (createTrigger.current && !createTrigger.current.disabled)
              createTrigger.current.focus();
            else refreshTrigger.current?.focus();
          }}
          onReload={reload}
          onSaved={() => {
            setCreated(true);
            reload();
          }}
        />
      )}
      <section
        aria-label="Bộ lọc tài sản"
        className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Bộ lọc
          </h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={!isFiltered}
            onClick={clearFilters}
          >
            <X className="size-3.5" aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        </div>
        <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(15rem,2fr)_repeat(4,minmax(0,1fr))]">
          <label className="block min-w-0 space-y-2 text-sm font-medium">
            <span className="block">Tìm tài sản</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-10 pl-9 font-normal"
                placeholder="Mã tài sản, serial hoặc tên vật tư…"
                maxLength={100}
                value={filters.search ?? ""}
                onChange={(e) => change({ search: e.target.value })}
              />
            </div>
          </label>
          <label className="block min-w-0 space-y-2 text-sm font-medium">
            <span className="block">Trạng thái</span>
            <Select
              className="h-10 font-normal"
              value={filters.status ?? ""}
              onChange={(e) =>
                change({
                  status: (e.target.value || undefined) as
                    AssetStatus | undefined,
                })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="outline"
            className="col-span-full h-10 justify-between sm:hidden"
            aria-expanded={moreFiltersOpen}
            aria-controls="asset-more-filters"
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
          >
            <span className="flex items-center gap-2">
              Bộ lọc khác
              {moreFilterCount > 0 && (
                <Badge variant="secondary">{moreFilterCount}</Badge>
              )}
            </span>
            <ChevronDown
              className={`size-4 ${moreFiltersOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </Button>
          <div
            id="asset-more-filters"
            className={`${moreFiltersOpen ? "contents" : "hidden"} sm:contents`}
          >
            <AssetLookup
              farmId={farmId}
              kind="item"
              selected={choices.item}
              onSelect={(item) => {
                setChoices({ ...choices, item });
                change({ itemId: item?.id });
              }}
            />
            <AssetLookup
              farmId={farmId}
              kind="warehouse"
              selected={choices.warehouse}
              onSelect={(warehouse) => {
                setChoices({ ...choices, warehouse, location: null });
                change({ warehouseId: warehouse?.id });
              }}
            />
            <AssetLookup
              key={choices.warehouse?.id ?? "all"}
              farmId={farmId}
              kind="location"
              selected={choices.location}
              warehouseId={choices.warehouse?.id}
              onSelect={(location) => {
                setChoices({ ...choices, location });
                change({ locationId: location?.id });
              }}
            />
          </div>
        </div>
      </section>
      <section
        aria-label="Kết quả tài sản"
        aria-busy={!current}
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div className="flex items-center gap-2.5 border-b px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold">Danh sách tài sản</h2>
          {current?.response ? (
            <Badge variant="secondary" className="tabular-nums">
              {current.response.page.totalItems} tài sản
            </Badge>
          ) : (
            <span className="sr-only">Đang tải số lượng</span>
          )}
        </div>
        {!current ? (
          <div role="status" aria-label="Đang tải tài sản" className="divide-y">
            <span className="sr-only">Đang tải tài sản…</span>
            {[1, 2, 3].map((row) => (
              <div key={row} className="grid gap-3 p-5 sm:grid-cols-3">
                <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
                <Skeleton className="h-5 w-48 max-w-full motion-reduce:animate-none" />
                <Skeleton className="h-5 w-28 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : current.error ? (
          <ErrorAlert
            className="m-4"
            message={current.error}
            onRetry={reload}
          />
        ) : current.response?.data.length === 0 ? (
          <EmptyState
            icon={
              <PackageSearch
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
            }
            title={isFiltered ? "Không có tài sản phù hợp" : "Chưa có tài sản"}
            description={
              isFiltered
                ? "Thử thay đổi từ khóa hoặc xóa bộ lọc để xem thêm tài sản."
                : "Tài sản được ghi nhận sau khi xác nhận phiếu nhập kho."
            }
            action={
              isFiltered && (
                <Button variant="outline" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              )
            }
          />
        ) : (
          <div>
            <div
              className="hidden grid-cols-[1.2fr_1.5fr_1fr_1fr_1.5fr_1fr] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground xl:grid"
              aria-hidden="true"
            >
              {[
                "Mã tài sản",
                "Vật tư",
                "Serial",
                "Trạng thái",
                "Vị trí",
                "Bảo trì tiếp theo",
              ].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <ul className="divide-y" aria-label="Danh sách tài sản">
              {current.response?.data.map((row) => (
                <li
                  key={row.asset.id}
                  className="grid min-w-0 grid-cols-2 items-start gap-x-4 gap-y-3 p-4 text-sm transition-colors hover:bg-muted/30 focus-within:bg-muted/30 sm:p-5 xl:grid-cols-[1.2fr_1.5fr_1fr_1fr_1.5fr_1fr]"
                >
                  <Link
                    className="order-1 flex min-h-10 min-w-0 items-center break-all font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary xl:min-h-0"
                    href={`/assets/${row.asset.id}`}
                  >
                    {row.asset.assetCode}
                  </Link>
                  <div className="order-3 col-span-2 min-w-0 break-words xl:order-2 xl:col-span-1">
                    <p className="font-medium">{row.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.itemCode}
                    </p>
                  </div>
                  <p className="order-4 col-span-2 break-all font-mono text-xs text-muted-foreground xl:order-3 xl:col-span-1">
                    <span className="text-muted-foreground xl:sr-only">
                      Serial:{" "}
                    </span>
                    {row.asset.serialNumber || "—"}
                  </p>
                  <div className="order-2 flex min-h-10 items-center justify-end xl:order-4 xl:min-h-0 xl:justify-start">
                    <AssetStatusBadge status={row.asset.status} />
                  </div>
                  <div className="order-5 col-span-2 flex min-w-0 items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground xl:col-span-1 xl:border-0 xl:pt-0 xl:text-sm">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="min-w-0 break-words">
                      <span className="sr-only">Vị trí: </span>
                      {[row.locationCode, row.locationName]
                        .filter(Boolean)
                        .join(" — ") || "Chưa ghi nhận vị trí"}
                    </p>
                  </div>
                  <p className="order-6 col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground xl:col-span-1 xl:text-sm">
                    <CalendarDays
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground xl:sr-only">
                      Bảo trì tiếp:{" "}
                    </span>
                    <span className="tabular-nums">
                      {formatAssetDate(row.asset.nextMaintenanceDate)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {current?.response && (
          <Pagination
            pageInfo={current.response.page}
            itemLabel="tài sản"
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MaterialFilterParams,
  MaterialKind,
  MaterialTrackingMode,
  CategoryReference,
  RecordStatus,
} from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";
import { createDebouncedSearch } from "../hooks/debounce-search";

interface MaterialFilterToolbarProps {
  filters: MaterialFilterParams;
  categories: CategoryReference[];
  referencesLoading: boolean;
  referencesError: string | null;
  onSearchChange: (search: string) => void;
  onStatusChange: (status?: RecordStatus) => void;
  onKindChange: (kind?: MaterialKind) => void;
  onTrackingModeChange: (trackingMode?: MaterialTrackingMode) => void;
  onCategoryChange: (categoryId?: string) => void;
  onResetFilters: () => void;
}

function normalizeSearch(value: string) {
  return value.trim().slice(0, 100);
}

export function MaterialFilterToolbar({
  filters,
  categories,
  referencesLoading,
  referencesError,
  onSearchChange,
  onStatusChange,
  onKindChange,
  onTrackingModeChange,
  onCategoryChange,
  onResetFilters,
}: MaterialFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useMemo(
    () => createDebouncedSearch(onSearchChange),
    [onSearchChange],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      const nextSearch = normalizeSearch(value);
      if (nextSearch === (filters.search ?? "")) {
        debouncedSearch.cancel();
        return;
      }
      debouncedSearch.schedule(nextSearch);
    },
    [debouncedSearch, filters.search],
  );

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    debouncedSearch.flush(normalizeSearch(searchInput));
  };

  const handleClearFilters = () => {
    debouncedSearch.cancel();
    setSearchInput("");
    onResetFilters();
  };

  const hasFilters = Boolean(
    searchInput ||
      filters.search ||
      filters.status ||
      filters.kind ||
      filters.trackingMode ||
      filters.categoryId,
  );

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted-foreground"
            >
              🔍
            </span>
            <input
              type="text"
              aria-label="Tìm vật tư theo mã, tên hoặc mã vạch"
              maxLength={100}
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              placeholder="Tìm kiếm theo mã, tên hoặc mã vạch barcode..."
              className="block w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2"
          >
            Tìm kiếm
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label
              htmlFor="filter-status"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Trạng thái
            </label>
            <select
              id="filter-status"
              value={filters.status ?? ""}
              onChange={(event) =>
                onStatusChange(
                  event.target.value
                    ? (event.target.value as RecordStatus)
                    : undefined,
                )
              }
              className="mt-1 block w-full rounded-xl border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:ring-2"
            >
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(RECORD_STATUS_LABELS) as RecordStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {RECORD_STATUS_LABELS[status]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-kind"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Phân loại
            </label>
            <select
              id="filter-kind"
              value={filters.kind ?? ""}
              onChange={(event) =>
                onKindChange(
                  event.target.value
                    ? (event.target.value as MaterialKind)
                    : undefined,
                )
              }
              className="mt-1 block w-full rounded-xl border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:ring-2"
            >
              <option value="">Tất cả phân loại</option>
              {(Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[]).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {MATERIAL_KIND_LABELS[kind]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-tracking"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Phương thức theo dõi
            </label>
            <select
              id="filter-tracking"
              value={filters.trackingMode ?? ""}
              onChange={(event) =>
                onTrackingModeChange(
                  event.target.value
                    ? (event.target.value as MaterialTrackingMode)
                    : undefined,
                )
              }
              className="mt-1 block w-full rounded-xl border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:ring-2"
            >
              <option value="">Tất cả phương thức</option>
              {(
                Object.keys(
                  MATERIAL_TRACKING_MODE_LABELS,
                ) as MaterialTrackingMode[]
              ).map((mode) => (
                <option key={mode} value={mode}>
                  {MATERIAL_TRACKING_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Danh mục
            </label>
            <select
              id="filter-category"
              disabled={referencesLoading || Boolean(referencesError)}
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                onCategoryChange(event.target.value || undefined)
              }
              className="mt-1 block w-full rounded-xl border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:ring-2"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </div>
  );
}

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
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Search, X, SlidersHorizontal, RotateCcw } from "lucide-react";

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

  const selectedCategoryName = categories.find(
    (c) => c.id === filters.categoryId,
  )?.name;

  return (
    <section
      aria-label="Bộ lọc vật tư"
      className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs"
    >
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <SlidersHorizontal
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            Bộ lọc tìm kiếm
          </h2>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </Button>
          )}
        </div>

        {/* Search input + Dropdowns Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
            <label
              htmlFor="search-material"
              className="block text-xs font-semibold text-foreground"
            >
              Tìm kiếm vật tư
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="search-material"
                type="text"
                maxLength={100}
                value={searchInput}
                onChange={(event) => handleSearchInputChange(event.target.value)}
                placeholder="Mã vật tư, tên hoặc mã vạch barcode…"
                className="h-9 pl-8.5 pr-8 text-xs font-normal"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => handleSearchInputChange("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-status"
              className="block text-xs font-semibold text-foreground"
            >
              Trạng thái
            </label>
            <Select
              id="filter-status"
              className="h-9 text-xs font-medium"
              value={filters.status ?? ""}
              onChange={(event) =>
                onStatusChange(
                  event.target.value
                    ? (event.target.value as RecordStatus)
                    : undefined,
                )
              }
            >
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(RECORD_STATUS_LABELS) as RecordStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {RECORD_STATUS_LABELS[status]}
                  </option>
                ),
              )}
            </Select>
          </div>

          {/* Kind */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-kind"
              className="block text-xs font-semibold text-foreground"
            >
              Phân loại
            </label>
            <Select
              id="filter-kind"
              className="h-9 text-xs font-medium"
              value={filters.kind ?? ""}
              onChange={(event) =>
                onKindChange(
                  event.target.value
                    ? (event.target.value as MaterialKind)
                    : undefined,
                )
              }
            >
              <option value="">Tất cả phân loại</option>
              {(Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[]).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {MATERIAL_KIND_LABELS[kind]}
                  </option>
                ),
              )}
            </Select>
          </div>

          {/* Tracking mode */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-tracking"
              className="block text-xs font-semibold text-foreground"
            >
              Phương thức theo dõi
            </label>
            <Select
              id="filter-tracking"
              className="h-9 text-xs font-medium"
              value={filters.trackingMode ?? ""}
              onChange={(event) =>
                onTrackingModeChange(
                  event.target.value
                    ? (event.target.value as MaterialTrackingMode)
                    : undefined,
                )
              }
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
            </Select>
          </div>
        </div>

        {/* Second row: Category dropdown if available */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-category"
              className="text-xs font-semibold text-foreground whitespace-nowrap"
            >
              Danh mục:
            </label>
            <Select
              id="filter-category"
              className="h-8 text-xs font-medium max-w-xs"
              disabled={referencesLoading || Boolean(referencesError)}
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                onCategoryChange(event.target.value || undefined)
              }
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.code})
                </option>
              ))}
            </Select>
          </div>

          {/* Active Filter Chips */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {filters.search && (
                <Badge variant="outline" className="gap-1 border-border bg-muted/60 text-xs py-0.5 font-normal">
                  <span>Từ khóa: &quot;{filters.search}&quot;</span>
                  <button
                    type="button"
                    onClick={() => handleSearchInputChange("")}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {filters.status && (
                <Badge variant="outline" className="gap-1 border-border bg-muted/60 text-xs py-0.5 font-normal">
                  <span>{RECORD_STATUS_LABELS[filters.status]}</span>
                  <button
                    type="button"
                    onClick={() => onStatusChange(undefined)}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {filters.kind && (
                <Badge variant="outline" className="gap-1 border-border bg-muted/60 text-xs py-0.5 font-normal">
                  <span>{MATERIAL_KIND_LABELS[filters.kind]}</span>
                  <button
                    type="button"
                    onClick={() => onKindChange(undefined)}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {filters.trackingMode && (
                <Badge variant="outline" className="gap-1 border-border bg-muted/60 text-xs py-0.5 font-normal">
                  <span>{MATERIAL_TRACKING_MODE_LABELS[filters.trackingMode]}</span>
                  <button
                    type="button"
                    onClick={() => onTrackingModeChange(undefined)}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {filters.categoryId && (
                <Badge variant="outline" className="gap-1 border-border bg-muted/60 text-xs py-0.5 font-normal">
                  <span>{selectedCategoryName || filters.categoryId}</span>
                  <button
                    type="button"
                    onClick={() => onCategoryChange(undefined)}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

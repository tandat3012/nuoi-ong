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
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Search, X, RotateCcw, Filter } from "lucide-react";

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
    <Card className="p-4 sm:p-5">
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        {/* Search row with prominent input & submit button */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              aria-label="Tìm vật tư theo mã, tên hoặc mã vạch"
              maxLength={100}
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              placeholder="Tìm kiếm theo mã, tên hoặc mã vạch barcode..."
              className="pl-9 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => handleSearchInputChange("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="h-9 px-4">
              <Search className="size-3.5" aria-hidden="true" />
              <span>Tìm kiếm</span>
            </Button>
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Đặt lại</span>
              </Button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label
              htmlFor="filter-status"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Trạng thái
            </label>
            <Select
              id="filter-status"
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

          <div>
            <label
              htmlFor="filter-kind"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Phân loại
            </label>
            <Select
              id="filter-kind"
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

          <div>
            <label
              htmlFor="filter-tracking"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Phương thức theo dõi
            </label>
            <Select
              id="filter-tracking"
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

          <div>
            <label
              htmlFor="filter-category"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Danh mục
            </label>
            <Select
              id="filter-category"
              disabled={referencesLoading || Boolean(referencesError)}
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                onCategoryChange(event.target.value || undefined)
              }
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground font-medium mr-1">
              <Filter className="size-3" />
              <span>Đang lọc:</span>
            </span>
            {filters.search && (
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
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
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Trạng thái: {RECORD_STATUS_LABELS[filters.status]}</span>
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
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Loại: {MATERIAL_KIND_LABELS[filters.kind]}</span>
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
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Theo dõi: {MATERIAL_TRACKING_MODE_LABELS[filters.trackingMode]}</span>
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
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Danh mục: {selectedCategoryName || filters.categoryId}</span>
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
      </form>
    </Card>
  );
}

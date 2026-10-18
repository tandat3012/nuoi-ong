'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  WarehouseFilterParams,
  WarehouseStatus,
} from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';
import { createDebouncedSearch } from '@/features/materials/hooks/debounce-search';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Search, X, RotateCcw, Filter } from 'lucide-react';

interface WarehouseFilterToolbarProps {
  filters: WarehouseFilterParams;
  onSearchChange: (search: string) => void;
  onStatusChange: (status?: WarehouseStatus) => void;
  onResetFilters: () => void;
}

function normalizeSearch(value: string) {
  return value.trim().slice(0, 100);
}

export function WarehouseFilterToolbar({
  filters,
  onSearchChange,
  onStatusChange,
  onResetFilters,
}: WarehouseFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useMemo(
    () => createDebouncedSearch(onSearchChange),
    [onSearchChange],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      const nextSearch = normalizeSearch(value);
      if (nextSearch === (filters.search ?? '')) {
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
    setSearchInput('');
    onResetFilters();
  };

  const hasFilters = Boolean(searchInput || filters.search || filters.status);

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        {/* Top search & status row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <label
              htmlFor="warehouse-search"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Tìm kiếm
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="warehouse-search"
                type="text"
                aria-label="Tìm kho theo mã hoặc tên"
                maxLength={100}
                value={searchInput}
                onChange={(event) => handleSearchInputChange(event.target.value)}
                placeholder="Tìm kiếm theo mã hoặc tên kho..."
                className="pl-9 pr-8"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => handleSearchInputChange('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="sm:w-60">
            <label
              htmlFor="warehouse-status"
              className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Trạng thái
            </label>
            <Select
              id="warehouse-status"
              value={filters.status ?? ''}
              onChange={(event) =>
                onStatusChange(
                  (event.target.value || undefined) as
                    | WarehouseStatus
                    | undefined,
                )
              }
            >
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(WAREHOUSE_STATUS_LABELS) as WarehouseStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {WAREHOUSE_STATUS_LABELS[status]}
                  </option>
                ),
              )}
            </Select>
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

        {/* Active Filter Chips Bar */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground font-medium mr-1">
              <Filter className="size-3" />
              <span>Đang lọc:</span>
            </span>
            {filters.search && (
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Từ khóa: &quot;{filters.search}&quot;</span>
                <button
                  type="button"
                  onClick={() => handleSearchInputChange('')}
                  aria-label="Bỏ lọc từ khóa"
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {filters.status && (
              <Badge variant="outline" className="gap-1 bg-background text-xs py-0.5">
                <span>Trạng thái: {WAREHOUSE_STATUS_LABELS[filters.status]}</span>
                <button
                  type="button"
                  onClick={() => onStatusChange(undefined)}
                  aria-label="Bỏ lọc trạng thái"
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

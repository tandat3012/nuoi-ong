'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  WarehouseFilterParams,
  WarehouseStatus,
} from '../types/warehouse';
import { WAREHOUSE_STATUS_LABELS } from '../types/warehouse';
import { createDebouncedSearch } from '@/features/materials/hooks/debounce-search';

export function WarehouseFilterToolbar({
  filters,
  onSearchChange,
  onStatusChange,
  onResetFilters,
}: {
  filters: WarehouseFilterParams;
  onSearchChange: (search: string) => void;
  onStatusChange: (status?: WarehouseStatus) => void;
  onResetFilters: () => void;
}) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useMemo(
    () => createDebouncedSearch(onSearchChange),
    [onSearchChange],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const changeSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      const normalized = value.trim().slice(0, 100);
      if (normalized === (filters.search ?? '')) {
        debouncedSearch.cancel();
        return;
      }
      debouncedSearch.schedule(normalized);
    },
    [debouncedSearch, filters.search],
  );

  const clear = () => {
    debouncedSearch.cancel();
    setSearchInput('');
    onResetFilters();
  };
  const hasFilters = Boolean(searchInput || filters.search || filters.status);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          debouncedSearch.flush(searchInput.trim().slice(0, 100));
        }}
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="warehouse-search"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Tìm kiếm
          </label>
          <input
            id="warehouse-search"
            type="search"
            value={searchInput}
            maxLength={100}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Tìm theo mã hoặc tên kho..."
            className="mt-1 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
          />
        </div>
        <div className="sm:w-52">
          <label
            htmlFor="warehouse-status"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Trạng thái
          </label>
          <select
            id="warehouse-status"
            value={filters.status ?? ''}
            onChange={(event) =>
              onStatusChange(
                (event.target.value || undefined) as
                  WarehouseStatus | undefined,
              )
            }
            className="mt-1 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
          >
            <option value="">Tất cả trạng thái</option>
            {(Object.keys(WAREHOUSE_STATUS_LABELS) as WarehouseStatus[]).map(
              (status) => (
                <option key={status} value={status}>
                  {WAREHOUSE_STATUS_LABELS[status]}
                </option>
              ),
            )}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2"
        >
          Tìm kiếm
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="rounded-xl border px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:ring-2"
          >
            Xóa bộ lọc
          </button>
        )}
      </form>
    </div>
  );
}

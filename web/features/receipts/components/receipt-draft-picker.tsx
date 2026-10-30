'use client';

import { useEffect, useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { getWarehouses } from '@/features/warehouses/api/warehouses.api';
import type { PageInfo } from '@/shared/api/contracts';
import { ApiError } from '@/shared/api/client';
import {
  getReceiptCatalogItems,
  getReceiptLocations,
  getReceiptLots,
  getReceiptSuppliers,
} from '../api/receipts.api';
import { Combobox } from '@/shared/components/ui/combobox';

export type DraftChoice = {
  id: string;
  label: string;
  /** Secondary text shown at the right of the dropdown row. */
  hint?: string;
  trackingMode?: 'QUANTITY' | 'LOT' | 'ASSET';
};

export type DraftPickerKind =
  | 'warehouse'
  | 'warehouse-filter'
  | 'material'
  | 'asset'
  | 'supplier'
  | 'location'
  | 'lot';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 250;

const formatDate = (value: string) => value.split('-').reverse().join('/');

/** Searchable dropdown backed by the paged API; typing searches by code or name. */
export function ReceiptDraftPicker({
  farmId,
  kind,
  warehouseId,
  itemId,
  value,
  placeholder,
  disabled,
  autoFocus,
  onSelect,
}: {
  farmId: string;
  kind: DraftPickerKind;
  warehouseId?: string;
  itemId?: string;
  /** Current choice; leave empty for "add a line" pickers that reset after each pick. */
  value?: DraftChoice | null;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSelect: (choice: DraftChoice) => void;
}) {
  const request = useAuthenticatedRequest();
  // A new object per keystroke/open, so reopening refetches (e.g. after an error).
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [active, setActive] = useState(false);
  const [result, setResult] = useState<{
    query: typeof query;
    choices?: DraftChoice[];
    page?: PageInfo;
    error?: string;
  } | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!active) return;
    const query = debouncedQuery;
    let cancelled = false;
    async function load() {
      try {
        const params = {
          farmId,
          ...query,
          pageSize: PAGE_SIZE,
          status: 'ACTIVE' as const,
        };
        let response: { page: PageInfo; choices: DraftChoice[] };
        if (kind === 'warehouse' || kind === 'warehouse-filter') {
          const { data, page } = await getWarehouses(request, {
            ...params,
            status: kind === 'warehouse' ? 'ACTIVE' : undefined,
          });
          response = {
            page,
            choices: data.map((row) => ({
              id: row.id,
              label: `${row.code} — ${row.name}${row.status === 'INACTIVE' ? ' · Ngừng hoạt động' : ''}`,
            })),
          };
        } else if (kind === 'supplier') {
          const { data, page } = await getReceiptSuppliers(request, farmId, params);
          response = {
            page,
            choices: data.map((row) => ({
              id: row.id,
              label: `${row.code} — ${row.name}`,
            })),
          };
        } else if (kind === 'lot') {
          const { data, page } = await getReceiptLots(request, farmId, {
            page: 1,
            pageSize: PAGE_SIZE,
            itemId: itemId!,
          });
          response = {
            page,
            choices: data.map((lot) => ({
              id: lot.id,
              label: [
                lot.lotNumber,
                lot.manufacturedDate && `NSX ${formatDate(lot.manufacturedDate)}`,
                lot.expiryDate && `HSD ${formatDate(lot.expiryDate)}`,
              ]
                .filter(Boolean)
                .join(' · '),
            })),
          };
        } else if (kind === 'location' && !warehouseId) {
          if (!cancelled)
            setResult({ query, error: 'Vui lòng chọn kho trước khi chọn vị trí.' });
          return;
        } else if (kind === 'location') {
          const { data, page } = await getReceiptLocations(request, farmId, {
            ...params,
            warehouseId: warehouseId!,
          });
          response = {
            page,
            choices: data.map((row) => ({
              id: row.id,
              label: `${row.code} — ${row.name}`,
            })),
          };
        } else {
          const { data, page } = await getReceiptCatalogItems(request, farmId, {
            ...params,
            itemType: kind === 'material' ? 'MATERIAL' : undefined,
            trackingMode: kind === 'asset' ? 'ASSET' : undefined,
          });
          response = {
            page,
            choices: data.map(({ item, unitSymbol, unitName }) => ({
              id: item.id,
              label: `${item.code} — ${item.name} (${unitSymbol || unitName || "—"})`,
              hint: item.trackingMode === 'LOT' ? 'Theo lô' : item.trackingMode === 'ASSET' ? 'Tài sản' : 'Theo số lượng',
              trackingMode: item.trackingMode,
            })),
          };
        }
        if (!cancelled) setResult({ query, ...response });
      } catch (error: unknown) {
        if (!cancelled)
          setResult({
            query,
            error:
              error instanceof ApiError && error.status === 403
                ? 'Bạn không có quyền xem dữ liệu lựa chọn.'
                : 'Không thể tải dữ liệu lựa chọn. Vui lòng thử lại.',
          });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [request, farmId, kind, warehouseId, itemId, debouncedQuery, active]);
  const current = result?.query === query ? result : null;
  const choices = current?.choices ?? [];
  return (
    <Combobox
      aria-label={
        kind === 'warehouse' || kind === 'warehouse-filter'
          ? 'Chọn kho'
          : kind === 'supplier'
            ? 'Chọn nhà cung cấp'
            : kind === 'location'
              ? 'Chọn vị trí'
              : kind === 'lot'
                ? 'Chọn lô có sẵn'
                : kind === 'asset'
                  ? 'Chọn thiết bị/tài sản'
                  : 'Chọn vật tư'
      }
      options={choices.map((choice) => ({
        value: choice.id,
        label: choice.label,
        hint: choice.hint,
      }))}
      value={value?.id ?? ''}
      selectedLabel={value?.label}
      placeholder={placeholder ?? 'Tìm theo mã hoặc tên...'}
      disabled={disabled}
      autoFocus={autoFocus}
      loading={!current}
      total={current?.page?.totalItems}
      emptyText={current?.error ?? 'Không có kết quả phù hợp.'}
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
}

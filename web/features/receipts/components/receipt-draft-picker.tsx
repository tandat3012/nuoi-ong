'use client';

import { useEffect, useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { getWarehouses } from '@/features/warehouses/api/warehouses.api';
import type { PageInfo } from '@/shared/api/contracts';
import { ApiError } from '@/shared/api/client';
import {
  getReceiptCatalogItems,
  getReceiptLocations,
  getReceiptSuppliers,
} from '../api/receipts.api';

export type DraftChoice = {
  id: string;
  label: string;
  trackingMode?: 'QUANTITY' | 'LOT' | 'ASSET';
};

export type DraftPickerKind =
  | 'warehouse'
  | 'warehouse-filter'
  | 'material'
  | 'asset'
  | 'supplier'
  | 'location';

export function ReceiptDraftPicker({
  farmId,
  kind,
  warehouseId,
  onSelect,
  onClose,
}: {
  farmId: string;
  kind: DraftPickerKind;
  warehouseId?: string;
  onSelect: (choice: DraftChoice) => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [result, setResult] = useState<{
    query: typeof query;
    choices?: DraftChoice[];
    page?: PageInfo;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = {
          farmId,
          ...query,
          pageSize: 10,
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
              label: `${item.code} — ${item.name} (${unitSymbol || unitName || '—'}) · ${item.trackingMode === 'LOT' ? 'Theo lô' : item.trackingMode === 'ASSET' ? 'Tài sản' : 'Theo số lượng'}`,
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
  }, [request, farmId, kind, warehouseId, query]);
  const current = result?.query === query ? result : null;
  return (
    <section
      aria-label={
        kind === 'warehouse' || kind === 'warehouse-filter'
          ? 'Chọn kho'
          : kind === 'supplier'
            ? 'Chọn nhà cung cấp'
            : kind === 'location'
              ? 'Chọn vị trí'
              : kind === 'asset'
                ? 'Chọn thiết bị/tài sản'
                : 'Chọn vật tư'
      }
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Từ khóa lựa chọn"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-lg border bg-background p-2"
          placeholder="Mã hoặc tên..."
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
            className="underline"
            onClick={() => setQuery({ ...query })}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {current.choices?.length === 0 && <p>Không có kết quả phù hợp.</p>}
          <ul className="space-y-2">
            {current.choices?.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() => onSelect(choice)}
                >
                  {choice.label}
                </button>
              </li>
            ))}
          </ul>
          {current.page && (
            <div className="flex gap-3">
              <button
                type="button"
                disabled={query.page <= 1}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}
                className="disabled:opacity-40"
              >
                Trang trước
              </button>
              <span>Trang {query.page}</span>
              <button
                type="button"
                disabled={query.page >= current.page.totalPages}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}
                className="disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

'use client';

import { startTransition, useEffect, useState } from 'react';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';

type WarehouseOption = { id: string; code: string; name: string };
type WarehouseList = { data: WarehouseOption[] };
type InventoryRow = {
  balance: {
    warehouseId: string;
    itemId: string;
    lotId: string | null;
    quantityOnHand: string;
    updatedAt: string;
  };
  itemCode: string;
  itemName: string;
};

function getErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  return Array.isArray(details?.message)
    ? details.message.join(', ')
    : details?.message ?? error.message;
}

export function InventoryScreen() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => {
      setWarehouses([]);
      setWarehouseId('');
      setLoadedFarmId(null);
      setError(null);
    });

    void request<WarehouseList>('/api/v1/warehouses', {
      params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' },
    })
      .then((response) => {
        if (!cancelled) setWarehouses(response.data);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(getErrorMessage(requestError));
      });

    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    void request<{ data: InventoryRow[] }>('/api/v1/inventory', {
      params: {
        farmId: selectedFarmId,
        warehouseId: warehouseId || undefined,
      },
    })
      .then((response) => {
        if (!cancelled) {
          setInventory(response.data);
          setLoadedFarmId(selectedFarmId);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setInventory([]);
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId, warehouseId]);

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem tồn kho.</p>;

  const visibleInventory = loadedFarmId === selectedFarmId ? inventory : [];

  return (
    <div className="space-y-6">
      <section>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inventory</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Tồn kho</h1>
        <p className="mt-2 text-sm text-muted-foreground">Theo dõi số lượng hiện tại theo farm, kho, item và LOT.</p>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <label className="grid gap-2 text-sm font-medium sm:max-w-md">
          Lọc theo kho
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="min-h-11 rounded-xl border bg-background px-3 font-normal">
            <option value="">Tất cả kho</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}
          </select>
        </label>
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-semibold">Danh sách tồn kho</h2>
          <span className="text-sm text-muted-foreground">{visibleInventory.length} sản phẩm</span>
        </div>
        {loading || loadedFarmId !== selectedFarmId ? <p className="p-5 text-sm text-muted-foreground">Đang tải tồn kho...</p> : visibleInventory.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Không có dữ liệu tồn kho.</p> : <div className="divide-y">
          {visibleInventory.map((row) => <article key={`${row.balance.warehouseId}-${row.balance.itemId}-${row.balance.lotId ?? 'none'}`} className="grid gap-2 p-5 sm:grid-cols-4"><div><p className="font-medium">{row.itemName}</p><p className="text-sm text-muted-foreground">{row.itemCode}</p></div><p className="text-sm">LOT: {row.balance.lotId ?? 'Không áp dụng'}</p><p className="text-sm text-muted-foreground">Cập nhật: {row.balance.updatedAt}</p><p className="font-semibold sm:text-right">{row.balance.quantityOnHand}</p></article>)}
        </div>}
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { startTransition, useEffect, useState } from 'react';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';

type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

type InventoryRow = {
  balance: {
    itemId: string;
    lotId: string | null;
    quantityOnHand: string;
    updatedAt: string;
  };
  itemCode: string;
  itemName: string;
};

type FormState = {
  code: string;
  name: string;
  address: string;
  description: string;
};

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  const message = Array.isArray(details?.message) ? details.message.join(', ') : details?.message;
  if (error.status === 403) return 'Bạn không có quyền truy cập farm này.';
  if (error.status === 409 && message?.toLowerCase().includes('code')) return 'Mã kho đã tồn tại trong farm này.';
  return message ?? error.message;
}

export function WarehouseDetailScreen() {
  const request = useAuthenticatedRequest();
  const { id } = useParams<{ id: string }>();
  const { data: auth, selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ code: '', name: '', address: '', description: '' });

  const membership = auth?.memberships.find(({ farm }) => farm.id === selectedFarmId);
  const canWrite = membership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;

  useEffect(() => {
    if (!selectedFarmId || !id) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    void Promise.all([
      request<{ data: Warehouse }>(`/api/v1/warehouses/${id}`, { params: { farmId: selectedFarmId } }),
      request<{ data: InventoryRow[] }>('/api/v1/inventory', { params: { farmId: selectedFarmId, warehouseId: id } }),
    ])
      .then(([warehouseResponse, inventoryResponse]) => {
        if (cancelled) return;
        const nextWarehouse = warehouseResponse.data;
        setWarehouse(nextWarehouse);
        setInventory(inventoryResponse.data);
        setForm({
          code: nextWarehouse.code,
          name: nextWarehouse.name,
          address: nextWarehouse.address ?? '',
          description: nextWarehouse.description ?? '',
        });
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, request, selectedFarmId]);

  async function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarmId || !warehouse || !canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const response = await request<{ data: Warehouse }>(`/api/v1/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        params: { farmId: selectedFarmId },
        data: {
          code: form.code.trim(),
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          description: form.description.trim() || undefined,
        },
      });
      setWarehouse(response.data);
      setEditing(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <p>Đang tải chi tiết kho...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (error) return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>;
  if (!selectedFarmId || !warehouse) return <p>Không tìm thấy kho.</p>;

  return (
    <div className="space-y-6">
      <Link href="/warehouses" className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">← Quay lại danh sách kho</Link>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chi tiết kho</p>
            <h1 className="mt-2 text-2xl font-semibold">{warehouse.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{warehouse.code}</p>
          </div>
          {canWrite && <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa kho'}</button>}
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Trạng thái</dt><dd className="font-medium">{warehouse.status}</dd></div>
          <div><dt className="text-muted-foreground">Địa chỉ</dt><dd className="font-medium">{warehouse.address ?? 'Chưa có'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Mô tả</dt><dd className="font-medium">{warehouse.description ?? 'Chưa có'}</dd></div>
        </dl>
        {editing && <form onSubmit={submitUpdate} className="mt-5 grid gap-3 border-t pt-5 md:grid-cols-2">
          <input required maxLength={50} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm" placeholder="Mã kho" />
          <input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm" placeholder="Tên kho" />
          <input maxLength={4000} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm" placeholder="Địa chỉ" />
          <input maxLength={4000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm" placeholder="Mô tả" />
          <button disabled={saving} type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </form>}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <div><h2 className="font-semibold">Tồn kho tại kho này</h2><p className="mt-1 text-sm text-muted-foreground">Dữ liệu được lọc theo warehouseId.</p></div>
          <span className="text-sm text-muted-foreground">{inventory.length} dòng</span>
        </div>
        {inventory.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Kho chưa có tồn kho.</p> : <div className="divide-y">
          {inventory.map((row) => <div key={row.balance.itemId + (row.balance.lotId ?? '')} className="grid gap-2 p-5 sm:grid-cols-3"><div><p className="font-medium">{row.itemName}</p><p className="text-sm text-muted-foreground">{row.itemCode}</p></div><p className="text-sm">LOT: {row.balance.lotId ?? 'Không áp dụng'}</p><p className="font-semibold sm:text-right">{row.balance.quantityOnHand}</p></div>)}
        </div>}
      </section>
    </div>
  );
}

'use client';

import { startTransition, useEffect, useState } from 'react';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';

type Warehouse = { id: string; code: string; name: string };
type Item = { id: string; code: string; name: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' };
type Transfer = { id: string; transferCode: string; fromWarehouseId: string; toWarehouseId: string; transferDate: string; status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'; note: string | null };
type TransferResponse = { transfer: Transfer; items: Array<{ id: string; itemId: string; quantity: string }> };

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  return Array.isArray(details?.message) ? details.message.join(', ') : details?.message ?? error.message;
}

export function TransfersScreen() {
  const request = useAuthenticatedRequest();
  const { data: auth, selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const membership = auth?.memberships.find(({ farm }) => farm.id === selectedFarmId);
  const canWrite = membership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ transferCode: '', fromWarehouseId: '', toWarehouseId: '', itemId: '', quantity: '1', note: '' });

  useEffect(() => {
    if (!selectedFarmId) return;
    startTransition(() => { setPage(1); setLoadedFarmId(null); setTransfers([]); setError(null); });
    let cancelled = false;
    void Promise.all([
      request<{ data: Warehouse[] }>('/api/v1/warehouses', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' } }),
      request<PaginatedResponse<Item>>('/api/v1/items', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' } }),
    ]).then(([warehouseResponse, itemResponse]) => {
      if (cancelled) return;
      setWarehouses(warehouseResponse.data);
      setItems(itemResponse.data);
      setForm((current) => ({ ...current, fromWarehouseId: '', toWarehouseId: '', itemId: itemResponse.data[0]?.id ?? '' }));
    }).catch((requestError: unknown) => { if (!cancelled) setError(errorMessage(requestError)); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => { setLoading(true); setError(null); });
    void request<PaginatedResponse<Transfer>>('/api/v1/stock-transfers', { params: { farmId: selectedFarmId, page, pageSize: 20, status: status === 'ALL' ? undefined : status } })
      .then((response) => { if (!cancelled) { setTransfers(response.data); setLoadedFarmId(selectedFarmId); setTotalPages(response.page.totalPages); setTotalItems(response.page.totalItems); } })
      .catch((requestError: unknown) => { if (!cancelled) { setTransfers([]); setError(errorMessage(requestError)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, request, selectedFarmId, status]);

  async function createTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarmId || !canWrite) return;
    setSaving(true); setError(null);
    try {
      await request<TransferResponse>('/api/v1/stock-transfers', {
        method: 'POST',
        params: { farmId: selectedFarmId },
        data: { transferCode: form.transferCode.trim(), fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, note: form.note.trim() || undefined, items: [{ itemId: form.itemId, quantity: form.quantity.trim() }] },
      });
      setShowForm(false); setForm((current) => ({ ...current, transferCode: '', quantity: '1', note: '' })); setPage(1); setLoadedFarmId(null);
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setSaving(false); }
  }

  async function changeTransfer(id: string, action: 'confirm' | 'cancel') {
    if (!selectedFarmId || !canWrite) return;
    try { await request<TransferResponse>(`/api/v1/stock-transfers/${id}/${action}`, { method: 'POST', params: { farmId: selectedFarmId } }); setLoadedFarmId(null); setPage(1); } catch (requestError) { setError(errorMessage(requestError)); }
  }

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem điều chuyển kho.</p>;
  const visibleTransfers = loadedFarmId === selectedFarmId ? transfers : [];

  return <div className="space-y-6">
    <section><span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock Transfer</span><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Điều chuyển kho</h1><p className="mt-2 text-sm text-muted-foreground">Tạo phiếu DRAFT, xác nhận để giảm kho nguồn và tăng kho đích.</p></section>
    {canWrite && <section className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Tạo phiếu điều chuyển</h2><button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{showForm ? 'Đóng form' : 'Tạo phiếu mới'}</button></div>
      {showForm && <form onSubmit={createTransfer} className="mt-4 grid gap-3 md:grid-cols-2"><input required maxLength={50} value={form.transferCode} onChange={(event) => setForm({ ...form, transferCode: event.target.value })} placeholder="Mã phiếu điều chuyển" className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><select required value={form.fromWarehouseId} onChange={(event) => setForm({ ...form, fromWarehouseId: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Kho nguồn</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select><select required value={form.toWarehouseId} onChange={(event) => setForm({ ...form, toWarehouseId: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Kho đích</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select><select required value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Chọn item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name} ({item.trackingMode})</option>)}</select><input required pattern="^(0|[1-9]\d{0,14})(\.\d{1,3})?$" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Số lượng" className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú" className="min-h-11 rounded-xl border bg-background px-3 text-sm md:col-span-2" /><button disabled={saving} type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">{saving ? 'Đang tạo...' : 'Tạo DRAFT'}</button></form>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">Danh sách phiếu</h2><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{totalItems} phiếu</span><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }} className="rounded-lg border bg-background px-2 py-1 text-sm"><option value="ALL">Tất cả</option><option value="DRAFT">DRAFT</option><option value="CONFIRMED">CONFIRMED</option><option value="CANCELLED">CANCELLED</option></select></div></div>{loading || loadedFarmId !== selectedFarmId ? <p className="p-5 text-sm text-muted-foreground">Đang tải phiếu...</p> : visibleTransfers.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Chưa có phiếu điều chuyển.</p> : <div className="divide-y">{visibleTransfers.map((transfer) => <article key={transfer.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{transfer.transferCode}</p><p className="mt-1 text-sm text-muted-foreground">{transfer.fromWarehouseId} → {transfer.toWarehouseId} · {transfer.transferDate}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{transfer.status}</span>{canWrite && transfer.status === 'DRAFT' && <><button type="button" onClick={() => void changeTransfer(transfer.id, 'confirm')} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Xác nhận</button><button type="button" onClick={() => void changeTransfer(transfer.id, 'cancel')} className="rounded-lg border px-3 py-2 text-sm">Hủy</button></>}</div></article>)}</div>}<div className="flex items-center justify-between border-t p-5 text-sm"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button><span>Trang {page}/{totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang sau</button></div></section>
  </div>;
}

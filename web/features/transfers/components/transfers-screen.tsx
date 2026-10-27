'use client';

import { startTransition, useEffect, useState } from 'react';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import { DocumentApprovalActions } from '@/features/warehouses/components/document-approval-actions';

type Warehouse = { id: string; code: string; name: string };
type InventoryRow = { id: string; balance: { id: string; farmId: string; warehouseId: string; itemId: string; lotId: string | null; quantityOnHand: string }; itemCode: string; itemName: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET'; lot: { lotNumber: string } | null };
type TransferOption = { key: string; itemId: string; itemCode: string; itemName: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET'; lotId?: string; lotNumber?: string; assetId?: string; quantity: number };
type Transfer = { id: string; transferCode: string; fromWarehouseId: string; toWarehouseId: string; transferDate: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'; note: string | null; rejectionReason?: string | null };
type TransferResponse = { data: { transfer: Transfer; items: Array<{ id: string; itemId: string; quantity: string }> } };

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
  const [transferOptions, setTransferOptions] = useState<TransferOption[]>([]);
  const [stockScope, setStockScope] = useState<string | null>(null);
  const [status, setStatus] = useState<'ALL' | Transfer['status']>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ transferCode: '', fromWarehouseId: '', toWarehouseId: '', optionKey: '', quantity: '1', note: '' });
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  const scopedOptions = stockScope === `${selectedFarmId}:${form.fromWarehouseId}` ? transferOptions : [];
  const selectedOption = scopedOptions.find((option) => option.key === form.optionKey);

  useEffect(() => {
    if (!selectedFarmId) return;
    startTransition(() => { setPage(1); setLoadedFarmId(null); setTransfers([]); setError(null); });
    let cancelled = false;
    void request<{ data: Warehouse[] }>('/warehouses', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' } }).then((warehouseResponse) => {
      if (cancelled) return;
      setWarehouses(warehouseResponse.data);
      setLoadingSourceStock(false);
      setForm((current) => ({ ...current, fromWarehouseId: '', toWarehouseId: '', optionKey: '' }));
    }).catch((requestError: unknown) => { if (!cancelled) setError(errorMessage(requestError)); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId || !form.fromWarehouseId) {
      return;
    }
    let cancelled = false;
    void Promise.all([
      request<PaginatedResponse<InventoryRow>>('/inventory', { params: { farmId: selectedFarmId, warehouseId: form.fromWarehouseId, page: 1, pageSize: 100 } }),
      request<PaginatedResponse<{ asset: { id: string; itemId: string; assetCode: string; farmId: string; status: string }; itemCode: string; itemName: string; locationWarehouseId: string | null }>>('/assets', { params: { farmId: selectedFarmId, warehouseId: form.fromWarehouseId, status: 'AVAILABLE', page: 1, pageSize: 100 } }),
    ]).then(async ([firstPage, assetPage]) => {
      if (cancelled) return;
      const allRows = [...firstPage.data];
      for (let pageNumber = 2; pageNumber <= firstPage.page.totalPages; pageNumber += 1) {
        const nextPage = await request<PaginatedResponse<InventoryRow>>('/inventory', { params: { farmId: selectedFarmId, warehouseId: form.fromWarehouseId, page: pageNumber, pageSize: 100 } });
        allRows.push(...nextPage.data);
      }
      if (cancelled) return;
      const quantityByItem = new Map<string, TransferOption>();
      const options: TransferOption[] = [];
      for (const row of allRows) {
        const balance = row.balance;
        const quantity = Number(balance.quantityOnHand);
        if (balance.farmId !== selectedFarmId || balance.warehouseId !== form.fromWarehouseId || !Number.isFinite(quantity) || quantity <= 0) continue;
        if (row.trackingMode === 'ASSET') continue;
        if (row.trackingMode === 'LOT') {
          if (!balance.lotId) continue;
          options.push({ key: `LOT:${balance.id}`, itemId: balance.itemId, itemCode: row.itemCode, itemName: row.itemName, trackingMode: 'LOT', lotId: balance.lotId, lotNumber: row.lot?.lotNumber, quantity });
        } else {
          const current = quantityByItem.get(balance.itemId);
          if (current) current.quantity += quantity;
          else quantityByItem.set(balance.itemId, { key: `QTY:${balance.itemId}`, itemId: balance.itemId, itemCode: row.itemCode, itemName: row.itemName, trackingMode: 'QUANTITY', quantity });
        }
      }
      options.push(...quantityByItem.values());
      for (const row of assetPage.data) {
        if (row.asset.farmId !== selectedFarmId || row.locationWarehouseId !== form.fromWarehouseId || row.asset.status !== 'AVAILABLE') continue;
        options.push({ key: `ASSET:${row.asset.id}`, itemId: row.asset.itemId, itemCode: row.itemCode, itemName: row.itemName, trackingMode: 'ASSET', assetId: row.asset.id, quantity: 1 });
      }
      setTransferOptions(options);
      setStockScope(`${selectedFarmId}:${form.fromWarehouseId}`);
      setForm((current) => ({ ...current, optionKey: options.some((option) => option.key === current.optionKey) ? current.optionKey : options[0]?.key ?? '', quantity: '1' }));
    }).catch((requestError: unknown) => {
      if (!cancelled) { setStockScope(null); setError(errorMessage(requestError)); }
    }).finally(() => { if (!cancelled) setLoadingSourceStock(false); });
    return () => { cancelled = true; };
  }, [form.fromWarehouseId, request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => { setLoading(true); setError(null); });
    void request<PaginatedResponse<Transfer>>('/stock-transfers', { params: { farmId: selectedFarmId, page, pageSize: 20, status: status === 'ALL' ? undefined : status } })
      .then((response) => { if (!cancelled) { setTransfers(response.data); setLoadedFarmId(selectedFarmId); setTotalPages(response.page.totalPages); setTotalItems(response.page.totalItems); } })
      .catch((requestError: unknown) => { if (!cancelled) { setTransfers([]); setError(errorMessage(requestError)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, request, selectedFarmId, status, refreshKey]);

  async function createTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarmId || !canWrite) return;
    if (!selectedOption) { setError('Kho nguồn chưa có mặt hàng tồn dương để điều chuyển.'); return; }
    if (form.fromWarehouseId === form.toWarehouseId) { setError('Kho nguồn và kho đích phải khác nhau.'); return; }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > selectedOption.quantity || !/^\d+(\.\d{1,3})?$/.test(form.quantity)) {
      setError(`Số lượng phải lớn hơn 0, không vượt tồn ${selectedOption.quantity} và tối đa 3 chữ số thập phân.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      await request<TransferResponse>('/stock-transfers', {
        method: 'POST',
        params: { farmId: selectedFarmId },
        data: { transferCode: form.transferCode.trim(), fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, note: form.note.trim() || undefined, items: [{ itemId: selectedOption.itemId, quantity: selectedOption.trackingMode === 'ASSET' ? '1' : form.quantity.trim(), lotId: selectedOption.lotId, assetId: selectedOption.assetId }] },
      });
      setShowForm(false); setForm((current) => ({ ...current, transferCode: '', quantity: '1', note: '' })); setPage(1); setLoadedFarmId(null); setRefreshKey((value) => value + 1);
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setSaving(false); }
  }

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem điều chuyển kho.</p>;
  const visibleTransfers = loadedFarmId === selectedFarmId ? transfers : [];

  return <div className="space-y-6">
    <section><span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock Transfer</span><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Điều chuyển kho</h1><p className="mt-2 text-sm text-muted-foreground">Tạo phiếu DRAFT, xác nhận để giảm kho nguồn và tăng kho đích.</p></section>
    {canWrite && <section className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Tạo phiếu điều chuyển</h2><button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{showForm ? 'Đóng form' : 'Tạo phiếu mới'}</button></div>
      {showForm && <form onSubmit={createTransfer} className="mt-4 grid gap-3 md:grid-cols-2"><input required maxLength={50} value={form.transferCode} onChange={(event) => setForm({ ...form, transferCode: event.target.value })} placeholder="Mã phiếu điều chuyển" className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><select required value={form.fromWarehouseId} onChange={(event) => { setLoadingSourceStock(Boolean(event.target.value)); setForm({ ...form, fromWarehouseId: event.target.value, optionKey: '' }); }} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Kho nguồn</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select><select required value={form.toWarehouseId} onChange={(event) => setForm({ ...form, toWarehouseId: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Kho đích</option>{warehouses.filter((warehouse) => warehouse.id !== form.fromWarehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</select><select required disabled={!form.fromWarehouseId || loadingSourceStock} value={form.optionKey} onChange={(event) => { const option = scopedOptions.find((candidate) => candidate.key === event.target.value); setForm({ ...form, optionKey: event.target.value, quantity: '1' }); if (option) setError(null); }} className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="">{loadingSourceStock ? 'Đang tải kho nguồn...' : 'Chọn vật tư/lô/tài sản trong kho nguồn'}</option>{scopedOptions.map((option) => <option key={option.key} value={option.key}>{option.itemCode} - {option.itemName}{option.assetId ? ` · Tài sản ${option.assetId.slice(0, 8)}` : option.lotId ? ` · Lô ${option.lotNumber ?? option.lotId.slice(0, 8)}` : ''} · {option.trackingMode === 'ASSET' ? '1 tài sản' : `Tồn ${option.quantity}`}</option>)}</select><input required={selectedOption?.trackingMode !== 'ASSET'} disabled={!selectedOption || selectedOption.trackingMode === 'ASSET'} max={selectedOption?.quantity} pattern="^(0|[1-9]\d{0,14})(\.\d{1,3})?$" value={selectedOption?.trackingMode === 'ASSET' ? '1' : form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Số lượng" className="min-h-11 rounded-xl border bg-background px-3 text-sm" /><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú" className="min-h-11 rounded-xl border bg-background px-3 text-sm md:col-span-2" /><button disabled={saving || loadingSourceStock || !selectedOption} type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">{saving ? 'Đang tạo...' : 'Tạo DRAFT'}</button></form>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">Danh sách phiếu</h2><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{totalItems} phiếu</span><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }} className="rounded-lg border bg-background px-2 py-1 text-sm"><option value="ALL">Tất cả</option>{(['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'REJECTED', 'CANCELLED'] as const).map((value) => <option key={value} value={value}>{value === 'PENDING_APPROVAL' ? 'Chờ duyệt' : value}</option>)}</select></div></div>{loading || loadedFarmId !== selectedFarmId ? <p className="p-5 text-sm text-muted-foreground">Đang tải phiếu...</p> : visibleTransfers.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Chưa có phiếu điều chuyển.</p> : <div className="divide-y">{visibleTransfers.map((transfer) => <article key={transfer.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{transfer.transferCode}</p><p className="mt-1 text-sm text-muted-foreground">{transfer.fromWarehouseId} → {transfer.toWarehouseId} · {transfer.transferDate}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{transfer.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : transfer.status}</span><DocumentApprovalActions basePath="/stock-transfers" farmId={selectedFarmId} id={transfer.id} status={transfer.status} rejectionReason={transfer.rejectionReason} canSubmit={canWrite} canApprove={canWrite} onChanged={() => { setLoadedFarmId(null); setRefreshKey((value) => value + 1); }} /></div></article>)}</div>}<div className="flex items-center justify-between border-t p-5 text-sm"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button><span>Trang {page}/{totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang sau</button></div></section>
  </div>;
}

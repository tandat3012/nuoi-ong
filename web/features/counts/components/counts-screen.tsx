'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState } from 'react';

import { useAuthenticatedRequest, useAuthContext, useFarmMembership } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Badge } from '@/shared/components/ui/badge';
import type { PaginatedResponse } from '@/shared/api/contracts';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { WarehouseLotSelect } from '@/features/inventory';
import { canCreateStockDocuments, StockDocumentLines, StockDocumentReview, stockDocumentActions, useStockDocumentLock, useStockDocumentQuery, DOCUMENT_CODE_HINT, documentCodeLabel, isFarmOwner, numberingDraft, numberingOptionsError, numberingOptionsPayload, NumberingOptionsFields } from '@/features/stock-documents';
import { shouldReloadAfterFailure } from '@/features/stock-documents/stock-document.logic';
import { useNotificationRefresh } from '@/features/notifications';

type Warehouse = { id: string; code: string; name: string };
type Item = { id: string; code: string; name: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' };
type Count = { id: string; countCode: string | null; externalReference?: string | null; requestedCode?: string | null; warehouseId: string; status: 'DRAFT' | 'COUNTING' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'; note: string | null; createdByMemberId: string | null; rejectionReason?: string | null };
type CountResponse = { count: Count; items: Array<{ id: string; itemId: string; systemQuantity: string; actualQuantity: string }> };

const STATUS_LABELS: Record<Count['status'], string> = { DRAFT: 'Nháp', COUNTING: 'Đang kiểm', PENDING_APPROVAL: 'Chờ duyệt', CONFIRMED: 'Đã xác nhận', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy' };

const warehouseName = (warehouses: Warehouse[], id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  return Array.isArray(details?.message) ? details.message.join(', ') : details?.message ?? error.message;
}

export function CountsScreen() {
  const { selectedFarmId } = useAuthContext();
  const notificationRevision = useNotificationRefresh();
  return <FarmCountsScreen key={`${selectedFarmId}:${notificationRevision}`} />;
}

function FarmCountsScreen() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const { membership } = useFarmMembership();
  const viewer = { roles: membership?.roles ?? [], memberId: membership?.memberId };
  const canWrite = canCreateStockDocuments(viewer.roles);
  const isOwner = isFarmOwner(viewer.roles);
  const lock = useStockDocumentLock();
  const reloadList = () => { setLoadedFarmId(null); setRevision((value) => value + 1); };
  const [counts, setCounts] = useState<Count[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'COUNTING' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Action failures live apart from `error`, which every list reload clears.
  const [actionError, setActionError] = useState<string | null>(null);
  const [openId, setOpenId] = useStockDocumentQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ warehouseId: '', itemId: '', lotId: '', actualQuantity: '0', note: '' });

  useEffect(() => {
    if (!selectedFarmId) return;
    startTransition(() => { setPage(1); setLoadedFarmId(null); setCounts([]); setError(null); });
    let cancelled = false;
    void Promise.all([
      request<{ data: Warehouse[] }>('/warehouses', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' } }),
      request<PaginatedResponse<{ item: Item }>>('/items', { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' } }),
    ]).then(([warehouseResponse, itemResponse]) => {
      if (cancelled) return;
      setWarehouses(warehouseResponse.data);
      setItems(itemResponse.data.map(({ item }) => item).filter((item) => item.trackingMode !== 'ASSET'));
      setForm((current) => ({ ...current, warehouseId: '', itemId: '', lotId: '' }));
    }).catch((requestError: unknown) => { if (!cancelled) setError(errorMessage(requestError)); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => { setLoading(true); setError(null); });
    void request<PaginatedResponse<Count>>('/stock-counts', { params: { farmId: selectedFarmId, page, pageSize: 20, status: status === 'ALL' ? undefined : status } })
      .then((response) => { if (!cancelled) { setCounts(response.data); setLoadedFarmId(selectedFarmId); setTotalPages(response.page.totalPages); setTotalItems(response.page.totalItems); } })
      .catch((requestError: unknown) => { if (!cancelled) { setCounts([]); setError(errorMessage(requestError)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, request, selectedFarmId, status, revision]);

  // Keep after the other state hooks: stock-document-interaction.test.mjs seeds state by call order.
  const [numbering, setNumbering] = useState(numberingDraft);
  async function createCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numberingOptions = isOwner ? numberingOptionsPayload(numbering) : {};
    const numberingError = numberingOptionsError(numberingOptions);
    if (numberingError) { setError(numberingError); return; }
    if (!selectedFarmId || !canWrite || !lock.acquire()) return;
    setSaving(true); setError(null);
    try {
      await request<CountResponse>('/stock-counts', { method: 'POST', params: { farmId: selectedFarmId }, data: { ...numberingOptions, warehouseId: form.warehouseId, note: form.note.trim() || undefined, items: [{ itemId: form.itemId, lotId: selectedItem?.trackingMode === 'LOT' ? form.lotId : undefined, actualQuantity: form.actualQuantity.trim() }] } });
      setShowForm(false); setNumbering(numberingDraft()); setForm((current) => ({ ...current, actualQuantity: '0', note: '' })); setPage(1); setLoadedFarmId(null); setRevision((value) => value + 1);
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setSaving(false); lock.release(); }
  }

  async function changeCount(id: string, action: 'confirm' | 'cancel') {
    if (!selectedFarmId || !lock.acquire()) return;
    setActionError(null);
    try { await request<CountResponse>(`/stock-counts/${id}/${action}`, { method: 'POST', params: { farmId: selectedFarmId } }); setLoadedFarmId(null); setRevision((value) => value + 1); setPage(1); } catch (requestError) { setActionError(errorMessage(requestError)); if (shouldReloadAfterFailure(requestError instanceof ApiError ? requestError.status : null)) reloadList(); } finally { lock.release(); }
  }

  if (authLoading) return <p>Đang tải trang trại...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Vui lòng chọn trang trại để xem phiếu kiểm kê.</p>;
  const visibleCounts = loadedFarmId === selectedFarmId ? counts : [];
  const selectedItem = items.find((item) => item.id === form.itemId);

  return <div className="space-y-6">
    <PageHeader title="Kiểm kê kho" description="Nhập số thực tế, đối chiếu snapshot và xác nhận chênh lệch tồn kho." />
    {canWrite && <section className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Tạo phiếu kiểm kê</h2><Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Đóng form' : 'Tạo phiếu mới'}</Button></div>
      {showForm && <form onSubmit={createCount} className="mt-4 grid gap-3 md:grid-cols-2"><p className="text-sm text-muted-foreground md:col-span-2">{DOCUMENT_CODE_HINT}</p>{isOwner && <NumberingOptionsFields value={numbering} onChange={setNumbering} />}<Select aria-label="Kho" required value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value, lotId: '' })}><option value="">Chọn kho</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>)}</Select><Select aria-label="Mặt hàng" required value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value, lotId: '' })}><option value="">Chọn vật tư</option>{items.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name} ({item.trackingMode})</option>)}</Select>{selectedItem?.trackingMode === 'LOT' && <WarehouseLotSelect farmId={selectedFarmId} warehouseId={form.warehouseId} itemId={form.itemId} value={form.lotId} onChange={(lotId) => setForm({ ...form, lotId })} />}<Input required min="0" pattern="^(0|[1-9][0-9]{0,14})([.][0-9]{1,3})?$" value={form.actualQuantity} onChange={(event) => setForm({ ...form, actualQuantity: event.target.value })} aria-label="Số lượng thực tế" placeholder="Số lượng thực tế" /><Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} aria-label="Ghi chú chênh lệch" placeholder="Ghi chú chênh lệch" className="md:col-span-2" /><p className="text-sm text-muted-foreground md:col-span-2">Tài sản (ASSET) không kiểm kê ở đây; đối chiếu từng tài sản qua hồ sơ, báo mất hoặc hỏng tại đó. <Link href="/assets" className="underline">Mở hồ sơ tài sản</Link>.</p><Button disabled={saving || lock.locked || (selectedItem?.trackingMode === 'LOT' && !form.lotId)} type="submit" className="md:col-span-2">{saving ? 'Đang tạo...' : 'Tạo phiếu nháp'}</Button></form>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
    {actionError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{actionError}</p>}
    {openId && <StockDocumentLines key={openId} revision={revision} kind="stock-counts" farmId={selectedFarmId} id={openId} viewer={viewer} items={items} lock={lock} onChanged={reloadList} onError={setActionError} onClose={() => setOpenId(null)} />}
    <section className="overflow-hidden rounded-xl border bg-card"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">Danh sách phiếu</h2><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{totalItems} phiếu</span><div className="w-44"><Select aria-label="Trạng thái phiếu" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }}><option value="ALL">Tất cả</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div></div></div>{loading || (!error && loadedFarmId !== selectedFarmId) ? <p className="p-5 text-sm text-muted-foreground">Đang tải phiếu...</p> : visibleCounts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Chưa có phiếu kiểm kê.</p> : <div className="divide-y">{visibleCounts.map((count) => { const actions = stockDocumentActions(viewer, count); return <article key={count.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{documentCodeLabel(count.countCode, count.id)}</p>{count.externalReference && <p className="text-xs text-muted-foreground">Chứng từ giấy: {count.externalReference}</p>}{count.requestedCode && !count.countCode && <p className="text-xs text-muted-foreground">Mã yêu cầu: {count.requestedCode}</p>}<p className="mt-1 text-sm text-muted-foreground">Kho {warehouseName(warehouses, count.warehouseId)} · {count.note || 'Không có ghi chú'}</p>{count.status === 'REJECTED' && count.rejectionReason && <p className="mt-1 text-sm text-destructive">Lý do từ chối: {count.rejectionReason}</p>}</div><div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{STATUS_LABELS[count.status]}</Badge><Button variant="outline" disabled={lock.locked} onClick={() => { if (!lock.locked) setOpenId(count.id); }}>Xem dòng hàng</Button>{actions.confirm && <Button disabled={lock.locked} onClick={() => void changeCount(count.id, 'confirm')}>Xác nhận</Button>}{actions.cancel && <Button variant="outline" disabled={lock.locked} onClick={() => void changeCount(count.id, 'cancel')}>Hủy</Button>}<StockDocumentReview kind="stock-counts" farmId={selectedFarmId} id={count.id} code={documentCodeLabel(count.countCode, count.id)} canSubmit={actions.submit} canReject={actions.reject} lock={lock} onChanged={reloadList} onError={setActionError} /></div></article>; })}</div>}<div className="flex items-center justify-between border-t p-5 text-sm"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button><span>Trang {page}/{totalPages}</span><Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button></div></section>
  </div>;
}

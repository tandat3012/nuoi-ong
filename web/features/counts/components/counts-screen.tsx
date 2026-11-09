'use client';

import Link from 'next/link';
import { startTransition, useEffect, useState, useMemo } from 'react';

import { useAuthenticatedRequest, useAuthContext, useFarmMembership } from '@/features/auth';
import { ApiError } from '@/shared/api/client';
import { PageHeader } from '@/shared/components/ui/page-header';
import type { PaginatedResponse } from '@/shared/api/contracts';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { WarehouseLotSelect } from '@/features/inventory';
import {
  canCreateStockDocuments,
  StockDocumentLines,
  StockDocumentReview,
  stockDocumentActions,
  useStockDocumentLock,
  useStockDocumentQuery,
  DOCUMENT_CODE_HINT,
  documentCodeLabel,
  isFarmOwner,
  numberingDraft,
  numberingOptionsError,
  numberingOptionsPayload,
  NumberingOptionsFields,
} from '@/features/stock-documents';
import { shouldReloadAfterFailure, stockDocumentErrorMessage } from '@/features/stock-documents/stock-document.logic';
import { useNotificationRefresh } from '@/features/notifications';
import { BeeLoader } from '@/shared/components/ui/bee-loader';
import { CountAssetFields, type CountAssetValue } from './count-asset-fields';
import { CountSummaryBar } from './count-summary-bar';
import {
  Plus,
  X,
  Search,
  RotateCcw,
  ClipboardCheck,
  Eye,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';

type Warehouse = { id: string; code: string; name: string };
type Item = { id: string; code: string; name: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' };
type Count = {
  id: string;
  countCode: string | null;
  externalReference?: string | null;
  requestedCode?: string | null;
  warehouseId: string;
  status: 'DRAFT' | 'COUNTING' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
  note: string | null;
  createdByMemberId: string | null;
  rejectionReason?: string | null;
};
type CountResponse = {
  count: Count;
  items: Array<{ id: string; itemId: string; systemQuantity: string; actualQuantity: string }>;
};

const STATUS_LABELS: Record<Count['status'], string> = {
  DRAFT: 'Nháp',
  COUNTING: 'Đang kiểm',
  PENDING_APPROVAL: 'Chờ duyệt',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_CONFIG: Record<
  Count['status'],
  { label: string; dotClass: string; badgeClass: string }
> = {
  CONFIRMED: {
    label: 'Đã xác nhận',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  COUNTING: {
    label: 'Đang kiểm',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  },
  PENDING_APPROVAL: {
    label: 'Chờ duyệt',
    dotClass: 'bg-sky-500',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  },
  DRAFT: {
    label: 'Nháp',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  REJECTED: {
    label: 'Đã từ chối',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
  CANCELLED: {
    label: 'Đã hủy',
    dotClass: 'bg-zinc-400',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

const warehouseName = (warehouses: Warehouse[], id: string) =>
  warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  const details = error.details as { message?: string | string[] } | undefined;
  const message = Array.isArray(details?.message) ? details.message.join(', ') : details?.message ?? error.message;
  return error.status === 409 ? stockDocumentErrorMessage(409, message) : message;
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
  const [assetLine, setAssetLine] = useState<CountAssetValue>({ assetId: '', result: 'GOOD', foundLocation: null });

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
      setItems(itemResponse.data.map(({ item }) => item));
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
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = items.find((item) => item.id === form.itemId);

  async function createCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numberingOptions = isOwner ? numberingOptionsPayload(numbering) : {};
    const numberingError = numberingOptionsError(numberingOptions);
    if (numberingError) { setError(numberingError); return; }
    if (!selectedFarmId || !canWrite || !lock.acquire()) return;
    setSaving(true); setError(null);
    try {
      const asset = selectedItem?.trackingMode === 'ASSET';
      const line = asset
        ? { itemId: form.itemId, assetId: assetLine.assetId, actualQuantity: assetLine.result === 'MISSING' ? '0' : '1', assetCondition: assetLine.result === 'MISSING' ? undefined : assetLine.result, foundLocationId: assetLine.result === 'MISSING' ? undefined : assetLine.foundLocation?.id, note: form.note.trim() || undefined }
        : { itemId: form.itemId, lotId: selectedItem?.trackingMode === 'LOT' ? form.lotId : undefined, actualQuantity: form.actualQuantity.trim() };
      await request<CountResponse>('/stock-counts', { method: 'POST', params: { farmId: selectedFarmId }, data: { ...numberingOptions, warehouseId: form.warehouseId, note: form.note.trim() || undefined, items: [line] } });
      setShowForm(false); setNumbering(numberingDraft()); setForm((current) => ({ ...current, actualQuantity: '0', note: '' })); setAssetLine({ assetId: '', result: 'GOOD', foundLocation: null }); setPage(1); setLoadedFarmId(null); setRevision((value) => value + 1);
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setSaving(false); lock.release(); }
  }

  async function changeCount(id: string, action: 'confirm' | 'cancel') {
    if (!selectedFarmId || !lock.acquire()) return;
    setActionError(null);
    try {
      await request<CountResponse>(`/stock-counts/${id}/${action}`, { method: 'POST', params: { farmId: selectedFarmId } });
      setLoadedFarmId(null);
      setRevision((value) => value + 1);
      setPage(1);
    } catch (requestError) {
      setActionError(errorMessage(requestError));
      if (shouldReloadAfterFailure(requestError instanceof ApiError ? requestError.status : null)) reloadList();
    } finally {
      lock.release();
    }
  }

  const visibleCounts = loadedFarmId === selectedFarmId ? counts : [];

  const displayedCounts = useMemo(() => {
    if (!searchQuery.trim()) return visibleCounts;
    const query = searchQuery.trim().toLowerCase();
    return visibleCounts.filter((c) => {
      const code = (c.countCode ?? '').toLowerCase();
      const whName = warehouseName(warehouses, c.warehouseId).toLowerCase();
      const note = (c.note ?? '').toLowerCase();
      const ref = (c.externalReference ?? '').toLowerCase();
      return (
        code.includes(query) ||
        whName.includes(query) ||
        note.includes(query) ||
        ref.includes(query)
      );
    });
  }, [visibleCounts, warehouses, searchQuery]);

  if (authLoading) return <BeeLoader label="Đang tải trang trại..." />;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Vui lòng chọn trang trại để xem phiếu kiểm kê.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm kê kho"
        description="Nhập số thực tế, đối chiếu snapshot và xác nhận chênh lệch tồn kho."
      />

      {/* Summary KPI Bar */}
      <CountSummaryBar counts={visibleCounts} totalItems={totalItems} />

      {/* Collapsible Count Creation Card */}
      {canWrite && (
        <section className="rounded-xl border border-border bg-card shadow-2xs transition-colors">
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tạo phiếu kiểm kê</h2>
              <p className="text-xs text-muted-foreground">
                Lập phiếu đối chiếu số lượng thực tế với tồn hệ thống
              </p>
            </div>
            <Button
              variant={showForm ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowForm((value) => !value)}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {showForm ? (
                <>
                  <X className="size-3.5" aria-hidden="true" />
                  <span>Đóng form</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Tạo phiếu mới</span>
                </>
              )}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={createCount} className="space-y-4 border-t border-border p-4 sm:p-5">
              <p className="font-mono text-xs text-muted-foreground">
                {DOCUMENT_CODE_HINT}
              </p>

              {isOwner && (
                <NumberingOptionsFields value={numbering} onChange={setNumbering} />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Kho kiểm kê *
                  </label>
                  <Select
                    aria-label="Kho"
                    required
                    value={form.warehouseId}
                    onChange={(event) => {
                      setForm({ ...form, warehouseId: event.target.value, lotId: '' });
                      setAssetLine({ assetId: '', result: 'GOOD', foundLocation: null });
                    }}
                    className="h-9 text-xs"
                  >
                    <option value="">Chọn kho kiểm kê</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Vật tư / Thiết bị *
                  </label>
                  <Select
                    aria-label="Mặt hàng"
                    required
                    value={form.itemId}
                    onChange={(event) => {
                      setForm({ ...form, itemId: event.target.value, lotId: '' });
                      setAssetLine({ assetId: '', result: 'GOOD', foundLocation: null });
                    }}
                    className="h-9 text-xs"
                  >
                    <option value="">Chọn vật tư / thiết bị</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name} ({item.trackingMode === 'LOT' ? 'Theo lô' : item.trackingMode === 'ASSET' ? 'Tài sản' : 'Số lượng'})
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedItem?.trackingMode === 'LOT' && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Lô hàng kiểm kê *
                    </label>
                    <WarehouseLotSelect
                      farmId={selectedFarmId}
                      warehouseId={form.warehouseId}
                      itemId={form.itemId}
                      value={form.lotId}
                      onChange={(lotId) => setForm({ ...form, lotId })}
                    />
                  </div>
                )}

                {selectedItem?.trackingMode === 'ASSET' ? (
                  <div className="sm:col-span-2">
                    <CountAssetFields
                      farmId={selectedFarmId}
                      warehouseId={form.warehouseId}
                      itemId={form.itemId}
                      value={assetLine}
                      onChange={setAssetLine}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Số lượng thực tế *
                    </label>
                    <Input
                      required
                      min="0"
                      pattern="^(0|[1-9][0-9]{0,14})([.][0-9]{1,3})?$"
                      value={form.actualQuantity}
                      onChange={(event) => setForm({ ...form, actualQuantity: event.target.value })}
                      aria-label="Số lượng thực tế"
                      placeholder="Nhập số lượng đếm được"
                      className="h-9 text-xs tabular-nums font-medium"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Ghi chú chênh lệch
                  </label>
                  <Input
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                    aria-label="Ghi chú chênh lệch"
                    placeholder="Lý do chênh lệch hoặc mô tả tình trạng..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    Thiết bị/dụng cụ (ASSET) kiểm từng tài sản. Thiếu sẽ trừ tồn, hỏng thành chưa dùng được.{" "}
                    <Link href="/assets" className="text-primary underline">
                      Mở hồ sơ tài sản
                    </Link>.
                  </span>
                </div>

                <Button
                  disabled={
                    saving ||
                    lock.locked ||
                    !form.warehouseId ||
                    !form.itemId ||
                    (selectedItem?.trackingMode === 'LOT' && !form.lotId) ||
                    (selectedItem?.trackingMode === 'ASSET' && !assetLine.assetId)
                  }
                  type="submit"
                  className="h-9 self-end px-5 text-xs font-semibold shadow-xs"
                >
                  {saving ? 'Đang tạo...' : 'Tạo phiếu nháp'}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {openId && (
        <StockDocumentLines
          key={openId}
          revision={revision}
          kind="stock-counts"
          farmId={selectedFarmId}
          id={openId}
          viewer={viewer}
          items={items.filter((item) => item.trackingMode !== 'ASSET')}
          lock={lock}
          onChanged={reloadList}
          onError={setActionError}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* Counts List Section */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        {/* Header & Filter Controls */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Danh sách phiếu kiểm kê</h2>
            <p className="text-xs text-muted-foreground">{totalItems} phiếu trong hệ thống</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative min-w-[14rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Tìm mã, kho kiểm kê..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-card pl-8.5 pr-8 text-xs font-normal text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Status Selector */}
            <div className="w-40">
              <Select
                aria-label="Trạng thái phiếu"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as typeof status);
                }}
                className="h-8.5 text-xs font-medium"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {(status !== 'ALL' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('ALL');
                  setSearchQuery('');
                }}
                className="h-8.5 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Đặt lại</span>
              </Button>
            )}
          </div>
        </div>

        {loading || (!error && loadedFarmId !== selectedFarmId) ? (
          <BeeLoader label="Đang tải danh sách phiếu kiểm kê..." />
        ) : displayedCounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="size-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {searchQuery || status !== 'ALL'
                ? 'Không tìm thấy phiếu kiểm kê phù hợp với bộ lọc.'
                : 'Chưa có phiếu kiểm kê nào trong trang trại.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedCounts.map((count) => {
              const actions = stockDocumentActions(viewer, count);
              const statusCfg = STATUS_CONFIG[count.status] ?? {
                label: STATUS_LABELS[count.status] ?? count.status,
                dotClass: 'bg-zinc-400',
                badgeClass: 'bg-muted text-muted-foreground border-border',
              };
              const code = documentCodeLabel(count.countCode, count.id, 'KK');

              return (
                <article
                  key={count.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/20 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${statusCfg.badgeClass}`}
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${statusCfg.dotClass}`}
                          aria-hidden="true"
                        />
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                      <span className="font-medium text-foreground">
                        Kho {warehouseName(warehouses, count.warehouseId)}
                      </span>
                      {count.note && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground italic">&quot;{count.note}&quot;</span>
                        </>
                      )}
                    </div>

                    {count.externalReference && (
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Chứng từ giấy: <span className="font-mono">{count.externalReference}</span>
                      </p>
                    )}
                    {count.requestedCode && !count.countCode && (
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Mã yêu cầu: <span className="font-mono">{count.requestedCode}</span>
                      </p>
                    )}
                    {count.status === 'REJECTED' && count.rejectionReason && (
                      <p className="text-xs font-medium text-destructive">
                        Lý do từ chối: {count.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Actions Group */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={lock.locked}
                      onClick={() => {
                        if (!lock.locked) setOpenId(count.id);
                      }}
                      className="h-8 gap-1 text-xs font-medium"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      <span>Xem dòng hàng</span>
                    </Button>

                    {actions.confirm && (
                      <Button
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => void changeCount(count.id, 'confirm')}
                        className="h-8 gap-1 text-xs font-medium shadow-xs"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        <span>Xác nhận</span>
                      </Button>
                    )}

                    {actions.cancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => void changeCount(count.id, 'cancel')}
                        className="h-8 text-xs font-medium text-muted-foreground hover:text-destructive"
                      >
                        Hủy
                      </Button>
                    )}

                    <StockDocumentReview
                      kind="stock-counts"
                      farmId={selectedFarmId}
                      id={count.id}
                      code={code}
                      canSubmit={actions.submit}
                      canReject={actions.reject}
                      lock={lock}
                      onChanged={reloadList}
                      onError={setActionError}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Navigation */}
        <div className="flex items-center justify-between border-t border-border p-4 text-xs font-medium sm:p-5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
            className="h-8 text-xs"
          >
            Trang trước
          </Button>
          <span className="text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
            className="h-8 text-xs"
          >
            Trang sau
          </Button>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { QrCodeButton } from '@/features/qr/components/qr-code-button';
import { ApiError } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import type { Warehouse } from '@/features/warehouses/types/warehouse';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';

type AssetFilters = { search: string; status: string; warehouseId: string; page: number };
const initialAssetFilters: AssetFilters = { search: '', status: '', warehouseId: '', page: 1 };

type AssetRow = {
  asset: {
    id: string;
    assetCode: string;
    serialNumber: string | null;
    status: string;
    lastMaintenanceDate?: string | null;
    nextMaintenanceDate?: string | null;
  };
  itemCode: string;
  itemName: string;
  locationCode: string | null;
  locationName: string | null;
  locationWarehouseId?: string | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
};

type MaintenanceRow = {
  id: string;
  maintenanceType: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  description: string | null;
  resultNote: string | null;
  totalCost: string | null;
};

export function AssetsScreen() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId, isLoading: authLoading, error: authError } = useAuthContext();
  const [filters, setFilters] = useState<AssetFilters>(initialAssetFilters);
  const [searchDraft, setSearchDraft] = useState('');
  const queryKey = JSON.stringify([selectedFarmId, filters]);
  const [assetResult, setAssetResult] = useState<{
    key: string;
    data: AssetRow[];
    page: PaginatedResponse<AssetRow>['page'];
    error: string | null;
  } | null>(null);
  const [warehouseResult, setWarehouseResult] = useState<{ farmId: string; data: Warehouse[] } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
  const loading = Boolean(selectedFarmId) && assetResult?.key !== queryKey;
  const assets = assetResult?.key === queryKey ? assetResult.data : [];
  const page = assetResult?.key === queryKey ? assetResult.page : null;
  const error = assetResult?.key === queryKey ? assetResult.error : null;
  const warehouses = warehouseResult?.farmId === selectedFarmId ? warehouseResult.data : [];
  const maintenanceKey = selectedAsset ? `${selectedFarmId}:${selectedAsset.asset.id}` : '';
  const [maintenanceResult, setMaintenanceResult] = useState<{
    key: string;
    records: MaintenanceRow[];
    error: string | null;
  } | null>(null);
  const maintenanceLoading = Boolean(selectedAsset) && maintenanceResult?.key !== maintenanceKey;
  const maintenance = maintenanceResult?.key === maintenanceKey ? maintenanceResult.records : [];
  const maintenanceError = maintenanceResult?.key === maintenanceKey ? maintenanceResult.error : null;

  useEffect(() => {
    setFilters(initialAssetFilters);
    setSearchDraft('');
    setSelectedAsset(null);
  }, [selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void request<PaginatedResponse<AssetRow>>('/assets', {
      params: {
        farmId: selectedFarmId,
        page: filters.page,
        pageSize: 20,
        search: filters.search || undefined,
        status: filters.status || undefined,
        warehouseId: filters.warehouseId || undefined,
      },
    })
      .then((response) => {
        if (!cancelled) setAssetResult({ key: queryKey, data: response.data, page: response.page, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setAssetResult({
          key: queryKey,
          data: [],
          page: { number: filters.page, size: 20, totalItems: 0, totalPages: 0 },
          error: cause instanceof ApiError ? cause.message : 'Không thể tải danh sách tài sản.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId, filters, queryKey]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void request<PaginatedResponse<Warehouse>>('/warehouses', {
      params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: 'ACTIVE' },
    }).then((response) => {
      if (!cancelled) setWarehouseResult({ farmId: selectedFarmId, data: response.data });
    }).catch(() => {
      if (!cancelled) setWarehouseResult({ farmId: selectedFarmId, data: [] });
    });
    return () => { cancelled = true; };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId || !selectedAsset) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const first = await request<PaginatedResponse<MaintenanceRow>>("/maintenance-records", {
          params: { farmId: selectedFarmId, assetId: selectedAsset.asset.id, page: 1, pageSize: 100 },
        });
        const records = [...first.data];
        for (let page = 2; page <= first.page.totalPages; page += 1) {
          const next = await request<PaginatedResponse<MaintenanceRow>>("/maintenance-records", {
            params: { farmId: selectedFarmId, assetId: selectedAsset.asset.id, page, pageSize: 100 },
          });
          records.push(...next.data);
        }
        if (!cancelled) setMaintenanceResult({ key: maintenanceKey, records, error: null });
      } catch {
        if (!cancelled) setMaintenanceResult({ key: maintenanceKey, records: [], error: "Không tải được lịch sử bảo trì của tài sản." });
      }
    })();
    return () => { cancelled = true; };
  }, [request, selectedFarmId, selectedAsset, maintenanceKey]);

  if (authLoading) return <p>Đang tải farm...</p>;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId) return <p>Không có farm hoạt động để xem tài sản.</p>;

  function updateFilter(patch: Partial<AssetFilters>) {
    setSelectedAsset(null);
    setFilters((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  }

  return (
    <div className="space-y-6">
      <section>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Assets</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Tài sản định danh</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mở chi tiết tài sản để xem mã QR thật từ API.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <form onSubmit={(event) => { event.preventDefault(); updateFilter({ search: searchDraft.trim().slice(0, 100) }); }} className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_12rem_16rem_auto]">
          <label className="sr-only" htmlFor="asset-search">Tìm mã tài sản hoặc serial</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="asset-search" value={searchDraft} maxLength={100} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm mã tài sản hoặc serial..." className="pl-9" /></div>
          <Select aria-label="Lọc trạng thái tài sản" value={filters.status} onChange={(event) => updateFilter({ status: event.target.value })}>
            <option value="">Tất cả trạng thái</option><option value="AVAILABLE">Sẵn sàng</option><option value="ASSIGNED">Đã phân công</option><option value="IN_USE">Đang sử dụng</option><option value="MAINTENANCE">Đang bảo trì</option><option value="LOST">Đã mất</option><option value="RETIRED">Đã thanh lý</option>
          </Select>
          <Select aria-label="Lọc theo kho" value={filters.warehouseId} onChange={(event) => updateFilter({ warehouseId: event.target.value })}>
            <option value="">Tất cả kho trong farm</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
          </Select>
          <div className="flex gap-2"><Button type="submit" size="sm"><Search className="size-3.5" />Tìm</Button><Button type="button" size="sm" variant="outline" aria-label="Xóa bộ lọc" onClick={() => { setSearchDraft(''); updateFilter(initialAssetFilters); }}><X className="size-3.5" /></Button></div>
        </form>
      </section>
      {selectedAsset && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chi tiết tài sản</p>
              <h2 className="mt-2 text-xl font-semibold">{selectedAsset.itemName}</h2>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{selectedAsset.asset.assetCode}</p>
            </div>
            <button type="button" onClick={() => setSelectedAsset(null)} className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted">Đóng chi tiết</button>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Mã vật tư</dt><dd className="mt-1 font-medium">{selectedAsset.itemCode}</dd></div>
            <div><dt className="text-muted-foreground">Serial</dt><dd className="mt-1 font-medium">{selectedAsset.asset.serialNumber ?? 'Không có'}</dd></div>
            <div><dt className="text-muted-foreground">Trạng thái</dt><dd className="mt-1 font-medium">{selectedAsset.asset.status}</dd></div>
            <div><dt className="text-muted-foreground">Kho đang chứa</dt><dd className="mt-1 font-medium">{selectedAsset.warehouseName ? `${selectedAsset.warehouseName} (${selectedAsset.warehouseCode})` : selectedAsset.locationName ?? 'Chưa xác định'}</dd></div>
            <div><dt className="text-muted-foreground">Số lượng</dt><dd className="mt-1 font-medium">1 tài sản định danh</dd></div>
            <div><dt className="text-muted-foreground">Lần bảo trì gần nhất</dt><dd className="mt-1 font-medium">{selectedAsset.asset.lastMaintenanceDate ?? 'Chưa ghi nhận'}</dd></div>
            <div><dt className="text-muted-foreground">Bảo trì tiếp theo</dt><dd className="mt-1 font-medium">{selectedAsset.asset.nextMaintenanceDate ?? 'Chưa lên lịch'}</dd></div>
          </dl>
          <div className="mt-5 border-t pt-5">
            <h3 className="font-semibold">Lịch sử bảo trì</h3>
            {maintenanceLoading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Đang tải lịch sử...</p>
              : maintenanceError ? <p role="alert" className="mt-3 text-sm text-destructive">{maintenanceError}</p>
                : maintenance.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Tài sản chưa có lịch sử bảo trì.</p>
                  : <div className="mt-3 divide-y rounded-xl border">{maintenance.map((record) => <article key={record.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto]">
                    <div><p className="font-medium">{record.description || record.maintenanceType}</p><p className="mt-1 text-muted-foreground">{record.maintenanceType} · {record.status}</p>{record.resultNote && <p className="mt-2">Kết quả: {record.resultNote}</p>}</div>
                    <div className="text-sm text-muted-foreground sm:text-right"><p>{record.completedAt ? `Hoàn tất ${new Date(record.completedAt).toLocaleDateString('vi-VN')}` : record.scheduledAt ? `Lịch ${new Date(record.scheduledAt).toLocaleDateString('vi-VN')}` : record.startedAt ? `Bắt đầu ${new Date(record.startedAt).toLocaleDateString('vi-VN')}` : 'Chưa có ngày'}</p>{record.totalCost && <p className="mt-1">Chi phí: {new Intl.NumberFormat('vi-VN').format(Number(record.totalCost))} đ</p>}</div>
                  </article>)}</div>}
          </div>
          <div className="mt-5 border-t pt-5">
            <QrCodeButton farmId={selectedFarmId} path={`/assets/${selectedAsset.asset.id}/qr`} label="Xem QR tài sản" alt={`Mã QR tài sản ${selectedAsset.asset.assetCode}`} />
          </div>
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-5"><h2 className="font-semibold">Danh sách tài sản</h2></div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Đang tải tài sản...</p> : assets.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Không tìm thấy tài sản phù hợp với farm và bộ lọc hiện tại.</p> : <div className="divide-y">{assets.map((asset) => <article key={asset.asset.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{asset.itemName}</p><p className="font-mono text-sm text-muted-foreground">{asset.asset.assetCode}{asset.asset.serialNumber ? ` · S/N ${asset.asset.serialNumber}` : ''}</p><p className="text-sm text-muted-foreground">{asset.warehouseName ? `${asset.warehouseName} · ` : ''}{asset.locationName ?? 'Chưa xác định vị trí'}</p></div><button type="button" onClick={() => setSelectedAsset(asset)} className="rounded-xl border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Mở chi tiết</button></article>)}</div>}
        {page && page.totalPages > 1 && <div className="flex items-center justify-between border-t p-4 text-sm"><span className="text-muted-foreground">Trang {page.number}/{page.totalPages} · {page.totalItems} tài sản</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={loading || page.number <= 1} onClick={() => updateFilter({ page: page.number - 1 })}>Trước</Button><Button type="button" size="sm" variant="outline" disabled={loading || page.number >= page.totalPages} onClick={() => updateFilter({ page: page.number + 1 })}>Sau</Button></div></div>}
      </section>
    </div>
  );
}

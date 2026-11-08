'use client';

import { useEffect, useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth';
import { AssetLookup } from '@/features/assets';
import type { PaginatedResponse } from '@/shared/api/contracts';
import { Select } from '@/shared/components/ui/select';

export type CountAssetValue = {
  assetId: string;
  result: 'GOOD' | 'DAMAGED' | 'MISSING';
  foundLocation: { id: string; label: string } | null;
};

/** P1-12: one asset of the counted warehouse, found (good/damaged, maybe elsewhere) or missing. */
export function CountAssetFields({ farmId, warehouseId, itemId, value, onChange }: {
  farmId: string;
  warehouseId: string;
  itemId: string;
  value: CountAssetValue;
  onChange: (value: CountAssetValue) => void;
}) {
  const request = useAuthenticatedRequest();
  const [result, setResult] = useState<{ key: string; assets?: { id: string; assetCode: string; status: string }[]; error?: string } | null>(null);
  const key = `${warehouseId}:${itemId}`;
  useEffect(() => {
    if (!warehouseId || !itemId) return;
    let cancelled = false;
    void request<PaginatedResponse<{ asset: { id: string; assetCode: string; status: string } }>>('/assets', { params: { farmId, warehouseId, itemId, page: 1, pageSize: 100 } })
      // shortcut: first 100 assets of the item in the warehouse; add search when a warehouse holds more.
      .then((response) => { if (!cancelled) setResult({ key, assets: response.data.map(({ asset }) => asset).filter((asset) => asset.status === 'AVAILABLE' || asset.status === 'DAMAGED') }); })
      .catch(() => { if (!cancelled) setResult({ key, error: 'Không tải được tài sản của kho.' }); });
    return () => { cancelled = true; };
  }, [request, farmId, warehouseId, itemId, key]);
  if (!warehouseId) return <p className="text-sm text-muted-foreground md:col-span-2">Chọn kho trước để chọn tài sản.</p>;
  const current = result?.key === key ? result : null;
  if (current?.error) return <p role="alert" className="text-sm text-destructive md:col-span-2">{current.error}</p>;
  return <>
    <Select aria-label="Tài sản" required value={value.assetId} onChange={(event) => onChange({ ...value, assetId: event.target.value })}>
      <option value="">{current ? (current.assets?.length ? 'Chọn tài sản trong kho' : 'Kho không có tài sản này') : 'Đang tải tài sản...'}</option>
      {current?.assets?.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode}{asset.status === 'DAMAGED' ? ' (đang hỏng)' : ''}</option>)}
    </Select>
    <Select aria-label="Kết quả kiểm" value={value.result} onChange={(event) => onChange({ ...value, result: event.target.value as CountAssetValue['result'], foundLocation: event.target.value === 'MISSING' ? null : value.foundLocation })}>
      <option value="GOOD">Có, tốt</option>
      <option value="DAMAGED">Có, hỏng</option>
      <option value="MISSING">Thiếu (không tìm thấy)</option>
    </Select>
    {value.result !== 'MISSING' && <div className="md:col-span-2"><AssetLookup key={warehouseId} farmId={farmId} kind="location" activeOnly warehouseId={warehouseId} selected={value.foundLocation} onSelect={(foundLocation) => onChange({ ...value, foundLocation })} /><p className="mt-1 text-xs text-muted-foreground">Chỉ chọn vị trí nếu tài sản nằm sai chỗ so với hồ sơ.</p></div>}
  </>;
}

'use client';

import { useEffect, useState } from 'react';

import { useAuthContext, useAuthenticatedRequest } from '@/features/auth';
import { ApiError } from '@/shared/api/client';

type AssetLookup = {
  asset: {
    assetCode: string;
    status: string;
    serialNumber: string | null;
    purchaseDate: string | null;
    warrantyExpiryDate: string | null;
    note: string | null;
  };
  itemCode: string;
  itemName: string;
  locationCode: string | null;
  locationName: string | null;
};

export function QrAssetLookup({ assetCode: qrToken }: { assetCode: string }) {
  const request = useAuthenticatedRequest();
  const { selectedFarmId } = useAuthContext();
  const [asset, setAsset] = useState<AssetLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedFarmId || !qrToken) {
      setLoading(false);
      setError('Cần chọn farm để xác thực mã QR.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void request<{ data: AssetLookup }>(`/assets/by-qr/${encodeURIComponent(qrToken)}`, {
      params: { farmId: selectedFarmId },
    })
      .then(({ data }) => {
        if (!cancelled) {
          setAsset(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setAsset(null);
          setError(cause instanceof ApiError && cause.status === 404
            ? 'QR không hợp lệ hoặc tài sản không thuộc farm đang chọn.'
            : cause instanceof Error ? cause.message : 'Không thể xác thực mã QR.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [qrToken, request, selectedFarmId]);

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      <div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">QR tài sản</span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Tra cứu tài sản</h1>
        <p className="mt-2 break-all text-sm text-muted-foreground">Token: <strong className="font-mono text-foreground">{qrToken}</strong></p>
      </div>
      {loading && <p role="status" className="rounded-xl border bg-muted/40 p-4 text-sm">Đang xác thực với dữ liệu farm...</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      {asset && (
        <div className="rounded-xl border p-5">
          <p className="text-sm font-semibold text-emerald-700">QR hợp lệ · API OK</p>
          <h2 className="mt-2 text-xl font-semibold">{asset.itemName}</h2>
          <p className="font-mono text-sm text-muted-foreground">{asset.itemCode} · {asset.asset.assetCode}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Trạng thái" value={asset.asset.status} />
            <Detail label="Serial" value={asset.asset.serialNumber ?? 'Không có'} />
            <Detail label="Kho hiện tại" value={asset.locationName ?? 'Chưa xác định'} />
            <Detail label="Vị trí" value={asset.locationCode ?? 'Chưa xác định'} />
            <Detail label="Ngày mua" value={asset.asset.purchaseDate ?? 'Chưa có'} />
            <Detail label="Hạn bảo hành" value={asset.asset.warrantyExpiryDate ?? 'Chưa có'} />
          </dl>
          {asset.asset.note && <p className="mt-4 text-sm">Ghi chú: {asset.asset.note}</p>}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

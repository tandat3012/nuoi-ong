'use client';

import { useEffect, useState } from 'react';

import { useAuthContext } from '@/features/auth';
import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { ApiError } from '@/shared/api/client';

type InventoryQrData = {
  balanceId: string;
  balance: {
    itemId: string;
    warehouseId: string;
    lotId: string | null;
    quantityOnHand: string;
    updatedAt?: string | null;
  };
  itemCode: string;
  itemName: string;
  itemType: string;
  trackingMode: string;
  warehouseCode: string;
  warehouseName: string;
  lotNumber: string | null;
};

export function InventoryQrResult({ balanceId }: { balanceId: string }) {
  const request = useAuthenticatedRequest();
  const { selectedFarmId } = useAuthContext();
  const [data, setData] = useState<InventoryQrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedFarmId) {
      setLoading(false);
      setError('Chưa chọn trang trại để tra cứu mã tồn kho.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    void request<{ data: InventoryQrData }>(`/inventory/${encodeURIComponent(balanceId)}/qr`, {
      params: { farmId: selectedFarmId },
    })
      .then((response) => {
        if (!cancelled) {
          setData(response.data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'Không thể tải dữ liệu tồn kho.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [balanceId, request, selectedFarmId]);

  return (
    <section className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">QR tồn kho</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tra cứu bản ghi tồn kho</h1>
        <p className="mt-2 break-all text-sm text-muted-foreground">Balance ID: {balanceId}</p>
      </div>

      {loading && <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Đang tải dữ liệu từ API...</div>}
      {error && <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">{error}</div>}
      {data && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">QR hợp lệ · API OK</span>
              <h2 className="mt-4 text-2xl font-semibold">{data.itemName}</h2>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{data.itemCode}</p>
            </div>
            <a href="/inventory" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted">Mở tồn kho</a>
          </div>
          <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Kho" value={`${data.warehouseCode} - ${data.warehouseName}`} />
            <Detail label="Mã LOT" value={data.lotNumber ?? 'Không áp dụng'} />
            <Detail label="Số lượng tồn" value={`${data.balance.quantityOnHand} ${data.itemType}`} />
            <Detail label="Theo dõi" value={data.trackingMode} />
          </dl>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>;
}

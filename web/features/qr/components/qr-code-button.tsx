'use client';

import { useState } from 'react';

import { useAuthenticatedRequest } from '@/features/auth';
import { ApiError } from '@/shared/api/client';

type QrPayload = { qrUrl: string; imageDataUrl: string };

export function QrCodeButton({
  farmId,
  path,
  label,
  alt,
}: {
  farmId: string;
  path: string;
  label: string;
  alt: string;
}) {
  const request = useAuthenticatedRequest();
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleQr() {
    if (qr) {
      setQr(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await request<{ data: QrPayload }>(path, {
        params: { farmId },
      });
      setQr(response.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tạo mã QR từ DB.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void toggleQr()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        <span aria-hidden="true">▦</span>
        <span>{loading ? 'Đang tạo QR...' : qr ? 'Ẩn QR' : label}</span>
      </button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {qr && (
        <div className="flex flex-col items-start gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center">
          <img src={qr.imageDataUrl} alt={alt} className="size-44 max-w-full" />
          <a href={qr.qrUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-primary underline">
            Mở URL QR để kiểm tra
          </a>
        </div>
      )}
    </div>
  );
}

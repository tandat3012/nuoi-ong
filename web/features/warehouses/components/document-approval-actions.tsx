'use client';

import { useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth';
import { ApiError } from '@/shared/api/client';

export type StockDocumentStatus =
  | 'DRAFT'
  | 'COUNTING'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

type Action = 'submit' | 'confirm' | 'reject' | 'cancel';

function messageFor(error: unknown, action: Action) {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (error.status === 409) return error.message;
  if (error.status === 400) return error.message;
  if (error.status === 404) return 'Phiếu không tồn tại hoặc không thuộc farm đang chọn.';
  if (action === 'reject') return 'Chưa từ chối được phiếu. Vui lòng thử lại.';
  return 'Chưa cập nhật được trạng thái phiếu. Vui lòng thử lại.';
}

export function DocumentApprovalActions({
  basePath,
  farmId,
  id,
  status,
  rejectionReason,
  canSubmit,
  canApprove,
  onChanged,
}: {
  basePath: string;
  farmId: string;
  id: string;
  status: StockDocumentStatus;
  rejectionReason?: string | null;
  canSubmit: boolean;
  canApprove: boolean;
  onChanged?: (action: Action) => void;
}) {
  const request = useAuthenticatedRequest();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (action === 'reject' && !reason.trim()) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setSaving(action);
    setError(null);
    try {
      await request(`${basePath}/${id}/${action}`, {
        method: 'POST',
        params: { farmId },
        ...(action === 'reject' ? { data: { rejectionReason: reason.trim() } } : {}),
      });
      setRejecting(false);
      setReason('');
      onChanged?.(action);
    } catch (cause) {
      setError(messageFor(cause, action));
    } finally {
      setSaving(null);
    }
  }

  const canCancel = canSubmit && (status === 'DRAFT' || status === 'COUNTING');
  const canSend = canSubmit && (status === 'DRAFT' || status === 'COUNTING');
  const canReview = canApprove && status === 'PENDING_APPROVAL';
  if (!canSend && !canCancel && !canReview && status !== 'REJECTED') {
    return rejectionReason ? (
      <p className="text-sm text-destructive">Lý do từ chối: {rejectionReason}</p>
    ) : null;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === 'REJECTED' && rejectionReason && (
        <p className="max-w-md text-right text-sm text-destructive">
          Lý do từ chối: {rejectionReason}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {canSend && (
          <button
            type="button"
            disabled={Boolean(saving)}
            onClick={() => void run('submit')}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving === 'submit' ? 'Đang gửi...' : 'Gửi duyệt'}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={Boolean(saving)}
            onClick={() => void run('cancel')}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            {saving === 'cancel' ? 'Đang hủy...' : 'Hủy nháp'}
          </button>
        )}
        {canReview && (
          <>
            <button
              type="button"
              disabled={Boolean(saving)}
              onClick={() => void run('confirm')}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving === 'confirm' ? 'Đang duyệt...' : 'Duyệt phiếu'}
            </button>
            <button
              type="button"
              disabled={Boolean(saving)}
              onClick={() => setRejecting((value) => !value)}
              className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-50"
            >
              Từ chối
            </button>
          </>
        )}
      </div>
      {rejecting && canReview && (
        <div className="w-full max-w-md space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <label htmlFor={`rejection-${id}`} className="block text-sm font-medium">
            Lý do từ chối <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={`rejection-${id}`}
            required
            maxLength={4000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do để người lập phiếu biết cần bổ sung gì"
            className="min-h-24 w-full rounded-lg border bg-background p-2 text-sm"
          />
          <button
            type="button"
            disabled={saving === 'reject'}
            onClick={() => void run('reject')}
            className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {saving === 'reject' ? 'Đang từ chối...' : 'Xác nhận từ chối'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

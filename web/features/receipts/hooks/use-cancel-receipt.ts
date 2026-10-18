'use client';

import { useRef, useState } from 'react';
import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { ApiError } from '@/shared/api/client';
import { cancelReceipt } from '../api/receipts.api';

export function useCancelReceipt(
  farmId: string,
  canWrite: boolean,
  id: string,
  onCancelled: () => void,
) {
  const request = useAuthenticatedRequest();
  const pending = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    if (pending.current) return;
    if (!canWrite) {
      setError('Bạn không có quyền hủy phiếu nhập.');
      return;
    }
    pending.current = true;
    setIsCancelling(true);
    setError(null);
    try {
      await cancelReceipt(request, farmId, id);
      setIsCancelling(false);
      onCancelled();
    } catch (failure: unknown) {
      setIsCancelling(false);
      const message =
        failure instanceof ApiError && failure.status === 403
          ? 'Bạn không có quyền hủy phiếu nhập trong trang trại này.'
          : failure instanceof ApiError && failure.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : failure instanceof ApiError && failure.status === 409
              ? 'Phiếu này không còn ở trạng thái nháp nên không thể hủy.'
              : failure instanceof ApiError && failure.status === 404
                ? 'Phiếu nhập không tồn tại hoặc không thuộc trang trại này.'
                : 'Chưa xác nhận được kết quả hủy. Hãy tải lại danh sách trước khi thử lại.';
      setError(message);
    } finally {
      pending.current = false;
    }
  }
  return { cancel, isCancelling, cancelError: error };
}

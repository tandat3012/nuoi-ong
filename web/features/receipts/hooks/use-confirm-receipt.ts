"use client";

import { useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { confirmReceipt } from "../api/receipts.api";

export function useConfirmReceipt(
  farmId: string,
  canWrite: boolean,
  id: string,
  onConfirmed: () => void,
) {
  const request = useAuthenticatedRequest();

  const pending = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending.current) return;
    if (!canWrite) {
      setError("Bạn không có quyền xác nhận phiếu nhập.");
      return;
    }
    pending.current = true;
    setIsConfirming(true);
    setError(null);
    try {
      await confirmReceipt(request, farmId, id);
      setIsConfirming(false);
      onConfirmed();
    } catch (failure: unknown) {
      setIsConfirming(false);
      const message =
        failure instanceof ApiError && failure.status === 403
          ? "Bạn không có quyền xác nhận phiếu nhập trong trang trại này."
          : failure instanceof ApiError && failure.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : failure instanceof ApiError && failure.status === 404
              ? "Phiếu nhập không tồn tại hoặc không thuộc trang trại này."
              : failure instanceof ApiError && failure.status === 409
                ? `Không thể xác nhận phiếu nhập: ${failure.message}`
                : failure instanceof ApiError && failure.status === 400
                  ? `Phiếu nhập chưa hợp lệ: ${failure.message}`
                  : "Chưa xác nhận được kết quả xác nhận. Hãy tải lại chi tiết trước khi thử lại.";
      setError(message);
    } finally {
      pending.current = false;
    }
  }

  return { confirm, isConfirming, confirmError: error };
}

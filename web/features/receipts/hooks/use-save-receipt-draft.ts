"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { createReceipt, updateReceipt } from "../api/receipts.api";
import { validateReceiptDraft } from "../components/receipt-draft.logic";
import type { CreateReceiptInput } from "../types/receipt";

export function useSaveReceiptDraft(
  farmId: string,
  canWrite: boolean,
  id: string | undefined,
  onSaved: (id: string) => void,
) {
  const request = useAuthenticatedRequest();
  const alive = useRef(true);
  const submitting = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function submit(input: CreateReceiptInput) {
    if (submitting.current) return;
    const validation = canWrite
      ? validateReceiptDraft(input)
      : "Bạn không có quyền lưu phiếu nhập.";
    if (validation) {
      setError(validation);
      return;
    }
    submitting.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const { data } = id
        ? await updateReceipt(request, farmId, id, input)
        : await createReceipt(request, farmId, input);
      if (alive.current) onSaved(data.receipt.id);
    } catch (failure: unknown) {
      if (!alive.current) return;
      const action = id ? "cập nhật" : "tạo";
      const message =
        failure instanceof ApiError && failure.status === 403
          ? `Bạn không có quyền ${action} phiếu nhập trong trang trại này.`
          : failure instanceof ApiError && failure.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : failure instanceof ApiError && failure.status === 409
              ? `Không thể ${action} phiếu nhập: ${failure.message}`
              : failure instanceof ApiError &&
                  [400, 404].includes(failure.status)
                ? `Dữ liệu không hợp lệ hoặc không còn khả dụng: ${failure.message}`
                : `Chưa xác nhận được kết quả ${action}. Hãy tải lại danh sách trước khi gửi lại.`;
      setError(message);
    } finally {
      submitting.current = false;
      if (alive.current) setIsSaving(false);
    }
  }
  return { submit, isSaving, error };
}

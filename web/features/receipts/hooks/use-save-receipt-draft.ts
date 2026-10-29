"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { createReceipt, updateReceipt } from "../api/receipts.api";
import {
  receiptSaveErrorMessage,
  validateReceiptDraft,
} from "../components/receipt-draft.logic";
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
      setError(
        receiptSaveErrorMessage(
          failure instanceof ApiError ? failure.status : null,
          failure instanceof ApiError ? failure.message : "",
          id ? "cập nhật" : "tạo",
        ),
      );
    } finally {
      submitting.current = false;
      if (alive.current) setIsSaving(false);
    }
  }
  return { submit, isSaving, error };
}

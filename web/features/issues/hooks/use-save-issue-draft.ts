"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { createIssue, updateIssue } from "../api/issues.api";
import { validateIssueDraft } from "../components/issue-draft.logic";
import type { CreateIssueInput, IssueDraftTrackingMode } from "../types/issue";

export function useSaveIssueDraft(
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

  async function submit(
    input: CreateIssueInput,
    trackingModes?: readonly IssueDraftTrackingMode[],
  ) {
    if (submitting.current) return;
    const validation = canWrite
      ? validateIssueDraft(input, trackingModes)
      : "Bạn không có quyền lưu phiếu xuất.";
    if (validation) {
      setError(validation);
      return;
    }
    submitting.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const { data } = id
        ? await updateIssue(request, farmId, id, input)
        : await createIssue(request, farmId, input);
      if (alive.current) onSaved(data.issue.id);
    } catch (failure: unknown) {
      if (!alive.current) return;
      const message =
        failure instanceof ApiError && failure.status === 403
          ? "Bạn không có quyền lưu phiếu xuất trong trang trại này."
          : failure instanceof ApiError && failure.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : failure instanceof ApiError && failure.status === 409
              ? failure.message === "Issue code already exists for this farm"
                ? "Mã phiếu đã tồn tại trong trang trại. Vui lòng chọn mã khác."
                : failure.message === "Warehouse must exist and be ACTIVE"
                  ? "Kho xuất không tồn tại hoặc đã ngừng hoạt động. Vui lòng chọn kho khác."
                  : failure.message === "Only DRAFT issues can be edited"
                    ? "Phiếu không còn ở trạng thái nháp. Hãy tải lại chi tiết để kiểm tra."
                    : `Không thể lưu phiếu xuất: ${failure.message}`
              : failure instanceof ApiError &&
                  [400, 404].includes(failure.status)
                ? `Dữ liệu không hợp lệ hoặc không còn khả dụng: ${failure.message}`
                : "Chưa xác nhận được kết quả lưu. Hãy quay lại và tải lại danh sách trước khi gửi lại.";
      setError(message);
    } finally {
      submitting.current = false;
      if (alive.current) setIsSaving(false);
    }
  }
  return { submit, isSaving, error };
}

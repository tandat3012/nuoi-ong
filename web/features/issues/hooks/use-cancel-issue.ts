"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { cancelIssue } from "../api/issues.api";
import type { IssueStatus } from "../types/issue";

export function useCancelIssue(
  farmId: string,
  canWrite: boolean,
  id: string,
  status: IssueStatus | undefined,
  onRefresh: () => void,
) {
  const request = useAuthenticatedRequest();
  const pending = useRef(false);
  const alive = useRef(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function cancel() {
    if (pending.current) return;
    if (!canWrite || status !== "DRAFT") {
      setError(
        !canWrite
          ? "Bạn không có quyền hủy phiếu xuất."
          : "Chỉ phiếu xuất nháp mới được hủy.",
      );
      return;
    }
    pending.current = true;
    setIsCancelling(true);
    setError(null);
    try {
      const { data } = await cancelIssue(request, farmId, id);
      if (data.issue.status !== "CANCELLED")
        throw new Error("Unexpected cancellation response");
      if (alive.current) onRefresh();
    } catch (failure: unknown) {
      if (!alive.current) return;
      const statusCode = failure instanceof ApiError ? failure.status : 0;
      setError(
        statusCode === 403
          ? "Bạn không có quyền hủy phiếu xuất trong trang trại này."
          : statusCode === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : statusCode === 409
              ? "Không thể hủy vì phiếu không còn ở trạng thái nháp. Trạng thái phiếu đang được tải lại."
              : statusCode === 404
                ? "Phiếu xuất không tồn tại hoặc không thuộc trang trại này."
                : statusCode === 400
                  ? "Yêu cầu hủy không hợp lệ. Vui lòng kiểm tra lại phiếu."
                  : "Yêu cầu hủy chưa nhận được kết quả xác định. Hãy kiểm tra trạng thái được tải lại trước khi thử tiếp.",
      );
      if (![400, 401, 403].includes(statusCode)) onRefresh();
    } finally {
      pending.current = false;
      if (alive.current) setIsCancelling(false);
    }
  }
  return { cancel, isCancelling, cancelError: error };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { confirmIssue } from "../api/issues.api";
import type { IssueStatus } from "../types/issue";

const BUSINESS_ERRORS: Record<string, string> = {
  "Insufficient inventory":
    "Tồn kho không đủ để xác nhận phiếu xuất. Phiếu chưa được xử lý; hãy kiểm tra lại tồn kho.",
  "Only DRAFT issues can be confirmed":
    "Phiếu không còn ở trạng thái nháp nên không thể xác nhận.",
  "Warehouse must exist and be ACTIVE":
    "Kho nguồn không tồn tại hoặc đã ngừng hoạt động.",
  "LOT is missing or expired": "Lô hàng không tồn tại hoặc đã hết hạn sử dụng.",
  "ASSET is missing or unavailable":
    "Tài sản không tồn tại hoặc không còn khả dụng.",
  "ASSET must be located in the source warehouse":
    "Tài sản không nằm trong kho nguồn của phiếu xuất.",
};

export function useConfirmIssue(
  farmId: string,
  canWrite: boolean,
  id: string,
  status: IssueStatus | undefined,
  onRefresh: () => void,
) {
  const request = useAuthenticatedRequest();
  const pending = useRef(false);
  const alive = useRef(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function confirm() {
    if (pending.current) return;
    if (!canWrite || status !== "DRAFT") {
      setError(
        !canWrite
          ? "Bạn không có quyền xác nhận phiếu xuất."
          : "Chỉ phiếu xuất nháp mới được xác nhận.",
      );
      return;
    }
    pending.current = true;
    setIsConfirming(true);
    setError(null);
    try {
      const { data } = await confirmIssue(request, farmId, id);
      if (data.issue.status !== "CONFIRMED")
        throw new Error("Unexpected confirmation response");
      if (alive.current) onRefresh();
    } catch (failure: unknown) {
      if (!alive.current) return;
      const code = failure instanceof ApiError ? failure.status : 0;
      const message = failure instanceof ApiError ? failure.message : "";
      setError(
        code === 403
          ? "Bạn không có quyền xác nhận phiếu xuất trong trang trại này."
          : code === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : code === 404
              ? "Phiếu hoặc dữ liệu tham chiếu không tồn tại trong trang trại này."
              : code === 400
                ? `Dữ liệu phiếu xuất không hợp lệ: ${message}`
                : code === 409
                  ? (BUSINESS_ERRORS[message] ??
                    "Không thể xác nhận do xung đột dữ liệu. Hãy kiểm tra trạng thái phiếu được tải lại.")
                  : "Yêu cầu xác nhận chưa nhận được kết quả xác định. Hãy kiểm tra trạng thái được tải lại trước khi thử tiếp.",
      );
      // Never replay a mutation; the read hook hides stale actions until GET succeeds.
      if (![401, 403].includes(code)) onRefresh();
    } finally {
      pending.current = false;
      if (alive.current) setIsConfirming(false);
    }
  }
  return { confirm, isConfirming, confirmError };
}

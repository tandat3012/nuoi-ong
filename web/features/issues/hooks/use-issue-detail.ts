"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { getIssueById } from "../api/issues.api";
import type { IssueDetail } from "../types/issue";

export function useIssueDetail(farmId: string, id: string) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    id: string;
    attempt: number;
    detail?: IssueDetail;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getIssueById(request, farmId, id)
      .then(({ data }) => {
        if (!cancelled) setResult({ farmId, id, attempt, detail: data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.status === 404
            ? "Phiếu xuất không tồn tại hoặc không thuộc trang trại này."
            : error instanceof ApiError && error.status === 403
              ? "Bạn không có quyền xem chi tiết phiếu xuất này."
              : error instanceof ApiError && error.status === 401
                ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                : "Không thể tải chi tiết phiếu xuất. Vui lòng thử lại.";
        setResult({ farmId, id, attempt, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, id, attempt]);

  const current =
    result?.farmId === farmId && result.id === id && result.attempt === attempt
      ? result
      : null;
  return {
    detail: current?.detail,
    error: current?.error,
    isLoading: !current,
    reload: () => setAttempt((previous) => previous + 1),
  };
}

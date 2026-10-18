"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { getIssues } from "../api/issues.api";
import type { Issue, IssueFilters, IssueStatus } from "../types/issue";

export function useIssueList(farmId: string) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<IssueFilters>({
    page: 1,
    pageSize: 20,
  });
  const [result, setResult] = useState<{
    farmId: string;
    filters: IssueFilters;
    response?: PaginatedResponse<Issue>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getIssues(request, farmId, filters)
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (filters.page > lastPage) {
          setFilters((previous) => ({ ...previous, page: lastPage }));
          return;
        }
        setResult({ farmId, filters, response });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.status === 403
            ? "Bạn không có quyền xem phiếu xuất của trang trại này."
            : error instanceof ApiError && error.status === 401
              ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
              : "Không thể tải danh sách phiếu xuất. Vui lòng thử lại.";
        setResult({ farmId, filters, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters]);

  const current =
    result?.farmId === farmId && result.filters === filters ? result : null;
  return {
    filters,
    issues: current?.response?.data ?? [],
    pageInfo: current?.response?.page,
    isLoading: !current,
    error: current?.error,
    changeStatus: (status?: IssueStatus) =>
      setFilters((previous) => ({ ...previous, status, page: 1 })),
    changePage: (page: number) =>
      setFilters((previous) => ({ ...previous, page: Math.max(1, page) })),
    reload: () => setFilters((previous) => ({ ...previous })),
  };
}

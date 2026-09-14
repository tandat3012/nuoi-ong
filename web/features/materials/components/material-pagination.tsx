"use client";

import type { PageInfo } from "@/shared/api/contracts";

interface MaterialPaginationProps {
  pageInfo: PageInfo;
  isLoading: boolean;
  errorMessage: string | null;
  onPageChange: (page: number) => void;
}

export function MaterialPagination({
  pageInfo,
  isLoading,
  errorMessage,
  onPageChange,
}: MaterialPaginationProps) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t bg-card px-4 py-3 sm:flex-row sm:px-6">
      <p className="text-xs text-muted-foreground">
        {isLoading ? (
          "Đang tải..."
        ) : errorMessage ? (
          "Chưa có thông tin phân trang"
        ) : pageInfo.totalItems === 0 ? (
          "0 bản ghi"
        ) : (
          <>
            Hiển thị trang{" "}
            <span className="font-semibold text-foreground">
              {pageInfo.number}
            </span>{" "}
            /{" "}
            <span className="font-semibold text-foreground">
              {pageInfo.totalPages}
            </span>{" "}
            ({pageInfo.totalItems} bản ghi)
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(pageInfo.number - 1)}
          disabled={pageInfo.number <= 1 || isLoading || Boolean(errorMessage)}
          className="rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          Trang trước
        </button>
        <button
          type="button"
          onClick={() => onPageChange(pageInfo.number + 1)}
          disabled={
            pageInfo.number >= pageInfo.totalPages ||
            isLoading ||
            Boolean(errorMessage)
          }
          className="rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

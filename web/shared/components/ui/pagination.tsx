import * as React from 'react';
import type { PageInfo } from '@/shared/api/contracts';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  pageInfo: PageInfo;
  isLoading?: boolean;
  errorMessage?: string | null;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function Pagination({
  pageInfo,
  isLoading = false,
  errorMessage = null,
  onPageChange,
  itemLabel = 'bản ghi',
  className,
  ...props
}: PaginationProps) {
  const isPrevDisabled = pageInfo.number <= 1 || isLoading || Boolean(errorMessage);
  const isNextDisabled =
    pageInfo.totalPages === 0 ||
    pageInfo.number >= pageInfo.totalPages ||
    isLoading ||
    Boolean(errorMessage);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:px-6',
        className,
      )}
      {...props}
    >
      <p className="text-xs text-muted-foreground">
        {isLoading ? (
          'Đang tải...'
        ) : errorMessage ? (
          'Chưa có thông tin phân trang'
        ) : pageInfo.totalItems === 0 ? (
          `0 ${itemLabel}`
        ) : (
          <>
            Hiển thị trang{' '}
            <span className="font-semibold text-foreground">{pageInfo.number}</span> /{' '}
            <span className="font-semibold text-foreground">{pageInfo.totalPages}</span>{' '}
            ({pageInfo.totalItems} {itemLabel})
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageInfo.number - 1)}
          disabled={isPrevDisabled}
          aria-label="Trang trước"
          className="h-8 gap-1 text-xs"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          <span>Trang trước</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageInfo.number + 1)}
          disabled={isNextDisabled}
          aria-label="Trang sau"
          className="h-8 gap-1 text-xs"
        >
          <span>Trang sau</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type Count = {
  id: string;
  status:
    | 'DRAFT'
    | 'COUNTING'
    | 'PENDING_APPROVAL'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'CANCELLED';
};

export function CountSummaryBar({
  counts,
  totalItems,
}: {
  counts: Count[];
  totalItems?: number;
}) {
  const summary = useMemo(() => {
    const total = totalItems ?? counts.length;
    let counting = 0;
    let pendingOrDraft = 0;
    let confirmed = 0;

    for (const c of counts) {
      if (c.status === 'COUNTING') counting++;
      else if (c.status === 'DRAFT' || c.status === 'PENDING_APPROVAL') pendingOrDraft++;
      else if (c.status === 'CONFIRMED') confirmed++;
    }

    return { total, counting, pendingOrDraft, confirmed };
  }, [counts, totalItems]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Tổng phiếu kiểm kê</span>
          <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-foreground tabular-nums">
          {summary.total}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đợt kiểm kê trong nông trại</p>
      </div>

      {/* Counting */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đang kiểm đếm</span>
          <Clock className="size-4 text-violet-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-violet-600 dark:text-violet-400 tabular-nums">
          {summary.counting}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đang nhập số lượng thực tế</p>
      </div>

      {/* Pending / Draft */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Chờ duyệt / Nháp</span>
          <AlertCircle className="size-4 text-amber-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
          {summary.pendingOrDraft}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Chờ quản lý kiểm tra đối chiếu</p>
      </div>

      {/* Confirmed */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đã xác nhận</span>
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
          {summary.confirmed}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đã điều chỉnh cân đối tồn kho</p>
      </div>
    </div>
  );
}

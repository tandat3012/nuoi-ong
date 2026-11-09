'use client';

import { useMemo } from 'react';
import {
  ArrowLeftRight,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type Transfer = {
  id: string;
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'IN_TRANSIT'
    | 'DISCREPANCY'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'CANCELLED';
};

export function TransferSummaryBar({
  transfers,
  totalItems,
}: {
  transfers: Transfer[];
  totalItems?: number;
}) {
  const summary = useMemo(() => {
    const total = totalItems ?? transfers.length;
    let inTransit = 0;
    let discrepancy = 0;
    let confirmed = 0;

    for (const t of transfers) {
      if (t.status === 'IN_TRANSIT') inTransit++;
      else if (t.status === 'DISCREPANCY') discrepancy++;
      else if (t.status === 'CONFIRMED') confirmed++;
    }

    return { total, inTransit, discrepancy, confirmed };
  }, [transfers, totalItems]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Tổng phiếu chuyển</span>
          <ArrowLeftRight className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-foreground tabular-nums">
          {summary.total}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Toàn bộ điều chuyển nội bộ</p>
      </div>

      {/* In Transit */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đang vận chuyển</span>
          <Truck className="size-4 text-sky-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-sky-600 dark:text-sky-400 tabular-nums">
          {summary.inTransit}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đã xuất kho nguồn, chưa nhận</p>
      </div>

      {/* Discrepancy */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Lệch số lượng</span>
          <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
          {summary.discrepancy}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Nhận thiếu, chờ giải quyết</p>
      </div>

      {/* Confirmed */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đã nhận hàng</span>
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
          {summary.confirmed}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Kho đích đã nhận đủ & cộng tồn</p>
      </div>
    </div>
  );
}

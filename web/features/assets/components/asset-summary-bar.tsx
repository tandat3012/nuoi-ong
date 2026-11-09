'use client';

import { useMemo } from 'react';
import type { AssetView } from '../types/asset';
import {
  Package,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export function AssetSummaryBar({
  assets,
  totalItems,
}: {
  assets: AssetView[];
  totalItems?: number;
}) {
  const summary = useMemo(() => {
    const total = totalItems ?? assets.length;
    let available = 0;
    let inUse = 0;
    let attention = 0;

    for (const item of assets) {
      const status = item.asset.status;
      if (status === 'AVAILABLE') {
        available++;
      } else if (status === 'ASSIGNED' || status === 'IN_USE') {
        inUse++;
      } else if (
        status === 'MAINTENANCE' ||
        status === 'DAMAGED' ||
        status === 'LOST' ||
        status === 'TRANSFER_PENDING'
      ) {
        attention++;
      }
    }

    return { total, available, inUse, attention };
  }, [assets, totalItems]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total Assets */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Tổng tài sản / thiết bị</span>
          <Package className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-foreground tabular-nums">
          {summary.total}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Thiết bị quản lý trong trại</p>
      </div>

      {/* Available */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Sẵn sàng sử dụng</span>
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
          {summary.available}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đang ở kho, sẵn sàng cấp phát</p>
      </div>

      {/* In Use / Assigned */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đang cấp phát / Dùng</span>
          <UserCheck className="size-4 text-blue-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
          {summary.inUse}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Nhân viên / tổ đội đang giữ</p>
      </div>

      {/* Attention Needed */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Cần xử lý / Bảo trì</span>
          <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
        </div>
        <p className="mt-1.5 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
          {summary.attention}
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">Đang bảo trì, hỏng hoặc thất lạc</p>
      </div>
    </div>
  );
}

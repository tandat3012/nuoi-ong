'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  PackageSearch,
  ShoppingCart,
  Wrench,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { formatOrderMoney } from '@/features/commerce/orders/order.logic';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { DashboardSummary } from '../types/dashboard';

interface DashboardKpiGridProps {
  summary: DashboardSummary | null;
  isLoading: boolean;
  showOrders?: boolean;
}

export function DashboardKpiGrid({
  summary,
  isLoading,
  showOrders = false,
}: DashboardKpiGridProps) {
  if (isLoading || !summary) {
    return (
      <section aria-label="Đang tải chỉ số" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: showOrders ? 3 : 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-48 rounded-md" />
          </div>
        ))}
      </section>
    );
  }

  const isUnpriced = (summary.unpricedItems ?? 0) > 0;

  return (
    <section aria-label="Chỉ số vận hành cốt lõi" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-primary" />
          <span>Chỉ số vận hành trọng yếu</span>
        </h2>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Metric 1: Stock Valuation */}
        {summary.stockValue !== null && (
          <Link
            href="/inventory"
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {isUnpriced ? 'Giá trị tồn đã định giá' : 'Tổng giá trị tồn kho'}
                </span>
                <span className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <PackageSearch className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums group-hover:text-primary transition-colors">
                  {formatOrderMoney(summary.stockValue)}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              {isUnpriced ? (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{summary.unpricedItems} mặt hàng chưa có đơn giá</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                  <span>Tính theo giá bình quân gia quyền di động</span>
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Metric 2: Store Orders (if applicable) */}
        {showOrders && summary.ordersToday !== null && (
          <Link
            href="/store-orders"
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Đơn hàng hôm nay
                </span>
                <span className="grid size-8 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ShoppingCart className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums group-hover:text-primary transition-colors">
                  {summary.ordersToday}
                </span>
                <span className="text-xs font-medium text-muted-foreground">đơn hàng</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              {summary.ordersPending > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-purple-700 dark:text-purple-400">
                  <span className="size-1.5 rounded-full bg-purple-500 animate-pulse" />
                  {summary.ordersPending} đơn mới đang chờ duyệt
                </span>
              ) : (
                <span className="text-muted-foreground">Tất cả đơn đã được xử lý</span>
              )}
            </div>
          </Link>
        )}

        {/* Metric 3: Assets & Maintenance */}
        {typeof summary.assetsInMaintenance === 'number' && (
          <Link
            href="/maintenance"
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Trạng thái bảo trì thiết bị
                </span>
                <span className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Wrench className="size-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums group-hover:text-primary transition-colors">
                  {summary.assetsInMaintenance}
                </span>
                <span className="text-xs font-medium text-muted-foreground">thiết bị đang sửa chữa</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              {summary.assetsInMaintenance > 0 ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Đang trong lịch sửa chữa & thay thế phụ tùng
                </span>
              ) : (
                <span className="text-muted-foreground">100% thiết bị sẵn sàng vận hành</span>
              )}
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}


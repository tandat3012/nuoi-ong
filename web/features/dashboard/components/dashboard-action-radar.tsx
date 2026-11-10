'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  PackageX,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import type { DashboardSummary } from '../types/dashboard';

interface DashboardActionRadarProps {
  summary: DashboardSummary;
  showOrders?: boolean;
}

export function DashboardActionRadar({ summary, showOrders = false }: DashboardActionRadarProps) {
  // Collect actionable items
  const items: Array<{
    id: string;
    title: string;
    count: number;
    unit: string;
    description: string;
    href: string;
    severity: 'critical' | 'warning' | 'info' | 'store';
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  // Critical: Expired lots still in stock
  if (typeof summary.expiredLots === 'number' && summary.expiredLots > 0) {
    items.push({
      id: 'expired-lots',
      title: 'Lô hàng đã hết hạn còn tồn',
      count: summary.expiredLots,
      unit: 'lô',
      description: 'Cần cách ly hoặc lập phiếu xuất hủy để tránh thất thoát chất lượng.',
      href: '/inventory',
      severity: 'critical',
      icon: PackageX,
    });
  }

  // Warning: Below minimum threshold
  if (typeof summary.belowMinimum === 'number' && summary.belowMinimum > 0) {
    items.push({
      id: 'below-minimum',
      title: 'Vật tư dưới mức an toàn',
      count: summary.belowMinimum,
      unit: 'mặt hàng',
      description: 'Tồn kho thực tế thấp hơn định mức tối thiểu, cần lập kế hoạch nhập hàng.',
      href: '/materials',
      severity: 'warning',
      icon: AlertTriangle,
    });
  }

  // Warning: Expiring within 30 days
  if (typeof summary.expiringLots === 'number' && summary.expiringLots > 0) {
    items.push({
      id: 'expiring-lots',
      title: 'Lô sắp hết hạn trong 30 ngày',
      count: summary.expiringLots,
      unit: 'lô',
      description: 'Ưu tiên xuất dùng trước (FEFO) để đảm bảo tuổi thọ và chất lượng.',
      href: '/inventory',
      severity: 'warning',
      icon: Clock,
    });
  }

  // Pending adjustments requiring approval
  if (typeof summary.pendingAdjustments === 'number' && summary.pendingAdjustments > 0) {
    items.push({
      id: 'pending-adjustments',
      title: 'Điều chỉnh tồn kho chờ duyệt',
      count: summary.pendingAdjustments,
      unit: 'phiếu',
      description: 'Có chênh lệch kiểm kê cần người quản lý kho rà soát và phê duyệt.',
      href: '/inventory',
      severity: 'info',
      icon: FileCheck,
    });
  }

  // Pending store orders
  if (showOrders && typeof summary.ordersPending === 'number' && summary.ordersPending > 0) {
    items.push({
      id: 'pending-orders',
      title: 'Đơn hàng mới chờ xác nhận',
      count: summary.ordersPending,
      unit: 'đơn',
      description: 'Khách hàng đã đặt đơn mới trên cửa hàng, cần duyệt và chuẩn bị hàng.',
      href: '/store-orders',
      severity: 'store',
      icon: ShoppingCart,
    });
  }

  // Assets under maintenance
  if (typeof summary.assetsInMaintenance === 'number' && summary.assetsInMaintenance > 0) {
    items.push({
      id: 'assets-maintenance',
      title: 'Thiết bị đang bảo trì',
      count: summary.assetsInMaintenance,
      unit: 'thiết bị',
      description: 'Đang trong quá trình sửa chữa hoặc bảo dưỡng định kỳ.',
      href: '/maintenance',
      severity: 'info',
      icon: Wrench,
    });
  }

  if (items.length === 0) return null;

  const severityStyles = {
    critical: {
      card: 'border-red-500/30 bg-red-500/5 hover:border-red-500/50',
      badge: 'bg-red-500/15 text-red-700 dark:text-red-400',
      iconWrapper: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
    warning: {
      card: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50',
      badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
      iconWrapper: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    info: {
      card: 'border-sky-500/30 bg-sky-500/5 hover:border-sky-500/50',
      badge: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
      iconWrapper: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    store: {
      card: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50',
      badge: 'bg-purple-500/15 text-purple-800 dark:text-purple-300',
      iconWrapper: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
  };

  return (
    <section aria-label="Điểm nóng cần xử lý" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Điểm nóng nghiệp vụ cần chú ý ({items.length})</span>
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const style = severityStyles[item.severity];
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-all duration-150 hover:-translate-y-0.5 ${style.card}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${style.iconWrapper}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="font-semibold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums shrink-0 ${style.badge}`}>
                    {item.count} {item.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary/90 group-hover:text-primary">
                <span>Xử lý ngay</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


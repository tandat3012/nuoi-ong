'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthenticatedRequest, useFarmMembership } from '@/features/auth';
import { formatOrderMoney } from '@/features/commerce/orders/order.logic';
import { isNavigationItemVisible, primaryNavigationSections } from '@/shared/config/navigation';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { PageHeader } from '@/shared/components/ui/page-header';
import { Skeleton } from '@/shared/components/ui/skeleton';

type DashboardSummary = {
  stockValue: string;
  unpricedItems: number;
  belowMinimum: number;
  expiringLots: number;
  expiredLots: number;
  assetsInMaintenance: number;
  pendingAdjustments: number;
  ordersToday: number;
  ordersPending: number;
};

type Metric = { label: string; value: string; note?: string; href: string; alert?: boolean };

function metrics(summary: DashboardSummary, showOrders: boolean): Metric[] {
  const list: Metric[] = [
    {
      label: 'Giá trị tồn kho (ước tính)',
      value: formatOrderMoney(summary.stockValue),
      note: summary.unpricedItems ? `${summary.unpricedItems} mặt hàng chưa có giá nhập, chưa tính` : 'Số lượng tồn × giá nhập gần nhất',
      href: '/inventory',
    },
    { label: 'Dưới mức tồn tối thiểu', value: String(summary.belowMinimum), href: '/materials', alert: summary.belowMinimum > 0 },
    {
      label: 'Lô sắp hết hạn (30 ngày)',
      value: String(summary.expiringLots),
      note: summary.expiredLots ? `${summary.expiredLots} lô đã hết hạn còn tồn` : undefined,
      href: '/inventory',
      alert: summary.expiringLots + summary.expiredLots > 0,
    },
    { label: 'Tài sản đang bảo trì', value: String(summary.assetsInMaintenance), href: '/maintenance' },
    { label: 'Điều chỉnh tồn chờ duyệt', value: String(summary.pendingAdjustments), href: '/inventory', alert: summary.pendingAdjustments > 0 },
  ];
  if (showOrders)
    list.push({
      label: 'Đơn hàng hôm nay',
      value: String(summary.ordersToday),
      note: `${summary.ordersPending} đơn chờ xác nhận`,
      href: '/store-orders',
      alert: summary.ordersPending > 0,
    });
  return list;
}

function DashboardMetrics({ farmId, showOrders }: { farmId: string; showOrders: boolean }) {
  const request = useAuthenticatedRequest();
  const [result, setResult] = useState<{ summary?: DashboardSummary; error?: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void request<{ data: DashboardSummary }>('/dashboard/summary', { params: { farmId } })
      .then(({ data }) => { if (!cancelled) setResult({ summary: data }); })
      .catch(() => { if (!cancelled) setResult({ error: true }); });
    return () => { cancelled = true; };
  }, [request, farmId]);

  if (result?.error) return <ErrorAlert message="Không tải được số liệu tổng quan. Vui lòng tải lại trang." />;
  return (
    <section aria-label="Số liệu tổng quan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {!result?.summary
        ? Array.from({ length: showOrders ? 6 : 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
        : metrics(result.summary, showOrders).map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className={`rounded-xl border bg-card p-4 shadow-2xs transition-colors hover:border-primary/40 ${metric.alert ? 'border-warning/50' : ''}`}
            >
              <span className="block text-sm text-muted-foreground">{metric.label}</span>
              <span className={`mt-1 block text-2xl font-semibold tabular-nums ${metric.alert ? 'text-warning' : 'text-foreground'}`}>{metric.value}</span>
              {metric.note && <span className="mt-1 block text-xs text-muted-foreground">{metric.note}</span>}
            </Link>
          ))}
    </section>
  );
}

export function DashboardOverview() {
  const access = useFarmMembership();
  const { membership, selectedFarmId, isStoreFarm, canManageOrders } = access;

  const sections = primaryNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.href !== '/dashboard' && isNavigationItemVisible(item, access)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tổng quan"
        description={membership ? `Trang trại ${membership.farm.name}` : 'Chọn trang trại để bắt đầu làm việc.'}
      />

      {selectedFarmId && membership && canManageOrders && (
        <DashboardMetrics key={selectedFarmId} farmId={selectedFarmId} showOrders={isStoreFarm && canManageOrders} />
      )}

      {sections.map((section, index) => (
        <section key={section.title} aria-labelledby={`hub-${index}`} className="space-y-3">
          <h2 id={`hub-${index}`} className="text-sm font-semibold text-muted-foreground">
            {section.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3.5 rounded-xl border bg-card p-4 shadow-2xs transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground group-hover:text-primary">{label}</span>
                  {description && (
                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{description}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

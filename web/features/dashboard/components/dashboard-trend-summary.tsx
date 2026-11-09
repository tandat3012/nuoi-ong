'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, ArrowRight } from 'lucide-react';
import { useAuthenticatedRequest } from '@/features/auth';
import { ReportBarChart } from '@/features/reports/components/report-bar-chart';
import { formatVndCurrency } from '@/shared/lib/currency';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface TrendSummaryProps {
  farmId: string;
  canManageWarehouse?: boolean;
}

type TimeseriesResponse = {
  data: {
    granularity: 'day' | 'week' | 'month';
    periods: Array<{
      period: string;
      inboundValue: string;
      outboundValue: string;
      inboundDocuments: number;
      outboundDocuments: number;
    }>;
  };
};

function formatPeriodLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function DashboardTrendSummary({ farmId, canManageWarehouse = true }: TrendSummaryProps) {
  const request = useAuthenticatedRequest();
  const [data, setData] = React.useState<TimeseriesResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!canManageWarehouse) {
      return;
    }

    let cancelled = false;

    const now = new Date();
    const dateTo = now.toISOString().slice(0, 10);
    const past = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    const dateFrom = past.toISOString().slice(0, 10);

    request<TimeseriesResponse>('/dashboard/timeseries', {
      params: { farmId, dateFrom, dateTo },
    })
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request, farmId, canManageWarehouse]);

  if (!canManageWarehouse) return null;

  const periods = data?.periods ?? [];
  const labels = periods.map((p) => formatPeriodLabel(p.period));
  const inboundData = periods.map((p) => Number(p.inboundValue) || 0);
  const outboundData = periods.map((p) => Number(p.outboundValue) || 0);

  const series = [
    { label: 'Nhập kho', data: inboundData, color: '#15803d' },
    { label: 'Xuất kho', data: outboundData, color: '#a16207' },
  ];

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-primary" />
              <span>Biến động Nhập - Xuất (14 ngày gần nhất)</span>
            </h3>
            <p className="text-[0.7rem] text-muted-foreground mt-0.5">
              Đơn vị: Đồng (VND) theo giá bình quân di động
            </p>
          </div>
          <Link
            href="/reports"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            <span>Báo cáo chi tiết</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="mt-3 w-full">
          {isLoading ? (
            <div className="h-72 flex items-end gap-2 px-4 pb-2">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${20 + (i % 5) * 15}%` }} />
              ))}
            </div>
          ) : periods.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">
              Không có dữ liệu biến động kho trong 14 ngày qua.
            </div>
          ) : (
            <ReportBarChart
              ariaLabel="Biểu đồ nhập xuất kho 14 ngày gần nhất"
              labels={labels}
              series={series}
              formatValue={(val) => formatVndCurrency(val) ?? '0 ₫'}
              formatTick={(val) => {
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} tr`;
                if (val >= 1_000) return `${(val / 1_000).toFixed(0)} k`;
                return `${val}`;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}


'use client';

import * as React from 'react';
import Link from 'next/link';
import { History, ArrowRight, User } from 'lucide-react';
import { useAuthenticatedRequest } from '@/features/auth';
import { HISTORY_ACTION_LABELS, HISTORY_ENTITY_LABELS } from '@/features/history/history.logic';
import type { AuditLogPage } from '@/features/history/types/history';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface ActivityFeedProps {
  farmId: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Vừa xong';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function DashboardActivityFeed({ farmId }: ActivityFeedProps) {
  const request = useAuthenticatedRequest();
  const [data, setData] = React.useState<AuditLogPage | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    request<AuditLogPage>('/audit-logs', {
      params: { farmId, page: 1, pageSize: 5 },
    })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request, farmId]);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="size-3.5 text-primary" />
            <span>Hoạt động gần đây</span>
          </h3>
          <Link
            href="/history"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            <span>Tất cả</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="divide-y divide-border/40 mt-1">
          {isLoading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="py-2.5 flex items-center gap-3">
                <Skeleton className="size-7 rounded-full shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
              </div>
            ))
          ) : !data || data.data.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Chưa có thao tác nào được ghi nhận hôm nay.
            </div>
          ) : (
            data.data.map((item) => {
              const entityName = HISTORY_ENTITY_LABELS[item.entityType] ?? item.entityType;
              const actionName = HISTORY_ACTION_LABELS[item.action] ?? item.action;
              const refCode = item.entityId ? data.references[item.entityId] : undefined;
              const actorName = item.actor?.name || item.actor?.email?.split('@')[0] || 'Nhân viên';

              return (
                <div key={item.id} className="py-2.5 flex items-start gap-2.5 text-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary font-medium text-[0.65rem] mt-0.5">
                    <User className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 leading-relaxed">
                    <p className="text-foreground">
                      <span className="font-semibold text-foreground">{actorName}</span>{' '}
                      <span className="text-muted-foreground">{actionName.toLowerCase()}</span>{' '}
                      <span className="font-medium text-foreground">{entityName}</span>
                      {refCode && (
                        <span className="ml-1 font-mono text-[0.7rem] bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                          {refCode}
                        </span>
                      )}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground mt-0.5">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border/40 text-center">
        <Link
          href="/history"
          className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          Xem chi tiết lịch sử thay đổi →
        </Link>
      </div>
    </div>
  );
}


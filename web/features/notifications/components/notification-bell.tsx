'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuthenticatedRequest, useAuthContext } from '@/features/auth';
import { shouldReloadAfterFailure } from '@/features/stock-documents/stock-document.logic';
import { ApiError } from '@/shared/api/client';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { Pagination } from '@/shared/components/ui/pagination';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/shared/components/ui/sheet';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead,
  type Notification, type NotificationsResponse,
} from '../api/notifications.api';
import { notificationBadgeText, notificationErrorMessage, notificationHref, notificationTargetsCurrentPage } from '../notifications.logic';
import { NOTIFICATION_REFRESH_EVENT } from '../use-notification-refresh';

type NotificationError = { message: string; status: number | null };

function failureInfo(failure: unknown): NotificationError {
  const status = failure instanceof ApiError ? failure.status : null;
  return {
    status,
    message: notificationErrorMessage(status, failure instanceof ApiError ? failure.message : ''),
  };
}

export function NotificationBell() {
  const { selectedFarmId } = useAuthContext();
  return selectedFarmId ? <FarmNotificationBell key={selectedFarmId} farmId={selectedFarmId} /> : null;
}

function FarmNotificationBell({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<NotificationError | null>(null);
  const [result, setResult] = useState<{
    key: string;
    response?: NotificationsResponse;
    error?: NotificationError;
  } | null>(null);
  const active = useRef(false);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const listKey = `${page}:${unreadOnly}:${revision}:${pathname}?${params.toString()}`;

  useEffect(() => {
    active.current = true;
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active.current = false;
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void getNotifications(request, farmId, { page, unreadOnly })
      .then((response) => {
        if (cancelled) return;
        setUnreadCount(response.unreadCount);
        const lastPage = Math.max(1, response.page.totalPages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setResult({ key: listKey, response });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setUnreadCount(null);
        setResult({ key: listKey, error: failureInfo(failure) });
      });
    return () => { cancelled = true; };
  }, [request, farmId, page, unreadOnly, listKey]);

  async function markRead(perform: () => Promise<unknown>) {
    setIsSaving(true);
    setActionError(null);
    let refresh = true;
    try {
      await perform();
    } catch (failure) {
      if (!active.current) return false;
      const error = failureInfo(failure);
      setActionError(error);
      refresh = shouldReloadAfterFailure(error.status);
      if (!refresh) setUnreadCount(null);
    }
    if (!active.current) return false;
    setIsSaving(false);
    if (refresh) {
      setPage(1);
      reload();
    }
    return true;
  }

  async function openNotification(notification: Notification) {
    if (isSaving) return;
    if (!notification.readAt && !await markRead(() => markNotificationRead(request, farmId, notification.id))) return;
    if (!active.current) return;
    const href = notificationHref(notification.entityType, notification.entityId);
    if (href) {
      setOpen(false);
      startTransition(() => {
        if (notificationTargetsCurrentPage(window.location.pathname, href))
          window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
        router.push(href);
      });
    }
  }

  const current = result?.key === listKey ? result : null;
  const badgeText = notificationBadgeText(unreadCount ?? 0);
  const retry = () => { setActionError(null); reload(); };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) { setPage(1); reload(); }
    }}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative shrink-0"
          aria-label={`Thông báo, ${unreadCount ?? 0} chưa đọc`}>
          <Bell className="size-5" aria-hidden="true" />
          {badgeText && <Badge aria-hidden="true" variant="destructive"
            className="absolute -right-1 -top-1 min-w-5 justify-center bg-destructive px-1 py-0 text-[0.65rem] text-destructive-foreground">
            {badgeText}
          </Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0">
        <SheetHeader className="border-b p-5 pr-12 text-left">
          <SheetTitle>Thông báo</SheetTitle>
          <SheetDescription>Cập nhật chứng từ và yêu cầu trong trang trại đang chọn.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={unreadOnly} className="size-4 accent-primary"
              onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />
            Chỉ chưa đọc
          </label>
          <Button type="button" variant="outline" size="sm"
            disabled={isSaving || !current?.response || !unreadCount}
            onClick={() => void markRead(() => markAllNotificationsRead(request, farmId))}>
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {actionError && <ErrorAlert className="m-4" title="" message={actionError.message}
            onRetry={shouldReloadAfterFailure(actionError.status) ? retry : undefined} />}
          {!current ? <p role="status" className="p-5 text-sm text-muted-foreground">Đang tải thông báo…</p>
            : current.error ? <ErrorAlert className="m-4" title="" message={current.error.message}
              onRetry={shouldReloadAfterFailure(current.error.status) ? reload : undefined} />
              : current.response && (
                current.response.data.length === 0
                  ? <p role="status" className="p-5 text-sm text-muted-foreground">
                    {unreadOnly ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo.'}
                  </p>
                  : <ul className="divide-y">
                    {current.response.data.map((notification) => <li key={notification.id}>
                      <button type="button" disabled={isSaving} onClick={() => void openNotification(notification)}
                        className={`w-full min-w-0 space-y-2 p-5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${!notification.readAt ? 'bg-primary/5' : ''}`}>
                        <span className="flex items-start justify-between gap-3">
                          <span className={`min-w-0 break-words text-sm ${!notification.readAt ? 'font-semibold' : 'font-medium'}`}>{notification.title}</span>
                          {!notification.readAt && <Badge className="shrink-0">Chưa đọc</Badge>}
                        </span>
                        <span className="block whitespace-pre-wrap break-words text-sm text-muted-foreground">{notification.body}</span>
                        <time dateTime={notification.createdAt} className="block text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString('vi-VN')}
                        </time>
                      </button>
                    </li>)}
                  </ul>
              )}
        </div>
        {current?.response && <Pagination pageInfo={current.response.page} itemLabel="thông báo"
          isLoading={isSaving} onPageChange={setPage} className="shrink-0" />}
      </SheetContent>
    </Sheet>
  );
}

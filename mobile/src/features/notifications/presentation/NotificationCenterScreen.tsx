import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationRoute, type AppNotification } from '../api';

type Filter = 'all' | 'unread';

export default function NotificationCenterScreen() {
  const router = useRouter();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (!currentFarmId) {
      setRows([]);
      setUnreadCount(0);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      setError('Chọn trang trại để xem thông báo.');
      return () => { cancelled = true; };
    }
    setLoading(true);
    setError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listNotifications(token, currentFarmId, 1, filter === 'unread');
      })
      .then((response) => {
        if (cancelled) return;
        setRows(response.data);
        setUnreadCount(response.unreadCount);
        setPage(response.page.number);
        setTotalPages(response.page.totalPages);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : 'Không thể tải thông báo.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, filter, getAccessToken, reloadKey]));

  async function openNotification(notification: AppNotification) {
    const route = notificationRoute(notification);
    if (!notification.readAt && currentFarmId) {
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        await markNotificationRead(token, currentFarmId, notification.id);
        setRows((current) => filter === 'unread'
          ? current.filter((row) => row.id !== notification.id)
          : current.map((row) => row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Không thể đánh dấu thông báo đã đọc.');
      }
    }
    if (route) router.push(route as never);
  }

  async function markAllRead() {
    if (!currentFarmId || unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      await markAllNotificationsRead(token, currentFarmId);
      setRows((current) => filter === 'unread'
        ? []
        : current.map((row) => row.readAt ? row : { ...row, readAt: new Date().toISOString() }));
      setUnreadCount(0);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể đánh dấu đã đọc tất cả.');
    } finally {
      setMarkingAll(false);
    }
  }

  async function loadMore() {
    if (!currentFarmId || page >= totalPages || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listNotifications(token, currentFarmId, page + 1, filter === 'unread');
      setRows((current) => [...current, ...response.data]);
      setPage(response.page.number);
      setTotalPages(response.page.totalPages);
      setUnreadCount(response.unreadCount);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải thêm thông báo.');
    } finally {
      setLoadingMore(false);
    }
  }

  function reload() {
    setPage(1);
    setReloadKey((key) => key + 1);
  }

  return (
    <AppShell active="dashboard">
      <PageHeader
        title="Thông báo"
        subtitle={farmName}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/dashboard' as never)}
        action={<Pressable accessibilityRole="button" accessibilityLabel="Tải lại thông báo" onPress={reload} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}><Icon name="sync" color={colors.primary} /></Pressable>}
      />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryIcon}><Icon name="notifications-active" color={colors.primary} size={24} /></View>
        <View style={styles.summaryCopy}>
          <Text style={styles.eyebrow}>HỘP THÔNG BÁO</Text>
          <Text style={styles.summaryTitle}>{unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}</Text>
          <Text style={styles.summarySubtitle}>Cập nhật theo tài khoản và trang trại đang chọn.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={unreadCount === 0 || markingAll} onPress={() => void markAllRead()} style={({ pressed }) => [styles.readAll, (unreadCount === 0 || markingAll) && styles.disabled, pressed && styles.pressed]}>
          {markingAll ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.readAllText}>Đọc hết</Text>}
        </Pressable>
      </Card>

      <SectionTitle title="Hoạt động gần đây" count={rows.length ? `${rows.length} mục` : undefined} />
      <View style={styles.filters}>
        {([['all', 'Tất cả'], ['unread', 'Chưa đọc']] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => { setPage(1); setFilter(key); }} style={[styles.filter, filter === key && styles.filterSelected]}>
            <Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{label}</Text>
            {key === 'unread' && unreadCount > 0 ? <Pill tone="danger"><Text style={styles.filterCount}>{unreadCount > 99 ? '99+' : unreadCount}</Text></Pill> : null}
          </Pressable>
        ))}
      </View>

      {!currentFarmId ? <Card style={styles.messageCard}><Icon name="hive" color={colors.primary} /><Text style={styles.message}>Chọn trang trại để xem hộp thông báo.</Text></Card>
        : loading ? <Card style={styles.messageCard}><ActivityIndicator color={colors.primary} /><Text style={styles.message}>Đang tải thông báo...</Text></Card>
          : error && rows.length === 0 ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><View style={styles.messageCopy}><Text style={styles.errorTitle}>Không tải được thông báo</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={reload} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable></View></Card>
            : rows.length === 0 ? <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Icon name={filter === 'unread' ? 'done-all' : 'notifications-none'} color={colors.primary} size={25} /></View><Text style={styles.emptyTitle}>{filter === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}</Text><Text style={styles.emptyText}>{filter === 'unread' ? 'Các cập nhật mới sẽ xuất hiện tại đây.' : `Thông báo của ${farmName} sẽ được lưu tại đây.`}</Text></Card>
              : <View style={styles.list}>{rows.map((row) => <NotificationCard key={row.id} notification={row} onPress={() => void openNotification(row)} />)}</View>}

      {error && rows.length > 0 ? <Text style={styles.inlineError}>{error}</Text> : null}
      {!loading && rows.length > 0 && page < totalPages ? <Pressable accessibilityRole="button" onPress={() => void loadMore()} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
        {loadingMore ? <ActivityIndicator color={colors.primary} /> : <><Text style={styles.loadMoreText}>Tải thêm thông báo</Text><Icon name="expand-more" color={colors.primary} /></>}
      </Pressable> : null}
      {rows.length > 0 ? <Text style={styles.pagination}>Trang {page} / {Math.max(totalPages, 1)}</Text> : null}
    </AppShell>
  );
}

function NotificationCard({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const status = notification.data?.status;
  const tone = status === 'CONFIRMED' ? 'success' : status === 'REJECTED' ? 'danger' : status === 'PENDING_APPROVAL' ? 'amber' : 'neutral';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở thông báo: ${notification.title}`} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={[styles.notificationCard, !notification.readAt && styles.unreadCard]}>
        <View style={[styles.notificationIcon, !notification.readAt && styles.unreadIcon]}><Icon name={iconForNotification(notification)} color={colors.primary} /></View>
        <View style={styles.notificationCopy}>
          <View style={styles.notificationHeading}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            {!notification.readAt ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.notificationBody}>{notification.body}</Text>
          <View style={styles.notificationMeta}>
            <Text style={styles.time}>{new Date(notification.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            {status ? <Pill tone={tone}><Text style={styles.status}>{statusLabel(status)}</Text></Pill> : null}
          </View>
          {notification.data?.documentCode ? <Text style={styles.documentCode}>{notification.data.documentCode}</Text> : null}
        </View>
        <Icon name="chevron-right" color={colors.outline} size={20} />
      </Card>
    </Pressable>
  );
}

function iconForNotification(notification: AppNotification): 'build' | 'inventory-2' | 'swap-horiz' | 'receipt-long' | 'notifications-none' {
  const entityType = notification.data?.documentType ?? notification.entityType;
  if (entityType === 'MAINTENANCE_REQUEST') return 'build';
  if (entityType === 'STOCK_TRANSFER') return 'swap-horiz';
  if (entityType === 'STOCK_RECEIPT' || entityType === 'STOCK_ISSUE') return 'receipt-long';
  if (entityType === 'STOCK_COUNT') return 'inventory-2';
  return 'notifications-none';
}

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING_APPROVAL': return 'Chờ duyệt';
    case 'CONFIRMED': return 'Đã duyệt';
    case 'REJECTED': return 'Từ chối';
    default: return status;
  }
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
  headerAction: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, backgroundColor: colors.parchmentWarm },
  summaryIcon: { width: 46, height: 46, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { ...typography.labelSm, color: colors.secondary, letterSpacing: 1 },
  summaryTitle: { ...typography.labelLg, color: colors.deepAmberStrong },
  summarySubtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  readAll: { minHeight: 38, minWidth: 54, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center' },
  readAllText: { ...typography.labelSm, color: colors.primary },
  filters: { flexDirection: 'row', gap: spacing.spaceSm },
  filter: { minHeight: 38, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  filterSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  filterText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  filterTextSelected: { color: colors.primary, fontWeight: '700' },
  filterCount: { ...typography.labelSm, color: colors.error },
  list: { gap: spacing.spaceSm },
  notificationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, padding: spacing.spaceMd },
  unreadCard: { borderColor: colors.secondaryContainer, backgroundColor: colors.surfaceContainerLow },
  notificationIcon: { width: 40, height: 40, borderRadius: radius.default, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  unreadIcon: { backgroundColor: colors.honeyChip },
  notificationCopy: { flex: 1, minWidth: 0, gap: 5 },
  notificationHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs },
  notificationTitle: { ...typography.labelLg, color: colors.onSurface, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 5 },
  notificationBody: { ...typography.bodySm, color: colors.onSurfaceVariant },
  notificationMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceXs, flexWrap: 'wrap' },
  time: { ...typography.labelSm, color: colors.outline },
  status: { ...typography.labelSm, color: colors.deepAmberStrong },
  documentCode: { ...typography.labelSm, color: colors.secondary },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  messageCopy: { flex: 1, gap: spacing.spaceXs },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.errorContainer },
  errorTitle: { ...typography.labelLg, color: colors.error },
  errorText: { ...typography.bodySm, color: colors.error },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.spaceXs, paddingHorizontal: spacing.spaceSm },
  retryText: { ...typography.labelMd, color: colors.primary },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.spaceXl, gap: spacing.spaceSm },
  emptyIcon: { width: 54, height: 54, borderRadius: radius.full, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.labelLg, color: colors.onSurface, textAlign: 'center' },
  emptyText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  inlineError: { ...typography.bodySm, color: colors.error, textAlign: 'center' },
  loadMore: { minHeight: 46, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  loadMoreText: { ...typography.labelMd, color: colors.primary },
  pagination: { ...typography.labelSm, color: colors.outline, textAlign: 'center', paddingBottom: spacing.spaceMd },
});

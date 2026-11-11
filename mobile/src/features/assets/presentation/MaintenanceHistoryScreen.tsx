import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listMaintenanceRecordsPage, type MaintenanceRecord } from '@/src/features/inventory/api';
import { isAbortError, MobileApiError } from '@/src/shared/api/client';

const PAGE_SIZE = 20;

const MaintenanceRecordCard = memo(function MaintenanceRecordCard({
  record,
  attemptNumber,
}: {
  record: MaintenanceRecord;
  attemptNumber: number;
}) {
  return (
    <Card style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={styles.recordIcon}>
          <Icon
            name={record.status === 'COMPLETED' ? 'check-circle' : record.status === 'CANCELLED' ? 'cancel' : 'build'}
            color={record.status === 'COMPLETED' ? colors.statusSuccessStrong : colors.primary}
          />
        </View>
        <View style={styles.recordCopy}>
          <Text style={styles.recordTitle}>{maintenanceTypeLabel(record.maintenanceType)}</Text>
          <Text style={styles.recordNumber}>Lần {attemptNumber} • Tạo {formatDate(record.createdAt)}</Text>
        </View>
        <Pill tone={statusTone(record.status)}><Text style={styles.statusText}>{statusLabel(record.status)}</Text></Pill>
      </View>
      {record.description ? <Detail label="Nội dung" value={record.description} /> : null}
      <View style={styles.dateGrid}>
        <DateCell label="Dự kiến" value={record.scheduledAt} />
        {record.startedAt ? <DateCell label={record.issuedByMemberId ? 'Kho xác nhận xuất' : 'Gửi sửa'} value={record.startedAt} suffix={record.issuedByMemberId && record.issuedByName ? record.issuedByName : null} /> : null}
        <DateCell label="Hoàn tất" value={record.completedAt} />
      </View>
      {record.resultNote ? <Detail label="Kết quả / ghi chú" value={record.resultNote} /> : null}
      {record.returnStatus ? <Detail label="Nhập lại kho" value={record.returnStatus === 'PENDING_APPROVAL' ? 'Chờ quản lý kho duyệt' : record.returnStatus === 'CONFIRMED' ? 'Đã duyệt' : 'Bị từ chối · cần gửi lại'} /> : null}
      {record.returnRejectionReason ? <Detail label="Lý do từ chối nhập lại" value={record.returnRejectionReason} /> : null}
      {record.finalDecision ? <Detail label="Quyết định cuối" value={record.finalDecision === 'REUSE' ? 'Cho phép sử dụng lại' : `Tạm giữ${record.finalDecisionNote ? ` · ${record.finalDecisionNote}` : ''}`} /> : null}
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Chi phí</Text>
        <Text style={styles.costValue}>{formatMoney(record.totalCost ?? sumCosts(record))} ₫</Text>
      </View>
      {record.performedByMemberId ? <Detail label="Người thực hiện (member)" value={record.performedByMemberId} /> : null}
      {record.supplierId ? <Detail label="Nhà cung cấp" value={record.supplierId} /> : null}
    </Card>
  );
});

export default function MaintenanceHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ assetId?: string; recordId?: string; assetCode?: string; itemName?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadMoreControllerRef.current?.abort();
    if (!currentFarmId || (!params.assetId && !params.recordId)) {
      setRecords([]);
      setPage(1);
      setTotalPages(0);
      setTotalItems(0);
      setLoading(false);
      setError('Thiếu farm hoặc mã hồ sơ bảo trì.');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listMaintenanceRecordsPage(
          token,
          currentFarmId,
          { assetId: params.assetId, recordId: params.recordId, page: 1, pageSize: PAGE_SIZE, skipCache: true },
          controller.signal,
        );
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        const filtered = response.data.filter((record) => params.recordId ? record.id === params.recordId : record.assetId === params.assetId);
        setRecords(filtered);
        setPage(response.page.number);
        setTotalPages(response.page.totalPages);
        setTotalItems(response.page.totalItems);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause) || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử bảo dưỡng.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [currentFarmId, getAccessToken, params.assetId, params.recordId, reloadNonce]);

  const loadMore = useCallback(async () => {
    if (!currentFarmId || !params.assetId || params.recordId || loading || loadingMore || page >= totalPages) return;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listMaintenanceRecordsPage(
        token,
        currentFarmId,
        { assetId: params.assetId, page: page + 1, pageSize: PAGE_SIZE, skipCache: true },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const incoming = response.data.filter((record) => record.assetId === params.assetId);
      setRecords((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const next = [...prev];
        for (const row of incoming) {
          if (!seen.has(row.id)) next.push(row);
        }
        return next;
      });
      setPage(response.page.number);
      setTotalPages(response.page.totalPages);
      setTotalItems(response.page.totalItems);
    } catch (cause: unknown) {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        Alert.alert('Không thể tải thêm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [currentFarmId, getAccessToken, loading, loadingMore, page, params.assetId, totalPages]);

  const counts = useMemo(
    () =>
      records.reduce<Record<string, number>>((all, record) => {
        all[record.status] = (all[record.status] ?? 0) + 1;
        return all;
      }, {}),
    [records],
  );

  const effectiveTotal = Math.max(totalItems, records.length);

  const renderRecord = useCallback(
    ({ item, index }: { item: MaintenanceRecord; index: number }) => (
      <MaintenanceRecordCard record={item} attemptNumber={Math.max(1, effectiveTotal - index)} />
    ),
    [effectiveTotal],
  );

  const headerElement = (
    <View style={styles.listHeader}>
      <Card style={styles.assetCard}>
        <View style={styles.assetIcon}><Icon name="build" color={colors.primary} /></View>
        <View style={styles.assetCopy}>
          <Text style={styles.eyebrow}>TÀI SẢN ĐỊNH DANH</Text>
          <Text style={styles.assetName}>{params.itemName ?? 'Chi tiết tài sản'}</Text>
          <Text style={styles.assetCode}>{params.assetCode ?? params.assetId ?? 'Chưa có mã tài sản'}</Text>
        </View>
      </Card>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Toàn bộ hồ sơ</Text>
          <Text style={styles.subtitle}>{loading ? 'Đang tải hồ sơ…' : `${effectiveTotal} hồ sơ bảo dưỡng`}</Text>
        </View>
        <Pill tone="amber"><Text style={styles.countText}>{effectiveTotal}</Text></Pill>
      </View>
      {!loading && !error && records.length > 0 ? (
        <View style={styles.summaryRow}>
          <Summary label="Đã lên lịch" value={counts.SCHEDULED ?? 0} tone="amber" />
          <Summary label="Đang làm" value={counts.IN_PROGRESS ?? 0} tone="success" />
          <Summary label="Hoàn tất" value={counts.COMPLETED ?? 0} tone="neutral" />
        </View>
      ) : null}
      {loading ? (
        <Card style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Đang tải hồ sơ bảo dưỡng của tài sản…</Text>
        </Card>
      ) : null}
      {error ? (
        <Card style={styles.errorCard}>
          <Icon name="error-outline" color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <Pressable onPress={() => setReloadNonce((n) => n + 1)}><Text style={styles.backText}>Thử lại</Text></Pressable>
            <Pressable onPress={() => router.back()}><Text style={styles.backText}>Quay lại tài sản</Text></Pressable>
          </View>
        </Card>
      ) : null}
      {!loading && !error && records.length === 0 ? (
        <Card style={styles.stateCard}>
          <Icon name="event-note" color={colors.outline} />
          <Text style={styles.stateText}>Tài sản này chưa có hồ sơ bảo dưỡng.</Text>
        </Card>
      ) : null}
    </View>
  );

  const footerElement = (
    <View style={styles.listFooter}>
      {!loading && !error && page < totalPages ? (
        <Pressable
          disabled={loadingMore}
          onPress={() => void loadMore()}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="expand-more" size={18} color={colors.primary} />
          )}
          <Text style={styles.loadMoreText}>
            {loadingMore ? 'Đang tải thêm...' : `Tải thêm hồ sơ (${records.length}/${effectiveTotal})`}
          </Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.replace('/scan' as never)} style={({ pressed }) => [styles.rescan, pressed && styles.pressed]}>
        <Icon name="qr-code-scanner" color={colors.statusSuccessStrong} /><Text style={styles.rescanText}>Quét QR tiếp theo</Text>
      </Pressable>
    </View>
  );

  return (
    <AppShell active="scan" scroll={false}>
      <PageHeader title="Lịch sử bảo dưỡng" subtitle={`${params.assetCode ?? 'Tài sản'} • ${params.itemName ?? 'Lịch sử bảo dưỡng'}`} onBack={() => router.back()} action={<NotificationBell />} />
      <FlatList
        data={loading || error ? [] : records}
        keyExtractor={(item) => item.id}
        renderItem={renderRecord}
        ListHeaderComponent={headerElement}
        ListFooterComponent={footerElement}
        removeClippedSubviews={false}
        style={styles.listFlex}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </AppShell>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'success' | 'neutral' }) {
  return <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{value}</Text><Text style={[styles.summaryLabel, tone === 'success' && styles.summarySuccess, tone === 'amber' && styles.summaryAmber]}>{label}</Text></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function DateCell({ label, value, suffix }: { label: string; value: string | null; suffix?: string | null }) {
  return <View style={styles.dateCell}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.dateValue}>{value ? `${formatDate(value)}${suffix ? ` · ${suffix}` : ''}` : '—'}</Text></View>;
}

function maintenanceTypeLabel(value: string) {
  return value === 'PREVENTIVE' ? 'Bảo dưỡng định kỳ' : value === 'CORRECTIVE' ? 'Sửa chữa' : value === 'INSPECTION' ? 'Kiểm tra / vệ sinh' : value;
}

function statusLabel(value: string) {
  return value === 'SCHEDULED' ? 'Đã lên lịch' : value === 'IN_PROGRESS' ? 'Đang bảo trì' : value === 'RECEIVED' ? 'Đã nhận về · chờ nghiệm thu' : value === 'COMPLETED' ? 'Đã nghiệm thu đạt' : value === 'FAILED' ? 'Bảo trì không đạt' : value === 'CANCELLED' ? 'Đã hủy' : value;
}

function statusTone(value: string): 'amber' | 'success' | 'neutral' | 'danger' {
  return value === 'SCHEDULED' ? 'amber' : value === 'IN_PROGRESS' ? 'success' : value === 'CANCELLED' ? 'danger' : 'neutral';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function sumCosts(record: MaintenanceRecord) {
  return [record.laborCost, record.materialCost, record.otherCost].reduce((total, value) => total + (Number(value) || 0), 0).toFixed(2);
}

function formatMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : value;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  listFlex: { flex: 1, marginHorizontal: -spacing.gutterMobile },
  listContent: { paddingHorizontal: spacing.gutterMobile, paddingTop: spacing.spaceMd, gap: spacing.spaceMd },
  listHeader: { gap: spacing.spaceMd },
  listFooter: { gap: spacing.spaceMd, paddingTop: spacing.spaceXs },
  assetCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd },
  assetIcon: { width: 48, height: 48, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  assetCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  assetName: { ...typography.headlineSm, color: colors.deepAmber },
  assetCode: { ...typography.bodySm, color: colors.onSurfaceVariant },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.headlineMd, color: colors.deepAmber },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  countText: { ...typography.labelMd, color: colors.deepAmber },
  summaryRow: { flexDirection: 'row', gap: spacing.spaceSm },
  summaryCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: spacing.spaceSm },
  summaryValue: { ...typography.headlineSm, color: colors.deepAmber },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
  summarySuccess: { color: colors.statusSuccessStrong },
  summaryAmber: { color: colors.secondary },
  stateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  stateText: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  errorCard: { gap: spacing.spaceSm, backgroundColor: colors.errorContainer, borderColor: colors.error },
  errorActions: { flexDirection: 'row', gap: spacing.spaceMd, alignItems: 'center', flexWrap: 'wrap' },
  errorText: { ...typography.bodyMd, color: colors.error },
  backText: { ...typography.labelLg, color: colors.primary },
  recordCard: { gap: spacing.spaceSm },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  recordIcon: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  recordCopy: { flex: 1, minWidth: 0, gap: 2 },
  recordTitle: { ...typography.labelLg, color: colors.deepAmber },
  recordNumber: { ...typography.bodySm, color: colors.onSurfaceVariant },
  statusText: { ...typography.labelSm, color: colors.deepAmber },
  detail: { gap: 2, paddingTop: spacing.spaceXs },
  detailLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  detailValue: { ...typography.bodyMd, color: colors.onSurface },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  dateCell: { flex: 1, minWidth: 90, gap: 2 },
  dateValue: { ...typography.bodySm, color: colors.onSurface },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  costLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  costValue: { ...typography.labelMd, color: colors.deepAmber },
  loadMoreButton: { minHeight: 44, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceMd },
  loadMoreText: { ...typography.labelLg, color: colors.primary },
  rescan: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.statusSuccessBorder, backgroundColor: colors.statusSuccessSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  rescanText: { ...typography.labelLg, color: colors.statusSuccessStrong },
});

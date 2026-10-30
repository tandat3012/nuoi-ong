import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { documentCodeLabel, formatDate, statusLabel, type Paginated, type StockCount, type StockIssue, type StockReceipt } from '@/src/features/inventory/api';

type Filter = 'COUNT' | 'RECEIPT' | 'ISSUE' | 'MAINTENANCE';
type DocumentCard = { id: string; code: string; title: string; type: Filter; status: string; date?: string | null; warehouseId?: string; reason?: string | null; assetId?: string; assetCode?: string; description?: string };
type MaintenanceRequestRow = { id: string; assetId: string; assetCode: string; itemName: string; description: string; status: string; createdAt: string; rejectionReason: string | null };
type MaintenanceRequestPage = { data: MaintenanceRequestRow[]; page: { totalPages: number } };

const filterTabs: { icon: 'fact-check' | 'input' | 'output' | 'build'; label: string; value: Filter }[] = [
  { icon: 'fact-check', label: 'Kiểm kê kho', value: 'COUNT' },
  { icon: 'input', label: 'Phiếu nhập', value: 'RECEIPT' },
  { icon: 'output', label: 'Phiếu xuất', value: 'ISSUE' },
  { icon: 'build', label: 'Phiếu bảo trì', value: 'MAINTENANCE' },
];

function tone(status: string): 'success' | 'amber' | 'danger' | 'cream' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_APPROVAL' || status === 'COUNTING' || status === 'SCHEDULED' || status === 'IN_PROGRESS') return 'amber';
  return 'cream';
}

function cardStatusLabel(status: string, type: Filter) {
  if (type === 'MAINTENANCE') {
    if (status === 'PENDING_APPROVAL') return 'CHỜ DUYỆT';
    if (status === 'CONFIRMED') return 'ĐÃ DUYỆT';
    if (status === 'REJECTED') return 'TỪ CHỐI';
  }
  return statusLabel(status);
}

function parseDatabaseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMaintenanceDay(value?: string | null) {
  if (!value) return 'Chưa có ngày';
  const date = parseDatabaseDate(value);
  return date ? date.toLocaleDateString('vi-VN') : value;
}

export default function ReceiptListScreen() {
  const router = useRouter();
  const { maintenanceAssetId } = useLocalSearchParams<{ maintenanceAssetId?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [filter, setFilter] = useState<Filter>('RECEIPT');
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<DocumentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const syncRotation = useRef(new Animated.Value(0)).current;
  const filterScroll = useRef<ScrollView | null>(null);
  const filterLayouts = useRef<Partial<Record<Filter, { x: number; width: number }>>>({});
  const filterScales = useRef<Record<Filter, Animated.Value>>({
    COUNT: new Animated.Value(1), RECEIPT: new Animated.Value(1), ISSUE: new Animated.Value(1), MAINTENANCE: new Animated.Value(1),
  }).current;
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';

  useEffect(() => {
    if (!currentFarmId) { setDocuments([]); return; }
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<Paginated<StockReceipt>>('/stock-receipts', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        apiRequest<Paginated<StockIssue>>('/stock-issues', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        apiRequest<Paginated<StockCount>>('/stock-counts', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        apiRequest<MaintenanceRequestPage>('/maintenance-requests', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 }, skipCache: true }),
      ]);
    }).then(([receipts, issues, counts, maintenanceRequests]) => {
      if (cancelled) return;
      setDocuments([
        ...receipts.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.receiptCode, row.id), title: row.note || 'Phiếu nhập kho', type: 'RECEIPT' as const, status: row.status, date: row.receiptDate ?? row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...issues.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.issueCode, row.id), title: row.reason || 'Phiếu xuất kho', type: 'ISSUE' as const, status: row.status, date: row.issueDate ?? row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...counts.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.countCode, row.id), title: row.note || 'Phiếu kiểm kê kho', type: 'COUNT' as const, status: row.status, date: row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...maintenanceRequests.data.map((row) => ({ id: row.id, code: `MNT-${row.id.slice(0, 8).toUpperCase()}`, title: row.itemName, description: row.description, type: 'MAINTENANCE' as const, status: row.status, date: row.createdAt, reason: row.rejectionReason, assetId: row.assetId, assetCode: row.assetCode })),
      ]);
      setError(null);
    }).catch((cause: unknown) => {
      if (!cancelled) { setDocuments([]); setError(cause instanceof Error ? cause.message : 'Không thể tải nhật ký kho.'); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce]);

  const visibleDocuments = useMemo(() => documents.filter((document) => document.type === filter && `${document.code} ${document.title} ${document.assetCode ?? ''} ${document.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())), [documents, filter, search]);

  useEffect(() => {
    for (const tab of filterTabs) {
      Animated.spring(filterScales[tab.value], { toValue: tab.value === filter ? 1 : 0.94, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
    }
  }, [filter, filterScales]);

  function selectFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    const layout = filterLayouts.current[nextFilter];
    if (layout) filterScroll.current?.scrollTo({ x: Math.max(0, layout.x - 20), animated: true });
  }

  function openDocument(document: DocumentCard) {
    if (document.type === 'COUNT') router.push(`/counts/${document.id}` as never);
    else if (document.type === 'MAINTENANCE') router.push(`/maintenance/requests/${document.id}` as never);
    else router.push(`/receipts/${document.id}?type=${document.type === 'ISSUE' ? 'issue' : 'receipt'}` as never);
  }

  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }

  function openCreateForm() {
    if (filter === 'COUNT') {
      router.push('/counts/new' as never);
      return;
    }
    if (filter === 'RECEIPT' || filter === 'ISSUE') {
      router.push(`/receipts/new?type=${filter === 'ISSUE' ? 'issue' : 'receipt'}` as never);
      return;
    }
    const assetQuery = maintenanceAssetId ? `?assetId=${encodeURIComponent(maintenanceAssetId)}` : '';
    router.push(`/maintenance/new${assetQuery}` as never);
  }

  const createEntry = {
    COUNT: { icon: 'fact-check' as const, eyebrow: 'KIỂM KÊ KHO', title: 'Tạo phiếu kiểm kê', badge: 'KIỂM KÊ', description: 'Ghi nhận số lượng thực tế và đối chiếu tồn kho.', action: 'Mở biểu mẫu' },
    RECEIPT: { icon: 'input' as const, eyebrow: 'NHẬP KHO', title: 'Tạo phiếu nhập', badge: 'PHIẾU NHẬP', description: 'Ghi nhận vật tư nhập vào kho và cập nhật tồn.', action: 'Mở biểu mẫu' },
    ISSUE: { icon: 'output' as const, eyebrow: 'XUẤT KHO', title: 'Tạo phiếu xuất', badge: 'PHIẾU XUẤT', description: 'Chọn vật tư đủ tồn tại kho để lập phiếu xuất.', action: 'Mở biểu mẫu' },
    MAINTENANCE: { icon: 'build' as const, eyebrow: 'HỒ SƠ THIẾT BỊ', title: 'Tạo phiếu bảo trì', badge: maintenanceAssetId ? 'ĐÃ CHỌN TÀI SẢN' : 'BẢO TRÌ', description: 'Lập lịch bảo trì hoặc gửi yêu cầu sự cố để quản lý duyệt.', action: 'Mở biểu mẫu' },
  }[filter];

  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  return <AppShell active="receipts">
    <PageHeader title="Nhật ký kho vận" subtitle={farmName} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]}><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
    <View style={styles.heading}><Text style={styles.eyebrow}>KHO ONG TRUNG TÂM</Text><Text style={styles.pageTitle} numberOfLines={2}>{filter === 'MAINTENANCE' ? 'Phiếu Bảo Trì' : 'Phiếu Nhập & Xuất'}</Text></View>
    <Pressable accessibilityRole="button" onPress={openCreateForm} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.maintenanceEntry}>
        <HoneycombDecor />
        <View style={styles.maintenanceEntryTop}>
          <View style={styles.maintenanceEntryIcon}><Icon name={createEntry.icon} color={colors.primary} /></View>
          <View style={styles.maintenanceEntryCopy}>
            <Text style={styles.maintenanceEntryEyebrow}>{createEntry.eyebrow}</Text>
            <Text style={styles.maintenanceEntryTitle}>{createEntry.title}</Text>
          </View>
          <Pill tone="amber"><Text style={styles.maintenanceEntryPill}>{createEntry.badge}</Text></Pill>
        </View>
        <View style={styles.maintenanceEntryBottom}>
          <Text style={styles.maintenanceEntryDescription} numberOfLines={2}>{createEntry.description}</Text>
          <View style={styles.maintenanceEntryAction}><Text style={styles.maintenanceEntryActionText}>{createEntry.action}</Text><Icon name="chevron-right" size={19} color={colors.primary} /></View>
        </View>
      </Card>
    </Pressable>
    <View style={styles.search}><Icon name="search" color={colors.onSurfaceVariant} /><TextInput value={search} onChangeText={setSearch} placeholder="Tìm theo mã phiếu hoặc nội dung..." placeholderTextColor={colors.onSurfaceVariant} style={styles.searchInput} /><Icon name="tune" color={colors.onSurfaceVariant} /></View>
    <ScrollView ref={filterScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filterTabs.map((tab) => <Animated.View key={tab.value} onLayout={(event) => { filterLayouts.current[tab.value] = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }; }} style={{ transform: [{ scale: filterScales[tab.value] }] }}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === tab.value }} onPress={() => selectFilter(tab.value)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.filterButton, filter === tab.value ? styles.filterButtonActive : styles.filterButtonIdle, pressed && styles.pressed]}>
          <Icon name={tab.icon} size={16} color={filter === tab.value ? colors.deepAmber : colors.onSurfaceVariant} /><Text numberOfLines={1} style={filter === tab.value ? styles.activeText : styles.filterText}>{tab.label}</Text>
        </Pressable>
      </Animated.View>)}
    </ScrollView>
    <SectionTitle title={filter === 'COUNT' ? 'Danh sách kiểm kê' : filter === 'MAINTENANCE' ? 'Danh sách phiếu bảo trì' : 'Danh sách phiếu'} count={`${visibleDocuments.length} phiếu`} />
    {loading ? <Text style={styles.emptyText}>Đang tải dữ liệu từ cơ sở dữ liệu...</Text> : visibleDocuments.length === 0 ? <Text style={styles.emptyText}>{error ?? 'Không có dữ liệu cho bộ lọc hiện tại.'}</Text> : visibleDocuments.map((document) => <Pressable key={`${document.type}-${document.id}`} onPress={() => openDocument(document)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={[styles.receipt, document.status === 'DRAFT' && styles.draft]}>
        <HoneycombDecor tone={tone(document.status) === 'success' ? 'green' : 'amber'} />
        <View style={styles.receiptContent}>
          <View style={styles.receiptTop}>
            <View style={styles.typeIcon}><Icon name={document.type === 'RECEIPT' ? 'arrow-downward' : document.type === 'ISSUE' ? 'arrow-upward' : document.type === 'MAINTENANCE' ? 'build' : 'fact-check'} color={colors.primary} /></View>
            <View style={styles.receiptCopy}>
              <View style={styles.codeRow}><Pill tone="cream"><Text style={styles.receiptCode}>{document.code}</Text></Pill><Text style={styles.typeText}>{document.type === 'RECEIPT' ? 'Phiếu nhập kho' : document.type === 'ISSUE' ? 'Phiếu xuất kho' : document.type === 'MAINTENANCE' ? 'Phiếu bảo trì' : 'Kiểm kê kho'}</Text></View>
              <Text style={styles.receiptTitle} numberOfLines={3}>{document.title}</Text>
              {document.type === 'MAINTENANCE' && document.description ? <Text style={styles.maintenanceDescription} numberOfLines={3}>{document.description}</Text> : null}
              {document.type !== 'MAINTENANCE' ? <Text style={styles.receiptMeta} numberOfLines={2}>◷ {formatDate(document.date)}{document.warehouseId ? ` • Kho: ${document.warehouseId}` : ''}</Text> : null}
            </View>
            <Pill tone={tone(document.status)}><Text style={styles.pillText}>{cardStatusLabel(document.status, document.type)}</Text></Pill>
          </View>
          {document.type === 'MAINTENANCE' ? <View style={styles.maintenanceMetaRow}>
            <Text style={[styles.maintenanceMetaText, styles.maintenanceDate]} numberOfLines={1}>◷ {formatMaintenanceDay(document.date)}</Text>
            <Text style={[styles.maintenanceMetaText, styles.maintenanceAssetCode]} numberOfLines={1} ellipsizeMode="tail">Mã tài sản: {document.assetCode ?? '—'}</Text>
          </View> : null}
          {document.reason ? <Text style={styles.rejection} numberOfLines={3}>Lý do từ chối: {document.reason}</Text> : null}
          <View style={styles.receiptBottom}><Text style={styles.typeText}>Mở dữ liệu chi tiết</Text><Text style={styles.action}>{document.type === 'MAINTENANCE' ? 'Xem yêu cầu →' : 'Xem chi tiết phiếu →'}</Text></View>
        </View>
      </Card>
    </Pressable>)}
    <Card style={styles.monthly}><Text style={styles.monthlyTitle}>Tổng hợp theo dữ liệu hiện tại</Text><View style={styles.monthlyGrid}><Metric label="Phiếu nhập" value={String(documents.filter((item) => item.type === 'RECEIPT').length)} /><Metric label="Phiếu xuất" value={String(documents.filter((item) => item.type === 'ISSUE').length)} /><Metric label="Kiểm kê" value={String(documents.filter((item) => item.type === 'COUNT').length)} /><Metric label="Bảo trì" value={String(documents.filter((item) => item.type === 'MAINTENANCE').length)} /></View></Card>
  </AppShell>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricUnit}>bản ghi</Text></View>; }

const styles = StyleSheet.create({
  sync: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  heading: { gap: spacing.spaceXs }, eyebrow: { ...typography.labelMd, color: colors.secondary }, pageTitle: { ...typography.displayLgMobile, color: colors.deepAmberStrong, flexShrink: 1 },
  maintenanceEntry: { position: 'relative', overflow: 'hidden', gap: spacing.spaceMd, backgroundColor: colors.parchmentWarm, borderColor: colors.secondaryContainer },
  maintenanceEntryTop: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  maintenanceEntryIcon: { width: 42, height: 42, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  maintenanceEntryCopy: { flex: 1, minWidth: 0 },
  maintenanceEntryEyebrow: { ...typography.labelSm, color: colors.secondary },
  maintenanceEntryTitle: { ...typography.headlineSm, color: colors.deepAmberStrong },
  maintenanceEntryPill: { ...typography.labelSm, color: colors.deepAmber },
  maintenanceEntryBottom: { position: 'relative', zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: spacing.spaceSm },
  maintenanceEntryDescription: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  maintenanceEntryAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  maintenanceEntryActionText: { ...typography.labelMd, color: colors.primary },
  maintenanceMetaRow: { position: 'relative', zIndex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, paddingTop: spacing.spaceXs },
  maintenanceMetaText: { ...typography.bodySm, color: colors.onSurfaceVariant, minWidth: 0 },
  maintenanceDate: { flexShrink: 0 },
  maintenanceAssetCode: { flex: 1, textAlign: 'right' },
  search: { height: 46, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm }, searchInput: { flex: 1, minWidth: 0, color: colors.onSurface, ...typography.bodyMd },
  filters: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, paddingHorizontal: spacing.spaceXs, paddingVertical: spacing.spaceSm }, filterButton: { minHeight: 38, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceMd }, filterButtonActive: { minHeight: 44, backgroundColor: colors.honeyChip, borderColor: colors.secondary }, filterButtonIdle: { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }, activeText: { ...typography.labelMd, color: colors.deepAmber }, filterText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  receipt: { marginBottom: spacing.spaceSm, position: 'relative', overflow: 'hidden' }, receiptContent: { position: 'relative', zIndex: 1, gap: spacing.spaceMd, width: '100%' }, draft: { borderStyle: 'dashed' }, receiptTop: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap' }, typeIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' }, receiptCopy: { flex: 1, minWidth: 0 }, codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, minWidth: 0, flexWrap: 'wrap' }, receiptCode: { ...typography.labelSm, color: colors.primary }, receiptTitle: { ...typography.headlineSm, color: colors.deepAmber, marginTop: spacing.spaceSm, flexShrink: 1 }, maintenanceDescription: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs, flexShrink: 1 }, receiptMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.spaceSm, flexShrink: 1 }, pillText: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' }, typeText: { ...typography.bodySm, color: colors.onSurfaceVariant, minWidth: 0, flexShrink: 1 }, reviewInfo: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, paddingTop: spacing.spaceXs }, reviewInfoText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0 }, rejection: { position: 'relative', zIndex: 1, ...typography.bodySm, color: colors.error, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.errorContainer }, receiptBottom: { position: 'relative', zIndex: 1, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: spacing.spaceSm, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm }, action: { ...typography.labelLg, color: colors.secondary, flexShrink: 1, textAlign: 'right' }, emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  monthly: { gap: spacing.spaceMd, backgroundColor: colors.parchmentWarm }, monthlyTitle: { ...typography.headlineSm, color: colors.deepAmber }, monthlyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm }, metric: { flex: 1, minWidth: 86, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.parchment, alignItems: 'center' }, metricLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' }, metricValue: { ...typography.headlineSm, color: colors.deepAmber, marginTop: 4 }, metricUnit: { ...typography.labelSm, color: colors.onSurfaceVariant },
});

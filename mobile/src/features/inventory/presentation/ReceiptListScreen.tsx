import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { documentCodeLabel, formatDate, statusLabel, type Paginated, type StockCount, type StockIssue, type StockReceipt, type Warehouse } from '@/src/features/inventory/api';
import StockDateRangeFilter from '@/src/features/inventory/presentation/StockDateRangeFilter';
import { formatApiDateTime } from '@/src/shared/format-date-time';
import type { StockDateRange } from '@/src/features/inventory/stock-date-range';

type Filter = 'COUNT' | 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'MAINTENANCE';
type DocumentCard = { id: string; code: string; title: string; type: Filter; status: string; date?: string | null; createdAt?: string | null; warehouseId?: string; destinationWarehouse?: string; reason?: string | null; assetId?: string; assetCode?: string; description?: string };
type StockTransfer = { id: string; transferCode: string | null; status: string; fromWarehouseId: string; toWarehouseId: string; transferDate?: string | null; createdAt?: string; note?: string | null; rejectionReason?: string | null };
type MaintenanceRequestRow = { id: string; assetId: string; assetCode: string; itemName: string; description: string; status: string; createdAt: string; rejectionReason: string | null };
type MaintenanceRequestPage = { data: MaintenanceRequestRow[]; page: { totalPages: number } };
const DOCUMENT_PAGE_SIZE = 20;

const filterTabs: { icon: 'fact-check' | 'input' | 'output' | 'swap-horiz' | 'build'; label: string; value: Filter }[] = [
  { icon: 'fact-check', label: 'Kiểm kê kho', value: 'COUNT' },
  { icon: 'input', label: 'Phiếu nhập', value: 'RECEIPT' },
  { icon: 'output', label: 'Phiếu xuất', value: 'ISSUE' },
  { icon: 'swap-horiz', label: 'Phiếu điều chuyển', value: 'TRANSFER' },
  { icon: 'build', label: 'Phiếu bảo trì', value: 'MAINTENANCE' },
];

function tone(status: string): 'success' | 'amber' | 'danger' | 'cream' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_APPROVAL' || status === 'IN_TRANSIT' || status === 'COUNTING' || status === 'SCHEDULED' || status === 'IN_PROGRESS') return 'amber';
  return 'cream';
}

function cardStatusLabel(status: string, type: Filter) {
  if (type === 'MAINTENANCE') {
    if (status === 'PENDING_APPROVAL') return 'CHỜ DUYỆT';
    if (status === 'CONFIRMED') return 'ĐÃ DUYỆT';
    if (status === 'REJECTED') return 'TỪ CHỐI';
  }
  if (type === 'TRANSFER') {
    if (status === 'IN_TRANSIT') return 'ĐANG CHUYỂN';
    if (status === 'CONFIRMED') return 'ĐÃ NHẬN';
  }
  return statusLabel(status);
}

export default function ReceiptListScreen() {
  const router = useRouter();
  const { maintenanceAssetId } = useLocalSearchParams<{ maintenanceAssetId?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [filter, setFilter] = useState<Filter>(maintenanceAssetId ? 'MAINTENANCE' : 'RECEIPT');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [dateRanges, setDateRanges] = useState<Record<'RECEIPT' | 'ISSUE', StockDateRange>>({ RECEIPT: {}, ISSUE: {} });
  const [documents, setDocuments] = useState<DocumentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const syncRotation = useRef(new Animated.Value(0)).current;
  const firstFocus = useRef(true);
  const filterScroll = useRef<ScrollView | null>(null);
  const filterLayouts = useRef<Partial<Record<Filter, { x: number; width: number }>>>({});
  const filterScales = useRef<Record<Filter, Animated.Value>>({
    COUNT: new Animated.Value(1), RECEIPT: new Animated.Value(1), ISSUE: new Animated.Value(1), TRANSFER: new Animated.Value(1), MAINTENANCE: new Animated.Value(1),
  }).current;
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';
  const activeDateRange = filter === 'RECEIPT' || filter === 'ISSUE' ? dateRanges[filter] : {};
  useEffect(() => { setPage(1); }, [currentFarmId]);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else { clearApiCache(); setReloadNonce((value) => value + 1); }
  }, []));

  useEffect(() => {
    if (!currentFarmId) { setDocuments([]); setPageInfo(null); return; }
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<Paginated<StockReceipt>>('/stock-receipts', { token, params: { farmId: currentFarmId, page: filter === 'RECEIPT' ? page : 1, pageSize: filter === 'RECEIPT' ? DOCUMENT_PAGE_SIZE : 100, ...(filter === 'RECEIPT' ? activeDateRange : {}) } }),
        apiRequest<Paginated<StockIssue>>('/stock-issues', { token, params: { farmId: currentFarmId, page: filter === 'ISSUE' ? page : 1, pageSize: filter === 'ISSUE' ? DOCUMENT_PAGE_SIZE : 100, ...(filter === 'ISSUE' ? activeDateRange : {}) } }),
        apiRequest<Paginated<StockCount>>('/stock-counts', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        apiRequest<Paginated<StockTransfer>>('/stock-transfers', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        apiRequest<MaintenanceRequestPage>('/maintenance-requests', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 }, skipCache: true }),
        apiRequest<Paginated<Warehouse>>('/warehouses', { token, params: { farmId: currentFarmId, destination: 'true', page: 1, pageSize: 100 } }),
      ]);
    }).then(([receipts, issues, counts, transfers, maintenanceRequests, warehouses]) => {
      if (cancelled) return;
      setPageInfo(filter === 'RECEIPT' ? receipts.page : filter === 'ISSUE' ? issues.page : null);
      const warehouseLabels = new Map(warehouses.data.map((row) => [row.id, `${row.code} · ${row.name}`]));
      setDocuments([
        ...receipts.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.receiptCode, row.id, 'PN'), title: row.note || 'Phiếu nhập kho', type: 'RECEIPT' as const, status: row.status, date: row.receiptDate ?? row.createdAt, createdAt: row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...issues.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.issueCode, row.id, 'PX'), title: row.reason || 'Phiếu xuất kho', type: 'ISSUE' as const, status: row.status, date: row.issueDate ?? row.createdAt, createdAt: row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...counts.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.countCode, row.id, 'KK'), title: row.note || 'Phiếu kiểm kê kho', type: 'COUNT' as const, status: row.status, date: row.createdAt, createdAt: row.createdAt, warehouseId: row.warehouseId, reason: row.rejectionReason })),
        ...transfers.data.map((row) => ({ id: row.id, code: documentCodeLabel(row.transferCode, row.id, 'CK'), title: row.note || 'Điều chuyển vật tư giữa các kho', type: 'TRANSFER' as const, status: row.status, date: row.transferDate ?? row.createdAt, createdAt: row.createdAt, warehouseId: warehouseLabels.get(row.fromWarehouseId) ?? row.fromWarehouseId, destinationWarehouse: warehouseLabels.get(row.toWarehouseId) ?? row.toWarehouseId, reason: row.rejectionReason })),
        ...maintenanceRequests.data.map((row) => ({ id: row.id, code: documentCodeLabel(null, row.id, 'MNT'), title: row.itemName, description: row.description, type: 'MAINTENANCE' as const, status: row.status, date: row.createdAt, reason: row.rejectionReason, assetId: row.assetId, assetCode: row.assetCode })),
      ]);
      setError(null);
    }).catch((cause: unknown) => {
      if (!cancelled) { setDocuments([]); setError(cause instanceof Error ? cause.message : 'Không thể tải nhật ký kho.'); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeDateRange.dateFrom, activeDateRange.dateTo, currentFarmId, filter, getAccessToken, page, reloadNonce]);

  const visibleDocuments = useMemo(() => documents.filter((document) => document.type === filter && `${document.code} ${document.title} ${document.assetCode ?? ''} ${document.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())), [documents, filter, search]);

  useEffect(() => {
    for (const tab of filterTabs) {
      Animated.spring(filterScales[tab.value], { toValue: tab.value === filter ? 1 : 0.94, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
    }
  }, [filter, filterScales]);

  function selectFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    setPage(1);
    const layout = filterLayouts.current[nextFilter];
    if (layout) filterScroll.current?.scrollTo({ x: Math.max(0, layout.x - 20), animated: true });
  }

  function applyDateRange(range: StockDateRange) {
    if (filter !== 'RECEIPT' && filter !== 'ISSUE') return;
    setPage(1);
    setDateRanges((current) => ({ ...current, [filter]: range }));
  }

  function openDocument(document: DocumentCard) {
    if (document.type === 'COUNT') router.push(`/counts/${document.id}` as never);
    else if (document.type === 'TRANSFER') router.push(`/transfers/${document.id}` as never);
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
    if (filter === 'TRANSFER') {
      router.push('/transfers/new' as never);
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
    TRANSFER: { icon: 'swap-horiz' as const, eyebrow: 'ĐIỀU CHUYỂN KHO', title: 'Tạo phiếu điều chuyển', badge: 'PHIẾU CHUYỂN', description: 'Chọn vật tư hoặc lô để chuyển giữa hai kho.', action: 'Mở biểu mẫu' },
    MAINTENANCE: { icon: 'build' as const, eyebrow: 'HỒ SƠ THIẾT BỊ', title: 'Báo sự cố', badge: maintenanceAssetId ? 'ĐÃ CHỌN TÀI SẢN' : 'BẢO TRÌ', description: 'Gửi yêu cầu sự cố để quản lý xử lý trên web.', action: 'Mở biểu mẫu' },
  }[filter];

  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  return <AppShell active="receipts">
    <PageHeader title="Nhật ký kho vận" subtitle={farmName} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]}><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
    <View style={styles.heading}><Text style={styles.eyebrow}>KHO ONG TRUNG TÂM</Text><Text style={styles.pageTitle} numberOfLines={2}>{filter === 'MAINTENANCE' ? 'Phiếu Bảo Trì' : filter === 'TRANSFER' ? 'Phiếu Điều Chuyển' : filter === 'COUNT' ? 'Phiếu Kiểm Kê' : 'Phiếu Nhập & Xuất'}</Text></View>
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
    <View style={styles.search}><Icon name="search" color={colors.onSurfaceVariant} /><TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder={filter === 'RECEIPT' || filter === 'ISSUE' ? 'Tìm trong trang phiếu hiện tại...' : 'Tìm theo mã phiếu hoặc nội dung...'} placeholderTextColor={colors.onSurfaceVariant} style={styles.searchInput} /><Icon name="tune" color={colors.onSurfaceVariant} /></View>
    <ScrollView ref={filterScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filterTabs.map((tab) => <Animated.View key={tab.value} onLayout={(event) => { filterLayouts.current[tab.value] = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }; }} style={{ transform: [{ scale: filterScales[tab.value] }] }}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === tab.value }} onPress={() => selectFilter(tab.value)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.filterButton, filter === tab.value ? styles.filterButtonActive : styles.filterButtonIdle, pressed && styles.pressed]}>
          <Icon name={tab.icon} size={16} color={filter === tab.value ? colors.deepAmber : colors.onSurfaceVariant} /><Text numberOfLines={1} style={filter === tab.value ? styles.activeText : styles.filterText}>{tab.label}</Text>
        </Pressable>
      </Animated.View>)}
    </ScrollView>
    {(filter === 'RECEIPT' || filter === 'ISSUE') ? <StockDateRangeFilter key={filter} value={dateRanges[filter]} onApply={applyDateRange} /> : null}
    <SectionTitle title={filter === 'COUNT' ? 'Danh sách kiểm kê' : filter === 'MAINTENANCE' ? 'Danh sách phiếu bảo trì' : filter === 'TRANSFER' ? 'Danh sách điều chuyển' : 'Danh sách phiếu'} count={`${search.trim() ? visibleDocuments.length : pageInfo?.totalItems ?? visibleDocuments.length} phiếu`} />

    {loading ? <Text style={styles.emptyText}>Đang tải danh sách phiếu...</Text> : visibleDocuments.length === 0 ? <Text style={styles.emptyText}>{error ?? (search.trim() || activeDateRange.dateFrom || activeDateRange.dateTo ? 'Không có kết quả phù hợp với bộ lọc.' : 'Chưa có dữ liệu.')}</Text> : visibleDocuments.map((document) => <Pressable key={`${document.type}-${document.id}`} onPress={() => openDocument(document)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={[styles.receipt, document.status === 'DRAFT' && styles.draft]}>
        <HoneycombDecor tone={tone(document.status) === 'success' ? 'green' : 'amber'} />
        <View style={styles.receiptContent}>
          <View style={styles.receiptTop}>
            <View style={styles.typeIcon}><Icon name={document.type === 'RECEIPT' ? 'arrow-downward' : document.type === 'ISSUE' ? 'arrow-upward' : document.type === 'TRANSFER' ? 'swap-horiz' : document.type === 'MAINTENANCE' ? 'build' : 'fact-check'} color={colors.primary} /></View>
            <View style={styles.receiptCopy}>
              <View style={styles.codeRow}>{document.type !== 'MAINTENANCE' ? <Pill tone="cream"><Text style={styles.receiptCode}>{document.code}</Text></Pill> : null}<Text style={styles.typeText}>{document.type === 'RECEIPT' ? 'Phiếu nhập kho' : document.type === 'ISSUE' ? 'Phiếu xuất kho' : document.type === 'TRANSFER' ? 'Phiếu điều chuyển' : document.type === 'MAINTENANCE' ? 'Phiếu bảo trì' : 'Kiểm kê kho'}</Text></View>
              <Text style={styles.receiptTitle} numberOfLines={3}>{document.title}</Text>
              {document.type === 'MAINTENANCE' && document.description ? <Text style={styles.maintenanceDescription} numberOfLines={3}>{document.description}</Text> : null}
              {document.type !== 'MAINTENANCE' ? <Text style={styles.receiptMeta} numberOfLines={2}>◷ {document.createdAt ? formatApiDateTime(document.createdAt) : formatDate(document.date)}{document.type === 'TRANSFER' ? ` • ${document.warehouseId ?? 'Kho nguồn'} → ${document.destinationWarehouse ?? 'Kho đích'}` : document.warehouseId ? ` • Kho: ${document.warehouseId}` : ''}</Text> : null}
            </View>
            <Pill tone={tone(document.status)}><Text style={styles.pillText}>{cardStatusLabel(document.status, document.type)}</Text></Pill>
          </View>
          {document.type === 'MAINTENANCE' ? <View style={styles.maintenanceMetaRow}>
            <Text style={[styles.maintenanceMetaText, styles.maintenanceDate]} numberOfLines={1}>◷ {formatApiDateTime(document.date)}</Text>
          </View> : null}
          {document.reason ? <Text style={styles.rejection} numberOfLines={3}>Lý do từ chối: {document.reason}</Text> : null}
          <View style={styles.receiptBottom}><Text style={styles.typeText}>Mở dữ liệu chi tiết</Text><Text style={styles.action}>{document.type === 'MAINTENANCE' ? 'Xem yêu cầu →' : 'Xem chi tiết phiếu →'}</Text></View>
        </View>
      </Card>
    </Pressable>)}
    {(filter === 'RECEIPT' || filter === 'ISSUE') && !loading && !error && (pageInfo?.totalPages ?? 0) > 1 ? <View style={styles.pagination}><Pressable disabled={page <= 1} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, page <= 1 && styles.pageDisabled]}><Text style={styles.pageButtonText}>Trước</Text></Pressable><Text style={styles.pageSummary}>Trang {page}/{pageInfo?.totalPages} · {pageInfo?.totalItems} phiếu</Text><Pressable disabled={page >= (pageInfo?.totalPages ?? 1)} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, page >= (pageInfo?.totalPages ?? 1) && styles.pageDisabled]}><Text style={styles.pageButtonText}>Sau</Text></Pressable></View> : null}
    <Card style={styles.monthly}><Text style={styles.monthlyTitle}>Tổng hợp theo dữ liệu đang tải</Text><View style={styles.monthlyGrid}><Metric label="Phiếu nhập" value={String(filter === 'RECEIPT' ? pageInfo?.totalItems ?? documents.filter((item) => item.type === 'RECEIPT').length : documents.filter((item) => item.type === 'RECEIPT').length)} /><Metric label="Phiếu xuất" value={String(filter === 'ISSUE' ? pageInfo?.totalItems ?? documents.filter((item) => item.type === 'ISSUE').length : documents.filter((item) => item.type === 'ISSUE').length)} /><Metric label="Kiểm kê" value={String(documents.filter((item) => item.type === 'COUNT').length)} /><Metric label="Điều chuyển" value={String(documents.filter((item) => item.type === 'TRANSFER').length)} /><Metric label="Bảo trì" value={String(documents.filter((item) => item.type === 'MAINTENANCE').length)} /></View></Card>
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
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, paddingVertical: spacing.spaceMd },
  pageButton: { minHeight: 38, paddingHorizontal: spacing.spaceMd, justifyContent: 'center', borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment },
  pageButtonText: { ...typography.labelMd, color: colors.primary },
  pageSummary: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1, textAlign: 'center' },
  pageDisabled: { opacity: 0.4 },
});

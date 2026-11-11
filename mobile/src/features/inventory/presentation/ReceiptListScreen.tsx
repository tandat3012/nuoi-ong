import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { documentCodeLabel, formatDate, listWarehouses, statusLabel, type Page, type Paginated, type StockCount, type StockIssue, type StockReceipt } from '@/src/features/inventory/api';
import { firstRouteParam, normalizeReceiptListFilter, type ReceiptListFilter } from '@/src/features/inventory/receipt-list.logic';
import StockDateRangeFilter from '@/src/features/inventory/presentation/StockDateRangeFilter';
import { formatApiDateTime } from '@/src/shared/format-date-time';
import type { StockDateRange } from '@/src/features/inventory/stock-date-range';

type Filter = ReceiptListFilter;
type DocumentCard = { id: string; code: string; title: string; type: Filter; status: string; date?: string | null; createdAt?: string | null; warehouseId?: string; destinationWarehouse?: string; reason?: string | null; assetId?: string; assetCode?: string; description?: string };
type StockTransfer = { id: string; transferCode: string | null; status: string; fromWarehouseId: string; toWarehouseId: string; transferDate?: string | null; createdAt?: string; note?: string | null; rejectionReason?: string | null };
type MaintenanceRequestRow = { id: string; assetId: string; assetCode: string; itemName: string; description: string; status: string; createdAt: string; rejectionReason: string | null; maintenanceRecordStatus?: string | null; maintenanceReturnStatus?: string | null; maintenanceFinalDecision?: string | null };
type StockReceiptRow = StockReceipt & { warehouseCode?: string | null; warehouseName?: string | null };
type StockIssueRow = StockIssue & { warehouseCode?: string | null; warehouseName?: string | null };
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
    const maintenanceLabels: Record<string, string> = {
      PENDING_APPROVAL: 'CHỜ TIẾP NHẬN', CONFIRMED: 'ĐÃ TIẾP NHẬN', REJECTED: 'TỪ CHỐI',
      SCHEDULED: 'ĐÃ LÊN LỊCH', IN_PROGRESS: 'ĐANG BẢO TRÌ', RECEIVED: 'CHỜ NGHIỆM THU',
      COMPLETED: 'CHỜ NHẬP LẠI', FAILED: 'BẢO TRÌ KHÔNG ĐẠT', CANCELLED: 'LỊCH ĐÃ HỦY',
      RETURN_PENDING_APPROVAL: 'CHỜ DUYỆT NHẬP LẠI', RETURN_REJECTED: 'CẦN GỬI LẠI PHIẾU',
      AWAITING_FINAL_DECISION: 'CHỜ QUYẾT ĐỊNH CUỐI', RETURN_CONFIRMED_FAILED: 'ĐÃ NHẬP · KHÔNG ĐẠT',
      REUSE: 'HOÀN TẤT · ĐƯỢC DÙNG LẠI', HOLD: 'ĐÃ NHẬP · TẠM GIỮ',
    };
    return maintenanceLabels[status] ?? status;
  }
  if (type === 'TRANSFER') {
    if (status === 'IN_TRANSIT') return 'ĐANG CHUYỂN';
    if (status === 'CONFIRMED') return 'ĐÃ NHẬN';
  }
  return statusLabel(status);
}

const DocumentCardRow = memo(function DocumentCardRow({
  document,
  onPress,
}: {
  document: DocumentCard;
  onPress: (entry: DocumentCard) => void;
}) {
  return (
    <Pressable onPress={() => onPress(document)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={[styles.receipt, document.status === 'DRAFT' && styles.draft]}>
        <HoneycombDecor tone={tone(document.status) === 'success' ? 'green' : 'amber'} />
        <View style={styles.receiptContent}>
          <View style={styles.receiptTop}>
            <View style={styles.typeIcon}>
              <Icon name={document.type === 'RECEIPT' ? 'arrow-downward' : document.type === 'ISSUE' ? 'arrow-upward' : document.type === 'TRANSFER' ? 'swap-horiz' : document.type === 'MAINTENANCE' ? 'build' : 'fact-check'} color={colors.primary} />
            </View>
            <View style={styles.receiptCopy}>
              <View style={styles.codeRow}>
                {document.type !== 'MAINTENANCE' ? <Pill tone="cream"><Text style={styles.receiptCode}>{document.code}</Text></Pill> : null}
                <Text style={styles.typeText}>{document.type === 'RECEIPT' ? 'Phiếu nhập kho' : document.type === 'ISSUE' ? 'Phiếu xuất kho' : document.type === 'TRANSFER' ? 'Phiếu điều chuyển' : document.type === 'MAINTENANCE' ? 'Phiếu bảo trì' : 'Kiểm kê kho'}</Text>
              </View>
              <Text style={styles.receiptTitle} numberOfLines={3}>{document.title}</Text>
              {document.type === 'MAINTENANCE' && document.description ? <Text style={styles.maintenanceDescription} numberOfLines={3}>{document.description}</Text> : null}
              {document.type !== 'MAINTENANCE' ? (
                <Text style={styles.receiptMeta} numberOfLines={2}>
                  ◷ {document.createdAt ? formatApiDateTime(document.createdAt) : formatDate(document.date)}
                  {document.type === 'TRANSFER'
                    ? ` • ${document.warehouseId ?? 'Kho nguồn'} → ${document.destinationWarehouse ?? 'Kho đích'}`
                    : document.warehouseId ? ` • Kho: ${document.warehouseId}` : ''}
                </Text>
              ) : null}
            </View>
            <Pill tone={tone(document.status)}><Text style={styles.pillText}>{cardStatusLabel(document.status, document.type)}</Text></Pill>
          </View>
          {document.type === 'MAINTENANCE' ? (
            <View style={styles.maintenanceMetaRow}>
              <Text style={[styles.maintenanceMetaText, styles.maintenanceDate]} numberOfLines={1}>◷ {formatApiDateTime(document.date)}</Text>
            </View>
          ) : null}
          {document.reason ? <Text style={styles.rejection} numberOfLines={3}>Lý do từ chối: {document.reason}</Text> : null}
          <View style={styles.receiptBottom}>
            <Text style={styles.typeText}>Mở dữ liệu chi tiết</Text>
            <Text style={styles.action}>{document.type === 'MAINTENANCE' ? 'Xem yêu cầu →' : 'Xem chi tiết phiếu →'}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

export default function ReceiptListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { maintenanceAssetId, tab } = useLocalSearchParams<{ maintenanceAssetId?: string; tab?: string | string[] }>();
  const tabParam = firstRouteParam(tab);
  const maintenanceAssetParam = firstRouteParam(maintenanceAssetId);
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [filter, setFilter] = useState<Filter>(() => normalizeReceiptListFilter(tabParam, maintenanceAssetParam));
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const scrolledInitialTab = useRef(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<Page | null>(null);
  const [tabTotals, setTabTotals] = useState<Partial<Record<Filter, number>>>({});
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
  const activeDateRange = useMemo(
    () => (filter === 'RECEIPT' || filter === 'ISSUE' ? dateRanges[filter] : {}),
    [dateRanges, filter],
  );

  useEffect(() => {
    if (!tabParam && !maintenanceAssetParam) return;
    const nextFilter = normalizeReceiptListFilter(tabParam, maintenanceAssetParam);
    if (filterRef.current !== nextFilter) {
      setFilter(nextFilter);
      setPage(1);
    }
    const layout = filterLayouts.current[nextFilter];
    if (layout) filterScroll.current?.scrollTo({ x: Math.max(0, layout.x - 20), animated: true });
  }, [maintenanceAssetParam, tabParam]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setTabTotals({});
  }, [currentFarmId]);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else {
      clearApiCache();
      setTabTotals({});
      setReloadNonce((value) => value + 1);
    }
  }, []));

  useEffect(() => {
    if (!currentFarmId) {
      setDocuments([]);
      setPageInfo(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const searchParam = debouncedSearch || undefined;
    const isUnfiltered = !searchParam && !activeDateRange.dateFrom && !activeDateRange.dateTo;

    void getAccessToken()
      .then(async (token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

        if (filter === 'RECEIPT') {
          const res = await apiRequest<Paginated<StockReceiptRow>>('/stock-receipts', {
            token,
            params: {
              farmId: currentFarmId,
              page,
              pageSize: DOCUMENT_PAGE_SIZE,
              search: searchParam,
              ...activeDateRange,
            },
            signal: controller.signal,
          });
          return {
            page: res.page,
            rows: res.data.map((row): DocumentCard => ({
              id: row.id,
              code: documentCodeLabel(row.receiptCode, row.id, 'PN'),
              title: row.note || 'Phiếu nhập kho',
              type: 'RECEIPT',
              status: row.status,
              date: row.receiptDate ?? row.createdAt,
              createdAt: row.createdAt,
              warehouseId: row.warehouseCode && row.warehouseName ? `${row.warehouseCode} · ${row.warehouseName}` : row.warehouseId,
              reason: row.rejectionReason,
            })),
          };
        }

        if (filter === 'ISSUE') {
          const res = await apiRequest<Paginated<StockIssueRow>>('/stock-issues', {
            token,
            params: {
              farmId: currentFarmId,
              page,
              pageSize: DOCUMENT_PAGE_SIZE,
              search: searchParam,
              ...activeDateRange,
            },
            signal: controller.signal,
          });
          return {
            page: res.page,
            rows: res.data.map((row): DocumentCard => ({
              id: row.id,
              code: documentCodeLabel(row.issueCode, row.id, 'PX'),
              title: row.reason || 'Phiếu xuất kho',
              type: 'ISSUE',
              status: row.status,
              date: row.issueDate ?? row.createdAt,
              createdAt: row.createdAt,
              warehouseId: row.warehouseCode && row.warehouseName ? `${row.warehouseCode} · ${row.warehouseName}` : row.warehouseId,
              reason: row.rejectionReason,
            })),
          };
        }

        if (filter === 'COUNT') {
          const res = await apiRequest<Paginated<StockCount>>('/stock-counts', {
            token,
            params: {
              farmId: currentFarmId,
              page,
              pageSize: DOCUMENT_PAGE_SIZE,
              search: searchParam,
            },
            signal: controller.signal,
          });
          return {
            page: res.page,
            rows: res.data.map((row): DocumentCard => ({
              id: row.id,
              code: documentCodeLabel(row.countCode, row.id, 'KK'),
              title: row.note || 'Phiếu kiểm kê kho',
              type: 'COUNT',
              status: row.status,
              date: row.createdAt,
              createdAt: row.createdAt,
              warehouseId: row.warehouseId,
              reason: row.rejectionReason,
            })),
          };
        }

        if (filter === 'TRANSFER') {
          const [transfers, warehouses] = await Promise.all([
            apiRequest<Paginated<StockTransfer>>('/stock-transfers', {
              token,
              params: {
                farmId: currentFarmId,
                page,
                pageSize: DOCUMENT_PAGE_SIZE,
                search: searchParam,
              },
              signal: controller.signal,
            }),
            listWarehouses(token, currentFarmId, true),
          ]);
          const warehouseLabels = new Map(warehouses.data.map((row) => [row.id, `${row.code} · ${row.name}`]));
          return {
            page: transfers.page,
            rows: transfers.data.map((row): DocumentCard => ({
              id: row.id,
              code: documentCodeLabel(row.transferCode, row.id, 'CK'),
              title: row.note || 'Điều chuyển vật tư giữa các kho',
              type: 'TRANSFER',
              status: row.status,
              date: row.transferDate ?? row.createdAt,
              createdAt: row.createdAt,
              warehouseId: warehouseLabels.get(row.fromWarehouseId) ?? row.fromWarehouseId,
              destinationWarehouse: warehouseLabels.get(row.toWarehouseId) ?? row.toWarehouseId,
              reason: row.rejectionReason,
            })),
          };
        }

        const maintenanceRequests = await apiRequest<Paginated<MaintenanceRequestRow>>('/maintenance-requests', {
          token,
          params: {
            farmId: currentFarmId,
            page,
            pageSize: DOCUMENT_PAGE_SIZE,
            search: searchParam,
          },
          skipCache: true,
          signal: controller.signal,
        });
        return {
          page: maintenanceRequests.page,
          rows: maintenanceRequests.data.map((row): DocumentCard => {
            let status = row.status;
            if (row.status === 'CONFIRMED' && row.maintenanceRecordStatus) {
              status = row.maintenanceRecordStatus;
              if (row.maintenanceReturnStatus === 'PENDING_APPROVAL') status = 'RETURN_PENDING_APPROVAL';
              else if (row.maintenanceReturnStatus === 'REJECTED') status = 'RETURN_REJECTED';
              else if (row.maintenanceReturnStatus === 'CONFIRMED' && row.maintenanceRecordStatus === 'COMPLETED') status = row.maintenanceFinalDecision ?? 'AWAITING_FINAL_DECISION';
              else if (row.maintenanceReturnStatus === 'CONFIRMED' && row.maintenanceRecordStatus === 'FAILED') status = 'RETURN_CONFIRMED_FAILED';
            }
            return { id: row.id, code: documentCodeLabel(null, row.id, 'MNT'), title: row.itemName, description: row.description, type: 'MAINTENANCE', status, date: row.createdAt, reason: row.rejectionReason, assetId: row.assetId, assetCode: row.assetCode };
          }),
        };
      })
      .then((result) => {
        if (cancelled) return;
        setDocuments(result.rows);
        setPageInfo(result.page);
        if (isUnfiltered) {
          setTabTotals((current) => ({ ...current, [filter]: result.page.totalItems }));
        }
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || isAbortError(cause)) return;
        setDocuments([]);
        setError(cause instanceof Error ? cause.message : 'Không thể tải nhật ký kho.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeDateRange, currentFarmId, debouncedSearch, filter, getAccessToken, page, reloadNonce]);

  useEffect(() => {
    for (const tab of filterTabs) {
      Animated.spring(filterScales[tab.value], { toValue: tab.value === filter ? 1 : 0.94, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
    }
  }, [filter, filterScales]);

  const selectFilter = useCallback((nextFilter: Filter) => {
    setFilter(nextFilter);
    setPage(1);
    router.setParams({ tab: nextFilter });
    const layout = filterLayouts.current[nextFilter];
    if (layout) filterScroll.current?.scrollTo({ x: Math.max(0, layout.x - 20), animated: true });
  }, [router]);

  const applyDateRange = useCallback((range: StockDateRange) => {
    if (filter !== 'RECEIPT' && filter !== 'ISSUE') return;
    setPage(1);
    setDateRanges((current) => ({ ...current, [filter]: range }));
  }, [filter]);

  const openDocument = useCallback((document: DocumentCard) => {
    if (document.type === 'COUNT') router.push(`/counts/${document.id}` as never);
    else if (document.type === 'TRANSFER') router.push(`/transfers/${document.id}` as never);
    else if (document.type === 'MAINTENANCE') router.push(`/maintenance/requests/${document.id}` as never);
    else router.push(`/receipts/${document.id}?type=${document.type === 'ISSUE' ? 'issue' : 'receipt'}` as never);
  }, [router]);

  const sync = useCallback(() => {
    clearApiCache();
    setTabTotals({});
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }, [syncRotation]);

  const openCreateForm = useCallback(() => {
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
    const assetQuery = maintenanceAssetParam ? `?assetId=${encodeURIComponent(maintenanceAssetParam)}` : '';
    router.push(`/maintenance/new${assetQuery}` as never);
  }, [filter, maintenanceAssetParam, router]);

  const renderDocument = useCallback(
    ({ item }: { item: DocumentCard }) => <DocumentCardRow document={item} onPress={openDocument} />,
    [openDocument],
  );

  const createEntry = {
    COUNT: { icon: 'fact-check' as const, eyebrow: 'KIỂM KÊ KHO', title: 'Tạo phiếu kiểm kê', badge: 'KIỂM KÊ', description: 'Ghi nhận số lượng thực tế và đối chiếu tồn kho.', action: 'Mở biểu mẫu' },
    RECEIPT: { icon: 'input' as const, eyebrow: 'NHẬP KHO', title: 'Tạo phiếu nhập', badge: 'PHIẾU NHẬP', description: 'Ghi nhận vật tư nhập vào kho và cập nhật tồn.', action: 'Mở biểu mẫu' },
    ISSUE: { icon: 'output' as const, eyebrow: 'XUẤT KHO', title: 'Tạo phiếu xuất', badge: 'PHIẾU XUẤT', description: 'Chọn vật tư đủ tồn tại kho để lập phiếu xuất.', action: 'Mở biểu mẫu' },
    TRANSFER: { icon: 'swap-horiz' as const, eyebrow: 'ĐIỀU CHUYỂN KHO', title: 'Tạo phiếu điều chuyển', badge: 'PHIẾU CHUYỂN', description: 'Chọn vật tư hoặc lô để chuyển giữa hai kho.', action: 'Mở biểu mẫu' },
    MAINTENANCE: { icon: 'build' as const, eyebrow: 'HỒ SƠ THIẾT BỊ', title: 'Báo sự cố', badge: maintenanceAssetParam ? 'ĐÃ CHỌN TÀI SẢN' : 'BẢO TRÌ', description: 'Gửi yêu cầu sự cố để quản lý xử lý trên web.', action: 'Mở biểu mẫu' },
  }[filter];

  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  const totalMatchingCount = pageInfo?.totalItems ?? documents.length;

  const listHeaderElement = (
    <View style={styles.sectionGap}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>KHO ONG TRUNG TÂM</Text>
        <Text style={styles.pageTitle} numberOfLines={2}>
          {filter === 'MAINTENANCE' ? 'Phiếu Bảo Trì' : filter === 'TRANSFER' ? 'Phiếu Điều Chuyển' : filter === 'COUNT' ? 'Phiếu Kiểm Kê' : 'Phiếu Nhập & Xuất'}
        </Text>
      </View>
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
      <View style={styles.search}>
        <Icon name="search" color={colors.onSurfaceVariant} />
        <TextInput
          value={search}
          onChangeText={(value) => { setSearch(value); setPage(1); }}
          placeholder="Tìm theo mã phiếu hoặc nội dung..."
          placeholderTextColor={colors.onSurfaceVariant}
          style={styles.searchInput}
        />
        <Icon name="tune" color={colors.onSurfaceVariant} />
      </View>
      <ScrollView ref={filterScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filterTabs.map((tab) => (
          <Animated.View
            key={tab.value}
            onLayout={(event) => {
              const nextLayout = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width };
              filterLayouts.current[tab.value] = nextLayout;
              if (tab.value === filter && !scrolledInitialTab.current) {
                scrolledInitialTab.current = true;
                filterScroll.current?.scrollTo({ x: Math.max(0, nextLayout.x - 20), animated: false });
              }
            }}
            style={{ transform: [{ scale: filterScales[tab.value] }] }}
          >
            <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === tab.value }} onPress={() => selectFilter(tab.value)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.filterButton, filter === tab.value ? styles.filterButtonActive : styles.filterButtonIdle, pressed && styles.pressed]}>
              <Icon name={tab.icon} size={16} color={filter === tab.value ? colors.deepAmber : colors.onSurfaceVariant} />
              <Text numberOfLines={1} style={filter === tab.value ? styles.activeText : styles.filterText}>{tab.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
      {(filter === 'RECEIPT' || filter === 'ISSUE') ? <StockDateRangeFilter key={filter} value={dateRanges[filter]} onApply={applyDateRange} /> : null}
      <SectionTitle
        title={filter === 'COUNT' ? 'Danh sách kiểm kê' : filter === 'MAINTENANCE' ? 'Danh sách phiếu bảo trì' : filter === 'TRANSFER' ? 'Danh sách điều chuyển' : 'Danh sách phiếu'}
        count={`${totalMatchingCount} phiếu`}
      />
    </View>
  );

  const listFooterElement = (
    <View style={styles.footerGap}>
      {!loading && !error && (pageInfo?.totalPages ?? 0) > 1 ? (
        <View style={styles.pagination}>
          <Pressable disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.pageDisabled]}>
            <Text style={styles.pageButtonText}>Trước</Text>
          </Pressable>
          <Text style={styles.pageSummary}>Trang {page}/{pageInfo?.totalPages} · {pageInfo?.totalItems} phiếu</Text>
          <Pressable disabled={page >= (pageInfo?.totalPages ?? 1)} onPress={() => setPage((value) => Math.min(pageInfo?.totalPages ?? 1, value + 1))} style={[styles.pageButton, page >= (pageInfo?.totalPages ?? 1) && styles.pageDisabled]}>
            <Text style={styles.pageButtonText}>Sau</Text>
          </Pressable>
        </View>
      ) : null}
      <Card style={styles.monthly}>
        <Text style={styles.monthlyTitle}>Tổng hợp theo dữ liệu đang tải</Text>
        <View style={styles.monthlyGrid}>
          <Metric label="Phiếu nhập" value={tabTotals.RECEIPT !== undefined ? String(tabTotals.RECEIPT) : filter === 'RECEIPT' ? String(totalMatchingCount) : '—'} />
          <Metric label="Phiếu xuất" value={tabTotals.ISSUE !== undefined ? String(tabTotals.ISSUE) : filter === 'ISSUE' ? String(totalMatchingCount) : '—'} />
          <Metric label="Kiểm kê" value={tabTotals.COUNT !== undefined ? String(tabTotals.COUNT) : filter === 'COUNT' ? String(totalMatchingCount) : '—'} />
          <Metric label="Điều chuyển" value={tabTotals.TRANSFER !== undefined ? String(tabTotals.TRANSFER) : filter === 'TRANSFER' ? String(totalMatchingCount) : '—'} />
          <Metric label="Bảo trì" value={tabTotals.MAINTENANCE !== undefined ? String(tabTotals.MAINTENANCE) : filter === 'MAINTENANCE' ? String(totalMatchingCount) : '—'} />
        </View>
      </Card>
    </View>
  );

  return (
    <AppShell active="receipts" scroll={false}>
      <PageHeader
        title="Nhật ký kho vận"
        subtitle={farmName}
        action={(
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell />
            <Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]}>
              <Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View>
            </Pressable>
          </View>
        )}
      />
      <FlatList
        data={loading || error ? [] : documents}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderDocument}
        style={styles.flatList}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutterMobile,
          gap: spacing.spaceMd,
          paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Đang tải danh sách phiếu...</Text>
          ) : (
            <Text style={styles.emptyText}>
              {error ?? (debouncedSearch || activeDateRange.dateFrom || activeDateRange.dateTo ? 'Không có kết quả phù hợp với bộ lọc.' : 'Chưa có dữ liệu.')}
            </Text>
          )
        }
        ListFooterComponent={listFooterElement}
      />
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricUnit}>bản ghi</Text></View>; }

const styles = StyleSheet.create({
  flatList: { flex: 1, marginHorizontal: -spacing.gutterMobile },
  sectionGap: { gap: spacing.spaceMd },
  footerGap: { gap: spacing.spaceMd },
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

import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Animated, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { getInventoryForecastPage, listInventorySummaryPage, listWarehouses, type InventoryForecast, type InventorySummaryRow, type InventorySummaryTotals, type Page, type Warehouse } from '@/src/features/inventory/api';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';

const honeyImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0ssHRhDE29HtefOBLT_h8b7BV0zqL9eroB8E2SN1qFZwHiwpMX8_0AZtEqjMFvv7fbZbNb1ICdPIeOFY3CmyCBpWvCWFxYL9jWzIypEtoqqXInBaTdjmvQrvw9lHpUFvTM2cE2-zR2aYkXx85HOsIf4akGkTtdRflbUJPHpuskzlQ12lMygdsXvSV-_B1IWrDlj7NXb8xt_gBSZVVFNnBTVBRGOC7Z6uIqQqWtsld7SWgOKoQruXavg';
const INVENTORY_PAGE_SIZE = 8;
const EMPTY_TOTALS: InventorySummaryTotals = {
  stockedItemCount: 0,
  lotItemCount: 0,
  totalQuantity: '0',
  belowMinimumCount: 0,
};

type InventoryCard = {
  id: string;
  itemId: string;
  imageUrl: string | null;
  lotId: string | null;
  code: string;
  name: string;
  type: string;
  location: string;
  quantity: string;
  quantityValue: number;
  unit: string;
  extra: string;
  tone: 'success' | 'amber' | 'danger';
  progress: number;
  progressColor: string;
  minimumStock: string | null;
};

const InventoryCardRow = memo(function InventoryCardRow({
  item,
  onPress,
}: {
  item: InventoryCard;
  onPress: (entry: InventoryCard) => void;
}) {
  const thumbUrl = toThumbnailUrl(item.imageUrl, 128);
  return (
    <Pressable onPress={() => onPress(item)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={[styles.item, item.tone === 'success' && styles.itemSuccess, item.tone === 'amber' && styles.itemWarning, item.tone === 'danger' && styles.itemDanger]}>
        <HoneycombDecor tone={item.tone === 'danger' ? 'amber' : 'green'} />
        <View style={styles.itemTop}>
          <View style={styles.itemIcon}>
            {thumbUrl
              ? <Image source={{ uri: thumbUrl }} style={styles.itemImage} resizeMode="cover" />
              : <Icon name={item.type === 'TÀI SẢN' ? 'inventory-2' : item.type === 'THEO LÔ' ? 'hive' : 'grain'} size={27} color={colors.primary} />}
          </View>
          <View style={styles.itemCopy}>
            <View style={styles.itemCodeRow}>
              <Pill tone="cream"><Text style={styles.itemType} numberOfLines={1}>{item.type}</Text></Pill>
              <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
            </View>
            <Text style={styles.itemName} numberOfLines={3}>{item.name}</Text>
            <View style={styles.itemMetaRow}>
              <Text style={styles.location} numberOfLines={2}><Icon name="warehouse" size={13} color={colors.onSurfaceVariant} /> {item.location}</Text>
              <View style={styles.itemStatus}>
                <Pill tone={item.tone === 'success' ? 'success' : 'amber'}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={item.tone === 'success' ? styles.success : item.tone === 'danger' ? styles.danger : styles.amber}>
                    {item.tone === 'success' ? 'Đủ định mức' : item.tone === 'danger' ? 'Tồn rất thấp' : 'Dưới định mức'}
                  </Text>
                </Pill>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.itemStats}>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel} numberOfLines={2}>Tồn kho thực tế</Text>
            <Text style={styles.statValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{item.quantity} <Text style={styles.statUnit}>{item.unit}</Text></Text>
            {item.minimumStock ? <Text style={styles.minimumText}>Định mức: {item.minimumStock} {item.unit}</Text> : null}
            <View style={styles.itemProgressTrack}>
              <View style={[styles.itemProgressFill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: item.progressColor }]} />
            </View>
          </View>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel} numberOfLines={2}>{item.type === 'THEO LÔ' ? 'Mã lô' : 'Mã vật tư'}</Text>
            <Text style={styles.statValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{item.extra}</Text>
          </View>
        </View>
        <View style={styles.itemBottom}><Text style={styles.itemAction} numberOfLines={2}>Xem chi tiết tồn →</Text></View>
      </Card>
    </Pressable>
  );
});

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [filter, setFilter] = useState<'ALL' | 'LOT' | 'QUANTITY' | 'ASSET'>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const syncRotation = useRef(new Animated.Value(0)).current;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [summaryRows, setSummaryRows] = useState<InventorySummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<InventorySummaryTotals>(EMPTY_TOTALS);
  const [pageInfo, setPageInfo] = useState<Page | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [forecastItems, setForecastItems] = useState<InventoryForecast[]>([]);
  const [forecastTotalItems, setForecastTotalItems] = useState(0);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastExpanded, setForecastExpanded] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

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
    setSelectedWarehouseId(null);
    setCurrentPage(1);
    setForecastExpanded(false);
  }, [currentFarmId]);

  useEffect(() => {
    if (!currentFarmId) {
      setWarehouses([]);
      setSelectedWarehouseId(null);
      setWarehouseError(null);
      return;
    }
    let cancelled = false;
    setWarehousesLoading(true);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listWarehouses(token, currentFarmId);
      })
      .then((warehouseResponse) => {
        if (cancelled) return;
        const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
        setWarehouses(farmWarehouses);
        setSelectedWarehouseId((current) => {
          if (current && farmWarehouses.some((warehouse) => warehouse.id === current)) return current;
          return farmWarehouses[0]?.id ?? null;
        });
        setWarehouseError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setWarehouseError(cause instanceof Error ? cause.message : 'Không thể tải danh sách kho.');
          setWarehouses([]);
          setSelectedWarehouseId(null);
        }
      })
      .finally(() => { if (!cancelled) setWarehousesLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
    [selectedWarehouseId, warehouses],
  );

  useEffect(() => {
    if (!currentFarmId || !selectedWarehouse || selectedWarehouse.farmId !== currentFarmId) {
      setSummaryRows([]);
      setSummaryTotals(EMPTY_TOTALS);
      setPageInfo(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listInventorySummaryPage(
          token,
          currentFarmId,
          {
            warehouseId: selectedWarehouse.id,
            page: currentPage,
            pageSize: INVENTORY_PAGE_SIZE,
            search: debouncedSearch || undefined,
            trackingMode: filter === 'ALL' ? undefined : filter,
            skipCache: reloadNonce > 0,
          },
          controller.signal,
        );
      })
      .then((response) => {
        if (cancelled) return;
        setSummaryRows(response.data);
        setSummaryTotals(response.summary ?? EMPTY_TOTALS);
        setPageInfo(response.page);
        if (response.page.totalPages > 0 && currentPage > response.page.totalPages) {
          setCurrentPage(response.page.totalPages);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled || isAbortError(cause)) return;
        setSummaryError(cause instanceof Error ? cause.message : 'Không thể tải danh mục tồn kho.');
      })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentFarmId, currentPage, debouncedSearch, filter, getAccessToken, reloadNonce, selectedWarehouse]);

  useEffect(() => {
    if (!currentFarmId || !selectedWarehouse || selectedWarehouse.farmId !== currentFarmId) {
      setForecastItems([]);
      setForecastTotalItems(0);
      setForecastError(null);
      setForecastLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setForecastLoading(true);
    setForecastError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return getInventoryForecastPage(
          token,
          currentFarmId,
          selectedWarehouse.id,
          1,
          forecastExpanded ? 100 : 3,
          controller.signal,
        );
      })
      .then((response) => {
        if (cancelled) return;
        setForecastItems(response.data);
        setForecastTotalItems(response.page.totalItems);
      })
      .catch((cause: unknown) => {
        if (cancelled || isAbortError(cause)) return;
        setForecastError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử xuất kho.');
      })
      .finally(() => { if (!cancelled) setForecastLoading(false); });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentFarmId, forecastExpanded, getAccessToken, reloadNonce, selectedWarehouse]);

  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';

  const visibleItems = useMemo<InventoryCard[]>(() => summaryRows.map((row) => {
    const quantity = Number(row.quantityOnHand);
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
    const threshold = Number(row.minStockLevel ?? 0);
    const safeThreshold = Number.isFinite(threshold) ? threshold : 0;
    const ratio = safeThreshold > 0 ? safeQuantity / safeThreshold : 1;
    const tone: InventoryCard['tone'] = safeThreshold > 0 && ratio < 1 ? ratio <= 0.5 ? 'danger' : 'amber' : 'success';
    const type = row.trackingMode === 'LOT' ? 'THEO LÔ' : row.trackingMode === 'ASSET' ? 'TÀI SẢN' : 'SỐ LƯỢNG';
    const lotId = row.trackingMode === 'LOT' && row.singleLotId ? row.singleLotId : null;
    return {
      id: row.itemId,
      itemId: row.itemId,
      imageUrl: row.itemImageUrl ?? null,
      lotId,
      code: row.itemCode,
      name: row.itemName,
      type,
      location: selectedWarehouse
        ? safeQuantity > 0 ? selectedWarehouse.name : `${selectedWarehouse.name} • Chưa có tồn`
        : 'Chưa chọn kho',
      quantity: formatQuantity(safeQuantity),
      quantityValue: safeQuantity,
      unit: row.unitSymbol || row.unitName || row.itemType || 'đơn vị',
      extra: row.trackingMode === 'LOT'
        ? (lotId ? (row.singleLotCode || 'Chưa có mã lô') : row.lotCount > 1 ? `${row.lotCount} lô` : row.itemCode)
        : row.itemCode,
      tone,
      progress: safeThreshold > 0 ? Math.min(ratio, 1) : 1,
      progressColor: tone === 'danger' ? colors.error : tone === 'amber' ? colors.honey : colors.statusSuccess,
      minimumStock: safeThreshold > 0 ? formatQuantity(safeThreshold) : null,
    };
  }), [selectedWarehouse, summaryRows]);

  const loading = warehousesLoading || (summaryLoading && visibleItems.length === 0);
  const totalFilteredItems = pageInfo?.totalItems ?? visibleItems.length;
  const pageCount = Math.max(0, pageInfo?.totalPages ?? 0);
  const pageStart = (currentPage - 1) * INVENTORY_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + visibleItems.length, totalFilteredItems);
  const visibleForecast = forecastExpanded ? forecastItems : forecastItems.slice(0, 3);
  const lowStockCount = summaryTotals.belowMinimumCount;
  const activeError = warehouseError ?? summaryError;

  const sync = useCallback(() => {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }, [syncRotation]);

  const openItemAction = useCallback((item: InventoryCard) => {
    router.push(`/inventory-detail?itemId=${encodeURIComponent(item.itemId)}${item.type === 'THEO LÔ' && item.lotId ? `&lotId=${encodeURIComponent(item.lotId)}` : ''}&warehouseId=${encodeURIComponent(selectedWarehouse?.id ?? '')}` as never);
  }, [router, selectedWarehouse?.id]);

  const openNewDocument = useCallback((type: 'receipt' | 'issue') => {
    if (!selectedWarehouse?.id) {
      Alert.alert('Chưa chọn kho', 'Hãy chọn kho ở màn hình Tồn kho trước khi tạo phiếu.');
      return;
    }
    router.push(`/receipts/new?type=${type}&warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never);
  }, [router, selectedWarehouse?.id]);

  const renderInventoryItem = useCallback(
    ({ item }: { item: InventoryCard }) => <InventoryCardRow item={item} onPress={openItemAction} />,
    [openItemAction],
  );

  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };

  const listHeaderElement = (
    <View style={styles.listSectionGap}>
      <LinearGradient colors={[colors.surface, colors.surfaceContainerLow, colors.primaryFixed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inventoryHero}>
        <View style={styles.farmRow}>
          <View style={styles.heroCopy}>
            <View style={styles.farmBadge}>
              <Icon name="hive" size={14} color={colors.primary} filled />
              <Text style={styles.farmText} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.72}>{currentFarmName}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>Tồn kho Hiện trường & Lô hàng</Text>
            <Text style={styles.heroSubtitle} numberOfLines={2}>Giám sát hạn dùng & chuẩn bị mùa vụ mật</Text>
            <View style={styles.summary}>
              <Summary value={String(summaryTotals.stockedItemCount)} label="Mục tồn kho" />
              <Summary value={String(summaryTotals.lotItemCount)} label="Lô đang lưu" />
              <Summary value={formatQuantity(summaryTotals.totalQuantity)} label="Tổng số lượng" />
            </View>
          </View>
          <Image source={{ uri: honeyImage }} style={styles.heroImage} />
        </View>
      </LinearGradient>

      <View style={styles.warehouseRow}>
        <View style={styles.warehouseLabel}><Icon name="store" size={17} color={colors.primary} /><Text style={styles.warehouseTitle} numberOfLines={2}>Kho vật tư & thức ăn</Text></View>
        <Pill tone="success"><Text style={styles.online} numberOfLines={1}>{warehousesLoading || summaryLoading ? 'Đang tải' : activeError ? 'Không tải được' : 'Đã tải kho'}</Text></Pill>
      </View>
      <Pressable onPress={() => setWarehousePickerOpen(true)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.select, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Chọn kho tồn kho">
        <Text style={styles.selectText} numberOfLines={2}>{selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : warehousesLoading ? 'Đang tải kho...' : 'Chưa có kho trong trang trại'}</Text>
        <Icon name="expand-more" color={colors.onSurfaceVariant} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/inventory-ledger${selectedWarehouse ? `?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` : ''}` as never)} style={styles.ledgerEntry}>
        <View style={styles.ledgerEntryCopy}><Icon name="history" color={colors.primary} /><Text style={styles.ledgerEntryText}>Lịch sử biến động kho</Text></View>
        <Icon name="chevron-right" color={colors.primary} />
      </Pressable>
      <View style={styles.search}>
        <Icon name="search" color={colors.onSurfaceVariant} />
        <TextInput value={search} onChangeText={(value) => { setSearch(value); setCurrentPage(1); }} placeholder="Tìm kiếm vật tư, mã thiết bị, số lô..." placeholderTextColor={colors.onSurfaceVariant} style={styles.searchInput} />
        <Pressable onPress={() => router.push(`/scan${selectedWarehouse?.id ? `?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` : ''}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.barcodeButton, pressed && styles.pressed]} accessibilityLabel="Quét mã vạch">
          <Icon name="barcode-reader" color={colors.primary} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[{ label: 'TẤT CẢ', value: 'ALL' as const }, { label: 'THEO LÔ', value: 'LOT' as const }, { label: 'SỐ LƯỢNG', value: 'QUANTITY' as const }, { label: 'TÀI SẢN', value: 'ASSET' as const }].map((tab) => (
          <Pressable key={tab.value} onPress={() => { setFilter(tab.value); setCurrentPage(1); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
            <Pill tone={filter === tab.value ? 'amber' : 'neutral'}><Text numberOfLines={1} style={filter === tab.value ? styles.filterActive : styles.filterText}>{tab.label}</Text></Pill>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.inventoryStrip}>
        <View style={styles.inventoryStripCopy}><Icon name="inventory-2" size={16} color={colors.honey} /><Text style={styles.inventoryStripText}>Hiển thị: <Text style={styles.inventoryStripStrong}>{totalFilteredItems}</Text> danh mục vật tư</Text></View>
        <Pressable onPress={() => { setFilter('ALL'); setCurrentPage(1); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}><Icon name="filter-list" size={16} color={colors.primary} /><Text style={styles.sortText}>Sắp xếp</Text></Pressable>
      </View>
      {!warehousesLoading && selectedWarehouse && lowStockCount > 0 ? (
        <Pressable onPress={() => router.push(`/low-stock?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never)} accessibilityRole="button" accessibilityLabel={`Xem ${lowStockCount} vật tư dưới định mức`} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [pressed && styles.pressed]}>
          <Card style={styles.lowStockCard}>
            <View style={styles.lowStockHeader}>
              <View style={styles.lowStockIcon}><Icon name="warning-amber" color={colors.error} /></View>
              <View style={styles.lowStockHeaderCopy}>
                <Text style={styles.lowStockTitle}>Cảnh báo tồn dưới định mức</Text>
                <Text style={styles.lowStockSubtitle}>{lowStockCount} vật tư tại {selectedWarehouse.name} thấp hơn mức tối thiểu</Text>
              </View>
              <View style={styles.lowStockAction}><Text style={styles.lowStockActionText}>Chi tiết</Text><Icon name="chevron-right" size={18} color={colors.error} /></View>
            </View>
          </Card>
        </Pressable>
      ) : null}
      {!warehousesLoading && selectedWarehouse ? (
        <Card style={styles.forecastCard}>
          <View style={styles.forecastHeader}>
            <View style={styles.forecastHeaderCopy}>
              <Text style={styles.forecastEyebrow}>KHO {selectedWarehouse.code}</Text>
              <Text style={styles.forecastTitle}>Dự báo tồn kho</Text>
              <Text style={styles.forecastSubtitle}>Ước tính theo giao dịch xuất trong 30 ngày gần nhất</Text>
            </View>
            <View style={styles.forecastIcon}><Icon name="trending-down" color={colors.primary} /></View>
          </View>
          {forecastLoading && forecastItems.length === 0 ? <Text style={styles.forecastEmpty}>Đang tính từ lịch sử giao dịch...</Text>
            : forecastError ? <Text style={styles.forecastEmpty}>{forecastError}</Text>
              : visibleForecast.length === 0 ? <Text style={styles.forecastEmpty}>Chưa có giao dịch xuất đủ dữ liệu trong kho này để ước tính.</Text>
                : visibleForecast.map((forecast) => (
                  <Pressable key={forecast.itemId} onPress={() => router.push(`/inventory-detail?itemId=${encodeURIComponent(forecast.itemId)}&warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.forecastRow, pressed && styles.pressed]}>
                    <View style={styles.forecastItemCopy}>
                      <Text style={styles.forecastItemName} numberOfLines={1}>{forecast.name}</Text>
                      <Text style={styles.forecastItemMeta} numberOfLines={1}>{forecast.code} · xuất TB {formatQuantity(forecast.averageDailyOutflow)}{forecast.unit ? ` ${forecast.unit}` : ''}/ngày</Text>
                    </View>
                    <View style={styles.forecastEstimate}>
                      <Text style={styles.forecastDays}>{forecast.estimatedDaysRemaining < 1 ? '< 1' : formatQuantity(Math.floor(forecast.estimatedDaysRemaining))}</Text>
                      <Text style={styles.forecastDaysLabel}>ngày còn</Text>
                    </View>
                  </Pressable>
                ))}
          {!forecastError && forecastTotalItems > 3 ? (
            <Pressable onPress={() => setForecastExpanded((expanded) => !expanded)} accessibilityRole="button" style={styles.forecastToggle}>
              <Text style={styles.forecastToggleText}>{forecastExpanded ? 'Thu gọn' : `Xem tất cả ${forecastTotalItems} vật tư`}</Text>
              <Icon name={forecastExpanded ? 'expand-less' : 'expand-more'} size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.forecastNote}>Chỉ là ước tính tham khảo; phiếu nháp/chờ duyệt chưa làm thay đổi tồn kho.</Text>
        </Card>
      ) : null}
      <SectionTitle title="Danh mục vật tư" count={`${totalFilteredItems} danh mục`} />
    </View>
  );

  const listFooterElement = (
    <View style={styles.listFooterGap}>
      {!loading && visibleItems.length > 0 && pageCount > 0 ? (
        <View style={styles.pagination}>
          <Text style={styles.paginationSummary}>Vật phẩm {pageStart + 1}–{pageEnd} / {totalFilteredItems}</Text>
          <View style={styles.paginationControls}>
            <Pressable disabled={currentPage <= 1} onPress={() => setCurrentPage((page) => Math.max(1, page - 1))} accessibilityRole="button" accessibilityLabel="Trang trước" style={[styles.pageArrow, currentPage <= 1 && styles.pageDisabled]}>
              <Icon name="chevron-left" size={20} color={currentPage <= 1 ? colors.outline : colors.primary} />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.pageNumbers}>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <Pressable key={page} onPress={() => setCurrentPage(page)} accessibilityRole="button" accessibilityLabel={`Trang ${page}`} accessibilityState={{ selected: currentPage === page }} style={[styles.pageNumber, currentPage === page && styles.pageNumberActive]}>
                  <Text style={[styles.pageNumberText, currentPage === page && styles.pageNumberTextActive]}>{page}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable disabled={currentPage >= pageCount} onPress={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} accessibilityRole="button" accessibilityLabel="Trang sau" style={[styles.pageArrow, currentPage >= pageCount && styles.pageDisabled]}>
              <Icon name="chevron-right" size={20} color={currentPage >= pageCount ? colors.outline : colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.quickBar}>
        <Pressable onPress={() => openNewDocument('receipt')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}>
          <Icon name="input" color={colors.primary} /><Text style={styles.quickText}>+ Nhập kho</Text>
        </Pressable>
        <Pressable onPress={() => openNewDocument('issue')} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.quickButton, styles.quickPrimary, pressed && styles.pressed]}>
          <Icon name="output" color={colors.onPrimary} /><Text style={styles.quickPrimaryText}>− Xuất kho</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]} android_ripple={{ color: colors.primary }} onPress={() => router.push(`/scan${selectedWarehouse?.id ? `?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` : ''}` as never)}>
          <Icon name="qr-code-scanner" color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <AppShell active="inventory" scroll={false} scanWarehouseId={selectedWarehouse?.id}>
      <PageHeader
        title={currentFarmName}
        subtitle="● Giám sát hạn dùng & chuẩn bị mùa vụ mật"
        action={(
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]} accessibilityLabel="Đồng bộ tồn kho">
              <Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View>
            </Pressable>
          </View>
        )}
      />
      <FlatList
        data={activeError || loading ? [] : visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderInventoryItem}
        style={styles.flatList}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutterMobile,
          gap: spacing.spaceMd,
          paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg,
        }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Đang tải tồn kho...</Text>
          ) : (
            <Text style={styles.emptyText}>
              {activeError ?? (debouncedSearch || filter !== 'ALL' ? 'Không có vật tư phù hợp với bộ lọc.' : 'Farm hiện tại chưa có vật tư có tồn kho.')}
            </Text>
          )
        }
        ListFooterComponent={listFooterElement}
      />
      <Modal visible={warehousePickerOpen} transparent animationType="slide" onRequestClose={() => setWarehousePickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View><Text style={styles.pickerEyebrow}>KHO ĐANG XEM</Text><Text style={styles.pickerTitle}>Chọn kho tồn kho</Text></View>
              <Pressable onPress={() => setWarehousePickerOpen(false)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]} accessibilityLabel="Đóng chọn kho">
                <Icon name="close" color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {warehouses.map((warehouse) => {
                const selected = warehouse.id === selectedWarehouse?.id;
                return (
                  <Pressable key={warehouse.id} onPress={() => { setSelectedWarehouseId(warehouse.id); setCurrentPage(1); setForecastExpanded(false); setWarehousePickerOpen(false); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.warehouseOption, selected && styles.warehouseOptionActive, pressed && styles.pressed]}>
                    <View style={styles.warehouseOptionIcon}><Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={19} color={selected ? colors.primary : colors.outline} /></View>
                    <View style={styles.warehouseOptionCopy}><Text style={styles.warehouseOptionName}>{warehouse.code} - {warehouse.name}</Text><Text style={styles.warehouseOptionMeta}>{warehouse.status}</Text></View>
                    {selected ? <Icon name="check" size={18} color={colors.statusSuccess} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

function Summary({ value, label }: { value: string; label: string }) { return <View style={styles.summaryCell}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.summaryValue}>{value}</Text><Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.summaryLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  flatList: { flex: 1, marginHorizontal: -spacing.gutterMobile },
  listSectionGap: { gap: spacing.spaceMd },
  listFooterGap: { gap: spacing.spaceMd },
  ledgerEntry: { minHeight: 52, paddingHorizontal: spacing.spaceMd, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.spaceMd },
  ledgerEntryCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flex: 1 },
  ledgerEntryText: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.spaceSm },
  headerButton: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  inventoryHero: { marginHorizontal: -spacing.gutterMobile, paddingHorizontal: spacing.gutterMobile, paddingVertical: spacing.spaceMd, gap: spacing.spaceMd, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, overflow: 'hidden' },
  farmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceMd },
  heroCopy: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  heroTitle: { ...typography.headlineMd, color: colors.onSurface, flexShrink: 1 },
  heroSubtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  farmBadge: { minHeight: 28, maxWidth: '100%', alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceSm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  farmText: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1, minWidth: 0, lineHeight: 17 },
  heroImage: { width: 92, height: 92, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.outlineVariant },
  summary: { flexDirection: 'row', gap: spacing.spaceSm },
  summaryCell: { flex: 1, minWidth: 0, minHeight: 68, paddingHorizontal: spacing.spaceXs, paddingVertical: spacing.spaceXs, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, shadowColor: colors.deepAmber, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
  summaryValue: { ...typography.headlineSm, color: colors.primary, maxWidth: '100%', textAlign: 'center' },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, width: '100%', textAlign: 'center', lineHeight: 14 },
  warehouseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap' },
  warehouseLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  warehouseTitle: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  online: { ...typography.labelSm, color: colors.statusSuccess },
  select: { minHeight: 46, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  selectText: { ...typography.bodyMd, color: colors.onSurface, flex: 1, minWidth: 0, flexShrink: 1 },
  search: { height: 48, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, shadowColor: colors.deepAmber, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, color: colors.onSurface, ...typography.bodyMd },
  barcodeButton: { width: 38, height: 38, borderRadius: radius.default, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.spaceSm, paddingVertical: 2 },
  filterActive: { ...typography.labelSm, color: colors.deepAmber },
  filterText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  item: { marginBottom: spacing.spaceSm, gap: spacing.spaceMd, borderLeftWidth: 4, borderLeftColor: colors.honey, position: 'relative', overflow: 'hidden' },
  itemSuccess: { borderLeftColor: colors.statusSuccess },
  itemWarning: { borderLeftColor: colors.honey },
  itemDanger: { borderLeftColor: colors.error },
  itemTop: { zIndex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceMd },
  itemIcon: { width: 72, height: 72, flexShrink: 0, borderRadius: radius.lg, backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  itemImage: { width: '100%', height: '100%', borderRadius: radius.lg },
  itemCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.spaceXs, marginTop: 2 },
  itemStatus: { minWidth: 0, maxWidth: '100%', flexShrink: 1, alignSelf: 'flex-start' },
  itemCodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, minWidth: 0, flexWrap: 'wrap' },
  itemType: { ...typography.labelSm, color: colors.onSurfaceVariant, flexShrink: 1, textAlign: 'center' },
  itemCode: { ...typography.bodySm, color: colors.onSurfaceVariant, minWidth: 0, flexShrink: 1 },
  itemName: { ...typography.headlineSm, color: colors.deepAmber, marginTop: 3, minWidth: 0, flexShrink: 1 },
  location: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 0, flex: 1, minWidth: 0, flexShrink: 1 },
  success: { ...typography.labelSm, color: colors.statusSuccess },
  danger: { ...typography.labelSm, color: colors.error },
  amber: { ...typography.labelSm, color: colors.deepAmber },
  itemStats: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.spaceMd, padding: spacing.spaceMd, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant },
  statColumn: { flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 2 },
  statLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  statValue: { ...typography.bodyLg, color: colors.deepAmber, fontWeight: '700', marginTop: 3, flexShrink: 1 },
  statUnit: { ...typography.bodySm, color: colors.onSurfaceVariant, fontWeight: '400' },
  minimumText: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 2 },
  itemProgressTrack: { height: 5, width: '100%', marginTop: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.outlineVariant, overflow: 'hidden' },
  itemProgressFill: { height: '100%', borderRadius: radius.full },
  itemBottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  itemBottomText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0, flexShrink: 1 },
  itemAction: { ...typography.labelLg, color: colors.secondary, flexShrink: 1, textAlign: 'right' },
  quickBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm, padding: spacing.spaceSm, backgroundColor: colors.parchmentWarm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant },
  quickButton: { flex: 1, minWidth: 0, minHeight: 46, borderRadius: radius.default, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  quickPrimary: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  quickText: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
  quickPrimaryText: { ...typography.labelLg, color: colors.onPrimary, flexShrink: 1, textAlign: 'center' },
  qrButton: { width: 48, minHeight: 46, borderRadius: radius.default, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: 0, right: -3, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: radius.full, backgroundColor: colors.error, borderWidth: 1, borderColor: colors.parchment, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { ...typography.labelSm, color: colors.onPrimary, fontSize: 8, lineHeight: 11 },
  inventoryStrip: { minHeight: 36, marginHorizontal: -spacing.gutterMobile, paddingHorizontal: spacing.gutterMobile, paddingVertical: spacing.spaceXs, backgroundColor: colors.surfaceContainerLow, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  pagination: { marginTop: spacing.spaceSm, marginBottom: spacing.spaceSm, padding: spacing.spaceSm, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, gap: spacing.spaceXs },
  paginationSummary: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  pageArrow: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLowest },
  pageDisabled: { opacity: 0.45 },
  pageNumbers: { flexGrow: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs },
  pageNumber: { minWidth: 34, height: 34, paddingHorizontal: spacing.spaceXs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant },
  pageNumberActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  pageNumberText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  pageNumberTextActive: { color: colors.onPrimary },
  inventoryStripCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, flex: 1, minWidth: 0 },
  inventoryStripText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  inventoryStripStrong: { color: colors.onSurface, fontWeight: '700' },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  lowStockCard: { marginTop: spacing.spaceMd, marginBottom: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderWidth: 1, borderColor: colors.errorContainer, backgroundColor: colors.parchmentWarm },
  lowStockHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  lowStockIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.errorContainer, alignItems: 'center', justifyContent: 'center' },
  lowStockHeaderCopy: { flex: 1, minWidth: 0 },
  lowStockTitle: { ...typography.labelLg, color: colors.error },
  lowStockSubtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  lowStockAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  lowStockActionText: { ...typography.labelMd, color: colors.error },
  forecastCard: { marginTop: spacing.spaceMd, marginBottom: spacing.spaceMd, paddingVertical: spacing.spaceMd, borderColor: colors.outlineVariant, backgroundColor: colors.parchmentWarm },
  forecastHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, marginBottom: spacing.spaceSm },
  forecastHeaderCopy: { flex: 1, minWidth: 0 },
  forecastEyebrow: { ...typography.labelSm, color: colors.secondary },
  forecastTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  forecastSubtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  forecastIcon: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  forecastEmpty: { ...typography.bodySm, color: colors.onSurfaceVariant, paddingVertical: spacing.spaceSm },
  forecastRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  forecastItemCopy: { flex: 1, minWidth: 0 },
  forecastItemName: { ...typography.labelMd, color: colors.onSurface },
  forecastItemMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3 },
  forecastEstimate: { minWidth: 66, alignItems: 'flex-end' },
  forecastDays: { ...typography.labelLg, color: colors.error, fontSize: 16 },
  forecastDaysLabel: { ...typography.bodySm, color: colors.onSurfaceVariant },
  forecastToggle: { minHeight: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.spaceXs },
  forecastToggleText: { ...typography.labelMd, color: colors.primary },
  forecastNote: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, paddingVertical: 4 },
  sortText: { ...typography.labelMd, color: colors.primary },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  pickerSheet: { maxHeight: '72%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.spaceLg, gap: spacing.spaceSm, shadowColor: colors.deepAmber, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  pickerScroll: { flexGrow: 0 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd, marginBottom: spacing.spaceSm },
  pickerEyebrow: { ...typography.labelSm, color: colors.secondary },
  pickerTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  pickerClose: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  warehouseOption: { minHeight: 64, marginBottom: spacing.spaceSm, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  warehouseOptionActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  warehouseOptionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  warehouseOptionCopy: { flex: 1, minWidth: 0, gap: 2 },
  warehouseOptionName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  warehouseOptionMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
});

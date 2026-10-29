import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { balanceMatchesTrackingMode, calculateInventoryForecast, findLowStockItems, listBalances, listItems, listRecentInventoryTransactions, listWarehouses, type InventoryBalance, type InventoryTransaction, type Item, type Warehouse } from '@/src/features/inventory/api';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';

const honeyImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0ssHRhDE29HtefOBLT_h8b7BV0zqL9eroB8E2SN1qFZwHiwpMX8_0AZtEqjMFvv7fbZbNb1ICdPIeOFY3CmyCBpWvCWFxYL9jWzIypEtoqqXInBaTdjmvQrvw9lHpUFvTM2cE2-zR2aYkXx85HOsIf4akGkTtdRflbUJPHpuskzlQ12lMygdsXvSV-_B1IWrDlj7NXb8xt_gBSZVVFNnBTVBRGOC7Z6uIqQqWtsld7SWgOKoQruXavg';
const INVENTORY_PAGE_SIZE = 8;
type InventoryCard = {
  id: string;
  itemId: string;
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

export default function InventoryScreen() {
  const router = useRouter();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [filter, setFilter] = useState<'ALL' | 'LOT' | 'QUANTITY' | 'ASSET'>('ALL');
  const [search, setSearch] = useState('');
  const [warehouseIndex, setWarehouseIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const syncRotation = useRef(new Animated.Value(0)).current;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastExpanded, setForecastExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  useEffect(() => {
    if (!currentFarmId) {
      setWarehouses([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return Promise.all([listWarehouses(token, currentFarmId), listBalances(token, currentFarmId), listItems(token, currentFarmId)]);
      })
      .then(([warehouseResponse, balanceResponse, itemResponse]) => {
        if (!cancelled) {
          const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
          setWarehouses(farmWarehouses);
          setBalances(balanceResponse.data.filter(({ balance }) => balance.farmId === currentFarmId));
          setItems(itemResponse.data.filter((item) => item.farmId === currentFarmId));
          setWarehouseIndex(0);
          setWarehouseError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setWarehouseError(cause instanceof Error ? cause.message : 'Không thể tải danh sách kho.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce]);
  const selectedWarehouse = warehouses[warehouseIndex];
  useEffect(() => {
    if (!currentFarmId || !selectedWarehouse || selectedWarehouse.farmId !== currentFarmId) {
      setTransactions([]);
      return;
    }
    let cancelled = false;
    setForecastLoading(true);
    setForecastError(null);
    setTransactions([]);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listRecentInventoryTransactions(token, currentFarmId, selectedWarehouse.id);
      })
      .then((rows) => { if (!cancelled) setTransactions(rows); })
      .catch((cause: unknown) => {
        if (!cancelled) setForecastError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử xuất kho.');
      })
      .finally(() => { if (!cancelled) setForecastLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce, selectedWarehouse]);
  const lowStockItems = useMemo(
    () => currentFarmId && selectedWarehouse?.farmId === currentFarmId
      ? findLowStockItems(items, balances, currentFarmId, selectedWarehouse.id)
      : [],
    [balances, currentFarmId, items, selectedWarehouse],
  );
  const forecastItems = useMemo(
    () => currentFarmId && selectedWarehouse?.farmId === currentFarmId
      ? calculateInventoryForecast(transactions, balances, currentFarmId, selectedWarehouse.id)
      : [],
    [balances, currentFarmId, selectedWarehouse, transactions],
  );
  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';
  const visibleItems = useMemo<InventoryCard[]>(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const balanceByItem = new Map<string, { quantity: number; lotIds: Set<string>; lotNumbers: Set<string>; code: string; name: string; itemType: string; trackingMode: string; minStockLevel: number }>();
    balances
      .filter((entry) => Boolean(currentFarmId && selectedWarehouse?.farmId === currentFarmId)
        && entry.balance.farmId === currentFarmId
        && entry.balance.warehouseId === selectedWarehouse?.id
        && balanceMatchesTrackingMode(entry.balance, entry.trackingMode)
        && Number.isFinite(Number(entry.balance.quantityOnHand))
        && Number(entry.balance.quantityOnHand) > 0)
      .forEach((entry) => {
        const item = itemById.get(entry.balance.itemId);
        const current = balanceByItem.get(entry.balance.itemId) ?? {
          quantity: 0,
          lotIds: new Set<string>(),
          lotNumbers: new Set<string>(),
          code: entry.itemCode,
          name: entry.itemName,
          itemType: item?.unitSymbol || item?.unitName || entry.item?.unit?.symbol || entry.item?.unit?.name || entry.itemType,
          trackingMode: entry.trackingMode,
          minStockLevel: Number(item?.minStockLevel ?? 0),
        };
        const quantity = Number(entry.balance.quantityOnHand);
        current.quantity += Number.isNaN(quantity) ? 0 : quantity;
        if (entry.trackingMode === 'LOT' && entry.balance.lotId) {
          current.lotIds.add(entry.balance.lotId);
          const lotNumber = entry.lot?.lotNumber ?? entry.lotNumber;
          if (lotNumber) current.lotNumbers.add(lotNumber);
        }
        balanceByItem.set(entry.balance.itemId, current);
      });

    return [...balanceByItem.entries()]
      .map(([itemId, balance]) => {
        const quantity = balance.quantity;
        const lotId = balance.lotIds.size === 1 ? [...balance.lotIds][0] : null;
        const lotNumber = balance.lotIds.size === 1 ? [...balance.lotNumbers][0] : null;
        const threshold = Number.isFinite(balance.minStockLevel) ? balance.minStockLevel : 0;
        const ratio = threshold > 0 ? quantity / threshold : 1;
        const tone: InventoryCard['tone'] = threshold > 0 && ratio < 1 ? ratio <= 0.5 ? 'danger' : 'amber' : 'success';
        const type = balance.trackingMode === 'LOT' ? 'THEO LÔ' : balance.trackingMode === 'ASSET' ? 'TÀI SẢN' : 'SỐ LƯỢNG';
        return {
          id: itemId,
          itemId,
          lotId,
          code: balance.code,
          name: balance.name,
          type,
          location: selectedWarehouse
            ? quantity > 0 ? selectedWarehouse.name : `${selectedWarehouse.name} • Chưa có tồn`
            : 'Chưa chọn kho',
          quantity: formatQuantity(quantity),
          quantityValue: quantity,
          unit: balance.itemType || 'đơn vị',
          extra: lotId ? lotNumber || 'Chưa có mã lô' : balance.code,
          tone,
          progress: threshold > 0 ? Math.min(ratio, 1) : 1,
          progressColor: tone === 'danger' ? colors.error : tone === 'amber' ? colors.honey : colors.statusSuccess,
          minimumStock: threshold > 0 ? formatQuantity(threshold) : null,
        };
      })
      .filter((item) => item.quantityValue > 0)
      .filter((item) => (filter === 'ALL' || (filter === 'LOT' && item.type === 'THEO LÔ') || (filter === 'QUANTITY' && item.type === 'SỐ LƯỢNG') || (filter === 'ASSET' && item.type === 'TÀI SẢN')) && `${item.code} ${item.name} ${item.location}`.toLowerCase().includes(search.toLowerCase().trim()));
  }, [balances, currentFarmId, filter, items, search, selectedWarehouse]);
  const pageCount = Math.ceil(visibleItems.length / INVENTORY_PAGE_SIZE);
  const pageStart = (currentPage - 1) * INVENTORY_PAGE_SIZE;
  const pageItems = visibleItems.slice(pageStart, pageStart + INVENTORY_PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pageItems.length, visibleItems.length);
  useEffect(() => {
    setCurrentPage((page) => Math.max(1, Math.min(page, Math.max(1, pageCount))));
  }, [pageCount]);
  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }
  function openItemAction(item: InventoryCard) {
    router.push(`/inventory-detail?itemId=${encodeURIComponent(item.itemId)}${item.type === 'THEO LÔ' && item.lotId ? `&lotId=${encodeURIComponent(item.lotId)}` : ''}&warehouseId=${encodeURIComponent(selectedWarehouse?.id ?? '')}` as never);
  }
  function openNewDocument(type: 'receipt' | 'issue') {
    if (!selectedWarehouse?.id) {
      Alert.alert('Chưa chọn kho', 'Hãy chọn kho ở màn hình Tồn kho trước khi tạo phiếu.');
      return;
    }
    router.push(`/receipts/new?type=${type}&warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never);
  }
  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  return <AppShell active="inventory" showScrollIndicator scanWarehouseId={selectedWarehouse?.id}>
    <PageHeader title={currentFarmName} subtitle="● Giám sát hạn dùng & chuẩn bị mùa vụ mật" action={<View style={styles.headerActions}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]} accessibilityLabel="Đồng bộ tồn kho"><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
    <LinearGradient colors={[colors.surface, colors.surfaceContainerLow, colors.primaryFixed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inventoryHero}><View style={styles.farmRow}><View style={styles.heroCopy}><View style={styles.farmBadge}><Icon name="hive" size={14} color={colors.primary} filled /><Text style={styles.farmText} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.72}>{currentFarmName}</Text></View><Text style={styles.heroTitle} numberOfLines={2}>Tồn kho Hiện trường & Lô hàng</Text><Text style={styles.heroSubtitle} numberOfLines={2}>Giám sát hạn dùng & chuẩn bị mùa vụ mật</Text><View style={styles.summary}><Summary value={String(visibleItems.length)} label="Mục tồn kho" /><Summary value={String(visibleItems.filter((item) => item.type === 'THEO LÔ').length)} label="Lô đang lưu" /><Summary value={formatQuantity(visibleItems.reduce((total, item) => total + item.quantityValue, 0))} label="Tổng số lượng" /></View></View><Image source={{ uri: honeyImage }} style={styles.heroImage} /></View></LinearGradient>
    <View style={styles.warehouseRow}><View style={styles.warehouseLabel}><Icon name="store" size={17} color={colors.primary} /><Text style={styles.warehouseTitle} numberOfLines={2}>Kho vật tư & thức ăn</Text></View><Pill tone="success"><Text style={styles.online} numberOfLines={1}>{warehouseError ? 'Lỗi đồng bộ' : 'Online (API)'}</Text></Pill></View>
    <Pressable onPress={() => setWarehousePickerOpen(true)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.select, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Chọn kho tồn kho"><Text style={styles.selectText} numberOfLines={2}>{selectedWarehouse ? `${selectedWarehouse.code} - ${selectedWarehouse.name}` : loading ? 'Đang tải kho...' : 'Chưa có kho trong farm'}</Text><Icon name="expand-more" color={colors.onSurfaceVariant} /></Pressable>
    <View style={styles.search}><Icon name="search" color={colors.onSurfaceVariant} /><TextInput value={search} onChangeText={(value) => { setSearch(value); setCurrentPage(1); }} placeholder="Tìm kiếm vật tư, mã thiết bị, số lô..." placeholderTextColor={colors.onSurfaceVariant} style={styles.searchInput} /><Pressable onPress={() => router.push(`/scan${selectedWarehouse?.id ? `?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` : ''}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.barcodeButton, pressed && styles.pressed]} accessibilityLabel="Quét mã vạch"><Icon name="barcode-reader" color={colors.primary} /></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{[{ label: 'TẤT CẢ', value: 'ALL' as const }, { label: 'THEO LÔ', value: 'LOT' as const }, { label: 'SỐ LƯỢNG', value: 'QUANTITY' as const }, { label: 'TÀI SẢN', value: 'ASSET' as const }].map((tab) => <Pressable key={tab.value} onPress={() => { setFilter(tab.value); setCurrentPage(1); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}><Pill tone={filter === tab.value ? 'amber' : 'neutral'}><Text numberOfLines={1} style={filter === tab.value ? styles.filterActive : styles.filterText}>{tab.label}</Text></Pill></Pressable>)}</ScrollView>
    <View style={styles.inventoryStrip}><View style={styles.inventoryStripCopy}><Icon name="inventory-2" size={16} color={colors.honey} /><Text style={styles.inventoryStripText}>Hiển thị: <Text style={styles.inventoryStripStrong}>{visibleItems.length}</Text> danh mục vật tư</Text></View><Pressable onPress={() => setFilter('ALL')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}><Icon name="filter-list" size={16} color={colors.primary} /><Text style={styles.sortText}>Sắp xếp</Text></Pressable></View>
    {!loading && selectedWarehouse && lowStockItems.length > 0 ? <Pressable onPress={() => router.push(`/low-stock?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never)} accessibilityRole="button" accessibilityLabel={`Xem ${lowStockItems.length} vật tư dưới định mức`} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [pressed && styles.pressed]}><Card style={styles.lowStockCard}><View style={styles.lowStockHeader}><View style={styles.lowStockIcon}><Icon name="warning-amber" color={colors.error} /></View><View style={styles.lowStockHeaderCopy}><Text style={styles.lowStockTitle}>Cảnh báo tồn dưới định mức</Text><Text style={styles.lowStockSubtitle}>{lowStockItems.length} vật tư tại {selectedWarehouse.name} thấp hơn mức tối thiểu</Text></View><View style={styles.lowStockAction}><Text style={styles.lowStockActionText}>Chi tiết</Text><Icon name="chevron-right" size={18} color={colors.error} /></View></View></Card></Pressable> : null}
    {!loading && selectedWarehouse ? <Card style={styles.forecastCard}>
      <View style={styles.forecastHeader}><View style={styles.forecastHeaderCopy}><Text style={styles.forecastEyebrow}>KHO {selectedWarehouse.code}</Text><Text style={styles.forecastTitle}>Dự báo tồn kho</Text><Text style={styles.forecastSubtitle}>Ước tính theo giao dịch xuất trong 30 ngày gần nhất</Text></View><View style={styles.forecastIcon}><Icon name="trending-down" color={colors.primary} /></View></View>
      {forecastLoading ? <Text style={styles.forecastEmpty}>Đang tính từ lịch sử giao dịch...</Text>
        : forecastError ? <Text style={styles.forecastEmpty}>{forecastError}</Text>
          : forecastItems.length === 0 ? <Text style={styles.forecastEmpty}>Chưa có giao dịch xuất đủ dữ liệu trong kho này để ước tính.</Text>
            : (forecastExpanded ? forecastItems : forecastItems.slice(0, 3)).map((forecast) => <Pressable key={forecast.itemId} onPress={() => router.push(`/inventory-detail?itemId=${encodeURIComponent(forecast.itemId)}&warehouseId=${encodeURIComponent(selectedWarehouse.id)}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.forecastRow, pressed && styles.pressed]}>
              <View style={styles.forecastItemCopy}><Text style={styles.forecastItemName} numberOfLines={1}>{forecast.name}</Text><Text style={styles.forecastItemMeta} numberOfLines={1}>{forecast.code} · xuất TB {formatQuantity(forecast.averageDailyOutflow)}{forecast.unit ? ` ${forecast.unit}` : ''}/ngày</Text></View>
              <View style={styles.forecastEstimate}><Text style={styles.forecastDays}>{forecast.estimatedDaysRemaining < 1 ? '< 1' : formatQuantity(Math.floor(forecast.estimatedDaysRemaining))}</Text><Text style={styles.forecastDaysLabel}>ngày còn</Text></View>
            </Pressable>)}
      {!forecastLoading && !forecastError && forecastItems.length > 3 ? <Pressable onPress={() => setForecastExpanded((expanded) => !expanded)} accessibilityRole="button" style={styles.forecastToggle}><Text style={styles.forecastToggleText}>{forecastExpanded ? 'Thu gọn' : `Xem tất cả ${forecastItems.length} vật tư`}</Text><Icon name={forecastExpanded ? 'expand-less' : 'expand-more'} size={20} color={colors.primary} /></Pressable> : null}
      <Text style={styles.forecastNote}>Chỉ là ước tính tham khảo; phiếu nháp/chờ duyệt chưa làm thay đổi tồn kho.</Text>
    </Card> : null}
    <SectionTitle title="Danh mục vật tư" count={`${visibleItems.length} danh mục`} />
    {loading ? <Text style={styles.emptyText}>Đang tải tồn kho từ cơ sở dữ liệu...</Text> : visibleItems.length === 0 ? <Text style={styles.emptyText}>{warehouseError ?? 'Farm hiện tại chưa có vật tư có tồn kho.'}</Text> : pageItems.map((item) => <Pressable key={item.id} onPress={() => openItemAction(item)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}><Card style={[styles.item, item.tone === 'success' && styles.itemSuccess, item.tone === 'amber' && styles.itemWarning, item.tone === 'danger' && styles.itemDanger]}><HoneycombDecor tone={item.tone === 'danger' ? 'amber' : 'green'} /><View style={styles.itemTop}><View style={styles.itemIcon}><Icon name={item.type === 'TÀI SẢN' ? 'inventory-2' : item.type === 'THEO LÔ' ? 'hive' : 'grain'} size={27} color={colors.primary} /></View><View style={styles.itemCopy}><View style={styles.itemCodeRow}><Pill tone="cream"><Text style={styles.itemType} numberOfLines={1}>{item.type}</Text></Pill><Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text></View><Text style={styles.itemName} numberOfLines={3}>{item.name}</Text><View style={styles.itemMetaRow}><Text style={styles.location} numberOfLines={2}><Icon name="warehouse" size={13} color={colors.onSurfaceVariant} /> {item.location}</Text><View style={styles.itemStatus}><Pill tone={item.tone === 'success' ? 'success' : 'amber'}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={item.tone === 'success' ? styles.success : item.tone === 'danger' ? styles.danger : styles.amber}>{item.tone === 'success' ? 'Đủ định mức' : item.tone === 'danger' ? 'Tồn rất thấp' : 'Dưới định mức'}</Text></Pill></View></View></View></View><View style={styles.itemStats}><View style={styles.statColumn}><Text style={styles.statLabel} numberOfLines={2}>Tồn kho thực tế</Text><Text style={styles.statValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{item.quantity} <Text style={styles.statUnit}>{item.unit}</Text></Text>{item.minimumStock ? <Text style={styles.minimumText}>Định mức: {item.minimumStock} {item.unit}</Text> : null}<View style={styles.itemProgressTrack}><View style={[styles.itemProgressFill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: item.progressColor }]} /></View></View><View style={styles.statColumn}><Text style={styles.statLabel} numberOfLines={2}>{item.type === 'THEO LÔ' ? 'Mã lô' : 'Mã vật tư'}</Text><Text style={styles.statValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{item.extra}</Text></View></View><View style={styles.itemBottom}><Text style={styles.itemAction} numberOfLines={2}>Xem chi tiết tồn →</Text></View></Card></Pressable>)}
    {!loading && visibleItems.length > 0 ? <View style={styles.pagination}><Text style={styles.paginationSummary}>Vật phẩm {pageStart + 1}–{pageEnd} / {visibleItems.length}</Text><View style={styles.paginationControls}><Pressable disabled={currentPage <= 1} onPress={() => setCurrentPage((page) => Math.max(1, page - 1))} accessibilityRole="button" accessibilityLabel="Trang trước" style={[styles.pageArrow, currentPage <= 1 && styles.pageDisabled]}><Icon name="chevron-left" size={20} color={currentPage <= 1 ? colors.outline : colors.primary} /></Pressable><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.pageNumbers}>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <Pressable key={page} onPress={() => setCurrentPage(page)} accessibilityRole="button" accessibilityLabel={`Trang ${page}`} accessibilityState={{ selected: currentPage === page }} style={[styles.pageNumber, currentPage === page && styles.pageNumberActive]}><Text style={[styles.pageNumberText, currentPage === page && styles.pageNumberTextActive]}>{page}</Text></Pressable>)}</ScrollView><Pressable disabled={currentPage >= pageCount} onPress={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} accessibilityRole="button" accessibilityLabel="Trang sau" style={[styles.pageArrow, currentPage >= pageCount && styles.pageDisabled]}><Icon name="chevron-right" size={20} color={currentPage >= pageCount ? colors.outline : colors.primary} /></Pressable></View></View> : null}
    <View style={styles.quickBar}><Pressable onPress={() => openNewDocument('receipt')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}><Icon name="input" color={colors.primary} /><Text style={styles.quickText}>+ Nhập kho</Text></Pressable><Pressable onPress={() => openNewDocument('issue')} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.quickButton, styles.quickPrimary, pressed && styles.pressed]}><Icon name="output" color={colors.onPrimary} /><Text style={styles.quickPrimaryText}>− Xuất kho</Text></Pressable><Pressable style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]} android_ripple={{ color: colors.primary }} onPress={() => router.push(`/scan${selectedWarehouse?.id ? `?warehouseId=${encodeURIComponent(selectedWarehouse.id)}` : ''}` as never)}><Icon name="qr-code-scanner" color={colors.onPrimary} /></Pressable></View>
    <Modal visible={warehousePickerOpen} transparent animationType="slide" onRequestClose={() => setWarehousePickerOpen(false)}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}><View><Text style={styles.pickerEyebrow}>KHO ĐANG XEM</Text><Text style={styles.pickerTitle}>Chọn kho tồn kho</Text></View><Pressable onPress={() => setWarehousePickerOpen(false)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]} accessibilityLabel="Đóng chọn kho"><Icon name="close" color={colors.onSurfaceVariant} /></Pressable></View>
          {warehouses.map((warehouse, index) => <Pressable key={warehouse.id} onPress={() => { setWarehouseIndex(index); setCurrentPage(1); setWarehousePickerOpen(false); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.warehouseOption, warehouseIndex === index && styles.warehouseOptionActive, pressed && styles.pressed]}><View style={styles.warehouseOptionIcon}><Icon name={warehouseIndex === index ? 'radio-button-checked' : 'radio-button-unchecked'} size={19} color={warehouseIndex === index ? colors.primary : colors.outline} /></View><View style={styles.warehouseOptionCopy}><Text style={styles.warehouseOptionName}>{warehouse.code} - {warehouse.name}</Text><Text style={styles.warehouseOptionMeta}>{warehouse.status}</Text></View>{warehouseIndex === index ? <Icon name="check" size={18} color={colors.statusSuccess} /> : null}</Pressable>)}
        </View>
      </View>
    </Modal>
  </AppShell>;
}

function Summary({ value, label }: { value: string; label: string }) { return <View style={styles.summaryCell}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={styles.summaryValue}>{value}</Text><Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.summaryLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
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
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.spaceLg, gap: spacing.spaceSm, shadowColor: colors.deepAmber, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd, marginBottom: spacing.spaceSm },
  pickerEyebrow: { ...typography.labelSm, color: colors.secondary },
  pickerTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  pickerClose: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  warehouseOption: { minHeight: 64, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  warehouseOptionActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  warehouseOptionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  warehouseOptionCopy: { flex: 1, minWidth: 0, gap: 2 },
  warehouseOptionName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  warehouseOptionMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
});

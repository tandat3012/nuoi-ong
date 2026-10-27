import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { filterAvailableAssetsForScope, filterPositiveBalancesForScope, listAvailableAssets, listItems, listWarehouses, type InventoryBalance, type Item, type Warehouse } from '@/src/features/inventory/api';

export default function InventoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string; lotId?: string; warehouseId?: string; id?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const itemId = typeof params.itemId === 'string' ? params.itemId : undefined;
  const routeLotId = typeof params.lotId === 'string' ? params.lotId : typeof params.id === 'string' ? params.id : undefined;
  const routeWarehouseId = typeof params.warehouseId === 'string' ? params.warehouseId : undefined;
  const [item, setItem] = useState<Item | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [hasAvailableAsset, setHasAvailableAsset] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(routeWarehouseId || null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lotId = item?.trackingMode === 'LOT' ? routeLotId : undefined;

  useEffect(() => {
    if (!currentFarmId || (!itemId && !lotId)) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWarehouses([]);
    setSelectedWarehouseId(null);
    setBalances([]);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listItems(token, currentFarmId),
        listWarehouses(token, currentFarmId),
      ]);
    }).then(([itemResponse, warehouseResponse]) => {
      if (cancelled) return;
      setItem(itemResponse.data.find((candidate) => candidate.id === itemId) ?? null);
      const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
      setWarehouses(farmWarehouses);
      setSelectedWarehouseId((current) => {
        if (routeWarehouseId) return farmWarehouses.some((warehouse) => warehouse.id === routeWarehouseId) ? routeWarehouseId : null;
        if (current && farmWarehouses.some((warehouse) => warehouse.id === current)) return current;
        return farmWarehouses[0]?.id ?? null;
      });
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết tồn kho.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, itemId, lotId, routeWarehouseId]);

  useEffect(() => {
    if (!currentFarmId || !selectedWarehouseId || !warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setBalances([]);
      setHasAvailableAsset(false);
      setBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    setBalances([]);
    setHasAvailableAsset(false);
    setError(null);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const balanceRequest = apiRequest<{ data: InventoryBalance[] }>('/inventory', {
        token,
        params: { farmId: currentFarmId, warehouseId: selectedWarehouseId, itemId, lotId },
        skipCache: true,
      });
      const assetRequest = item?.trackingMode === 'ASSET'
        ? listAvailableAssets(token, currentFarmId, selectedWarehouseId)
        : Promise.resolve(null);
      return Promise.all([balanceRequest, assetRequest]);
    }).then(([response, assetResponse]) => {
      if (!cancelled) {
        setBalances(filterPositiveBalancesForScope(response.data, currentFarmId, selectedWarehouseId)
          .filter(({ balance }) => (!itemId || balance.itemId === itemId)
            && (!lotId || balance.lotId === lotId)));
        setHasAvailableAsset(Boolean(assetResponse && filterAvailableAssetsForScope(assetResponse, currentFarmId, selectedWarehouseId)
          .some(({ asset }) => asset.itemId === itemId)));
      }
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải số dư của kho đã chọn.');
    }).finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, item?.trackingMode, itemId, lotId, selectedWarehouseId, warehouses]);

  const warehouseById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const totalQuantity = balances.reduce((total, entry) => total + Number(entry.balance.quantityOnHand || 0), 0);
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';
  const trackingLabel = item?.trackingMode === 'LOT' ? 'THEO LÔ' : item?.trackingMode === 'ASSET' ? 'TÀI SẢN' : 'SỐ LƯỢNG';
  const canIssueOrTransfer = item?.trackingMode === 'ASSET' ? hasAvailableAsset : balances.length > 0;

  return <AppShell active="inventory">
    <PageHeader title={farmName} subtitle="● Trực tuyến • Dữ liệu tồn kho" onBack={() => router.back()} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={() => Alert.alert('Đồng bộ', 'Dữ liệu đang được đồng bộ.')} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Icon name="sync" color={colors.primary} /></Pressable></View>} />
    <View style={styles.breadcrumb}><Text style={styles.crumbMuted}>Tồn kho</Text><Icon name="chevron-right" size={16} color={colors.outline} /><Text style={styles.crumbStrong}>Chi tiết tồn kho</Text><Pill tone="amber"><Text style={styles.track}>{trackingLabel}</Text></Pill></View>
    <View style={styles.warehouseSelect}><View style={styles.warehouseSelectCopy}><Text style={styles.warehouseSelectLabel}>KHO ĐANG XEM</Text><Text style={styles.warehouseSelectValue}>{selectedWarehouse ? `${selectedWarehouse.code} • ${selectedWarehouse.name}` : loading ? 'Đang tải kho...' : 'Chưa xác định kho từ màn hình tồn kho'}</Text></View></View>
    {loading || balanceLoading ? <Text style={styles.message}>Đang tải chi tiết từ DB theo kho đã chọn...</Text> : error ? <Text style={styles.error}>{error}</Text> : <>
      <Card style={styles.productCard}><HoneycombDecor muted size={46} /><View style={styles.productHead}><View style={styles.productIcon}><Icon name={trackingLabel === 'TÀI SẢN' ? 'inventory-2' : trackingLabel === 'THEO LÔ' ? 'hive' : 'grain'} size={34} color={colors.primary} /></View><View style={styles.productCopy}><Pill tone={totalQuantity > 0 ? 'success' : 'amber'}><Text style={styles.status}>{totalQuantity > 0 ? '● Đang lưu kho tại kho này' : '● Chưa có tồn tại kho này'}</Text></Pill><Text style={styles.productTitle}>{item?.name ?? 'Vật tư không còn trong danh mục'}</Text><View style={styles.codeBox}><Text style={styles.codeLabel}>Mã vật tư</Text><Text style={styles.codeValue}>{item?.code ?? itemId ?? 'Chưa có mã'}</Text></View></View></View><View style={styles.metaRow}><Text style={styles.metaText}>Theo dõi: {trackingLabel}</Text><Text style={styles.metaBullet}>•</Text><Text style={styles.metaText}>Tồn kho này: {formatQuantity(totalQuantity)} {item?.unitSymbol ?? item?.unitName ?? item?.itemType ?? 'đơn vị'}</Text></View>{lotId ? <Text style={styles.lotText}>Mã lô: {lotId}</Text> : null}</Card>
      <Card style={styles.storageCard}><View style={styles.storageHeader}><Icon name="warehouse" color={colors.primary} /><Text style={styles.storageTitle}>Tồn kho & vị trí lưu trữ</Text><Pill tone={balances.length > 0 ? 'success' : 'amber'}><Text style={styles.status}>{balances.length > 0 ? 'Có dữ liệu DB' : 'Chưa có tồn'}</Text></Pill></View>{balances.length === 0 ? <Text style={styles.message}>{selectedWarehouse ? `Kho ${selectedWarehouse.name} chưa có số dư dương cho vật tư này.` : 'Chưa xác định được kho đang xem.'}</Text> : balances.map((entry) => <View key={entry.balance.id} style={styles.location}><View style={styles.locationCopy}><Text style={styles.locationName}>{warehouseById.get(entry.balance.warehouseId)?.name ?? 'Kho không xác định'}</Text><Text style={styles.locationMeta}>{warehouseById.get(entry.balance.warehouseId)?.code ?? entry.balance.warehouseId}</Text></View><Text style={styles.locationValue}>{formatQuantity(entry.balance.quantityOnHand)} {item?.unitSymbol ?? item?.unitName ?? item?.itemType ?? 'đơn vị'}</Text></View>)}</Card>
      <SectionTitle title="Thông tin chi tiết" /><Card style={styles.infoCard}><Info label="Trạng thái danh mục" value={item?.status ?? 'Chưa có dữ liệu'} /><Info label="Mã vật tư" value={item?.code ?? itemId ?? 'Chưa có dữ liệu'} /><Info label="Farm hiện tại" value={farmName} /></Card>
      <View style={styles.actions}>
        <View style={styles.action}><PrimaryButton label="Tạo phiếu nhập" icon="input" onPress={() => openDocument('receipt')} /></View>
        {canIssueOrTransfer ? <View style={styles.action}><PrimaryButton label="Tạo phiếu xuất" icon="output" onPress={() => openDocument('issue')} /></View> : null}
        {canIssueOrTransfer ? <View style={styles.action}><PrimaryButton label="Điều chuyển kho" icon="swap-horiz" onPress={() => openDocument('transfer')} /></View> : null}
        {!canIssueOrTransfer && !balanceLoading ? <Text style={styles.noStockNotice}>Chưa có tồn dương tại kho này; chỉ có thể tạo phiếu nhập.</Text> : null}
      </View>
    </>}
  </AppShell>;

  function openDocument(type: 'receipt' | 'issue' | 'transfer') {
    if (!selectedWarehouseId) {
      Alert.alert('Chưa chọn kho', 'Chọn một kho thuộc farm hiện tại trước khi tạo phiếu.');
      return;
    }
    const scopedItemId = encodeURIComponent(item?.id ?? itemId ?? '');
    const scopedLot = lotId ? `&lotId=${encodeURIComponent(lotId)}` : '';
    if (type === 'transfer') {
      router.push(`/transfers/new?itemId=${scopedItemId}&sourceWarehouseId=${encodeURIComponent(selectedWarehouseId)}${scopedLot}` as never);
      return;
    }
    router.push(`/receipts/new?type=${type}&itemId=${scopedItemId}&warehouseId=${encodeURIComponent(selectedWarehouseId)}${scopedLot}` as never);
  }
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  warehouseSelect: { minHeight: 52, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  warehouseSelectCopy: { flex: 1, minWidth: 0, gap: 2 },
  warehouseSelectLabel: { ...typography.labelSm, color: colors.deepAmber },
  warehouseSelectValue: { ...typography.bodyMd, color: colors.onSurface, flexShrink: 1 },
  headerButton: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, flexWrap: 'wrap' },
  crumbMuted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  crumbStrong: { ...typography.labelLg, color: colors.deepAmber },
  track: { ...typography.labelSm, color: colors.deepAmber },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  error: { ...typography.bodySm, color: colors.error, backgroundColor: colors.errorContainer, borderRadius: radius.default, padding: spacing.spaceMd },
  productCard: { gap: spacing.spaceMd, position: 'relative', overflow: 'hidden' },
  productHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceMd },
  productIcon: { width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, minWidth: 0, gap: spacing.spaceSm },
  status: { ...typography.labelSm, color: colors.statusSuccess, flexShrink: 1 },
  productTitle: { ...typography.headlineMd, color: colors.deepAmber, flexShrink: 1 },
  codeBox: { minHeight: 32, paddingHorizontal: spacing.spaceSm, paddingVertical: 6, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm },
  codeLabel: { ...typography.bodySm, color: colors.onSurfaceVariant },
  codeValue: { ...typography.labelSm, color: colors.deepAmber, flex: 1, minWidth: 0, textAlign: 'right' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  metaText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  metaBullet: { ...typography.bodySm, color: colors.outline },
  lotText: { ...typography.bodySm, color: colors.secondary, flexShrink: 1 },
  storageCard: { gap: spacing.spaceMd },
  storageHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.spaceSm },
  storageTitle: { ...typography.headlineSm, color: colors.deepAmber, flex: 1, minWidth: 0 },
  location: { padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  locationCopy: { flex: 1, minWidth: 0 },
  locationName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  locationMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  locationValue: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1, textAlign: 'right' },
  infoCard: { gap: spacing.spaceSm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  infoLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0 },
  infoValue: { ...typography.labelMd, color: colors.onSurface, flex: 1, minWidth: 0, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.spaceSm, flexWrap: 'wrap' },
  action: { flex: 1, minWidth: 150 },
  noStockNotice: { ...typography.bodySm, color: colors.onSurfaceVariant, flexBasis: '100%', textAlign: 'center', padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
});

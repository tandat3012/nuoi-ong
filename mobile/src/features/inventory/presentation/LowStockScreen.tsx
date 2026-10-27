import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { findLowStockItems, listBalances, listItems, listWarehouses, type Item, type LowStockItem, type Warehouse } from '@/src/features/inventory/api';
import { AppShell, Card, Icon, PageHeader, SectionTitle } from '@/src/shared/ui/MobileShell';
import { MobileApiError } from '@/src/shared/api/client';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';

export default function LowStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ warehouseId?: string | string[] }>();
  const requestedWarehouseId = Array.isArray(params.warehouseId) ? params.warehouseId[0] : params.warehouseId;
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<Awaited<ReturnType<typeof listBalances>>['data']>([]);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!currentFarmId || !requestedWarehouseId) {
      setLoading(false);
      setError('Thiếu trang trại hoặc kho cần xem cảnh báo.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return Promise.all([
          listWarehouses(token, currentFarmId),
          listBalances(token, currentFarmId),
          listItems(token, currentFarmId),
        ]);
      })
      .then(([warehouseResponse, balanceResponse, itemResponse]) => {
        if (cancelled) return;
        const selected = warehouseResponse.data.find((entry) =>
          entry.id === requestedWarehouseId && entry.farmId === currentFarmId,
        );
        if (!selected) {
          setError('Kho không thuộc trang trại đang chọn hoặc không còn hoạt động.');
          setWarehouse(null);
          setItems([]);
          setBalances([]);
          return;
        }
        setWarehouse(selected);
        setItems(itemResponse.data.filter((item) => item.farmId === currentFarmId));
        setBalances(balanceResponse.data.filter(({ balance }) => balance.farmId === currentFarmId));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải cảnh báo tồn kho.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce, requestedWarehouseId]);

  const alerts: LowStockItem[] = useMemo(() => currentFarmId && warehouse
    ? findLowStockItems(items, balances, currentFarmId, warehouse.id)
    : [], [balances, currentFarmId, items, warehouse]);
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? 'Trang trại';

  function openItem(item: Item) {
    if (!warehouse) return;
    router.push(`/inventory-detail?itemId=${encodeURIComponent(item.id)}&warehouseId=${encodeURIComponent(warehouse.id)}` as never);
  }

  return (
    <AppShell active="inventory">
      <PageHeader
        title="Vật tư dưới định mức"
        subtitle={`${farmName}${warehouse ? ` · ${warehouse.name}` : ''}`}
        onBack={() => router.back()}
        action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={() => setReloadNonce((value) => value + 1)} accessibilityRole="button" accessibilityLabel="Tải lại cảnh báo" style={styles.reload}><Icon name="sync" color={colors.primary} /></Pressable></View>}
      />
      <Card style={styles.overview}>
        <View style={styles.overviewIcon}><Icon name="warning-amber" size={22} color={colors.error} /></View>
        <View style={styles.overviewCopy}>
          <Text style={styles.overviewTitle}>{loading ? 'Đang kiểm tra tồn kho' : `${alerts.length} vật tư dưới định mức`}</Text>
          <Text style={styles.overviewSubtitle}>{warehouse ? `${warehouse.code} · ${warehouse.name}` : 'Kho thuộc farm đang chọn'}</Text>
        </View>
      </Card>
      <SectionTitle title="Danh sách cảnh báo" count={`${alerts.length} vật tư`} />
      {loading ? <Text style={styles.stateText}>Đang tải tồn kho và định mức...</Text> : error ? (
        <Card style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setReloadNonce((value) => value + 1)} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable></Card>
      ) : alerts.length === 0 ? (
        <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Icon name="check-circle" size={28} color={colors.statusSuccess} /></View><Text style={styles.emptyTitle}>Kho đang đạt định mức</Text><Text style={styles.emptyText}>Không có vật tư nào thấp hơn mức tối thiểu tại kho này.</Text></Card>
      ) : alerts.map((item) => (
        <Pressable key={item.id} onPress={() => openItem(item)} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name} tại ${warehouse?.name}`} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [pressed && styles.pressed]}>
          <Card style={styles.itemCard}>
            <View style={styles.itemIcon}><Icon name={item.trackingMode === 'ASSET' ? 'inventory-2' : item.trackingMode === 'LOT' ? 'hive' : 'grain'} size={21} color={colors.primary} /></View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemCode}>{item.code}</Text>
              <Text style={styles.itemMeta}>{item.categoryName ?? 'Vật tư'} · {item.trackingMode === 'LOT' ? 'Theo lô' : item.trackingMode === 'ASSET' ? 'Tài sản' : 'Số lượng'}</Text>
            </View>
            <View style={styles.quantityCopy}>
              <Text style={styles.quantity}>{formatQuantity(item.quantityOnHand)} / {formatQuantity(Number(item.minStockLevel ?? 0))}</Text>
              <Text style={styles.unit}>{item.unitSymbol ?? item.unitName ?? 'đơn vị'}</Text>
              <Icon name="chevron-right" size={18} color={colors.outline} />
            </View>
          </Card>
        </Pressable>
      ))}
      <Text style={styles.footerHint}>Số tồn được tính riêng cho kho đang chọn. Chạm vào vật tư để mở chi tiết.</Text>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  reload: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surfaceContainer },
  overview: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, borderColor: colors.errorContainer, backgroundColor: colors.parchmentWarm },
  overviewIcon: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer },
  overviewCopy: { flex: 1, minWidth: 0 },
  overviewTitle: { ...typography.labelLg, color: colors.error },
  overviewSubtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  stateText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  errorCard: { borderColor: colors.errorContainer },
  errorText: { ...typography.bodyMd, color: colors.error },
  retry: { alignSelf: 'flex-start', marginTop: spacing.spaceSm, paddingVertical: spacing.spaceSm, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, backgroundColor: colors.primaryContainer },
  retryText: { ...typography.labelMd, color: colors.onPrimary },
  emptyCard: { alignItems: 'center', gap: spacing.spaceSm, paddingVertical: spacing.spaceLg },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.statusSuccessSurface },
  emptyTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, textAlign: 'center' },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, padding: spacing.spaceSm, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.errorContainer },
  itemIcon: { width: 42, height: 42, borderRadius: radius.default, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryFixed },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { ...typography.labelLg, color: colors.onSurface },
  itemCode: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
  itemMeta: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 3 },
  quantityCopy: { minWidth: 70, alignItems: 'flex-end', gap: 1 },
  quantity: { ...typography.labelMd, color: colors.error, textAlign: 'right' },
  unit: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'right' },
  footerHint: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceMd },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

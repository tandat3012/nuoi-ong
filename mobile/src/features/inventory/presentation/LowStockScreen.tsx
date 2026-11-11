import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listInventorySummaryPage, listWarehouses, type InventorySummaryRow, type Warehouse } from '@/src/features/inventory/api';
import { AppShell, Card, Icon, PageHeader, SectionTitle } from '@/src/shared/ui/MobileShell';
import { clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';

const LOW_STOCK_PAGE_SIZE = 20;

const LowStockRowCard = memo(function LowStockRowCard({
  item,
  warehouseName,
  onPress,
}: {
  item: InventorySummaryRow;
  warehouseName?: string;
  onPress: (row: InventorySummaryRow) => void;
}) {
  const thumbUrl = toThumbnailUrl(item.itemImageUrl, 128);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết ${item.itemName}${warehouseName ? ` tại ${warehouseName}` : ''}`}
      android_ripple={{ color: colors.primaryFixed }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.itemCard}>
        <View style={styles.itemIcon}>
          {thumbUrl
            ? <Image source={{ uri: thumbUrl }} style={styles.itemImage} resizeMode="cover" />
            : <Icon name={item.trackingMode === 'ASSET' ? 'inventory-2' : item.trackingMode === 'LOT' ? 'hive' : 'grain'} size={21} color={colors.primary} />}
        </View>
        <View style={styles.itemCopy}>
          <Text style={styles.itemName} numberOfLines={2}>{item.itemName}</Text>
          <Text style={styles.itemCode}>{item.itemCode}</Text>
          <Text style={styles.itemMeta}>
            {item.categoryName ?? 'Vật tư'} · {item.trackingMode === 'LOT' ? 'Theo lô' : item.trackingMode === 'ASSET' ? 'Tài sản' : 'Số lượng'}
          </Text>
        </View>
        <View style={styles.quantityCopy}>
          <Text style={styles.quantity}>
            {formatQuantity(item.quantityOnHand)} / {formatQuantity(Number(item.minStockLevel ?? 0))}
          </Text>
          <Text style={styles.unit}>{item.unitSymbol ?? item.unitName ?? 'đơn vị'}</Text>
          <Icon name="chevron-right" size={18} color={colors.outline} />
        </View>
      </Card>
    </Pressable>
  );
});

export default function LowStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ warehouseId?: string | string[] }>();
  const requestedWarehouseId = Array.isArray(params.warehouseId) ? params.warehouseId[0] : params.warehouseId;
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [alerts, setAlerts] = useState<InventorySummaryRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    setLoadingMore(false);

    if (!currentFarmId || !requestedWarehouseId) {
      setWarehouse(null);
      setAlerts([]);
      setTotalItems(0);
      setPage(1);
      setTotalPages(0);
      setLoading(false);
      setError('Thiếu trang trại hoặc kho cần xem cảnh báo.');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setAlerts([]);
    setPage(1);
    setTotalPages(0);

    void getAccessToken()
      .then(async (token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const warehouseResponse = await listWarehouses(token, currentFarmId, false, controller.signal);
        const selected = warehouseResponse.data.find(
          (entry) => entry.id === requestedWarehouseId && entry.farmId === currentFarmId,
        );
        if (!selected) {
          return { selected: null, summaryResponse: null };
        }
        const summaryResponse = await listInventorySummaryPage(
          token,
          currentFarmId,
          {
            warehouseId: selected.id,
            lowStockOnly: true,
            page: 1,
            pageSize: LOW_STOCK_PAGE_SIZE,
            skipCache: reloadNonce > 0,
          },
          controller.signal,
        );
        return { selected, summaryResponse };
      })
      .then(({ selected, summaryResponse }) => {
        if (cancelled) return;
        if (!selected || !summaryResponse) {
          setError('Kho không thuộc trang trại đang chọn hoặc không còn hoạt động.');
          setWarehouse(null);
          setAlerts([]);
          setTotalItems(0);
          setTotalPages(0);
          return;
        }
        setWarehouse(selected);
        setAlerts(summaryResponse.data);
        setTotalItems(summaryResponse.page.totalItems);
        setPage(1);
        setTotalPages(summaryResponse.page.totalPages);
      })
      .catch((cause: unknown) => {
        if (cancelled || isAbortError(cause)) return;
        setError(cause instanceof Error ? cause.message : 'Không thể tải cảnh báo tồn kho.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [currentFarmId, getAccessToken, reloadNonce, requestedWarehouseId]);

  const loadMore = useCallback(() => {
    if (!currentFarmId || !warehouse || loading || loadingMore || page >= totalPages) return;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    const nextPage = page + 1;
    setLoadingMore(true);

    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listInventorySummaryPage(
          token,
          currentFarmId,
          {
            warehouseId: warehouse.id,
            lowStockOnly: true,
            page: nextPage,
            pageSize: LOW_STOCK_PAGE_SIZE,
            skipCache: reloadNonce > 0,
          },
          controller.signal,
        );
      })
      .then((response) => {
        if (loadMoreControllerRef.current !== controller) return;
        setAlerts((current) => {
          const existing = new Set(current.map((entry) => entry.itemId));
          const merged = [...current];
          for (const row of response.data) {
            if (!existing.has(row.itemId)) merged.push(row);
          }
          return merged;
        });
        setTotalItems(response.page.totalItems);
        setPage(nextPage);
        setTotalPages(response.page.totalPages);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(cause instanceof Error ? cause.message : 'Không thể tải thêm cảnh báo tồn kho.');
      })
      .finally(() => {
        if (loadMoreControllerRef.current === controller) {
          loadMoreControllerRef.current = null;
          setLoadingMore(false);
        }
      });
  }, [currentFarmId, getAccessToken, loading, loadingMore, page, reloadNonce, totalPages, warehouse]);

  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? 'Trang trại';

  const openItem = useCallback((item: InventorySummaryRow) => {
    if (!warehouse) return;
    router.push(`/inventory-detail?itemId=${encodeURIComponent(item.itemId)}&warehouseId=${encodeURIComponent(warehouse.id)}` as never);
  }, [router, warehouse]);

  const renderItem = useCallback(
    ({ item }: { item: InventorySummaryRow }) => (
      <LowStockRowCard item={item} warehouseName={warehouse?.name} onPress={openItem} />
    ),
    [openItem, warehouse?.name],
  );

  const listHeaderElement = (
    <View style={styles.sectionGap}>
      <Card style={styles.overview}>
        <View style={styles.overviewIcon}><Icon name="warning-amber" size={22} color={colors.error} /></View>
        <View style={styles.overviewCopy}>
          <Text style={styles.overviewTitle}>{loading ? 'Đang kiểm tra tồn kho' : `${totalItems} vật tư dưới định mức`}</Text>
          <Text style={styles.overviewSubtitle}>{warehouse ? `${warehouse.code} · ${warehouse.name}` : 'Kho thuộc trang trại đang chọn'}</Text>
        </View>
      </Card>
      <SectionTitle title="Danh sách cảnh báo" count={`${totalItems} vật tư`} />
    </View>
  );

  const listFooterElement = (
    <View style={styles.footerWrap}>
      {!loading && !error && page < totalPages ? (
        <Pressable
          accessibilityRole="button"
          onPress={loadMore}
          disabled={loadingMore}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
        >
          <Text style={styles.loadMoreText}>
            {loadingMore ? 'Đang tải thêm...' : `Tải thêm (${alerts.length}/${totalItems})`}
          </Text>
        </Pressable>
      ) : null}
      <Text style={styles.footerHint}>Số tồn được tính riêng cho kho đang chọn. Chạm vào vật tư để mở chi tiết.</Text>
    </View>
  );

  return (
    <AppShell active="inventory" scroll={false}>
      <PageHeader
        title="Vật tư dưới định mức"
        subtitle={`${farmName}${warehouse ? ` · ${warehouse.name}` : ''}`}
        onBack={() => router.back()}
        action={(
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell />
            <Pressable
              onPress={() => {
                clearApiCache();
                setReloadNonce((value) => value + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel="Tải lại cảnh báo"
              style={styles.reload}
            >
              <Icon name="sync" color={colors.primary} />
            </Pressable>
          </View>
        )}
      />
      <FlatList
        data={loading || error ? [] : alerts}
        keyExtractor={(item) => item.itemId}
        renderItem={renderItem}
        style={styles.flatList}
        contentContainerStyle={{
          paddingHorizontal: spacing.gutterMobile,
          gap: spacing.spaceSm,
          paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg,
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.stateText}>Đang tải tồn kho và định mức...</Text>
          ) : error ? (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => setReloadNonce((value) => value + 1)} style={styles.retry}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Icon name="check-circle" size={28} color={colors.statusSuccess} /></View>
              <Text style={styles.emptyTitle}>Kho đang đạt định mức</Text>
              <Text style={styles.emptyText}>Không có vật tư nào thấp hơn mức tối thiểu tại kho này.</Text>
            </Card>
          )
        }
        ListFooterComponent={listFooterElement}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flatList: { flex: 1, marginHorizontal: -spacing.gutterMobile },
  sectionGap: { gap: spacing.spaceMd, marginBottom: spacing.spaceXs },
  footerWrap: { gap: spacing.spaceSm, paddingTop: spacing.spaceXs },
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
  itemImage: { width: 42, height: 42, borderRadius: radius.default },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { ...typography.labelLg, color: colors.onSurface },
  itemCode: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
  itemMeta: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 3 },
  quantityCopy: { minWidth: 70, alignItems: 'flex-end', gap: 1 },
  quantity: { ...typography.labelMd, color: colors.error, textAlign: 'right' },
  unit: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'right' },
  loadMoreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment },
  loadMoreText: { ...typography.labelMd, color: colors.primary },
  footerHint: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceMd },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

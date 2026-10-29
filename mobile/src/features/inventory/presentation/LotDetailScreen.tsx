import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';

import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { listItems, unwrap, type Item, type InventoryBalance, type Paginated } from '@/src/features/inventory/api';
import { formatQuantity } from '@/src/shared/format-quantity';

export default function LotDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [lot, setLot] = useState<{ id: string; lotNumber: string; manufacturedDate?: string | null; expiryDate?: string | null; initialQuantity: string; itemId: string } | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [balance, setBalance] = useState<InventoryBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const syncRotation = useRef(new Animated.Value(0)).current;
  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }
  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  useEffect(() => {
    if (!id || !currentFarmId) return;
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<Paginated<typeof lot>>('/lots', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
        listItems(token, currentFarmId),
        apiRequest<{ data: InventoryBalance[] }>('/inventory', { token, params: { farmId: currentFarmId, lotId: id } }),
      ]);
    }).then(([lotsResponse, itemsResponse, balancesResponse]) => {
      if (cancelled) return;
      const lots = unwrap(lotsResponse) as unknown as Array<{ id: string; lotNumber: string; manufacturedDate?: string | null; expiryDate?: string | null; initialQuantity: string; itemId: string }>;
      const found = lots.find((candidate) => candidate.id === id);
      const foundItem = itemsResponse.data.find((candidate) => candidate.id === found?.itemId) ?? null;
      setLot(found ?? null); setItem(foundItem); setBalance(balancesResponse.data[0] ?? null); setError(found ? null : 'Không tìm thấy lô trong farm hiện tại.');
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải thông tin lô.'); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, id, reloadNonce]);
  const lotId = lot?.lotNumber ?? id ?? 'Chưa chọn lô';
  const quantity = formatQuantity(balance?.balance.quantityOnHand ?? lot?.initialQuantity ?? '0');
  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';
  return <AppShell active="inventory">
    <PageHeader title={currentFarmName} subtitle="● Trực tuyến • Lot Tracking" onBack={() => router.back()} action={<View style={styles.headerActions}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]} accessibilityLabel="Đồng bộ lô"><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable><Pressable onPress={() => Alert.alert('Chia sẻ lô', `Đã chuẩn bị liên kết cho ${lotId}.`)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]} accessibilityLabel="Chia sẻ lô"><Icon name="share" color={colors.primary} /></Pressable></View>} />
    <View style={styles.breadcrumb}><Text style={styles.crumbMuted}>Tồn kho</Text><Icon name="chevron-right" size={16} color={colors.outline} /><Text style={styles.crumbStrong}>{item?.name ?? 'Chi tiết lô'}</Text><Pill tone="amber"><Text style={styles.track}>THEO DÕI LÔ</Text></Pill></View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    <LinearGradient colors={[colors.parchment, colors.surfaceContainerLow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.productCard, styles.productCardGradient]}><HoneycombDecor muted size={42} /><View style={styles.productTop}><View style={styles.productVisual}><View style={styles.productPlaceholder}><Icon name="inventory-2" size={34} color={colors.primary} /></View></View><View style={styles.productCopy}><Pill tone="success"><Text style={styles.success} numberOfLines={2}>● Dữ liệu từ DB • {balance ? 'Đang lưu kho' : 'Chưa có tồn'}</Text></Pill><Text style={styles.productTitle} numberOfLines={4}>{item?.name ?? 'Đang tải vật tư...'}</Text><View style={styles.sku}><Text style={styles.skuLabel}>Mã:</Text><Text style={styles.skuText} numberOfLines={2}>{item?.code ?? 'Chưa có mã'}</Text></View></View></View><View style={styles.productMetaRow}><Text style={styles.metaText} numberOfLines={2}>Theo dõi: {item?.trackingMode ?? 'Chưa có dữ liệu'}</Text><Text style={styles.metaBullet}>•</Text><Text style={styles.metaSpec} numberOfLines={3}>Tồn khả dụng: {quantity}</Text></View><View style={styles.productFooter}><View style={styles.footerCopy}><Icon name="inventory-2" size={16} color={colors.secondary} /><Text style={styles.footerText} numberOfLines={3}>Lot ID: {id}</Text></View><Text style={styles.updated} numberOfLines={3}>Cập nhật từ API</Text></View></LinearGradient>
    <Card style={styles.lotCard}><View style={styles.lotHead}><View style={styles.lotTitleWrap}><View style={styles.lotIcon}><Icon name="description" color={colors.primary} /></View><View style={styles.lotTitleCopy}><Text style={styles.eyebrow}>LÔ HIỆN HÀNH</Text><Text style={styles.lotTitle} numberOfLines={2}>Mã lô: {lotId}</Text></View></View><Pill tone="amber"><Text style={styles.expiry} numberOfLines={1}>Tồn: {quantity}</Text></Pill></View><View style={styles.dateGrid}><DateCell label="Ngày sản xuất" value={lot?.manufacturedDate ?? 'Chưa có'} note="Từ DB" /><DateCell label="Hạn sử dụng" value={lot?.expiryDate ?? 'Không đặt'} note="Từ DB" /></View><View style={styles.origin}><View style={styles.originTop}><Icon name="storage" color={colors.primary} /><Text style={styles.originTitle} numberOfLines={2}>Item trong lô:</Text><Text style={styles.originValue} numberOfLines={1}>{item?.code ?? 'Chưa có'}</Text></View><Text style={styles.originText}>Thông tin lô và tồn kho được tải theo farm hiện tại; không dùng dữ liệu mẫu.</Text></View></Card>
    <Card style={styles.storage}><View style={styles.storageHead}><Icon name="inventory-2" color={colors.primary} /><Text style={styles.storageTitle} numberOfLines={2}>Tồn kho & Vị trí lưu trữ</Text><Pill tone={balance ? 'success' : 'amber'}><Text style={styles.success} numberOfLines={1}>{balance ? '● Có tồn DB' : '● Chưa có tồn'}</Text></Pill></View><View style={styles.available}><View style={styles.availableBlock}><Text style={styles.eyebrow}>TỒN KHẢ DỤNG</Text><Text style={styles.availableValue}>{quantity} <Text style={styles.availableUnit}>{item?.itemType ?? 'đơn vị'}</Text></Text></View><Text style={styles.availableNote}>Warehouse ID: {balance?.balance.warehouseId ?? 'Chưa có'}</Text></View></Card>
    <SectionTitle title="Lịch sử luân chuyển Lô" />
    <Text style={styles.emptyText}>Lịch sử transaction của lô sẽ lấy từ API transaction khi backend hỗ trợ lọc lotId.</Text>
    <View style={styles.authenticity}><View style={styles.authenticityIcon}><Icon name="verified-user" size={28} color={colors.primary} /></View><View style={styles.authenticityCopy}><Text style={styles.authenticityTitle}>Thông tin lô từ DB</Text><Text style={styles.authenticityText}>Dữ liệu lô và tồn kho đang được truy xuất theo farm hiện tại.</Text></View></View>
    <View style={styles.actions}><Pressable onPress={() => router.push('/receipts' as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.secondaryAction, styles.inventoryAction, pressed && styles.pressed]}><Icon name="inventory" size={16} color={colors.deepAmber} /><Text style={styles.secondaryText} numberOfLines={1}>Danh sách kiểm kê</Text></Pressable><Pressable onPress={() => Alert.alert('In tem QR', `Đã chuẩn bị tem QR cho ${lotId}.`)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.printAction, pressed && styles.pressed]}><Icon name="print" size={16} color={colors.deepAmber} /><Text style={styles.printText} numberOfLines={1}>In tem QR</Text></Pressable><View style={styles.primaryAction}><PrimaryButton label="Tạo Phiếu Xuất" icon="output" onPress={() => router.push('/receipts/new?type=issue' as never)} /></View></View>
  </AppShell>;
}

function DateCell({ label, value, note }: { label: string; value: string; note: string }) { return <View style={styles.dateCell}><Text style={styles.cellLabel}>{label}</Text><Text style={styles.cellValue}>{value}</Text><Text style={styles.cellNote}>{note}</Text></View>; }
function Meter({ label, value, note }: { label: string; value: string; note: string }) { return <View style={styles.meter}><Text style={styles.meterLabel}>{label}</Text><Text style={styles.meterValue}>{value}</Text><View style={styles.meterBar}><View style={styles.meterFill} /></View><Text style={styles.cellNote}>{note}</Text></View>; }
function History({ icon, title, date, detail, responsible, color }: { icon: Parameters<typeof Icon>[0]['name']; title: string; date: string; detail: string; responsible?: string; color: string }) { return <View style={styles.history}><View style={[styles.historyDot, { backgroundColor: color }]} /><View style={styles.historyLine} /><View style={styles.historyBody}><View style={styles.historyHead}><View style={styles.historyTitleWrap}><Icon name={icon} size={14} color={color} /><Text style={styles.historyTitle}>{title}</Text></View><Text style={styles.historyDate}>{date}</Text></View><Text style={styles.historyDetail}>{detail}</Text>{responsible ? <Text style={styles.historyResponsible}>{responsible}</Text> : null}</View></View>; }

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.spaceSm },
  headerButton: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, flexWrap: 'wrap' },
  crumbMuted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  crumbStrong: { ...typography.labelLg, color: colors.deepAmber },
  track: { ...typography.labelSm, color: colors.deepAmber },
  productCard: { gap: spacing.spaceMd },
  productCardGradient: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceMd, overflow: 'hidden', position: 'relative' },
  productTop: { flexDirection: 'row', gap: spacing.spaceMd, alignItems: 'flex-start', zIndex: 2 },
  productVisual: { width: 96, flexShrink: 0, alignItems: 'flex-start', zIndex: 3 },
  productImage: { width: 96, height: 112, borderRadius: radius.lg },
  productPlaceholder: { width: 96, height: 112, borderRadius: radius.lg, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, minWidth: 0, gap: spacing.spaceSm, paddingRight: spacing.spaceSm, zIndex: 3 },
  success: { ...typography.labelSm, color: colors.statusSuccess },
  productTitle: { fontFamily: 'VollkornSemiBold', fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.deepAmber, maxWidth: '100%', flexShrink: 1 },
  sku: { minHeight: 30, paddingHorizontal: spacing.spaceSm, paddingVertical: 5, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceXs },
  skuLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 0 },
  skuText: { ...typography.labelMd, fontSize: 11, lineHeight: 14, color: colors.deepAmber, flex: 1, minWidth: 0, flexShrink: 1, textAlign: 'right' },
  productMetaRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'nowrap', gap: spacing.spaceSm, minWidth: 0, zIndex: 1 },
  productMeta: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', minWidth: 0 },
  seasonMeta: { width: '100%', marginTop: spacing.spaceXs, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 2, flexShrink: 1, minWidth: 0 },
  metaText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  metaBullet: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 0 },
  metaSpec: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0, flexShrink: 1 },
  productFooter: { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: spacing.spaceSm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, zIndex: 1 },
  productSeason: { width: 105, flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  footerCopy: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs },
  footerText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0 },
  updated: { width: 125, ...typography.labelLg, fontSize: 12, lineHeight: 16, color: colors.secondary, flexShrink: 1, textAlign: 'right' },
  lotCard: { gap: spacing.spaceMd },
  lotHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  lotTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center' },
  lotTitleCopy: { flex: 1, minWidth: 0 },
  lotIcon: { width: 36, height: 36, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  lotTitle: { ...typography.headlineSm, color: colors.deepAmber, flexShrink: 1 },
  expiry: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
  dateGrid: { flexDirection: 'row', gap: spacing.spaceSm, flexWrap: 'wrap' },
  dateCell: { flex: 1, minWidth: 140, padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.secondaryContainer },
  cellLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  cellValue: { ...typography.labelLg, color: colors.onSurface, marginTop: 5, flexShrink: 1 },
  cellNote: { ...typography.bodySm, color: colors.statusSuccess, marginTop: 3, flexShrink: 1 },
  origin: { padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer },
  originTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap' },
  originTitle: { ...typography.labelLg, color: colors.deepAmber, flex: 1 },
  originValue: { ...typography.labelLg, color: colors.secondary, flexShrink: 1 },
  originText: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: spacing.spaceSm, lineHeight: 22, flexShrink: 1 },
  qualityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  qualityTitle: { ...typography.labelLg, color: colors.deepAmber, flex: 1, minWidth: 0, flexShrink: 1 },
  meters: { flexDirection: 'row', gap: spacing.spaceSm, flexWrap: 'wrap' },
  meter: { flex: 1, minWidth: 86, padding: spacing.spaceSm, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer, alignItems: 'center' },
  meterLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  meterValue: { ...typography.headlineSm, color: colors.deepAmber, marginTop: 4, flexShrink: 1, textAlign: 'center' },
  meterBar: { width: '100%', height: 8, marginVertical: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  meterFill: { width: '82%', height: '100%', backgroundColor: colors.primaryContainer, borderRadius: radius.full },
  storage: { gap: spacing.spaceMd },
  storageHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  storageTitle: { ...typography.headlineSm, color: colors.deepAmber, flex: 1, minWidth: 0, flexShrink: 1 },
  available: { padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.spaceSm },
  availableBlock: { flex: 1, minWidth: 110 },
  availableValue: { ...typography.displayLgMobile, color: colors.deepAmber },
  availableUnit: { ...typography.bodyMd, color: colors.deepAmber },
  availableNote: { ...typography.bodySm, color: colors.secondary, flex: 1, minWidth: 70, flexShrink: 1 },
  minimum: { ...typography.labelLg, color: colors.deepAmber, marginTop: 4 },
  location: { padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer },
  locationTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  locationName: { ...typography.labelLg, color: colors.deepAmber, flex: 1, minWidth: 0, flexShrink: 1 },
  locationMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 4, flexShrink: 1 },
  locationFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.secondaryContainer, marginTop: spacing.spaceSm, paddingTop: spacing.spaceSm },
  link: { ...typography.labelLg, color: colors.secondary },
  history: { position: 'relative', flexDirection: 'row', gap: spacing.spaceSm, paddingLeft: spacing.spaceSm, marginBottom: spacing.spaceSm },
  historyDot: { width: 12, height: 12, borderRadius: radius.full, marginTop: 5 },
  historyLine: { position: 'absolute', top: 17, bottom: -10, left: 5, width: 2, backgroundColor: colors.secondaryContainer },
  historyBody: { flex: 1, minWidth: 0, padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer },
  historyHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  historyTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs },
  historyTitle: { ...typography.labelLg, color: colors.deepAmber, flex: 1 },
  historyDate: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  historyDetail: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 4, flexShrink: 1 },
  historyResponsible: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 4, flexShrink: 1 },
  authenticity: { padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.honey, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd },
  authenticityIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.honey, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  authenticityCopy: { flex: 1, minWidth: 0 },
  authenticityTitle: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  authenticityText: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center', marginBottom: spacing.spaceMd },
  secondaryAction: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceSm },
  inventoryAction: { flex: 1 },
  printAction: { minHeight: 48, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.secondaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceSm },
  primaryAction: { flex: 1.5, minWidth: 0 },
  printText: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1 },
  secondaryText: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1 },
  errorText: { ...typography.bodySm, color: colors.error, padding: spacing.spaceSm, backgroundColor: colors.errorContainer, borderRadius: radius.default },
  emptyText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceMd },
});

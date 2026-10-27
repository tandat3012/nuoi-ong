import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, Card, Icon, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { formatQuantity } from '@/src/shared/format-quantity';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { listBalances, listItems, listWarehouses, unwrap, type Item, type StockCountDetail, type Warehouse } from '@/src/features/inventory/api';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';

type CountItem = { id: string; itemId: string; lotId?: string | null; assetId?: string | null; name: string; code: string; system: number; unit: string; initial: number; icon: 'toys' | 'grid-view' | 'medication'; reason?: string };
type CountLoadResult = { detailResponse: StockCountDetail | null; itemResponse: Awaited<ReturnType<typeof listItems>>; warehouseResponse: Awaited<ReturnType<typeof listWarehouses>>; balanceResponse: Awaited<ReturnType<typeof listBalances>> | null };

const honeycombBorderImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKySLYr_2aB1HqM6wOg1d_bAjSbFQd2SibqjBOFrHHnz0-AUgzUguTCrq85FmurMSO6uJcxfVt4vDBd1GJ6dfS6lcHZz0gnWEeklCFbz8XiYR_u0-E8QE2E8TbDrB3pzvRLGapoMRMV3SbSTnMqLDUivF5SDgJnk11QeKunQZt1eY_Fkb4CW9IJ7rwLsOmE74G-baMq627wJYYeEOJ-ezrWKxZ8LdQiBTiPZA_MxaYe9vOU-KyDP-5A';
const countHeaderImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBb_MRRQSULZVH-tdLML-KDpqN-N4_Q0XNi2f3igKldc5om0J3_zWEyDXjpJT8lcuWHrhPCv-o7-Z_Fyh_s5I2JcOerjQX-xwTMhqFxk7SsHxV936R_0d44Y64GbwmSH6NGFPpNp9kUMlVgHQT2dPmLFQvVjxBtJp-qwqgCPYR8TS7XNMBPMtmTKX-d2mRcE9-150iVpGozN4wbYj4gRnwkL2LEz6jyOXu7tLVb6eTx82MJFVktcEQolg';

export default function StockCountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [countCode, setCountCode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [countStatus, setCountStatus] = useState('DRAFT');
  const [loading, setLoading] = useState(Boolean(params.id));
  const [error, setError] = useState<string | null>(null);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [successSubmitted, setSuccessSubmitted] = useState(false);
  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';

  useEffect(() => {
    if (!currentFarmId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then(async (token): Promise<CountLoadResult> => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      if (params.id) {
        const [detailResponse, itemResponse, warehouseResponse] = await Promise.all([
          apiRequest<StockCountDetail>(`/stock-counts/${params.id}`, { token, params: { farmId: currentFarmId } }),
          listItems(token, currentFarmId),
          listWarehouses(token, currentFarmId),
        ]);
        return { detailResponse, itemResponse, warehouseResponse, balanceResponse: null };
      }
      const [itemResponse, warehouseResponse] = await Promise.all([listItems(token, currentFarmId), listWarehouses(token, currentFarmId)]);
      const initialWarehouseId = warehouseResponse.data[0]?.id;
      const balanceResponse = initialWarehouseId ? await listBalances(token, currentFarmId, initialWarehouseId) : null;
      return { detailResponse: null, itemResponse, warehouseResponse, balanceResponse };
    }).then(({ detailResponse, itemResponse, warehouseResponse, balanceResponse }) => {
      if (cancelled) return;
      const catalog = itemResponse.data;
      setCatalogItems(catalog);
      setWarehouses(warehouseResponse.data);
      const itemById = new Map(catalog.map((item) => [item.id, item]));
      if (detailResponse) {
        const detail = unwrap(detailResponse);
        const mapped = detail.items.map((line) => { const item = itemById.get(line.itemId); return { id: line.id, itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, name: item?.name ?? 'Vật tư không còn trong danh mục', code: item?.code ?? line.itemId, system: Number(line.systemQuantity ?? 0), unit: item?.unitSymbol ?? item?.unitName ?? item?.itemType ?? 'đơn vị', initial: Number(line.actualQuantity ?? 0), icon: 'grid-view' as const, reason: line.note ?? undefined }; });
        setCountItems(mapped); setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial]))); setReasons(Object.fromEntries(mapped.filter((item) => item.reason).map((item) => [item.id, item.reason ?? '']))); setCountCode(detail.count.countCode); setWarehouseId(detail.count.warehouseId); setCountStatus(detail.count.status);
      } else {
        const mapped = balanceResponse?.data.map(({ balance, itemCode, itemName }) => { const item = itemById.get(balance.itemId); return { id: balance.id, itemId: balance.itemId, lotId: balance.lotId, name: itemName, code: itemCode, system: Number(balance.quantityOnHand), unit: item?.unitSymbol ?? item?.unitName ?? item?.itemType ?? 'đơn vị', initial: Number(balance.quantityOnHand), icon: 'grid-view' as const }; }) ?? [];
        setCountItems(mapped); setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial]))); setCountCode(`SC-${Date.now()}`); setWarehouseId(warehouseResponse.data[0]?.id ?? ''); setCountStatus('DRAFT');
      }
      setError(null);
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải phiếu kiểm kê.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, params.id]);

  function adjustCount(id: string, delta: number) {
    setValues((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));
  }

  function addCatalogItem(item: Item) {
    if (countItems.some((line) => line.itemId === item.id)) { setItemPickerOpen(false); return; }
    const line: CountItem = { id: `new-${item.id}`, itemId: item.id, name: item.name, code: item.code, system: 0, unit: item.unitSymbol ?? item.unitName ?? item.itemType ?? 'đơn vị', initial: 0, icon: 'grid-view', reason: '' };
    setCountItems((current) => [...current, line]);
    setValues((current) => ({ ...current, [line.id]: 0 }));
    setReasons((current) => ({ ...current, [line.id]: '' }));
    setItemPickerOpen(false);
  }

  async function selectWarehouse(id: string) {
    setWarehouseId(id);
    setWarehousePickerOpen(false);
    if (params.id || !currentFarmId) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listBalances(token, currentFarmId, id);
      const itemById = new Map(catalogItems.map((item) => [item.id, item]));
      const mapped = response.data.map(({ balance, itemCode, itemName }) => { const item = itemById.get(balance.itemId); return { id: balance.id, itemId: balance.itemId, lotId: balance.lotId, name: itemName, code: itemCode, system: Number(balance.quantityOnHand), unit: item?.unitSymbol ?? item?.unitName ?? item?.itemType ?? 'đơn vị', initial: Number(balance.quantityOnHand), icon: 'grid-view' as const }; });
      setCountItems(mapped);
      setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial])));
      setReasons({});
    } catch (cause: unknown) {
      Alert.alert('Không thể tải tồn kho', cause instanceof Error ? cause.message : 'Không thể tải vật tư của kho đã chọn.');
    }
  }

  function countPayload() {
    return countItems.map((item) => ({ itemId: item.itemId, ...(item.lotId ? { lotId: item.lotId } : {}), ...(item.assetId ? { assetId: item.assetId } : {}), actualQuantity: String(values[item.id] ?? 0), note: reasons[item.id] || null }));
  }

  async function saveCount(submit: boolean) {
    if (!currentFarmId || !warehouseId || countItems.length === 0) { Alert.alert('Thiếu dữ liệu', 'Cần có farm, kho và ít nhất một vật tư từ DB.'); return; }
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      let id = params.id;
      if (!id) {
        const created = await apiRequest<StockCountDetail>('/stock-counts', { method: 'POST', token, params: { farmId: currentFarmId }, body: { warehouseId, countCode: countCode || `SC-${Date.now()}`, items: countPayload() } });
        id = unwrap(created).count.id;
      } else {
        await apiRequest(`/stock-counts/${id}`, { method: 'PATCH', token, params: { farmId: currentFarmId }, body: { items: countPayload() } });
      }
      if (submit) await apiRequest(`/stock-counts/${id}/submit`, { method: 'POST', token, params: { farmId: currentFarmId } });
      setSuccessSubmitted(submit);
      setSuccessId(id ?? null);
    } catch (cause: unknown) { Alert.alert('Không thể lưu', cause instanceof Error ? cause.message : 'API trả về lỗi.'); }
  }

  const warehouseName = (warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId) || 'Chưa chọn kho';

  return <>
  <AppShell active="inventory">
    <View style={styles.countTopBar}><View style={styles.countBrand}><View style={styles.countBrandMark}><Icon name="hive" size={24} color={colors.primary} filled /></View><View style={styles.countBrandCopy}><Text style={styles.countBrandLabel}>NHẬT KÝ KHO VẬN</Text><Text style={styles.countFarmName} numberOfLines={1}>{currentFarmName}</Text></View></View><View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={() => Alert.alert('Đồng bộ', 'Dữ liệu đang được đồng bộ.')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.countSync, pressed && styles.pressed]} accessibilityLabel="Đồng bộ và làm mới"><Icon name="sync" size={21} color={colors.primary} /></Pressable></View></View>
    <View style={styles.pageIntro}><View style={styles.pageIntroCopy}><Text style={styles.title} numberOfLines={2}>Phiếu Kho &amp; Kiểm kê</Text><Text style={styles.introSubtitle} numberOfLines={2}>Kiểm đếm định kỳ &amp; cân bằng kho hiện trường</Text></View><Pill tone="amber"><Icon name="schedule" size={14} color={colors.deepAmber} /><Text style={styles.today}>Hôm nay</Text></Pill></View>
    <View style={styles.businessTabs}><Pressable onPress={() => undefined} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.businessTabActive, pressed && styles.pressed]}><Icon name="fact-check" size={17} color={colors.onPrimary} /><Text style={styles.businessTabActiveText}>Kiểm kê kho</Text></Pressable><Pressable onPress={() => undefined} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.businessTab, pressed && styles.pressed]}><Icon name="input" size={17} color={colors.onSurfaceVariant} /><Text style={styles.businessTabText}>Phiếu nhập</Text></Pressable><Pressable onPress={() => undefined} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.businessTab, pressed && styles.pressed]}><Icon name="output" size={17} color={colors.onSurfaceVariant} /><Text style={styles.businessTabText}>Phiếu xuất</Text></Pressable></View>
    <Card style={styles.countInfo}><View style={styles.countInfoBanner}><Image source={{ uri: honeycombBorderImage }} style={styles.honeycombImage} resizeMode="cover" /></View><View style={styles.countInfoBody}><View style={styles.countInfoTop}><View style={styles.countCode}><Icon name="inventory" size={16} color={colors.deepAmber} /><Text style={styles.countCodeText}>{countCode || 'Chưa chọn phiếu'}</Text></View><View style={styles.draftBadge}><View style={styles.draftDot} /><Text style={styles.draftText}>{countStatus}</Text></View></View><View style={styles.countInfoBottom}><View style={styles.countInfoCopy}><Pressable disabled={Boolean(params.id)} onPress={() => setWarehousePickerOpen(true)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.metaLine, pressed && styles.pressed]}><View style={styles.metaIcon}><Icon name="warehouse" size={16} color={colors.primary} /></View><Text style={styles.warehouseMetaText} numberOfLines={2}>{warehouseName}</Text><Icon name="expand-more" size={18} color={colors.primary} /></Pressable><View style={styles.metaLine}><View style={styles.metaIcon}><Icon name="badge" size={16} color={colors.primary} /></View><Text style={styles.counterMetaText}>Người dùng hiện tại</Text></View></View><Image source={{ uri: countHeaderImage }} style={styles.countHeaderImage} resizeMode="contain" /></View></View></Card>
    <SectionTitle title="Chi tiết vật tư & thiết bị" count={`${countItems.length} mục`} action={<Pressable onPress={() => setItemPickerOpen(true)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.addItem, pressed && styles.pressed]}><Icon name="add-circle" size={17} color={colors.primary} /><Text style={styles.addItemText}>Thêm vật tư</Text></Pressable>} />
    {loading ? <Text style={styles.emptyText}>Đang tải dữ liệu kiểm kê từ DB...</Text> : error ? <Text style={styles.errorText}>{error}</Text> : countItems.length === 0 ? <Card style={styles.emptyCard}><Text style={styles.emptyText}>Chưa có vật tư trong kho này.</Text><Text style={styles.emptyHint}>Bấm “Thêm vật tư” để tạo dòng kiểm kê từ danh mục DB.</Text></Card> : countItems.map((item) => { const actual = values[item.id] ?? 0; const diff = actual - item.system; return <Card key={item.id} style={styles.item}><View style={styles.itemHead}><View style={styles.itemIdentity}><View style={[styles.itemIcon, diff < 0 && styles.itemIconDanger]}><Icon name={item.icon} size={22} color={diff < 0 ? colors.primary : colors.statusSuccessStrong} /></View><View style={styles.itemCopy}><Text style={styles.itemName} numberOfLines={3}>{item.name}</Text><Text style={styles.itemCode} numberOfLines={2}>Mã: {item.code}</Text></View></View><Pill tone={diff === 0 ? 'success' : 'danger'}><Text numberOfLines={3} style={diff === 0 ? styles.success : styles.danger}>{diff === 0 ? '✓ Khớp tồn (0)' : `↓ Hụt ${formatQuantity(Math.abs(diff))} ${item.unit}`}</Text></Pill></View><View style={styles.countGrid}><View style={styles.systemColumn}><Text style={styles.label} numberOfLines={2}>Tồn hệ thống</Text><Text style={styles.system} numberOfLines={2}>{formatQuantity(item.system)} <Text style={styles.unit}>{item.unit}</Text></Text></View><View style={styles.actual}><Text style={styles.label} numberOfLines={2}>Thực tế đếm</Text><View style={styles.counter}><Pressable onPress={() => adjustCount(item.id, -1)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}><Text style={styles.quantityText}>−</Text></Pressable><TextInput value={String(actual)} onChangeText={(value) => setValues((current) => ({ ...current, [item.id]: Math.max(0, Number.parseInt(value || '0', 10) || 0) }))} keyboardType="number-pad" style={[styles.input, diff < 0 && styles.inputDanger]} /><Pressable onPress={() => adjustCount(item.id, 1)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}><Text style={styles.quantityText}>+</Text></Pressable></View></View></View>{diff !== 0 || item.reason !== undefined ? <View style={styles.reason}><View style={styles.reasonLabel}><Icon name="edit-note" size={16} color={colors.primary} /><Text style={styles.reasonText} numberOfLines={3}>Lý do chênh lệch:</Text></View><TextInput multiline value={reasons[item.id]} onChangeText={(value) => setReasons((current) => ({ ...current, [item.id]: value }))} placeholder="Nhập lý do chênh lệch..." placeholderTextColor={colors.onSurfaceVariant} style={styles.reasonInput} /></View> : null}</Card>; })}
    <Card style={styles.warning}><Icon name="warning" color={colors.primary} /><View style={styles.warningCopy}><Text style={styles.warningTitle}>Lưu ý trước khi xác nhận</Text><Text style={styles.warningText}>Hệ thống sẽ tạo transaction điều chỉnh theo chênh lệch. Không thể hoàn tác sau khi quản lý xác nhận.</Text></View></Card>
    <View style={styles.actions}><View style={styles.saveAction}><PrimaryButton label="Lưu nháp" icon="save" compact onPress={() => void saveCount(false)} /></View><View style={styles.confirmAction}><PrimaryButton label="Gửi duyệt" icon="task-alt" onPress={() => void saveCount(true)} /></View></View>
  </AppShell>
  <Modal visible={warehousePickerOpen} transparent animationType="slide" onRequestClose={() => setWarehousePickerOpen(false)}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Chọn kho kiểm kê</Text><Pressable onPress={() => setWarehousePickerOpen(false)} style={styles.modalClose}><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable></View><ScrollView>{warehouses.map((warehouse) => <Pressable key={warehouse.id} onPress={() => void selectWarehouse(warehouse.id)} style={({ pressed }) => [styles.pickerRow, warehouse.id === warehouseId && styles.pickerRowActive, pressed && styles.pressed]}><View style={styles.pickerCopy}><Text style={styles.pickerName}>{warehouse.name}</Text><Text style={styles.pickerMeta}>{warehouse.code}</Text></View>{warehouse.id === warehouseId ? <Icon name="check" size={20} color={colors.primary} /> : null}</Pressable>)}</ScrollView></View></View></Modal>
  <Modal visible={itemPickerOpen} transparent animationType="slide" onRequestClose={() => setItemPickerOpen(false)}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Thêm vật tư kiểm kê</Text><Pressable onPress={() => setItemPickerOpen(false)} style={styles.modalClose}><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable></View><ScrollView>{catalogItems.map((item) => { const selected = countItems.some((line) => line.itemId === item.id); return <Pressable key={item.id} disabled={selected} onPress={() => addCatalogItem(item)} style={({ pressed }) => [styles.pickerRow, selected && styles.pickerRowDisabled, pressed && styles.pressed]}><View style={styles.pickerCopy}><Text style={styles.pickerName}>{item.name}</Text><Text style={styles.pickerMeta}>{item.code} • {item.unitName ?? item.itemType}</Text></View>{selected ? <Text style={styles.selectedText}>Đã thêm</Text> : <Icon name="add-circle-outline" size={20} color={colors.primary} />}</Pressable>; })}</ScrollView></View></View></Modal>
  <OperationResultDialog
    visible={Boolean(successId)}
    title={successSubmitted ? 'Phiếu kiểm kê đã gửi duyệt' : 'Đã lưu phiếu kiểm kê'}
    message={successSubmitted ? 'Phiếu đã chuyển sang trạng thái Chờ duyệt.' : 'Phiếu đã được tạo và lưu ở trạng thái Bản nháp.'}
    actionLabel="Mở phiếu"
    onAction={() => {
      if (successId) router.replace(`/counts/${successId}` as never);
      setSuccessId(null);
    }}
  />
  </>;
}

const styles = StyleSheet.create({
  countTopBar: { minHeight: 64, marginHorizontal: -spacing.gutterMobile, paddingHorizontal: spacing.spaceMd, backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  countBrand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  countBrandMark: { width: 44, height: 44, borderRadius: radius.default, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  countBrandCopy: { flex: 1, minWidth: 0 },
  countBrandLabel: { ...typography.labelSm, color: colors.primary, letterSpacing: 0.7 },
  countFarmName: { ...typography.headlineSm, color: colors.onSurface, marginTop: 2, flexShrink: 1 },
  countSync: { width: 40, height: 40, borderRadius: radius.default, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  pageIntro: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceMd, paddingTop: 4 },
  pageIntroCopy: { flex: 1, minWidth: 0 },
  introSubtitle: { ...typography.bodySm, color: colors.deepAmber, marginTop: spacing.spaceXs, flexShrink: 1 },
  today: { ...typography.labelSm, color: colors.deepAmber },
  businessTabs: { minHeight: 44, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', gap: 4 },
  businessTabActive: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  businessTab: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  businessTabActiveText: { ...typography.labelSm, color: colors.onPrimary, textAlign: 'center', flexShrink: 1 },
  businessTabText: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  countInfo: { padding: 0, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceContainerLowest },
  countInfoBanner: { height: 40, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.primaryFixed, opacity: 0.9 },
  honeycombImage: { width: '100%', height: '100%' },
  countInfoBody: { padding: spacing.spaceMd, gap: spacing.spaceSm },
  countInfoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  countCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.spaceSm, paddingVertical: 5, borderRadius: radius.default, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer },
  countCodeText: { ...typography.labelSm, color: colors.deepAmber, fontWeight: '700', letterSpacing: 0.5 },
  draftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.spaceSm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, flexShrink: 1 },
  draftDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.honey },
  draftText: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1 },
  countInfoBottom: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceMd, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant, flexWrap: 'wrap' },
  countInfoCopy: { flex: 1, minWidth: 0, gap: spacing.spaceSm },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, minWidth: 0 },
  metaIcon: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  warehouseMetaText: { ...typography.labelSm, color: colors.deepAmber, fontWeight: '600', flexShrink: 1 },
  counterMetaText: { ...typography.labelSm, color: colors.onSurfaceVariant, flexShrink: 1 },
  counterStrong: { color: colors.onSurface, fontWeight: '500' },
  countHeaderImage: { width: 56, height: 56, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.secondaryContainer, flexShrink: 0 },
  addItem: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { ...typography.labelSm, color: colors.deepAmber },
  title: { fontFamily: 'VollkornSemiBold', fontSize: 24, fontWeight: '700', lineHeight: 32, color: colors.deepAmberStrong, flexShrink: 1 },
  item: { gap: spacing.spaceMd },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap' },
  itemIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  itemIcon: { width: 44, height: 44, borderRadius: radius.default, backgroundColor: colors.statusSuccessSurface, borderWidth: 1, borderColor: colors.statusSuccessBorder, alignItems: 'center', justifyContent: 'center' },
  itemIconDanger: { backgroundColor: colors.primaryFixed, borderColor: colors.secondaryContainer },
  itemCopy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  itemName: { ...typography.headlineSm, color: colors.onSurface },
  itemCode: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  success: { ...typography.labelSm, color: colors.statusSuccess },
  danger: { ...typography.labelSm, color: colors.error },
  amber: { ...typography.labelSm, color: colors.deepAmber },
  countGrid: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceMd, padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.secondaryContainer, flexWrap: 'wrap' },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  system: { ...typography.bodyLg, fontWeight: '700', color: colors.onSurface, marginTop: 4 },
  unit: { ...typography.bodySm, fontWeight: '400', color: colors.onSurfaceVariant },
  actual: { flex: 1, minWidth: 150, flexShrink: 1, alignItems: 'flex-end' },
  systemColumn: { flex: 1, minWidth: 90 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, marginTop: spacing.spaceSm },
  quantityButton: { width: dimensions.quantityButton, height: dimensions.quantityButton, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center' },
  quantityText: { ...typography.bodyLg, color: colors.onSurface, lineHeight: 20 },
  input: { width: 56, height: dimensions.quantityButton, paddingVertical: 0, borderRadius: radius.default, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, textAlign: 'center', textAlignVertical: 'center', color: colors.onSurface, ...typography.labelLg },
  inputDanger: { borderColor: colors.error, color: colors.error },
  reason: { gap: spacing.spaceSm },
  reasonLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  reasonText: { ...typography.labelLg, color: colors.onSurfaceVariant, flexShrink: 1 },
  reasonInput: { minHeight: 42, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, textAlignVertical: 'top', ...typography.bodySm },
  warning: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'flex-start', backgroundColor: colors.parchmentWarm },
  warningCopy: { flex: 1 },
  warningTitle: { ...typography.labelLg, color: colors.primary },
  warningText: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3 },
  actions: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center' },
  saveAction: { flex: 1 },
  confirmAction: { flex: 1.6 },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  errorText: { ...typography.bodySm, color: colors.error, textAlign: 'center', padding: spacing.spaceSm, backgroundColor: colors.errorContainer, borderRadius: radius.default },
  emptyCard: { alignItems: 'center', gap: spacing.spaceXs },
  emptyHint: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 18, 13, 0.45)' },
  modalSheet: { maxHeight: '75%', backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.spaceMd },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, paddingBottom: spacing.spaceMd, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface, flexShrink: 1 },
  modalClose: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  pickerRow: { minHeight: 60, paddingVertical: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  pickerRowActive: { backgroundColor: colors.honeyChip },
  pickerRowDisabled: { opacity: 0.55 },
  pickerCopy: { flex: 1, minWidth: 0 },
  pickerName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  pickerMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  selectedText: { ...typography.labelSm, color: colors.statusSuccess },
});

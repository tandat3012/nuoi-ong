import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { filterPositiveBalancesForScope, listBalances, listItems, listWarehouses, unwrap, type Item, type Paginated, type Warehouse } from '@/src/features/inventory/api';
import { formatQuantity } from '@/src/shared/format-quantity';
import { validateQuantityInput } from '@/src/shared/quantity-input';

export type InventoryActionMode = 'maintenance' | 'transfer';

type TransferOption = { id: string; itemId: string; label: string; trackingMode: 'QUANTITY' | 'LOT'; quantity: number; lotId?: string };
type MaintenanceAsset = { asset: { id: string; assetCode: string; status: string }; itemName: string };

async function listMaintenanceAssets(token: string, farmId: string) {
  const params = { farmId, page: 1, pageSize: 100 };
  const first = await apiRequest<Paginated<MaintenanceAsset>>('/assets', { token, params, skipCache: true });
  const pages = await Promise.all(Array.from({ length: Math.max(0, first.page.totalPages - 1) }, (_, index) =>
    apiRequest<Paginated<MaintenanceAsset>>('/assets', { token, params: { ...params, page: index + 2 }, skipCache: true })));
  return [first.data, ...pages.map((page) => page.data)].flat();
}

const screenCopy: Record<InventoryActionMode, { title: string; subtitle: string; eyebrow: string; icon: 'build' | 'swap-horiz'; action: string }> = {
  maintenance: { title: 'Báo sự cố tài sản', subtitle: 'Gửi yêu cầu sửa chữa để quản lý xử lý trên web', eyebrow: 'BẢO TRÌ TÀI SẢN', icon: 'build', action: 'Gửi yêu cầu bảo trì' },
  transfer: { title: 'Tạo phiếu điều chuyển', subtitle: 'Chuyển vật tư hoặc lô giữa các kho', eyebrow: 'STOCK TRANSFER', icon: 'swap-horiz', action: 'Gửi duyệt điều chuyển' },
};

export default function InventoryActionScreen({ mode }: { mode: InventoryActionMode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string; itemId?: string; lotId?: string; sourceWarehouseId?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const copy = screenCopy[mode];
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [destinationWarehouses, setDestinationWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<Array<{ id: string; label: string }>>([]);
  const [transferOptions, setTransferOptions] = useState<TransferOption[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tracking: 'SỐ LƯỢNG',
    asset: '',
    sourceWarehouse: '',
    destinationWarehouse: '',
    item: '',
    quantity: '1',
    title: '',
    maintenanceType: 'Sửa chữa đột xuất',
    note: '',
  });
  const [picker, setPicker] = useState<keyof typeof pickerOptions | null>(null);
  const [successResult, setSuccessResult] = useState<{
    title: string;
    details?: Array<{ label: string; value: string }>;
    items?: Array<{ name: string; quantity: string }>;
  } | null>(null);

  useEffect(() => {
    if (!currentFarmId) return;
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listWarehouses(token, currentFarmId),
        listWarehouses(token, currentFarmId, true),
        listItems(token, currentFarmId),
        listMaintenanceAssets(token, currentFarmId),
      ]);
    }).then(([warehouseResponse, destinationWarehouseResponse, itemResponse, assetRows]) => {
      if (cancelled) return;
      setWarehouses(warehouseResponse.data);
      const allDestinations = destinationWarehouseResponse.data.length > 0 ? destinationWarehouseResponse.data : warehouseResponse.data;
      setDestinationWarehouses(allDestinations);
      setItems(itemResponse.data);
      setAssets(assetRows.filter(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status)).map(({ asset, itemName }) => ({ id: asset.id, label: `${itemName} · ${asset.assetCode}` })));
      const requestedSource = params.sourceWarehouseId && warehouseResponse.data.some((warehouse) => warehouse.id === params.sourceWarehouseId)
        ? params.sourceWarehouseId
        : '';
      const sourceWarehouse = params.itemId ? requestedSource : requestedSource || warehouseResponse.data[0]?.id || '';
      const suggestedDestination = allDestinations.find((warehouse) => warehouse.id !== sourceWarehouse)?.id ?? '';
      setForm((current) => ({
        ...current,
        sourceWarehouse,
        destinationWarehouse: !current.destinationWarehouse || current.destinationWarehouse === sourceWarehouse ? suggestedDestination : current.destinationWarehouse,
        asset: current.asset || (params.assetId ?? assetRows.find(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status))?.asset.id ?? ''),
      }));
      setLoadError(null);
    }).catch((cause: unknown) => { if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu lựa chọn từ DB.'); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, params.assetId, params.sourceWarehouseId]);

  useEffect(() => {
    if (mode !== 'transfer' || !currentFarmId || !form.sourceWarehouse) return;
    let cancelled = false;
    setTransferLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listBalances(token, currentFarmId, form.sourceWarehouse, true, true);
    }).then((balanceResponse) => {
      if (cancelled) return;
      const balances = filterPositiveBalancesForScope(balanceResponse.data, currentFarmId, form.sourceWarehouse);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const options: TransferOption[] = [];
      const quantityByItem = new Map<string, number>();
      for (const row of balances) {
        const item = itemById.get(row.balance.itemId);
        if (!item) continue;
        if (row.trackingMode === 'ASSET') continue;
        const quantity = Number(row.balance.quantityOnHand);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        if (row.trackingMode === 'LOT') {
          if (!row.balance.lotId) continue;
          options.push({ id: `LOT:${row.balance.id}`, itemId: item.id, lotId: row.balance.lotId, trackingMode: 'LOT', quantity, label: `${item.name} • ${item.code} • LOT ${row.balance.lotId.slice(0, 8)} • Tồn ${formatQuantity(quantity)}` });
        } else {
          quantityByItem.set(item.id, (quantityByItem.get(item.id) ?? 0) + quantity);
        }
      }
      for (const [itemId, quantity] of quantityByItem) {
        const item = itemById.get(itemId)!;
        options.push({ id: `QTY:${itemId}`, itemId, trackingMode: 'QUANTITY', quantity, label: `${item.name} • ${item.code} • Tồn ${formatQuantity(quantity)}` });
      }
      // dev rejects ASSET in stock transfers; assets move through the asset lifecycle.
      setTransferOptions(options);
      const requestedOption = params.itemId
        ? options.find((option) => option.itemId === params.itemId && (!params.lotId || option.lotId === params.lotId))
        : undefined;
      setForm((current) => ({
        ...current,
        tracking: (requestedOption ?? options.find((option) => option.id === current.item) ?? options[0])?.trackingMode === 'LOT' ? 'THEO LÔ' : 'SỐ LƯỢNG',
        item: requestedOption?.id ?? (options.some((option) => option.id === current.item) ? current.item : options[0]?.id ?? ''),
      }));
      setLoadError(null);
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setTransferOptions([]);
        setLoadError(cause instanceof Error ? cause.message : 'Không thể tải tồn tại kho nguồn.');
      }
    }).finally(() => { if (!cancelled) setTransferLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, form.sourceWarehouse, getAccessToken, items, mode, params.itemId, params.lotId]);

  const pickerOptions = useMemo(() => ({
    tracking: ['SỐ LƯỢNG', 'THEO LÔ'],
    asset: assets.map((asset) => asset.label),
    sourceWarehouse: warehouses.map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
    destinationWarehouse: destinationWarehouses.filter((warehouse) => warehouse.id !== form.sourceWarehouse).map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
    item: transferOptions.filter((option) => option.trackingMode === (form.tracking === 'THEO LÔ' ? 'LOT' : 'QUANTITY')).map((option) => option.label),
  }), [assets, destinationWarehouses, form.sourceWarehouse, form.tracking, transferOptions, warehouses]);
  const selectedTransferOption = transferOptions.find((option) => option.id === form.item);
  const transferQuantityError = mode === 'transfer'
    ? validateQuantityInput(form.quantity, { max: selectedTransferOption?.quantity })
    : null;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function choose(value: string) {
    if (picker === 'item') {
      const option = transferOptions.find((candidate) => candidate.label === value);
      if (option) setForm((current) => ({ ...current, item: option.id, tracking: option.trackingMode === 'LOT' ? 'THEO LÔ' : 'SỐ LƯỢNG' }));
    } else if (picker === 'tracking' && mode === 'transfer') {
      const trackingMode = value === 'THEO LÔ' ? 'LOT' : 'QUANTITY';
      const firstMatching = transferOptions.find((option) => option.trackingMode === trackingMode);
      setForm((current) => ({ ...current, tracking: value, item: firstMatching?.id ?? '' }));
    } else if (picker === 'sourceWarehouse' && mode === 'transfer') {
      const sourceId = value.split(' • ')[0];
      const suggestedDestination = destinationWarehouses.find((warehouse) => warehouse.id !== sourceId)?.id ?? '';
      setForm((current) => ({
        ...current,
        sourceWarehouse: sourceId,
        destinationWarehouse: current.destinationWarehouse === sourceId || !current.destinationWarehouse
          ? suggestedDestination
          : current.destinationWarehouse,
      }));
    } else if (picker === 'asset') {
      const selected = assets.find((asset) => asset.label === value);
      if (selected) update('asset', selected.id);
    } else if (picker) update(picker, value.split(' • ')[0]);
    setPicker(null);
  }

  function submit() {
    if (mode === 'transfer' && form.sourceWarehouse === form.destinationWarehouse) {
      Alert.alert('Kho không hợp lệ', 'Kho nguồn và kho đích phải khác nhau.');
      return;
    }
    if (mode === 'transfer' && (transferLoading || !transferOptions.some((option) => option.id === form.item))) {
      Alert.alert('Chưa có vật phẩm khả dụng', transferLoading ? 'Đang tải tồn kho của kho nguồn.' : 'Kho nguồn không có vật phẩm phù hợp với cách theo dõi đã chọn.');
      return;
    }
    if (mode === 'transfer' && transferQuantityError) {
      Alert.alert('Số lượng điều chuyển không hợp lệ', `${selectedTransferOption?.label ?? 'Vật tư'}: “${form.quantity || 'trống'}”. ${transferQuantityError}`);
      return;
    }
    if (mode === 'maintenance' && !form.title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung bảo trì.');
      return;
    }
    void saveToApi();
  }

  async function saveToApi() {
    if (!currentFarmId) { Alert.alert('Chưa chọn farm', 'Vui lòng chọn trang trại trước khi tạo dữ liệu.'); return; }
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const selectedWarehouse = form.sourceWarehouse.split(' • ')[0];
      const selectedDestination = form.destinationWarehouse.split(' • ')[0];
      const selectedAsset = form.asset.split(' • ')[0];
      let createdTransferId: string | null = null;
      let createdMaintenanceId: string | null = null;
      if (mode === 'transfer') {
        const selected = transferOptions.find((option) => option.id === form.item);
        if (!selected) throw new Error('Vật phẩm không còn trong danh sách tồn của kho nguồn.');
        const quantity = form.quantity;
        const latest = await listBalances(token, currentFarmId, selectedWarehouse, true, true);
        const available = filterPositiveBalancesForScope(latest.data, currentFarmId, selectedWarehouse)
          .filter(({ balance, trackingMode }) => balance.itemId === selected.itemId && trackingMode === selected.trackingMode && (selected.trackingMode !== 'LOT' || balance.lotId === selected.lotId))
          .reduce((sum, { balance }) => sum + Number(balance.quantityOnHand), 0);
        const quantityError = validateQuantityInput(quantity, { max: available });
        if (quantityError) throw new Error(`${selected.label}: “${quantity || 'trống'}”. ${quantityError}`);

        const response = await apiRequest<{ data: { transfer: { id: string } } | { id: string } }>('/stock-transfers', {
          method: 'POST',
          token,
          params: { farmId: currentFarmId },
          body: {
            fromWarehouseId: selectedWarehouse,
            toWarehouseId: selectedDestination,
            note: form.note.trim() || undefined,
            items: [{ itemId: selected.itemId, quantity: quantity.trim().replace(',', '.'), lotId: selected.lotId }],
          },
        });
        const transferObj = unwrap(response);
        createdTransferId = (transferObj as { transfer?: { id?: string } })?.transfer?.id ?? (transferObj as { id?: string })?.id ?? null;
        if (createdTransferId) {
          await apiRequest(`/stock-transfers/${encodeURIComponent(createdTransferId)}/submit`, {
            method: 'POST',
            token,
            params: { farmId: currentFarmId },
          });
        }
      } else {
        const response = await apiRequest<{ data: { id: string } } | { id: string }>('/maintenance-requests', { method: 'POST', token, params: { farmId: currentFarmId }, body: { assetId: selectedAsset, maintenanceType: 'CORRECTIVE', description: form.title } });
        createdMaintenanceId = (unwrap(response) as { id?: string })?.id ?? null;
      }

      if (mode === 'transfer') {
        const sourceName = warehouses.find((w) => w.id === selectedWarehouse)?.name ?? form.sourceWarehouse;
        const destName = destinationWarehouses.find((w) => w.id === selectedDestination)?.name ?? warehouses.find((w) => w.id === selectedDestination)?.name ?? form.destinationWarehouse;
        const selected = transferOptions.find((option) => option.id === form.item);
        setSuccessResult({
          title: 'Đã gửi duyệt phiếu điều chuyển',
          details: [
            { label: 'Mã phiếu', value: createdTransferId ? `CK-${createdTransferId.slice(0, 8)}` : '—' },
            { label: 'Kho nguồn', value: sourceName },
            { label: 'Kho đích', value: destName },
          ],
          items: selected ? [{ name: selected.label, quantity: `${form.quantity} đơn vị` }] : undefined,
        });
      } else {
        const selectedAssetObj = assets.find((a) => a.id === selectedAsset);
        setSuccessResult({
          title: 'Đã gửi yêu cầu bảo trì',
          details: [
            { label: 'Mã phiếu', value: createdMaintenanceId ? `MNT-${createdMaintenanceId.slice(0, 8)}` : '—' },
            { label: 'Vật phẩm', value: selectedAssetObj?.label ?? 'Thiết bị' },
            { label: 'Mô tả sự cố', value: form.title },
          ],
        });
      }
    } catch (cause: unknown) {
      Alert.alert('Không thể lưu', cause instanceof Error ? cause.message : 'API trả về lỗi.');
    }
  }

  return <>
  <AppShell active="inventory">
    <PageHeader title={copy.title} subtitle={`● ${copy.subtitle}`} onBack={() => router.back()} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><View style={styles.headerIcon}><Icon name={copy.icon} color={colors.primary} /></View></View>} />
    <View style={styles.intro}><View style={styles.introCopy}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.title} numberOfLines={2}>{copy.title}</Text><Text style={styles.subtitle} numberOfLines={2}>{copy.subtitle}</Text></View><Pill tone="amber"><Text style={styles.draft}>GỬI DUYỆT</Text></Pill></View>
    {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

    {mode === 'maintenance' ? <Card style={styles.formCard}><SectionTitle title="Báo sự cố cần bảo trì" count="Bắt buộc" /><PickerField label="Vật phẩm" value={assets.find((asset) => asset.id === form.asset)?.label ?? 'Chọn vật phẩm'} onPress={() => setPicker('asset')} /><Field label="Mô tả sự cố *" value={form.title} placeholder="VD: Máy quay phát tiếng kêu bất thường" onChangeText={(value) => update('title', value)} /><Field label="Thông tin bổ sung" value={form.note} placeholder="Mô tả thêm tình trạng thiết bị" onChangeText={(value) => update('note', value)} multiline /></Card> : null}

    {mode === 'transfer' ? <Card style={styles.formCard}><SectionTitle title="Thông tin điều chuyển" count="Bắt buộc" /><PickerField label="Kho nguồn" value={warehouses.find((warehouse) => warehouse.id === form.sourceWarehouse)?.name ?? 'Chọn kho nguồn'} onPress={() => setPicker('sourceWarehouse')} /><PickerField label="Kho đích" value={destinationWarehouses.find((warehouse) => warehouse.id === form.destinationWarehouse)?.name ?? warehouses.find((warehouse) => warehouse.id === form.destinationWarehouse)?.name ?? 'Chọn kho đích'} onPress={() => setPicker('destinationWarehouse')} /><PickerField label="Cách theo dõi" value={form.tracking} onPress={() => setPicker('tracking')} /><PickerField label="Vật tư / lô trong kho nguồn" value={transferOptions.find((option) => option.id === form.item)?.label ?? (transferLoading ? 'Đang tải tồn kho...' : 'Chọn vật tư có tồn')} onPress={() => setPicker('item')} /><Field label={`Số lượng chuyển (tối đa ${formatQuantity(transferOptions.find((option) => option.id === form.item)?.quantity ?? 0)})`} value={form.quantity} placeholder="0" onChangeText={(value) => update('quantity', value)} keyboardType="decimal-pad" error={transferQuantityError} /><Field label="Lý do điều chuyển" value={form.note} placeholder="Nhập lý do" onChangeText={(value) => update('note', value)} multiline /></Card> : null}

    <Card style={styles.notice}><Icon name="info-outline" color={colors.primary} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{mode === 'maintenance' ? 'Quy trình duyệt sự cố' : 'Quy trình duyệt điều chuyển'}</Text><Text style={styles.noticeText}>{mode === 'maintenance' ? 'Yêu cầu sẽ được gửi người có quyền duyệt trong trại. Chỉ sau khi duyệt, hệ thống mới tạo lịch bảo trì; kết quả gửi lại tài khoản của bạn.' : 'Phiếu sẽ được gửi duyệt tới quản lý kho nguồn để xuất hàng, sau đó quản lý kho đích xác nhận nhận hàng.'}</Text></View></Card>
    <View style={styles.actions}><Pressable onPress={() => router.back()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Hủy</Text></Pressable><View style={styles.submit}><PrimaryButton label={copy.action} icon="save" onPress={submit} /></View></View>

    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>LỰA CHỌN</Text><Text style={styles.modalTitle}>Chọn thông tin</Text></View><Pressable onPress={() => setPicker(null)} style={styles.close}><Icon name="close" color={colors.onSurfaceVariant} /></Pressable></View><ScrollView contentContainerStyle={styles.options}>{picker ? pickerOptions[picker].map((option) => <Pressable key={option} onPress={() => choose(option)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.option, form[picker] === option && styles.optionActive, pressed && styles.pressed]}><Icon name={form[picker] === option ? 'radio-button-checked' : 'radio-button-unchecked'} color={form[picker] === option ? colors.primary : colors.outline} /><Text style={styles.optionText} numberOfLines={3}>{option}</Text></Pressable>) : null}</ScrollView></View></View>
    </Modal>
  </AppShell>
  <OperationResultDialog
    visible={Boolean(successResult)}
    title={successResult?.title ?? ''}
    details={successResult?.details}
    items={successResult?.items}
    actionLabel="Hoàn tất"
    onAction={() => {
      setSuccessResult(null);
      router.back();
    }}
  />
  </>;
}

function Field({ label, value, placeholder, onChangeText, multiline = false, keyboardType, autoCapitalize = 'sentences', error }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: 'decimal-pad' | 'number-pad'; autoCapitalize?: 'sentences' | 'characters' | 'none'; error?: string | null }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.outline} style={[styles.input, multiline && styles.multiline, error && styles.inputError]} multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize} />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Pressable onPress={onPress} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}><Text style={styles.pickerValue} numberOfLines={2}>{value}</Text><Icon name="expand-more" color={colors.onSurfaceVariant} /></Pressable></View>;
}

const styles = StyleSheet.create({
  headerIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.secondaryContainer },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  intro: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm },
  introCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.labelSm, color: colors.secondary, letterSpacing: 0.6 },
  title: { ...typography.displayLgMobile, color: colors.deepAmberStrong, flexShrink: 1 },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs, flexShrink: 1 },
  loadError: { ...typography.bodySm, color: colors.error, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.errorContainer },
  draft: { ...typography.labelSm, color: colors.deepAmber },
  formCard: { gap: spacing.spaceMd },
  field: { gap: spacing.spaceXs },
  fieldLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, flexShrink: 1 },
  input: { minHeight: 46, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, ...typography.bodyMd },
  inputError: { borderColor: colors.error },
  fieldError: { ...typography.bodySm, color: colors.error },
  multiline: { minHeight: 86, paddingTop: spacing.spaceMd, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: spacing.spaceSm },
  column: { flex: 1, minWidth: 0 },
  pickerField: { minHeight: 46, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  pickerValue: { flex: 1, minWidth: 0, ...typography.bodyMd, color: colors.onSurface, flexShrink: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.parchmentWarm },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { ...typography.labelLg, color: colors.primary },
  noticeText: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, marginBottom: spacing.spaceMd },
  cancel: { width: 72, minHeight: 48, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.labelLg, color: colors.onSurfaceVariant },
  submit: { flex: 1, minWidth: 0 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  modalSheet: { maxHeight: '78%', padding: spacing.spaceLg, gap: spacing.spaceSm, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd },
  modalEyebrow: { ...typography.labelSm, color: colors.secondary },
  modalTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  options: { gap: spacing.spaceSm, paddingVertical: spacing.spaceSm },
  option: { minHeight: 52, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  optionActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  optionText: { flex: 1, minWidth: 0, ...typography.bodyMd, color: colors.onSurface, flexShrink: 1 },
});

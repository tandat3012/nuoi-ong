import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { filterPositiveBalancesForScope, listAvailableAssets, listBalances, listItems, listWarehouses, type AvailableAsset, type Item, type Paginated, type Warehouse } from '@/src/features/inventory/api';
import { formatQuantity } from '@/src/shared/format-quantity';

export type InventoryActionMode = 'material' | 'maintenance' | 'transfer' | 'assetReturn';

type CatalogOption = { id: string; code: string; name: string; status?: string };
type TransferOption = { id: string; itemId: string; label: string; trackingMode: 'QUANTITY' | 'LOT' | 'ASSET'; quantity: number; lotId?: string; assetId?: string };

function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
  if (!iso) throw new Error('Ngày phải theo định dạng DD/MM/YYYY.');
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error('Ngày dự kiến không hợp lệ.');
  }
  return iso;
}

const screenCopy: Record<InventoryActionMode, { title: string; subtitle: string; eyebrow: string; icon: 'add-box' | 'build' | 'swap-horiz' | 'keyboard-return'; action: string }> = {
  material: { title: 'Thêm vật tư', subtitle: 'Tạo danh mục vật tư mới trong farm', eyebrow: 'DANH MỤC VẬT TƯ', icon: 'add-box', action: 'Lưu vật tư nháp' },
  maintenance: { title: 'Bảo trì tài sản', subtitle: 'Lập lịch hoặc gửi yêu cầu sửa chữa đột xuất', eyebrow: 'BẢO TRÌ TÀI SẢN', icon: 'build', action: 'Tạo phiếu bảo trì' },
  transfer: { title: 'Tạo phiếu điều chuyển', subtitle: 'Chuyển tài sản hoặc vật tư giữa các kho', eyebrow: 'STOCK TRANSFER', icon: 'swap-horiz', action: 'Lưu phiếu điều chuyển' },
  assetReturn: { title: 'Trả tài sản về kho', subtitle: 'Đưa tài sản đã sử dụng trở lại kho', eyebrow: 'ASSET RETURN', icon: 'keyboard-return', action: 'Xác nhận trả kho' },
};

export default function InventoryActionScreen({ mode }: { mode: InventoryActionMode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string; itemId?: string; lotId?: string; sourceWarehouseId?: string }>();
  const { data: authData, currentFarmId, getAccessToken } = useAuthContext();
  const currentMembership = authData?.memberships.find(({ farm }) => farm.id === currentFarmId);
  const canScheduleMaintenance = currentMembership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;
  const copy = screenCopy[mode];
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<Array<{ id: string; label: string }>>([]);
  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [units, setUnits] = useState<CatalogOption[]>([]);
  const [transferOptions, setTransferOptions] = useState<TransferOption[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    categoryId: '',
    unitId: '',
    kind: 'CONSUMABLE',
    tracking: 'SỐ LƯỢNG',
    lotNumber: '',
    expiryDate: '',
    assetCode: '',
    serialNumber: '',
    asset: '',
    sourceWarehouse: '',
    destinationWarehouse: '',
    item: '',
    quantity: '1',
    title: '',
    scheduledDate: '',
    maintenanceType: 'Sửa chữa đột xuất',
    condition: 'Đã kiểm tra, hoạt động tốt',
    note: '',
  });
  const [picker, setPicker] = useState<keyof typeof pickerOptions | null>(null);
  const [successResult, setSuccessResult] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!currentFarmId) return;
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listWarehouses(token, currentFarmId),
        listItems(token, currentFarmId),
        apiRequest<{ data: CatalogOption[] }>('/categories', { token }),
        apiRequest<{ data: CatalogOption[] }>('/units', { token }),
        apiRequest<Paginated<{ asset: { id: string; assetCode: string; status: string }; itemName: string }>>('/assets', { token, params: { farmId: currentFarmId, page: 1, pageSize: 100 } }),
      ]);
    }).then(([warehouseResponse, itemResponse, categoryResponse, unitResponse, assetResponse]) => {
      if (cancelled) return;
      const activeCategories = categoryResponse.data.filter((option) => !option.status || option.status === 'ACTIVE');
      const activeUnits = unitResponse.data.filter((option) => !option.status || option.status === 'ACTIVE');
      setWarehouses(warehouseResponse.data);
      setItems(itemResponse.data);
      setCategories(activeCategories);
      setUnits(activeUnits);
      setAssets(assetResponse.data.filter(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status)).map(({ asset, itemName }) => ({ id: asset.id, label: `${asset.id} • ${asset.assetCode} • ${itemName}` })));
      const requestedSource = params.sourceWarehouseId && warehouseResponse.data.some((warehouse) => warehouse.id === params.sourceWarehouseId)
        ? params.sourceWarehouseId
        : '';
      const sourceWarehouse = params.itemId ? requestedSource : requestedSource || warehouseResponse.data[0]?.id || '';
      const suggestedDestination = warehouseResponse.data.find((warehouse) => warehouse.id !== sourceWarehouse)?.id ?? '';
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || activeCategories[0]?.id || '',
        unitId: current.unitId || activeUnits[0]?.id || '',
        sourceWarehouse,
        destinationWarehouse: !current.destinationWarehouse || current.destinationWarehouse === sourceWarehouse ? suggestedDestination : current.destinationWarehouse,
        asset: current.asset || (params.assetId ?? assetResponse.data.find(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status))?.asset.id ?? ''),
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
      return Promise.all([
        listBalances(token, currentFarmId, form.sourceWarehouse, true, true),
        listAvailableAssets(token, currentFarmId, form.sourceWarehouse),
      ]);
    }).then(([balanceResponse, availableAssets]) => {
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
      const assetById = new Map<string, AvailableAsset>();
      for (const asset of availableAssets) {
        if (asset.asset.farmId !== currentFarmId || asset.locationWarehouseId !== form.sourceWarehouse) continue;
        assetById.set(asset.asset.id, asset);
      }
      for (const asset of assetById.values()) {
        options.push({ id: `ASSET:${asset.asset.id}`, itemId: asset.asset.itemId, assetId: asset.asset.id, trackingMode: 'ASSET', quantity: 1, label: `${asset.itemName} • ${asset.asset.assetCode} • Tài sản` });
      }
      setTransferOptions(options);
      const requestedOption = params.assetId
        ? options.find((option) => option.assetId === params.assetId)
        : params.itemId
          ? options.find((option) => option.itemId === params.itemId && (!params.lotId || option.lotId === params.lotId))
          : undefined;
      setForm((current) => ({
        ...current,
        tracking: requestedOption ? requestedOption.trackingMode === 'ASSET' ? 'TÀI SẢN' : requestedOption.trackingMode === 'LOT' ? 'THEO LÔ' : 'SỐ LƯỢNG' : current.tracking,
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
  }, [currentFarmId, form.sourceWarehouse, getAccessToken, items, mode, params.assetId, params.itemId, params.lotId]);

  const pickerOptions = useMemo(() => ({
    tracking: mode === 'material' ? ['SỐ LƯỢNG', 'THEO LÔ'] : ['SỐ LƯỢNG', 'THEO LÔ', 'TÀI SẢN'],
    asset: assets.map((asset) => asset.label),
    sourceWarehouse: warehouses.map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
    destinationWarehouse: warehouses.map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
    item: transferOptions.filter((option) => option.trackingMode === (form.tracking === 'THEO LÔ' ? 'LOT' : form.tracking === 'TÀI SẢN' ? 'ASSET' : 'QUANTITY')).map((option) => option.label),
    categoryId: categories.map((category) => `${category.id} • ${category.name}`),
    unitId: units.map((unit) => `${unit.id} • ${unit.name}${unit.code ? ` (${unit.code})` : ''}`),
    kind: ['FEED', 'TREATMENT', 'PACKAGING', 'MAINTENANCE_SUPPLY', 'CONSUMABLE', 'OTHER'],
    maintenanceType: canScheduleMaintenance ? ['Định kỳ', 'Sửa chữa đột xuất', 'Vệ sinh thiết bị'] : ['Sửa chữa đột xuất'],
    condition: ['Đã kiểm tra, hoạt động tốt', 'Cần bảo dưỡng thêm', 'Hư hỏng chờ xử lý'],
  }), [assets, items, warehouses, canScheduleMaintenance]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function choose(value: string) {
    if (picker === 'item') {
      const option = transferOptions.find((candidate) => candidate.label === value);
      if (option) setForm((current) => ({ ...current, item: option.id, tracking: option.trackingMode === 'LOT' ? 'THEO LÔ' : option.trackingMode === 'ASSET' ? 'TÀI SẢN' : 'SỐ LƯỢNG' }));
    } else if (picker === 'tracking' && mode === 'transfer') {
      const trackingMode = value === 'THEO LÔ' ? 'LOT' : value === 'TÀI SẢN' ? 'ASSET' : 'QUANTITY';
      const firstMatching = transferOptions.find((option) => option.trackingMode === trackingMode);
      setForm((current) => ({ ...current, tracking: value, item: firstMatching?.id ?? '' }));
    } else if (picker === 'sourceWarehouse' && mode === 'transfer') {
      const sourceId = value.split(' • ')[0];
      const suggestedDestination = warehouses.find((warehouse) => warehouse.id !== sourceId)?.id ?? '';
      setForm((current) => ({
        ...current,
        sourceWarehouse: sourceId,
        destinationWarehouse: current.destinationWarehouse === sourceId || !current.destinationWarehouse
          ? suggestedDestination
          : current.destinationWarehouse,
      }));
    } else if (picker) update(picker, value.split(' • ')[0]);
    setPicker(null);
  }

  function submit() {
    if (mode === 'material' && (!form.code.trim() || !form.name.trim())) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã và tên vật tư.');
      return;
    }
    if (mode === 'transfer' && form.sourceWarehouse === form.destinationWarehouse) {
      Alert.alert('Kho không hợp lệ', 'Kho nguồn và kho đích phải khác nhau.');
      return;
    }
    if (mode === 'transfer' && (transferLoading || !transferOptions.some((option) => option.id === form.item))) {
      Alert.alert('Chưa có vật phẩm khả dụng', transferLoading ? 'Đang tải tồn kho của kho nguồn.' : 'Kho nguồn không có vật phẩm phù hợp với cách theo dõi đã chọn.');
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
      const selectedItem = form.item.split(' • ')[0];
      const selectedAsset = form.asset.split(' • ')[0];
      if (mode === 'transfer') {
        const selected = transferOptions.find((option) => option.id === form.item);
        if (!selected) throw new Error('Vật phẩm không còn trong danh sách tồn của kho nguồn.');
        const quantity = selected.trackingMode === 'ASSET' ? '1' : form.quantity;
        const parsedQuantity = Number(quantity);
        if (!/^\d+(\.\d{1,3})?$/.test(quantity) || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > selected.quantity) throw new Error(`Số lượng phải lớn hơn 0, tối đa 3 chữ số thập phân và không vượt quá tồn khả dụng (${formatQuantity(selected.quantity)}).`);
        await apiRequest('/stock-transfers', { method: 'POST', token, params: { farmId: currentFarmId }, body: { fromWarehouseId: selectedWarehouse, toWarehouseId: selectedDestination, transferCode: form.code || `TRANSFER-${Date.now()}`, items: [{ itemId: selected.itemId, quantity: String(quantity), lotId: selected.lotId, assetId: selected.assetId }] } });
      } else if (mode === 'assetReturn') {
        if (!selectedAsset || !selectedDestination) throw new Error('Cần chọn tài sản và kho nhận.');
        await apiRequest(`/assets/${selectedAsset}/return`, { method: 'POST', token, params: { farmId: currentFarmId }, body: { warehouseId: selectedDestination, note: form.note || null } });
      } else if (mode === 'maintenance') {
        const maintenanceType = form.maintenanceType === 'Vệ sinh thiết bị' ? 'INSPECTION' : form.maintenanceType === 'Định kỳ' ? 'PREVENTIVE' : 'CORRECTIVE';
        if (canScheduleMaintenance) {
          await apiRequest('/maintenance-records', { method: 'POST', token, params: { farmId: currentFarmId }, body: { assetId: selectedAsset, maintenanceType, scheduledAt: toIsoDate(form.scheduledDate), description: form.title } });
        } else {
          await apiRequest('/maintenance-requests', { method: 'POST', token, params: { farmId: currentFarmId }, body: { assetId: selectedAsset, maintenanceType: maintenanceType === 'PREVENTIVE' ? 'CORRECTIVE' : maintenanceType, description: form.title } });
        }
      } else {
        if (!form.categoryId || !form.unitId) throw new Error('Chọn danh mục và đơn vị tính từ catalog trước khi lưu.');
        await apiRequest('/materials', { method: 'POST', token, params: { farmId: currentFarmId }, body: { categoryId: form.categoryId, unitId: form.unitId, code: form.code.trim(), name: form.name.trim(), trackingMode: form.tracking === 'THEO LÔ' ? 'LOT' : 'QUANTITY', kind: form.kind, minStockLevel: '0', requiresExpiryTracking: false } });
      }
      const savedMessage = mode === 'maintenance' && !canScheduleMaintenance
        ? 'Yêu cầu sự cố đã gửi owner/admin duyệt. Bạn sẽ nhận thông báo khi có kết quả.'
        : mode === 'maintenance'
          ? 'Lịch bảo trì đã được tạo và ghi vào cơ sở dữ liệu.'
          : `${copy.title} đã được ghi vào cơ sở dữ liệu.`;
      setSuccessResult({
        title: mode === 'maintenance' && !canScheduleMaintenance ? 'Đã gửi yêu cầu bảo trì' : `${copy.title} thành công`,
        message: savedMessage,
      });
    } catch (cause: unknown) {
      Alert.alert('Không thể lưu', cause instanceof Error ? cause.message : 'API trả về lỗi.');
    }
  }

  return <>
  <AppShell active="inventory">
    <PageHeader title={copy.title} subtitle={`● ${copy.subtitle}`} onBack={() => router.back()} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><View style={styles.headerIcon}><Icon name={copy.icon} color={colors.primary} /></View></View>} />
    <View style={styles.intro}><View style={styles.introCopy}><Text style={styles.eyebrow}>{copy.eyebrow}</Text><Text style={styles.title} numberOfLines={2}>{copy.title}</Text><Text style={styles.subtitle} numberOfLines={2}>{copy.subtitle}</Text></View><Pill tone="amber"><Text style={styles.draft}>{mode === 'maintenance' ? canScheduleMaintenance ? 'LẬP LỊCH' : 'GỬI DUYỆT' : 'DRAFT'}</Text></Pill></View>
    {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

    {mode === 'material' ? <>
      <Card style={styles.formCard}>
        <SectionTitle title="Thông tin vật tư" count="Bắt buộc" />
        <Field label="Mã vật tư *" value={form.code} placeholder="VD: MAT-GLOVES-01" onChangeText={(value) => update('code', value)} autoCapitalize="characters" />
        <Field label="Tên vật tư *" value={form.name} placeholder="Nhập tên vật tư" onChangeText={(value) => update('name', value)} />
        <PickerField label="Danh mục *" value={categories.find((category) => category.id === form.categoryId)?.name ?? 'Chọn danh mục'} onPress={() => setPicker('categoryId')} />
        <View style={styles.twoColumns}><View style={styles.column}><PickerField label="Đơn vị tính *" value={units.find((unit) => unit.id === form.unitId)?.name ?? 'Chọn đơn vị'} onPress={() => setPicker('unitId')} /></View><View style={styles.column}><PickerField label="Cách theo dõi" value={form.tracking} onPress={() => setPicker('tracking')} /></View></View>
        <PickerField label="Phân loại vật tư" value={form.kind} onPress={() => setPicker('kind')} />
      </Card>
      {form.tracking === 'THEO LÔ' ? <Card style={styles.notice}><Icon name="info-outline" color={colors.primary} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Tạo lô ở phiếu nhập</Text><Text style={styles.noticeText}>Danh mục vật tư chỉ khai báo cách theo dõi. Mã lô và hạn sử dụng được ghi nhận khi tạo phiếu nhập kho.</Text></View></Card> : null}
    </> : null}

    {mode === 'maintenance' ? <Card style={styles.formCard}><SectionTitle title={canScheduleMaintenance ? 'Lập lịch bảo trì' : 'Báo sự cố cần bảo trì'} count="Bắt buộc" /><PickerField label="Tài sản" value={form.asset} onPress={() => setPicker('asset')} /><Field label={canScheduleMaintenance ? 'Nội dung bảo trì *' : 'Mô tả sự cố *'} value={form.title} placeholder="VD: Máy quay phát tiếng kêu bất thường" onChangeText={(value) => update('title', value)} /><View style={styles.twoColumns}><View style={styles.column}><PickerField label={canScheduleMaintenance ? 'Loại bảo trì' : 'Loại yêu cầu'} value={form.maintenanceType} onPress={() => setPicker('maintenanceType')} /></View>{canScheduleMaintenance ? <View style={styles.column}><Field label="Ngày dự kiến" value={form.scheduledDate} placeholder="DD/MM/YYYY" onChangeText={(value) => update('scheduledDate', value)} /></View> : null}</View><Field label="Thông tin bổ sung" value={form.note} placeholder="Mô tả thêm tình trạng thiết bị" onChangeText={(value) => update('note', value)} multiline /></Card> : null}

    {mode === 'transfer' ? <Card style={styles.formCard}><SectionTitle title="Thông tin điều chuyển" count="Bắt buộc" /><PickerField label="Kho nguồn" value={warehouses.find((warehouse) => warehouse.id === form.sourceWarehouse)?.name ?? 'Chọn kho nguồn'} onPress={() => setPicker('sourceWarehouse')} /><PickerField label="Kho đích" value={warehouses.find((warehouse) => warehouse.id === form.destinationWarehouse)?.name ?? 'Chọn kho đích'} onPress={() => setPicker('destinationWarehouse')} /><PickerField label="Cách theo dõi" value={form.tracking} onPress={() => setPicker('tracking')} /><PickerField label="Vật tư / lô / tài sản trong kho nguồn" value={transferOptions.find((option) => option.id === form.item)?.label ?? (transferLoading ? 'Đang tải tồn kho...' : 'Chọn vật phẩm có tồn')} onPress={() => setPicker('item')} />{transferOptions.find((option) => option.id === form.item)?.trackingMode !== 'ASSET' ? <Field label={`Số lượng chuyển (tối đa ${formatQuantity(transferOptions.find((option) => option.id === form.item)?.quantity ?? 0)})`} value={form.quantity} placeholder="0" onChangeText={(value) => update('quantity', value)} keyboardType="decimal-pad" /> : null}<Field label="Lý do điều chuyển" value={form.note} placeholder="Nhập lý do" onChangeText={(value) => update('note', value)} multiline /></Card> : null}

    {mode === 'assetReturn' ? <Card style={styles.formCard}><SectionTitle title="Thông tin trả tài sản" count="Bắt buộc" /><PickerField label="Tài sản" value={form.asset} onPress={() => setPicker('asset')} /><PickerField label="Kho nhận" value={form.destinationWarehouse} onPress={() => setPicker('destinationWarehouse')} /><PickerField label="Tình trạng khi trả" value={form.condition} onPress={() => setPicker('condition')} /><Field label="Ghi chú bàn giao" value={form.note} placeholder="Nhập ghi chú hiện trường" onChangeText={(value) => update('note', value)} multiline /></Card> : null}

    <Card style={styles.notice}><Icon name="info-outline" color={colors.primary} /><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{mode === 'maintenance' ? canScheduleMaintenance ? 'Lịch bảo trì' : 'Quy trình duyệt sự cố' : 'Quy trình duyệt'}</Text><Text style={styles.noticeText}>{mode === 'maintenance' ? canScheduleMaintenance ? 'Owner/admin tạo lịch SCHEDULED cho tài sản. Nhân viên không thể tự ghi hồ sơ bảo trì trực tiếp.' : 'Yêu cầu sẽ được gửi owner/admin trong farm. Chỉ sau khi duyệt, hệ thống mới tạo lịch bảo trì; kết quả gửi lại tài khoản của bạn.' : 'Biểu mẫu được lưu ở DRAFT. Tồn kho chỉ thay đổi sau khi người có quyền xác nhận.'}</Text></View></Card>
    <View style={styles.actions}><Pressable onPress={() => router.back()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Hủy</Text></Pressable><View style={styles.submit}><PrimaryButton label={copy.action} icon="save" onPress={submit} /></View></View>

    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>LỰA CHỌN</Text><Text style={styles.modalTitle}>Chọn thông tin</Text></View><Pressable onPress={() => setPicker(null)} style={styles.close}><Icon name="close" color={colors.onSurfaceVariant} /></Pressable></View><ScrollView contentContainerStyle={styles.options}>{picker ? pickerOptions[picker].map((option) => <Pressable key={option} onPress={() => choose(option)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.option, form[picker] === option && styles.optionActive, pressed && styles.pressed]}><Icon name={form[picker] === option ? 'radio-button-checked' : 'radio-button-unchecked'} color={form[picker] === option ? colors.primary : colors.outline} /><Text style={styles.optionText} numberOfLines={3}>{option}</Text></Pressable>) : null}</ScrollView></View></View>
    </Modal>
  </AppShell>
  <OperationResultDialog
    visible={Boolean(successResult)}
    title={successResult?.title ?? ''}
    message={successResult?.message ?? ''}
    actionLabel="Hoàn tất"
    onAction={() => {
      setSuccessResult(null);
      router.back();
    }}
  />
  </>;
}

function Field({ label, value, placeholder, onChangeText, multiline = false, keyboardType, autoCapitalize = 'sentences' }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: 'decimal-pad' | 'number-pad'; autoCapitalize?: 'sentences' | 'characters' | 'none' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.outline} style={[styles.input, multiline && styles.multiline]} multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize} /></View>;
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

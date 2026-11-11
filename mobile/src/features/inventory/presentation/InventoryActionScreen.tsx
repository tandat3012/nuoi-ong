import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import {
  balanceMatchesTrackingMode,
  filterPositiveBalancesForScope,
  getAssetById,
  listAssetsPage,
  listBalancesPage,
  listWarehouses,
  unwrap,
  type InventoryBalance,
  type Warehouse,
} from '@/src/features/inventory/api';
import { navigateToReceiptList } from '@/src/features/inventory/receipt-list.logic';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';
import { formatQuantity } from '@/src/shared/format-quantity';
import { validateQuantityInput } from '@/src/shared/quantity-input';
import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';

export type InventoryActionMode = 'maintenance' | 'transfer';

type TransferOption = {
  id: string;
  itemId: string;
  label: string;
  code: string;
  name: string;
  trackingMode: 'QUANTITY' | 'LOT';
  quantity: number;
  lotId?: string;
  lotCode?: string;
  imageUrl?: string | null;
};

type AssetOption = {
  id: string;
  label: string;
  code: string;
  name: string;
  status: string;
  imageUrl?: string | null;
};

const ACTION_PICKER_PAGE_SIZE = 20;

const screenCopy: Record<InventoryActionMode, { title: string; subtitle: string; eyebrow: string; icon: 'build' | 'swap-horiz'; action: string }> = {
  maintenance: { title: 'Báo sự cố tài sản', subtitle: 'Gửi yêu cầu sửa chữa để quản lý xử lý trên web', eyebrow: 'BẢO TRÌ TÀI SẢN', icon: 'build', action: 'Gửi yêu cầu bảo trì' },
  transfer: { title: 'Tạo phiếu điều chuyển', subtitle: 'Chuyển vật tư hoặc lô giữa các kho', eyebrow: 'STOCK TRANSFER', icon: 'swap-horiz', action: 'Gửi duyệt điều chuyển' },
};

function mapBalanceToTransferOption(row: InventoryBalance): TransferOption | null {
  if (row.trackingMode === 'ASSET') return null;
  const quantity = Number(row.balance.quantityOnHand);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (row.trackingMode === 'LOT') {
    if (!row.balance.lotId) return null;
    const lotTag = row.lot?.lotCode ?? row.lotCode ?? `LOT ${row.balance.lotId.slice(0, 8)}`;
    return {
      id: `LOT:${row.balance.id}`,
      itemId: row.balance.itemId,
      lotId: row.balance.lotId,
      lotCode: row.lot?.lotCode ?? row.lotCode ?? undefined,
      trackingMode: 'LOT',
      quantity,
      name: row.itemName,
      code: row.itemCode,
      imageUrl: row.itemImageUrl ?? row.item?.imageUrl,
      label: `${row.itemName} • ${row.itemCode} • ${lotTag} • Tồn ${formatQuantity(quantity)}`,
    };
  }
  return {
    id: `QTY:${row.balance.itemId}`,
    itemId: row.balance.itemId,
    trackingMode: 'QUANTITY',
    quantity,
    name: row.itemName,
    code: row.itemCode,
    imageUrl: row.itemImageUrl ?? row.item?.imageUrl,
    label: `${row.itemName} • ${row.itemCode} • Tồn ${formatQuantity(quantity)}`,
  };
}

const ServerPickerRow = memo(function ServerPickerRow({
  id,
  label,
  imageUrl,
  selected,
  onPress,
}: {
  id: string;
  label: string;
  imageUrl?: string | null;
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const thumb = toThumbnailUrl(imageUrl, 128);
  return (
    <Pressable
      onPress={() => onPress(id)}
      android_ripple={{ color: colors.primaryFixed }}
      style={({ pressed }) => [styles.option, selected && styles.optionActive, pressed && styles.pressed]}
    >
      <View style={styles.optionThumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.optionThumbImage} resizeMode="cover" />
        ) : (
          <Icon name="inventory-2" size={18} color={colors.primary} />
        )}
      </View>
      <Text style={styles.optionText} numberOfLines={3}>{label}</Text>
      <Icon
        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        color={selected ? colors.primary : colors.outline}
      />
    </Pressable>
  );
});

export default function InventoryActionScreen({ mode }: { mode: InventoryActionMode }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ assetId?: string; itemId?: string; lotId?: string; sourceWarehouseId?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const copy = screenCopy[mode];

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [destinationWarehouses, setDestinationWarehouses] = useState<Warehouse[]>([]);
  const [selectedAssetOptions, setSelectedAssetOptions] = useState<AssetOption[]>([]);
  const [selectedTransferOption, setSelectedTransferOption] = useState<TransferOption | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    tracking: 'SỐ LƯỢNG',
    sourceWarehouse: '',
    destinationWarehouse: '',
    item: '',
    quantity: '1',
    title: '',
    maintenanceType: 'Sửa chữa đột xuất',
    note: '',
  });

  type PickerKind = 'tracking' | 'asset' | 'sourceWarehouse' | 'destinationWarehouse' | 'item';
  const [picker, setPicker] = useState<PickerKind | null>(null);

  // Server-paginated picker state (used when picker === 'asset' || picker === 'item')
  const [pickerSearch, setPickerSearch] = useState('');
  const [debouncedPickerSearch, setDebouncedPickerSearch] = useState('');
  const [serverAssets, setServerAssets] = useState<AssetOption[]>([]);
  const [serverTransferOptions, setServerTransferOptions] = useState<TransferOption[]>([]);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerTotalPages, setPickerTotalPages] = useState(1);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerLoadingMore, setPickerLoadingMore] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerReloadNonce, setPickerReloadNonce] = useState(0);
  const pickerAbortRef = useRef<AbortController | null>(null);
  const deepLinkAppliedRef = useRef(false);

  const [successResult, setSuccessResult] = useState<{
    title: string;
    message?: string;
    details?: Array<{ label: string; value: string }>;
    items?: Array<{ name: string; quantity: string }>;
  } | null>(null);

  useEffect(() => {
    if (!currentFarmId) return;
    const controller = new AbortController();
    deepLinkAppliedRef.current = false;

    void getAccessToken().then(async (token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const warehousePromise = listWarehouses(token, currentFarmId);
      const destPromise = mode === 'transfer'
        ? listWarehouses(token, currentFarmId, true)
        : Promise.resolve({ data: [] as Warehouse[] });

      let assetPromise: Promise<AssetOption | null> = Promise.resolve(null);
      if (mode === 'maintenance') {
        if (params.assetId) {
          assetPromise = getAssetById(token, currentFarmId, params.assetId, controller.signal)
            .then((row) =>
              !['LOST', 'RETIRED', 'MAINTENANCE'].includes(row.asset.status)
                ? {
                    id: row.asset.id,
                    code: row.asset.assetCode,
                    name: row.itemName,
                    status: row.asset.status,
                    imageUrl: row.itemImageUrl,
                    label: `${row.itemName} · ${row.asset.assetCode}`,
                  }
                : null,
            )
            .catch(() => null);
        }
      }

      return Promise.all([warehousePromise, destPromise, assetPromise]);
    }).then(([warehouseResponse, destinationWarehouseResponse, firstAsset]) => {
      if (controller.signal.aborted) return;
      setWarehouses(warehouseResponse.data);
      const allDestinations = destinationWarehouseResponse.data.length > 0
        ? destinationWarehouseResponse.data
        : warehouseResponse.data;
      setDestinationWarehouses(allDestinations);

      const requestedSource =
        params.sourceWarehouseId && warehouseResponse.data.some((warehouse) => warehouse.id === params.sourceWarehouseId)
          ? params.sourceWarehouseId
          : '';
      const sourceWarehouse = params.itemId ? requestedSource : requestedSource || warehouseResponse.data[0]?.id || '';
      const suggestedDestination = allDestinations.find((warehouse) => warehouse.id !== sourceWarehouse)?.id ?? '';

      if (firstAsset) setSelectedAssetOptions([firstAsset]);
      setForm((current) => ({
        ...current,
        sourceWarehouse,
        destinationWarehouse: !current.destinationWarehouse || current.destinationWarehouse === sourceWarehouse
          ? suggestedDestination
          : current.destinationWarehouse,
      }));
      setLoadError(null);
    }).catch((cause: unknown) => {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        setLoadError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu lựa chọn từ DB.');
      }
    });

    return () => controller.abort();
  }, [currentFarmId, getAccessToken, mode, params.assetId, params.itemId, params.sourceWarehouseId]);

  useEffect(() => {
    if (mode !== 'transfer' || !currentFarmId || !form.sourceWarehouse) {
      setSelectedTransferOption(null);
      return;
    }
    const controller = new AbortController();
    setTransferLoading(true);

    void getAccessToken().then(async (token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

      let preferredOption: TransferOption | null = null;
      if (params.itemId && !deepLinkAppliedRef.current) {
        deepLinkAppliedRef.current = true;
        const deepRes = await listBalancesPage(
          token,
          currentFarmId,
          {
            warehouseId: form.sourceWarehouse,
            itemIds: [params.itemId],
            lotId: params.lotId || undefined,
            excludeTrackingMode: 'ASSET',
            positiveOnly: true,
            page: 1,
            pageSize: 20,
            skipCache: true,
          },
          controller.signal,
        );
        const scopedRows = filterPositiveBalancesForScope(deepRes.data, currentFarmId, form.sourceWarehouse);
        const matchedRow = scopedRows.find(
          (row) => row.balance.itemId === params.itemId && (!params.lotId || row.balance.lotId === params.lotId),
        );
        if (matchedRow) preferredOption = mapBalanceToTransferOption(matchedRow);
      }

      if (!preferredOption) {
        const expectedMode = form.tracking === 'THEO LÔ' ? 'LOT' : 'QUANTITY';
        const defaultRes = await listBalancesPage(
          token,
          currentFarmId,
          {
            warehouseId: form.sourceWarehouse,
            excludeTrackingMode: 'ASSET',
            trackingMode: expectedMode,
            positiveOnly: true,
            page: 1,
            pageSize: 5,
            skipCache: true,
          },
          controller.signal,
        );
        const scoped = filterPositiveBalancesForScope(defaultRes.data, currentFarmId, form.sourceWarehouse);
        for (const row of scoped) {
          const opt = mapBalanceToTransferOption(row);
          if (opt && opt.trackingMode === expectedMode) {
            preferredOption = opt;
            break;
          }
        }
      }

      if (controller.signal.aborted) return;
      setSelectedTransferOption(preferredOption);
      setForm((current) => ({
        ...current,
        tracking: preferredOption
          ? (preferredOption.trackingMode === 'LOT' ? 'THEO LÔ' : 'SỐ LƯỢNG')
          : current.tracking,
        item: preferredOption?.id ?? '',
      }));
      setLoadError(null);
    }).catch((cause: unknown) => {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        setSelectedTransferOption(null);
        setLoadError(cause instanceof Error ? cause.message : 'Không thể tải tồn tại kho nguồn.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setTransferLoading(false);
    });

    return () => controller.abort();
  }, [currentFarmId, form.sourceWarehouse, form.tracking, getAccessToken, mode, params.itemId, params.lotId]);

  useEffect(() => {
    if (picker !== 'asset' && picker !== 'item') {
      pickerAbortRef.current?.abort();
      pickerAbortRef.current = null;
      return;
    }
    const timer = setTimeout(() => setDebouncedPickerSearch(pickerSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [picker, pickerSearch]);

  const loadPickerServerPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      if (!currentFarmId || (picker !== 'asset' && picker !== 'item')) return;
      pickerAbortRef.current?.abort();
      const controller = new AbortController();
      pickerAbortRef.current = controller;

      if (append) setPickerLoadingMore(true);
      else setPickerLoading(true);
      setPickerError(null);

      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

        if (picker === 'asset') {
          const res = await listAssetsPage(
            token,
            currentFarmId,
            {
              excludeStatuses: ['LOST', 'RETIRED', 'MAINTENANCE'],
              search: debouncedPickerSearch || undefined,
              page: pageNumber,
              pageSize: ACTION_PICKER_PAGE_SIZE,
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const mapped: AssetOption[] = res.data
            .filter(({ asset }) => !['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status))
            .map(({ asset, itemName, itemImageUrl }) => ({
              id: asset.id,
              code: asset.assetCode,
              name: itemName,
              status: asset.status,
              imageUrl: itemImageUrl,
              label: `${itemName} · ${asset.assetCode}`,
            }));
          setPickerPage(res.page.number);
          setPickerTotalPages(Math.max(1, res.page.totalPages));
          setServerAssets((prev) => {
            if (!append) return mapped;
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...mapped.filter((a) => !seen.has(a.id))];
          });
        } else {
          if (!form.sourceWarehouse) {
            throw new Error('Hãy chọn kho nguồn trước.');
          }
          const expectedMode = form.tracking === 'THEO LÔ' ? 'LOT' : 'QUANTITY';
          const res = await listBalancesPage(
            token,
            currentFarmId,
            {
              warehouseId: form.sourceWarehouse,
              excludeTrackingMode: 'ASSET',
              trackingMode: expectedMode,
              search: debouncedPickerSearch || undefined,
              positiveOnly: true,
              page: pageNumber,
              pageSize: ACTION_PICKER_PAGE_SIZE,
              skipCache: true,
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const scoped = filterPositiveBalancesForScope(res.data, currentFarmId, form.sourceWarehouse);
          const mapped = scoped
            .map(mapBalanceToTransferOption)
            .filter((opt): opt is TransferOption => opt !== null && opt.trackingMode === expectedMode);
          setPickerPage(res.page.number);
          setPickerTotalPages(Math.max(1, res.page.totalPages));
          setServerTransferOptions((prev) => {
            if (!append) return mapped;
            const seen = new Set(prev.map((opt) => opt.id));
            return [...prev, ...mapped.filter((opt) => !seen.has(opt.id))];
          });
        }
      } catch (cause: unknown) {
        if (isAbortError(cause) || controller.signal.aborted) return;
        setPickerError(cause instanceof Error ? cause.message : 'Không thể tải danh sách lựa chọn.');
      } finally {
        if (!controller.signal.aborted) {
          setPickerLoading(false);
          setPickerLoadingMore(false);
        }
      }
    },
    [currentFarmId, debouncedPickerSearch, form.sourceWarehouse, form.tracking, getAccessToken, picker],
  );

  useEffect(() => {
    if (picker !== 'asset' && picker !== 'item') return;
    void loadPickerServerPage(1, false);
    return () => {
      pickerAbortRef.current?.abort();
    };
  }, [picker, loadPickerServerPage, pickerReloadNonce]);

  function openPicker(kind: PickerKind) {
    if (kind === 'asset' || kind === 'item') {
      setPickerSearch('');
      setDebouncedPickerSearch('');
      setServerAssets([]);
      setServerTransferOptions([]);
      setPickerPage(1);
      setPickerTotalPages(1);
      setPickerError(null);
    }
    setPicker(kind);
  }

  const staticPickerOptions = useMemo(() => ({
    tracking: ['SỐ LƯỢNG', 'THEO LÔ'],
    sourceWarehouse: warehouses.map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
    destinationWarehouse: destinationWarehouses
      .filter((warehouse) => warehouse.id !== form.sourceWarehouse)
      .map((warehouse) => `${warehouse.id} • ${warehouse.code} • ${warehouse.name}`),
  }), [destinationWarehouses, form.sourceWarehouse, warehouses]);

  const transferQuantityError = mode === 'transfer'
    ? validateQuantityInput(form.quantity, { max: selectedTransferOption?.quantity })
    : null;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseStatic(value: string) {
    if (picker === 'tracking' && mode === 'transfer') {
      setSelectedTransferOption(null);
      setForm((current) => ({ ...current, tracking: value, item: '' }));
    } else if (picker === 'sourceWarehouse' && mode === 'transfer') {
      const sourceId = value.split(' • ')[0];
      const suggestedDestination = destinationWarehouses.find((warehouse) => warehouse.id !== sourceId)?.id ?? '';
      setSelectedTransferOption(null);
      setForm((current) => ({
        ...current,
        sourceWarehouse: sourceId,
        item: '',
        destinationWarehouse:
          current.destinationWarehouse === sourceId || !current.destinationWarehouse
            ? suggestedDestination
            : current.destinationWarehouse,
      }));
    } else if (picker === 'destinationWarehouse') {
      update('destinationWarehouse', value.split(' • ')[0]);
    }
    setPicker(null);
  }

  const chooseServerAsset = useCallback((assetId: string) => {
    const found = serverAssets.find((asset) => asset.id === assetId);
    setSelectedAssetOptions((current) => {
      if (current.some((asset) => asset.id === assetId)) {
        return current.filter((asset) => asset.id !== assetId);
      }
      return found ? [...current, found] : current;
    });
  }, [serverAssets]);

  const chooseServerTransferOption = useCallback((optionId: string) => {
    const found = serverTransferOptions.find((opt) => opt.id === optionId);
    if (found) {
      setSelectedTransferOption(found);
      setForm((current) => ({
        ...current,
        item: found.id,
        tracking: found.trackingMode === 'LOT' ? 'THEO LÔ' : 'SỐ LƯỢNG',
      }));
    }
    setPicker(null);
  }, [serverTransferOptions]);

  function submit() {
    if (submittingRef.current) return;
    if (mode === 'transfer' && form.sourceWarehouse === form.destinationWarehouse) {
      Alert.alert('Kho không hợp lệ', 'Kho nguồn và kho đích phải khác nhau.');
      return;
    }
    if (mode === 'transfer' && (transferLoading || !selectedTransferOption || form.item !== selectedTransferOption.id)) {
      Alert.alert('Chưa có vật phẩm khả dụng', transferLoading ? 'Đang tải tồn kho của kho nguồn.' : 'Kho nguồn không có vật phẩm phù hợp với cách theo dõi đã chọn.');
      return;
    }
    if (mode === 'transfer' && transferQuantityError) {
      Alert.alert('Số lượng điều chuyển không hợp lệ', `${selectedTransferOption?.label ?? 'Vật tư'}: “${form.quantity || 'trống'}”. ${transferQuantityError}`);
      return;
    }
    if (mode === 'maintenance' && selectedAssetOptions.length === 0) {
      Alert.alert('Thiếu tài sản', 'Vui lòng chọn ít nhất một tài sản cần báo bảo trì.');
      return;
    }
    if (mode === 'maintenance' && !form.title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung bảo trì.');
      return;
    }
    void saveToApi();
  }

  async function saveToApi() {
    if (submittingRef.current) return;
    if (!currentFarmId) {
      Alert.alert('Chưa chọn farm', 'Vui lòng chọn trang trại trước khi tạo dữ liệu.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const selectedWarehouse = form.sourceWarehouse.split(' • ')[0];
      const selectedDestination = form.destinationWarehouse.split(' • ')[0];
      let createdTransferId: string | null = null;

      if (mode === 'transfer') {
        const selected = selectedTransferOption;
        if (!selected) throw new Error('Vật phẩm không còn trong danh sách tồn của kho nguồn.');
        const quantity = form.quantity;
        const latest = await listBalancesPage(token, currentFarmId, {
          warehouseId: selectedWarehouse,
          itemIds: [selected.itemId],
          trackingMode: selected.trackingMode,
          lotId: selected.lotId || undefined,
          positiveOnly: true,
          page: 1,
          pageSize: 100,
          skipCache: true,
        });
        const available = filterPositiveBalancesForScope(latest.data, currentFarmId, selectedWarehouse)
          .filter(({ balance }) =>
            balance.itemId === selected.itemId &&
            balanceMatchesTrackingMode(balance, selected.trackingMode) &&
            (selected.trackingMode !== 'LOT' || balance.lotId === selected.lotId),
          )
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
        const created: Array<{ asset: AssetOption; id: string | null }> = [];
        const failed: Array<{ asset: AssetOption; message: string }> = [];
        for (const asset of selectedAssetOptions) {
          try {
            const response = await apiRequest<{ data: { id: string } } | { id: string }>(
              '/maintenance-requests',
              {
                method: 'POST',
                token,
                params: { farmId: currentFarmId },
                body: { assetId: asset.id, maintenanceType: 'CORRECTIVE', description: form.title.trim() },
              },
            );
            created.push({ asset, id: (unwrap(response) as { id?: string })?.id ?? null });
          } catch (cause: unknown) {
            failed.push({ asset, message: cause instanceof Error ? cause.message : 'API trả về lỗi.' });
          }
        }

        if (failed.length > 0) {
          setSelectedAssetOptions(failed.map(({ asset }) => asset));
          if (created.length > 0) clearApiCache();
          Alert.alert(
            created.length > 0 ? 'Đã gửi một phần' : 'Chưa gửi được yêu cầu',
            [
              `Thành công: ${created.length}/${selectedAssetOptions.length}.`,
              created.length > 0 ? `Đã gửi: ${created.map(({ asset }) => asset.code).join(', ')}.` : '',
              `Chưa gửi: ${failed.map(({ asset, message }) => `${asset.code}: ${message}`).join('; ')}.`,
              'Các tài sản chưa gửi được giữ lại để bạn xử lý; không tự gửi lại những phiếu đã tạo.',
            ].filter(Boolean).join('\n'),
          );
          return;
        }

        clearApiCache();
        setSuccessResult({
          title: 'Đã gửi yêu cầu bảo trì',
          message: 'Mỗi tài sản đã được tạo thành một phiếu riêng để theo dõi và xử lý.',
          details: [
            { label: 'Số phiếu', value: String(created.length) },
            ...created.map(({ asset, id }) => ({
              label: asset.code,
              value: id ? `MNT-${id.slice(0, 8)}` : 'Đã gửi',
            })),
          ],
        });
        return;
      }

      clearApiCache();
      if (mode === 'transfer') {
        const sourceName = warehouses.find((w) => w.id === selectedWarehouse)?.name ?? form.sourceWarehouse;
        const destName =
          destinationWarehouses.find((w) => w.id === selectedDestination)?.name ??
          warehouses.find((w) => w.id === selectedDestination)?.name ??
          form.destinationWarehouse;
        setSuccessResult({
          title: 'Đã gửi duyệt phiếu điều chuyển',
          details: [
            { label: 'Mã phiếu', value: createdTransferId ? `CK-${createdTransferId.slice(0, 8)}` : '—' },
            { label: 'Kho nguồn', value: sourceName },
            { label: 'Kho đích', value: destName },
          ],
          items: selectedTransferOption
            ? [{ name: selectedTransferOption.label, quantity: `${form.quantity} đơn vị` }]
            : undefined,
        });
      }
    } catch (cause: unknown) {
      Alert.alert('Không thể lưu', cause instanceof Error ? cause.message : 'API trả về lỗi.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const isServerPicker = picker === 'asset' || picker === 'item';

  return (
    <>
      <AppShell active="receipts">
        <PageHeader
          title={copy.title}
          subtitle={`● ${copy.subtitle}`}
          onBack={() => router.back()}
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <NotificationBell />
              <View style={styles.headerIcon}>
                <Icon name={copy.icon} color={colors.primary} />
              </View>
            </View>
          }
        />
        <View style={styles.intro}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.title} numberOfLines={2}>{copy.title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{copy.subtitle}</Text>
          </View>
          <Pill tone="amber"><Text style={styles.draft}>GỬI DUYỆT</Text></Pill>
        </View>
        {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

        {mode === 'maintenance' ? (
          <Card style={styles.formCard}>
            <SectionTitle title="Báo sự cố cần bảo trì" count="Bắt buộc" />
            <PickerField
              label="Vật phẩm"
              value={
                selectedAssetOptions.length === 0
                  ? 'Chọn một hoặc nhiều tài sản'
                  : `${selectedAssetOptions.length} tài sản đã chọn`
              }
              onPress={() => openPicker('asset')}
            />
            {selectedAssetOptions.length > 0 ? (
              <Text style={styles.selectedAssetsSummary} numberOfLines={3}>
                {selectedAssetOptions.map((asset) => asset.label).join('\n')}
              </Text>
            ) : null}
            <Field
              label="Mô tả sự cố *"
              value={form.title}
              placeholder="VD: Máy quay phát tiếng kêu bất thường"
              onChangeText={(value) => update('title', value)}
            />
            <Field
              label="Thông tin bổ sung"
              value={form.note}
              placeholder="Mô tả thêm tình trạng thiết bị"
              onChangeText={(value) => update('note', value)}
              multiline
            />
          </Card>
        ) : null}

        {mode === 'transfer' ? (
          <Card style={styles.formCard}>
            <SectionTitle title="Thông tin điều chuyển" count="Bắt buộc" />
            <PickerField
              label="Kho nguồn"
              value={warehouses.find((warehouse) => warehouse.id === form.sourceWarehouse)?.name ?? 'Chọn kho nguồn'}
              onPress={() => openPicker('sourceWarehouse')}
            />
            <PickerField
              label="Kho đích"
              value={
                destinationWarehouses.find((warehouse) => warehouse.id === form.destinationWarehouse)?.name ??
                warehouses.find((warehouse) => warehouse.id === form.destinationWarehouse)?.name ??
                'Chọn kho đích'
              }
              onPress={() => openPicker('destinationWarehouse')}
            />
            <PickerField
              label="Cách theo dõi"
              value={form.tracking}
              onPress={() => openPicker('tracking')}
            />
            <PickerField
              label="Vật tư / lô trong kho nguồn"
              value={selectedTransferOption?.label ?? (transferLoading ? 'Đang tải tồn kho...' : 'Chọn vật tư có tồn')}
              onPress={() => openPicker('item')}
            />
            <Field
              label={`Số lượng chuyển (tối đa ${formatQuantity(selectedTransferOption?.quantity ?? 0)})`}
              value={form.quantity}
              placeholder="0"
              onChangeText={(value) => update('quantity', value)}
              keyboardType="decimal-pad"
              error={transferQuantityError}
            />
            <Field
              label="Lý do điều chuyển"
              value={form.note}
              placeholder="Nhập lý do"
              onChangeText={(value) => update('note', value)}
              multiline
            />
          </Card>
        ) : null}

        <Card style={styles.notice}>
          <Icon name="info-outline" color={colors.primary} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>
              {mode === 'maintenance' ? 'Quy trình duyệt sự cố' : 'Quy trình duyệt điều chuyển'}
            </Text>
            <Text style={styles.noticeText}>
              {mode === 'maintenance'
                ? 'Yêu cầu sẽ được gửi người có quyền duyệt trong trại. Chỉ sau khi duyệt, hệ thống mới tạo lịch bảo trì; kết quả gửi lại tài khoản của bạn.'
                : 'Phiếu sẽ được gửi duyệt tới quản lý kho nguồn để xuất hàng, sau đó quản lý kho đích xác nhận nhận hàng.'}
            </Text>
          </View>
        </Card>
        <View style={styles.actions}>
          <Pressable
            disabled={submitting}
            onPress={() => router.back()}
            android_ripple={{ color: colors.primaryFixed }}
            style={({ pressed }) => [styles.cancel, submitting && styles.disabledAction, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Hủy</Text>
          </Pressable>
          <View style={styles.submit}>
            <PrimaryButton
              label={submitting ? 'Đang gửi...' : copy.action}
              icon="save"
              loading={submitting}
              onPress={submitting ? undefined : submit}
            />
          </View>
        </View>

        <Modal
          visible={isServerPicker}
          transparent={false}
          presentationStyle="fullScreen"
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setPicker(null)}
        >
          <View style={[styles.fullPickerScreen, { paddingTop: insets.top }]}>
            <View style={styles.fullPickerTopBar}>
              <Pressable
                onPress={() => setPicker(null)}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
                accessibilityLabel="Quay lại"
              >
                <Icon name="arrow-back" size={22} color={colors.primary} />
              </Pressable>
              <View style={styles.fullPickerHeaderCopy}>
                <Text style={styles.modalEyebrow}>LỰA CHỌN</Text>
                <Text numberOfLines={2} style={styles.modalTitle}>
                  {picker === 'asset'
                    ? `Chọn tài sản (${selectedAssetOptions.length} đã chọn)`
                    : 'Chọn vật tư / lô tại kho nguồn'}
                </Text>
              </View>
              {picker === 'asset' ? (
                <Pressable
                  onPress={() => setPicker(null)}
                  android_ripple={{ color: colors.primaryFixed }}
                  style={({ pressed }) => [styles.pickerDoneButton, pressed && styles.pressed]}
                >
                  <Text style={styles.pickerDoneText}>Xong</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={[styles.fullPickerBody, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
              <View style={styles.pickerSearchWrap}>
                <Icon name="search" size={19} color={colors.onSurfaceVariant} />
                <TextInput
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder={
                    picker === 'asset'
                      ? 'Tìm tên hoặc mã tài sản...'
                      : 'Tìm tên, mã vật tư hoặc mã lô...'
                  }
                  placeholderTextColor={colors.outline}
                  style={styles.pickerSearchInput}
                  returnKeyType="search"
                />
                {pickerSearch.length > 0 ? (
                  <Pressable onPress={() => setPickerSearch('')}>
                    <Icon name="cancel" size={18} color={colors.outline} />
                  </Pressable>
                ) : null}
              </View>

              {picker === 'asset' ? (
                <FlatList
                  data={serverAssets}
                  keyExtractor={(item) => item.id}
                  style={styles.fullPickerList}
                  contentContainerStyle={styles.options}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  onEndReachedThreshold={0.4}
                  onEndReached={() => {
                    if (!pickerLoading && !pickerLoadingMore && pickerPage < pickerTotalPages) {
                      void loadPickerServerPage(pickerPage + 1, true);
                    }
                  }}
                  renderItem={({ item }) => (
                    <ServerPickerRow
                      id={item.id}
                      label={item.label}
                      imageUrl={item.imageUrl}
                      selected={selectedAssetOptions.some((asset) => asset.id === item.id)}
                      onPress={chooseServerAsset}
                    />
                  )}
                  ListEmptyComponent={
                    pickerLoading ? (
                      <View style={styles.pickerCenterState}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.pickerStateText}>Đang tải danh sách tài sản...</Text>
                      </View>
                    ) : pickerError ? (
                      <View style={styles.pickerCenterState}>
                        <Text style={styles.pickerErrorText}>{pickerError}</Text>
                        <Pressable onPress={() => setPickerReloadNonce((n) => n + 1)} style={styles.retryButton}>
                          <Text style={styles.retryButtonText}>Thử lại</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.pickerCenterState}>
                        <Text style={styles.pickerStateText}>Không tìm thấy tài sản phù hợp.</Text>
                      </View>
                    )
                  }
                  ListFooterComponent={
                    pickerLoadingMore ? (
                      <View style={styles.pickerCenterState}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.pickerStateText}>Đang tải thêm...</Text>
                      </View>
                    ) : null
                  }
                />
              ) : (
                <FlatList
                  data={serverTransferOptions}
                  keyExtractor={(item) => item.id}
                  style={styles.fullPickerList}
                  contentContainerStyle={styles.options}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  onEndReachedThreshold={0.4}
                  onEndReached={() => {
                    if (!pickerLoading && !pickerLoadingMore && pickerPage < pickerTotalPages) {
                      void loadPickerServerPage(pickerPage + 1, true);
                    }
                  }}
                  renderItem={({ item }) => (
                    <ServerPickerRow
                      id={item.id}
                      label={item.label}
                      imageUrl={item.imageUrl}
                      selected={form.item === item.id}
                      onPress={chooseServerTransferOption}
                    />
                  )}
                  ListEmptyComponent={
                    pickerLoading ? (
                      <View style={styles.pickerCenterState}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.pickerStateText}>Đang tải tồn kho nguồn...</Text>
                      </View>
                    ) : pickerError ? (
                      <View style={styles.pickerCenterState}>
                        <Text style={styles.pickerErrorText}>{pickerError}</Text>
                        <Pressable onPress={() => setPickerReloadNonce((n) => n + 1)} style={styles.retryButton}>
                          <Text style={styles.retryButtonText}>Thử lại</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.pickerCenterState}>
                        <Text style={styles.pickerStateText}>Kho nguồn chưa có tồn khả dụng cho lựa chọn này.</Text>
                      </View>
                    )
                  }
                  ListFooterComponent={
                    pickerLoadingMore ? (
                      <View style={styles.pickerCenterState}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.pickerStateText}>Đang tải thêm...</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={picker !== null && !isServerPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setPicker(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>LỰA CHỌN</Text>
                  <Text style={styles.modalTitle}>Chọn thông tin</Text>
                </View>
                <Pressable onPress={() => setPicker(null)} style={styles.close}>
                  <Icon name="close" color={colors.onSurfaceVariant} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.options}>
                {picker && (picker === 'tracking' || picker === 'sourceWarehouse' || picker === 'destinationWarehouse')
                  ? staticPickerOptions[picker].map((option) => {
                      const optionId = option.split(' • ')[0];
                      const isSelected = picker === 'tracking' ? form.tracking === option : form[picker] === optionId;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => chooseStatic(option)}
                          android_ripple={{ color: colors.primaryFixed }}
                          style={({ pressed }) => [styles.option, isSelected && styles.optionActive, pressed && styles.pressed]}
                        >
                          <Icon
                            name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                            color={isSelected ? colors.primary : colors.outline}
                          />
                          <Text style={styles.optionText} numberOfLines={3}>{option}</Text>
                        </Pressable>
                      );
                    })
                  : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </AppShell>
      <OperationResultDialog
        visible={Boolean(successResult)}
        title={successResult?.title ?? ''}
        message={successResult?.message}
        details={successResult?.details}
        items={successResult?.items}
        actionLabel="Về danh sách phiếu"
        onAction={() => {
          setSuccessResult(null);
          navigateToReceiptList(router, navigation, mode === 'transfer' ? 'TRANSFER' : 'MAINTENANCE');
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  multiline = false,
  keyboardType,
  autoCapitalize = 'sentences',
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
  autoCapitalize?: 'sentences' | 'characters' | 'none';
  error?: string | null;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: colors.primaryFixed }}
        style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}
      >
        <Text style={styles.pickerValue} numberOfLines={2}>{value}</Text>
        <Icon name="expand-more" color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
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
  selectedAssetsSummary: { ...typography.bodySm, color: colors.onSurfaceVariant, paddingHorizontal: spacing.spaceSm },
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
  disabledAction: { opacity: 0.6 },
  fullPickerScreen: { flex: 1, backgroundColor: colors.surface },
  fullPickerTopBar: { minHeight: 56, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  backCircle: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  fullPickerHeaderCopy: { flex: 1, minWidth: 0 },
  pickerDoneButton: { minHeight: 38, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pickerDoneText: { ...typography.labelMd, color: colors.onPrimary },
  fullPickerBody: { flex: 1, paddingHorizontal: spacing.gutterMobile, paddingTop: spacing.spaceMd, gap: spacing.spaceSm },
  fullPickerList: { flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  modalSheet: { maxHeight: '78%', padding: spacing.spaceLg, gap: spacing.spaceSm, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd },
  modalEyebrow: { ...typography.labelSm, color: colors.secondary },
  modalTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  pickerSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  pickerSearchInput: { flex: 1, minWidth: 0, ...typography.bodySm, color: colors.onSurface, paddingVertical: 6 },
  pickerFlatList: { maxHeight: 420 },
  pickerCenterState: { alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingVertical: spacing.spaceLg },
  pickerStateText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  pickerErrorText: { ...typography.bodySm, color: colors.error, textAlign: 'center' },
  retryButton: { marginTop: spacing.spaceXs, paddingHorizontal: spacing.spaceMd, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer },
  retryButtonText: { ...typography.labelMd, color: colors.deepAmberStrong },
  options: { gap: spacing.spaceSm, paddingVertical: spacing.spaceSm },
  option: { minHeight: 52, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  optionActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  optionThumb: { width: 36, height: 36, borderRadius: radius.default, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  optionThumbImage: { width: 36, height: 36 },
  optionText: { flex: 1, minWidth: 0, ...typography.bodyMd, color: colors.onSurface, flexShrink: 1 },
});

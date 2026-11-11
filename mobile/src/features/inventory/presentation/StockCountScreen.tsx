import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
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

import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import {
  documentCodeLabel,
  getItemById,
  listBalancesPage,
  listItemsPage,
  listWarehouses,
  statusLabel,
  unwrap,
  type InventoryBalance,
  type InventoryLot,
  type StockCountDetail,
  type Warehouse,
} from '@/src/features/inventory/api';
import {
  ItemMultiSelectModal,
  type MultiSelectFetchParams,
  type MultiSelectLine,
} from '@/src/features/inventory/presentation/ItemMultiSelectModal';
import { LotPickerModal } from '@/src/features/inventory/presentation/LotPickerModal';
import { isStockCountEditable, navigateToReceiptList } from '@/src/features/inventory/receipt-list.logic';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';
import { formatQuantity } from '@/src/shared/format-quantity';
import { quantityInputNumber, validateQuantityInput } from '@/src/shared/quantity-input';
import { AppShell, Card, Icon, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';

type CountItem = {
  id: string;
  itemId: string;
  lotId?: string | null;
  lotCode?: string | null;
  assetId?: string | null;
  name: string;
  code: string;
  imageUrl?: string | null;
  system: number;
  unit: string;
  initial: number;
  icon: 'toys' | 'grid-view' | 'medication';
  reason?: string;
};

type DiffFilter = 'ALL' | 'DIFF' | 'MATCH';

type PendingLotSelection = {
  itemId: string;
  name: string;
  code: string;
  imageUrl?: string | null;
  unit: string;
  initialQuantity: number;
};

type BalanceQrResponse = {
  data: {
    balanceId: string;
    balance: InventoryBalance['balance'];
    itemCode: string;
    itemName: string;
    itemImageUrl?: string | null;
    itemType: string;
    trackingMode: string;
    warehouseName: string;
    lotCode?: string | null;
  };
};

type AssetByQrResponse = {
  data: {
    asset: { id: string; assetCode: string };
    itemName: string;
  };
};

const COUNT_BALANCE_PAGE_SIZE = 20;
const COUNT_TRACKING_FILTER_OPTIONS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'QUANTITY', label: 'Theo số lượng' },
  { key: 'LOT', label: 'Theo lô' },
];
const honeycombBorderImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKySLYr_2aB1HqM6wOg1d_bAjSbFQd2SibqjBOFrHHnz0-AUgzUguTCrq85FmurMSO6uJcxfVt4vDBd1GJ6dfS6lcHZz0gnWEeklCFbz8XiYR_u0-E8QE2E8TbDrB3pzvRLGapoMRMV3SbSTnMqLDUivF5SDgJnk11QeKunQZt1eY_Fkb4CW9IJ7rwLsOmE74G-baMq627wJYYeEOJ-ezrWKxZ8LdQiBTiPZA_MxaYe9vOU-KyDP-5A';
const countHeaderImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBb_MRRQSULZVH-tdLML-KDpqN-N4_Q0XNi2f3igKldc5om0J3_zWEyDXjpJT8lcuWHrhPCv-o7-Z_Fyh_s5I2JcOerjQX-xwTMhqFxk7SsHxV936R_0d44Y64GbwmSH6NGFPpNp9kUMlVgHQT2dPmLFQvVjxBtJp-qwqgCPYR8TS7XNMBPMtmTKX-d2mRcE9-150iVpGozN4wbYj4gRnwkL2LEz6jyOXu7tLVb6eTx82MJFVktcEQolg';

function countLineKey(itemId: string, lotId?: string | null) {
  return `${itemId}::${lotId ?? ''}`;
}

function mapBalanceToCountItem(row: InventoryBalance): CountItem {
  const { balance, itemCode, itemName, itemImageUrl, itemType, item, lot, lotCode } = row;
  return {
    id: balance.id,
    itemId: balance.itemId,
    lotId: balance.lotId,
    lotCode: lot?.lotCode ?? lotCode ?? null,
    name: itemName,
    code: itemCode,
    imageUrl: itemImageUrl ?? item?.imageUrl ?? null,
    system: Number(balance.quantityOnHand),
    unit: item?.unit?.symbol ?? item?.unit?.name ?? itemType,
    initial: Number(balance.quantityOnHand),
    icon: 'grid-view',
  };
}

function extractQrToken(value: string) {
  const trimmed = value.trim();
  const inventoryRouteMatch = trimmed.match(/\/scan\/inventory\/([^/?#]+)/i);
  if (inventoryRouteMatch?.[1]) return `inventory:${decodeURIComponent(inventoryRouteMatch[1])}`;
  const itemRouteMatch = trimmed.match(/\/scan\/item\/([^/?#]+)/i);
  if (itemRouteMatch?.[1]) return `item:${decodeURIComponent(itemRouteMatch[1])}`;
  const routeMatch = trimmed.match(/\/scan\/([^/?#]+)/i);
  if (routeMatch?.[1]) {
    try {
      return decodeURIComponent(routeMatch[1]);
    } catch {
      return routeMatch[1];
    }
  }
  return trimmed;
}

type ItemCardProps = {
  item: CountItem;
  actual: number;
  rawInput: string | undefined;
  reasonValue: string | undefined;
  highlighted: boolean;
  editable: boolean;
  onAdjustCount: (id: string, delta: number) => void;
  onChangeCountInput: (id: string, value: string) => void;
  onChangeReason: (id: string, value: string) => void;
};

const StockCountItemCard = memo(function StockCountItemCard({
  item,
  actual,
  rawInput,
  reasonValue,
  highlighted,
  editable,
  onAdjustCount,
  onChangeCountInput,
  onChangeReason,
}: ItemCardProps) {
  const diff = actual - item.system;
  const quantityError = editable
    ? validateQuantityInput(rawInput ?? String(actual), { allowZero: true })
    : null;
  const thumbUrl = toThumbnailUrl(item.imageUrl, 128);
  const showReason = editable
    ? diff !== 0 || item.reason !== undefined || Boolean(reasonValue?.trim())
    : diff !== 0 || Boolean(reasonValue?.trim());

  return (
    <Card style={[styles.item, highlighted && styles.itemHighlighted]}>
      <View style={styles.itemHead}>
        <View style={styles.itemIdentity}>
          <View style={[styles.itemIcon, diff < 0 && styles.itemIconDanger]}>
            {thumbUrl ? (
              <Image source={{ uri: thumbUrl }} style={styles.itemImage} resizeMode="cover" />
            ) : (
              <Icon
                name={item.icon}
                size={22}
                color={diff < 0 ? colors.primary : colors.statusSuccessStrong}
              />
            )}
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemName} numberOfLines={3}>
              {item.name}
            </Text>
            <Text style={styles.itemCode} numberOfLines={2}>
              Mã: {item.code}
              {item.lotCode ? ` · Lô ${item.lotCode}` : item.lotId ? ` · Lô ${item.lotId.slice(0, 8)}` : ''}
            </Text>
          </View>
        </View>
        <Pill tone={quantityError ? 'amber' : diff === 0 ? 'success' : diff < 0 ? 'danger' : 'amber'}>
          <Text
            numberOfLines={3}
            style={
              quantityError
                ? styles.amber
                : diff === 0
                ? styles.success
                : diff < 0
                ? styles.danger
                : styles.amber
            }
          >
            {quantityError
              ? 'Số đếm chưa hợp lệ'
              : diff === 0
              ? '✓ Khớp tồn (0)'
              : `${diff < 0 ? '↓ Hụt' : '↑ Dư'} ${formatQuantity(Math.abs(diff))} ${item.unit}`}
          </Text>
        </Pill>
      </View>

      <View style={styles.countGrid}>
        <View style={styles.systemColumn}>
          <Text style={styles.label} numberOfLines={2}>
            Tồn hệ thống
          </Text>
          <Text style={styles.system} numberOfLines={2}>
            {formatQuantity(item.system)} <Text style={styles.unit}>{item.unit}</Text>
          </Text>
        </View>
        <View style={styles.actual}>
          <Text style={styles.label} numberOfLines={2}>
            Thực tế đếm
          </Text>
          {editable ? (
            <View style={styles.counter}>
              <Pressable
                onPress={() => onAdjustCount(item.id, -1)}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}
              >
                <Text style={styles.quantityText}>−</Text>
              </Pressable>
              <TextInput
                value={rawInput ?? formatQuantity(actual)}
                onChangeText={(value) => onChangeCountInput(item.id, value)}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={[styles.input, (diff < 0 || quantityError) && styles.inputDanger]}
              />
              <Pressable
                onPress={() => onAdjustCount(item.id, 1)}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}
              >
                <Text style={styles.quantityText}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.actualReadOnly, diff < 0 && styles.actualReadOnlyDanger]}>
              {formatQuantity(actual)} <Text style={styles.unit}>{item.unit}</Text>
            </Text>
          )}
        </View>
      </View>

      {quantityError ? <Text style={styles.countError}>{quantityError}</Text> : null}

      {showReason ? (
        <View style={styles.reason}>
          <View style={styles.reasonLabel}>
            <Icon name="edit-note" size={16} color={colors.primary} />
            <Text style={styles.reasonText} numberOfLines={3}>
              Lý do chênh lệch:
            </Text>
          </View>
          {editable ? (
            <TextInput
              multiline
              value={reasonValue ?? ''}
              onChangeText={(value) => onChangeReason(item.id, value)}
              placeholder="Nhập lý do chênh lệch..."
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.reasonInput}
            />
          ) : (
            <Text style={styles.reasonReadOnly}>
              {reasonValue?.trim() ? reasonValue : 'Chưa nhập lý do'}
            </Text>
          )}
        </View>
      ) : null}
    </Card>
  );
});

export default function StockCountScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [countCode, setCountCode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [countStatus, setCountStatus] = useState('DRAFT');
  const [createdCountId, setCreatedCountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(params.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Server pagination state for initial warehouse balances (Option A)
  const [balancePage, setBalancePage] = useState(0);
  const [balanceTotalPages, setBalanceTotalPages] = useState(0);
  const [balanceTotalItems, setBalanceTotalItems] = useState(0);
  const [loadingMoreBalances, setLoadingMoreBalances] = useState(false);

  // Local search & filter over countItems
  const [localSearch, setLocalSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('ALL');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Modals
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [pendingLotQueue, setPendingLotQueue] = useState<PendingLotSelection[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [qrProcessing, setQrProcessing] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);

  const [successId, setSuccessId] = useState<string | null>(null);
  const [successSubmitted, setSuccessSubmitted] = useState(false);

  const flatListRef = useRef<FlatList<CountItem>>(null);
  const savingRef = useRef(false);
  const currentLotPrompt = pendingLotQueue[0] ?? null;

  const effectiveCountId = params.id ?? createdCountId;
  const canEditCount = isStockCountEditable(loading, error, countStatus);
  const canEditCountRef = useRef(canEditCount);
  canEditCountRef.current = canEditCount;

  const currentFarmName =
    data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ??
    (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ??
    'Chưa chọn trang trại';

  const applyCountDetail = useCallback((detail: StockCountDetail) => {
    const mapped: CountItem[] = detail.items.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      lotId: line.lotId,
      lotCode: line.lotCode ?? null,
      assetId: line.assetId,
      name: line.itemName ?? 'Vật tư không còn trong danh mục',
      code: line.itemCode ?? line.itemId,
      imageUrl: line.itemImageUrl ?? null,
      system: Number(line.systemQuantity ?? 0),
      unit: line.unitSymbol ?? line.unitName ?? 'đơn vị',
      initial: Number(line.actualQuantity ?? 0),
      icon: 'grid-view',
      reason: line.note ?? undefined,
    }));
    setCountItems(mapped);
    setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial])));
    setQuantityInputs({});
    setReasons(
      Object.fromEntries(
        mapped.filter((item) => item.reason).map((item) => [item.id, item.reason ?? '']),
      ),
    );
    setCountCode(documentCodeLabel(detail.count.countCode, detail.count.id, 'KK'));
    setWarehouseId(detail.count.warehouseId);
    setCountStatus(detail.count.status);
    setBalancePage(1);
    setBalanceTotalPages(1);
    setBalanceTotalItems(mapped.length);
  }, []);

  const reloadCountDetail = useCallback(
    async (countId: string, signal?: AbortSignal) => {
      if (!currentFarmId) return;
      setLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const [detailResponse, warehouseResponse] = await Promise.all([
          apiRequest<StockCountDetail>(`/stock-counts/${countId}`, {
            token,
            params: { farmId: currentFarmId },
            skipCache: true,
            signal,
          }),
          listWarehouses(token, currentFarmId),
        ]);
        if (signal?.aborted) return;
        setWarehouses(warehouseResponse.data);
        applyCountDetail(unwrap(detailResponse));
        setError(null);
      } catch (cause: unknown) {
        if (!isAbortError(cause) && !signal?.aborted) {
          setError(cause instanceof Error ? cause.message : 'Không thể tải phiếu kiểm kê.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [applyCountDetail, currentFarmId, getAccessToken],
  );

  useEffect(() => {
    setCreatedCountId(null);
    if (!currentFarmId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    if (params.id) {
      void reloadCountDetail(params.id, controller.signal);
      return () => controller.abort();
    }
    setLoading(true);
    void getAccessToken()
      .then(async (token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const warehouseResponse = await listWarehouses(token, currentFarmId);
        const initialWarehouseId = warehouseResponse.data[0]?.id;
        const balanceResponse = initialWarehouseId
          ? await listBalancesPage(
              token,
              currentFarmId,
              {
                warehouseId: initialWarehouseId,
                page: 1,
                pageSize: COUNT_BALANCE_PAGE_SIZE,
                excludeTrackingMode: 'ASSET',
                skipCache: true,
              },
              controller.signal,
            )
          : null;
        return { warehouseResponse, balanceResponse };
      })
      .then(({ warehouseResponse, balanceResponse }) => {
        if (controller.signal.aborted) return;
        setWarehouses(warehouseResponse.data);
        const mapped =
          balanceResponse?.data
            .filter((row) => row.trackingMode !== 'ASSET')
            .map(mapBalanceToCountItem) ?? [];
        setCountItems(mapped);
        setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial])));
        setQuantityInputs({});
        setReasons({});
        setCountCode('');
        setWarehouseId(warehouseResponse.data[0]?.id ?? '');
        setCountStatus('DRAFT');
        setBalancePage(balanceResponse?.page.number ?? 1);
        setBalanceTotalPages(balanceResponse?.page.totalPages ?? 1);
        setBalanceTotalItems(balanceResponse?.page.totalItems ?? mapped.length);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!isAbortError(cause) && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Không thể tải phiếu kiểm kê.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [currentFarmId, getAccessToken, params.id, reloadCountDetail]);

  const adjustCount = useCallback((id: string, delta: number) => {
    if (!canEditCountRef.current) return;
    setValues((current) => {
      const next = Math.max(0, (current[id] ?? 0) + delta);
      if (validateQuantityInput(String(next), { allowZero: true })) return current;
      setQuantityInputs((inputs) => ({ ...inputs, [id]: String(next) }));
      return { ...current, [id]: next };
    });
  }, []);

  const changeCountInput = useCallback((id: string, raw: string) => {
    if (!canEditCountRef.current) return;
    setQuantityInputs((current) => ({ ...current, [id]: raw }));
    if (!validateQuantityInput(raw, { allowZero: true })) {
      setValues((current) => ({ ...current, [id]: quantityInputNumber(raw) }));
    }
  }, []);

  const changeReason = useCallback((id: string, value: string) => {
    if (!canEditCountRef.current) return;
    setReasons((current) => ({ ...current, [id]: value }));
  }, []);

  async function selectWarehouse(id: string) {
    setWarehousePickerOpen(false);
    if (!canEditCountRef.current || effectiveCountId) return;
    setWarehouseId(id);
    if (!currentFarmId) return;
    setLoading(true);
    setLocalSearch('');
    setDiffFilter('ALL');
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listBalancesPage(token, currentFarmId, {
        warehouseId: id,
        page: 1,
        pageSize: COUNT_BALANCE_PAGE_SIZE,
        excludeTrackingMode: 'ASSET',
        skipCache: true,
      });
      const mapped = response.data
        .filter((row) => row.trackingMode !== 'ASSET')
        .map(mapBalanceToCountItem);
      setCountItems(mapped);
      setValues(Object.fromEntries(mapped.map((item) => [item.id, item.initial])));
      setQuantityInputs({});
      setReasons({});
      setBalancePage(response.page.number);
      setBalanceTotalPages(response.page.totalPages);
      setBalanceTotalItems(response.page.totalItems);
    } catch (cause: unknown) {
      Alert.alert(
        'Không thể tải tồn kho',
        cause instanceof Error ? cause.message : 'Không thể tải vật tư của kho đã chọn.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreBalances() {
    if (
      !canEditCountRef.current ||
      effectiveCountId ||
      !currentFarmId ||
      !warehouseId ||
      loadingMoreBalances ||
      balancePage >= balanceTotalPages
    ) {
      return;
    }
    setLoadingMoreBalances(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listBalancesPage(token, currentFarmId, {
        warehouseId,
        page: balancePage + 1,
        pageSize: COUNT_BALANCE_PAGE_SIZE,
        excludeTrackingMode: 'ASSET',
        skipCache: true,
      });
      const existingKeys = new Set(
        countItems.map((line) => countLineKey(line.itemId, line.lotId)),
      );
      const added = response.data
        .filter((row) => row.trackingMode !== 'ASSET')
        .map(mapBalanceToCountItem)
        .filter((line) => !existingKeys.has(countLineKey(line.itemId, line.lotId)));

      if (added.length > 0) {
        setCountItems((prev) => [...prev, ...added]);
        setValues((prev) => {
          const next = { ...prev };
          for (const line of added) {
            if (next[line.id] === undefined) next[line.id] = line.initial;
          }
          return next;
        });
      }
      setBalancePage(response.page.number);
      setBalanceTotalPages(response.page.totalPages);
      setBalanceTotalItems(response.page.totalItems);
    } catch (cause: unknown) {
      Alert.alert(
        'Không thể tải thêm tồn kho',
        cause instanceof Error ? cause.message : 'Vui lòng thử lại.',
      );
    } finally {
      setLoadingMoreBalances(false);
    }
  }

  const fetchModalItemsPage = useCallback(
    async (fetchParams: MultiSelectFetchParams) => {
      if (!currentFarmId) {
        return {
          items: [],
          page: { number: 1, size: fetchParams.pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listItemsPage(
        token,
        currentFarmId,
        {
          page: fetchParams.page,
          pageSize: fetchParams.pageSize,
          search: fetchParams.search || undefined,
          categoryId: fetchParams.categoryId || undefined,
          trackingMode: fetchParams.trackingMode || undefined,
          excludeTrackingMode: 'ASSET',
        },
        fetchParams.signal,
      );
      return {
        items: response.data
          .filter((item) => item.trackingMode !== 'ASSET')
          .map((item) => ({
            id: item.id,
            itemId: item.id,
            name: item.name,
            code: item.code,
            categoryName: item.categoryName,
            unit: item.unitSymbol ?? item.unitName ?? item.itemType,
            trackingMode: item.trackingMode,
            imageUrl: item.imageUrl,
          })),
        page: response.page,
      };
    },
    [currentFarmId, getAccessToken],
  );

  async function handleAddCatalogConfirm(selectedLines: MultiSelectLine[]) {
    if (!canEditCountRef.current || !currentFarmId || selectedLines.length === 0) return;

    const existingKeys = new Set(
      countItems.map((line) => countLineKey(line.itemId, line.lotId)),
    );
    const qtyLines = selectedLines.filter(
      (line) =>
        line.trackingMode !== 'LOT' && !existingKeys.has(countLineKey(line.itemId, null)),
    );
    const lotLines: PendingLotSelection[] = selectedLines
      .filter((line) => line.trackingMode === 'LOT')
      .map((line) => ({
        itemId: line.itemId,
        name: line.name,
        code: line.code,
        imageUrl: line.imageUrl,
        unit: line.unit,
        initialQuantity: Math.max(0, quantityInputNumber(line.quantity) || 0),
      }));

    if (qtyLines.length > 0) {
      const balanceByItemId = new Map<string, InventoryBalance>();
      if (warehouseId) {
        try {
          const token = await getAccessToken();
          if (token) {
            const scopedBalances = await listBalancesPage(token, currentFarmId, {
              warehouseId,
              itemIds: qtyLines.map((l) => l.itemId),
              trackingMode: 'QUANTITY',
              page: 1,
              pageSize: 100,
              skipCache: true,
            });
            for (const row of scopedBalances.data) {
              balanceByItemId.set(row.balance.itemId, row);
            }
          }
        } catch {
          // Safe fallback: system stays 0 if scoped prefetch fails; server snapshots on save.
        }
      }

      const addedLines: CountItem[] = qtyLines.map((line) => {
        const balanceRow = balanceByItemId.get(line.itemId);
        const qty = quantityInputNumber(line.quantity);
        return {
          id: balanceRow?.balance.id ?? `new-${line.itemId}`,
          itemId: line.itemId,
          lotId: null,
          lotCode: null,
          name: line.name,
          code: line.code,
          imageUrl: line.imageUrl,
          system: balanceRow ? Number(balanceRow.balance.quantityOnHand) : 0,
          unit: line.unit,
          initial: qty,
          icon: 'grid-view',
          reason: '',
        };
      });

      setCountItems((prev) => [...prev, ...addedLines]);
      setValues((prev) => {
        const next = { ...prev };
        for (const line of addedLines) {
          next[line.id] = line.initial;
        }
        return next;
      });
      setQuantityInputs((prev) => {
        const next = { ...prev };
        for (const line of addedLines) {
          next[line.id] = String(line.initial);
        }
        return next;
      });
      setReasons((prev) => {
        const next = { ...prev };
        for (const line of addedLines) {
          next[line.id] = '';
        }
        return next;
      });
    }

    if (lotLines.length > 0) {
      setPendingLotQueue((prev) => [...prev, ...lotLines]);
    }
  }

  async function handleSelectLotForQueue(lot: InventoryLot) {
    if (!canEditCountRef.current) return;
    const target = pendingLotQueue[0];
    if (!target || !currentFarmId) return;
    setPendingLotQueue((prev) => prev.slice(1));

    const existing = countItems.find(
      (line) => line.itemId === target.itemId && (line.lotId ?? null) === lot.id,
    );
    if (existing) {
      focusAndHighlightLine(existing.id);
      return;
    }

    let systemQty = 0;
    let balanceId = `new-${target.itemId}-${lot.id}`;
    if (warehouseId) {
      try {
        const token = await getAccessToken();
        if (token) {
          const scoped = await listBalancesPage(token, currentFarmId, {
            warehouseId,
            itemId: target.itemId,
            lotId: lot.id,
            page: 1,
            pageSize: 5,
            skipCache: true,
          });
          const row = scoped.data[0];
          if (row) {
            balanceId = row.balance.id;
            systemQty = Number(row.balance.quantityOnHand);
          }
        }
      } catch {
        // Fallback to system 0; API snapshots actual balance on save.
      }
    }

    const newLine: CountItem = {
      id: balanceId,
      itemId: target.itemId,
      lotId: lot.id,
      lotCode: lot.lotCode,
      name: target.name,
      code: target.code,
      imageUrl: target.imageUrl,
      system: systemQty,
      unit: target.unit,
      initial: target.initialQuantity,
      icon: 'grid-view',
      reason: '',
    };

    setCountItems((prev) => [...prev, newLine]);
    setValues((prev) => ({ ...prev, [newLine.id]: newLine.initial }));
    setQuantityInputs((prev) => ({ ...prev, [newLine.id]: String(newLine.initial) }));
    setReasons((prev) => ({ ...prev, [newLine.id]: '' }));
    focusAndHighlightLine(newLine.id);
  }

  function focusAndHighlightLine(lineId: string) {
    setLocalSearch('');
    setDiffFilter('ALL');
    setHighlightedId(lineId);
    setTimeout(() => {
      setHighlightedId((curr) => (curr === lineId ? null : curr));
    }, 3000);
    setTimeout(() => {
      const index = countItems.findIndex((entry) => entry.id === lineId);
      if (index >= 0) {
        try {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 });
        } catch {
          // Safe fallback if index was just appended
        }
      }
    }, 120);
  }

  async function resolveScannedQr(rawInput: string) {
    if (!canEditCountRef.current) return;
    const trimmed = rawInput.trim();
    if (!trimmed) {
      Alert.alert('Thiếu mã QR', 'Hãy quét hoặc nhập mã QR để tìm nhanh vật tư.');
      return;
    }
    if (/^exp:\/\//i.test(trimmed)) {
      setBarcodeScanned(false);
      Alert.alert('Sai loại mã QR', 'Đây là mã QR Expo Go, không phải mã vật tư hoặc tồn kho.');
      return;
    }
    if (!currentFarmId) {
      Alert.alert('Chưa chọn trang trại', 'Vui lòng chọn trang trại trước.');
      return;
    }

    const extracted = extractQrToken(trimmed);
    setQrProcessing(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

      if (extracted.startsWith('inventory:')) {
        const balanceId = extracted.slice('inventory:'.length);
        const res = await apiRequest<BalanceQrResponse>(
          `/inventory/${encodeURIComponent(balanceId)}/qr`,
          { token, params: { farmId: currentFarmId } },
        );
        const payload = res.data;
        if (payload.trackingMode === 'ASSET') {
          Alert.alert('Không thuộc kiểm kê vật tư', 'Mã QR này là tài sản cố định, được kiểm kê tại mục Tài sản.');
          return;
        }
        if (warehouseId && payload.balance.warehouseId !== warehouseId) {
          Alert.alert(
            'Khác kho đang kiểm kê',
            `Tồn kho này nằm tại “${payload.warehouseName}”, không thuộc kho đang chọn.`,
          );
          return;
        }
        const existing = countItems.find(
          (line) =>
            line.itemId === payload.balance.itemId &&
            (line.lotId ?? null) === (payload.balance.lotId ?? null),
        );
        setQrModalOpen(false);
        if (existing) {
          focusAndHighlightLine(existing.id);
          return;
        }
        const qty = Number(payload.balance.quantityOnHand);
        const added: CountItem = {
          id: payload.balance.id,
          itemId: payload.balance.itemId,
          lotId: payload.balance.lotId,
          lotCode: payload.lotCode ?? null,
          name: payload.itemName,
          code: payload.itemCode,
          imageUrl: payload.itemImageUrl ?? null,
          system: qty,
          unit: payload.itemType,
          initial: qty,
          icon: 'grid-view',
        };
        setCountItems((prev) => [added, ...prev]);
        setValues((prev) => ({ ...prev, [added.id]: added.initial }));
        focusAndHighlightLine(added.id);
        return;
      }

      if (extracted.startsWith('item:')) {
        const itemId = extracted.slice('item:'.length);
        const item = await getItemById(token, currentFarmId, itemId);
        if (item.trackingMode === 'ASSET') {
          Alert.alert('Không thuộc kiểm kê vật tư', 'Mặt hàng này là tài sản cố định.');
          return;
        }
        if (item.trackingMode === 'LOT') {
          setQrModalOpen(false);
          const matchingLots = countItems.filter((line) => line.itemId === item.id);
          if (matchingLots.length > 0) {
            setLocalSearch(item.code);
            setDiffFilter('ALL');
            focusAndHighlightLine(matchingLots[0].id);
          } else {
            setPendingLotQueue([
              {
                itemId: item.id,
                name: item.name,
                code: item.code,
                imageUrl: item.imageUrl,
                unit: item.unitSymbol ?? item.unitName ?? item.itemType,
                initialQuantity: 1,
              },
            ]);
          }
          return;
        }

        const existing = countItems.find(
          (line) => line.itemId === item.id && !line.lotId,
        );
        setQrModalOpen(false);
        if (existing) {
          focusAndHighlightLine(existing.id);
          return;
        }
        let systemQty = 0;
        let lineId = `new-${item.id}`;
        if (warehouseId) {
          const scoped = await listBalancesPage(token, currentFarmId, {
            warehouseId,
            itemIds: [item.id],
            trackingMode: 'QUANTITY',
            page: 1,
            pageSize: 5,
            skipCache: true,
          });
          const row = scoped.data[0];
          if (row) {
            lineId = row.balance.id;
            systemQty = Number(row.balance.quantityOnHand);
          }
        }
        const added: CountItem = {
          id: lineId,
          itemId: item.id,
          lotId: null,
          name: item.name,
          code: item.code,
          imageUrl: item.imageUrl,
          system: systemQty,
          unit: item.unitSymbol ?? item.unitName ?? item.itemType,
          initial: systemQty,
          icon: 'grid-view',
          reason: '',
        };
        setCountItems((prev) => [added, ...prev]);
        setValues((prev) => ({ ...prev, [added.id]: added.initial }));
        focusAndHighlightLine(added.id);
        return;
      }

      // Raw UUID fallback: try inventory QR first, then check asset QR for a clear message
      try {
        const res = await apiRequest<BalanceQrResponse>(
          `/inventory/${encodeURIComponent(extracted)}/qr`,
          { token, params: { farmId: currentFarmId } },
        );
        const payload = res.data;
        setQrModalOpen(false);
        const existing = countItems.find(
          (line) =>
            line.itemId === payload.balance.itemId &&
            (line.lotId ?? null) === (payload.balance.lotId ?? null),
        );
        if (existing) {
          focusAndHighlightLine(existing.id);
          return;
        }
        const qty = Number(payload.balance.quantityOnHand);
        const added: CountItem = {
          id: payload.balance.id,
          itemId: payload.balance.itemId,
          lotId: payload.balance.lotId,
          lotCode: payload.lotCode ?? null,
          name: payload.itemName,
          code: payload.itemCode,
          imageUrl: payload.itemImageUrl ?? null,
          system: qty,
          unit: payload.itemType,
          initial: qty,
          icon: 'grid-view',
        };
        setCountItems((prev) => [added, ...prev]);
        setValues((prev) => ({ ...prev, [added.id]: added.initial }));
        focusAndHighlightLine(added.id);
        return;
      } catch {
        try {
          const assetRes = await apiRequest<AssetByQrResponse>(
            `/assets/by-qr/${encodeURIComponent(extracted)}`,
            { token, params: { farmId: currentFarmId } },
          );
          Alert.alert(
            'Mã tài sản cố định',
            `“${assetRes.data.itemName} (${assetRes.data.asset.assetCode})” là tài sản định danh, không thuộc danh sách kiểm kê vật tư.`,
          );
        } catch {
          Alert.alert('Không tìm thấy mã QR', 'Mã không khớp tồn kho hoặc vật tư nào trong trang trại.');
        }
      }
    } catch (cause: unknown) {
      Alert.alert(
        'Lỗi quét mã QR',
        cause instanceof Error ? cause.message : 'Không thể tra cứu mã QR.',
      );
    } finally {
      setQrProcessing(false);
    }
  }

  function handleQrScanned(result: BarcodeScanningResult) {
    if (barcodeScanned || qrProcessing) return;
    setBarcodeScanned(true);
    setQrTokenInput(result.data.trim());
    void resolveScannedQr(result.data);
  }

  function openQuickQr() {
    if (!canEditCountRef.current) return;
    setQrTokenInput('');
    setBarcodeScanned(false);
    setQrModalOpen(true);
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }

  function countPayload() {
    return countItems.map((item) => ({
      itemId: item.itemId,
      ...(item.lotId ? { lotId: item.lotId } : {}),
      ...(item.assetId ? { assetId: item.assetId } : {}),
      actualQuantity: (quantityInputs[item.id] ?? String(values[item.id] ?? 0)).trim().replace(',', '.'),
      note: reasons[item.id] || null,
    }));
  }

  async function saveCount(submit: boolean) {
    if (!canEditCountRef.current || savingRef.current) return;
    if (!currentFarmId || !warehouseId || countItems.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Hãy chọn trang trại, kho và ít nhất một vật tư.');
      return;
    }
    const invalid = countItems.find((item) =>
      validateQuantityInput(quantityInputs[item.id] ?? String(values[item.id] ?? 0), {
        allowZero: true,
      }),
    );
    if (invalid) {
      setLocalSearch('');
      setDiffFilter('ALL');
      const entered = quantityInputs[invalid.id] ?? String(values[invalid.id] ?? 0);
      Alert.alert(
        'Số đếm không hợp lệ',
        `${invalid.name}: “${entered || 'trống'}”. ${validateQuantityInput(entered, { allowZero: true })}`,
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let id = params.id ?? createdCountId ?? undefined;
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      if (!id) {
        const created = await apiRequest<StockCountDetail>('/stock-counts', {
          method: 'POST',
          token,
          params: { farmId: currentFarmId },
          body: { warehouseId, items: countPayload() },
        });
        const detail = unwrap(created);
        id = detail.count.id;
        setCreatedCountId(id);
        setCountCode(documentCodeLabel(detail.count.countCode, detail.count.id, 'KK'));
        setCountStatus(detail.count.status ?? 'COUNTING');
      } else {
        const updated = await apiRequest<StockCountDetail>(`/stock-counts/${id}`, {
          method: 'PATCH',
          token,
          params: { farmId: currentFarmId },
          body: { items: countPayload() },
        });
        const detail = unwrap(updated);
        if (detail?.count?.id) {
          setCountCode(documentCodeLabel(detail.count.countCode, detail.count.id, 'KK'));
          setCountStatus(detail.count.status ?? 'COUNTING');
        }
      }
      if (submit) {
        await apiRequest(`/stock-counts/${id}/submit`, {
          method: 'POST',
          token,
          params: { farmId: currentFarmId },
        });
        setCountStatus('PENDING_APPROVAL');
        setItemPickerOpen(false);
        setWarehousePickerOpen(false);
        setQrModalOpen(false);
        setPendingLotQueue([]);
      }
      clearApiCache();
      setSuccessSubmitted(submit);
      setSuccessId(id ?? null);
    } catch (cause: unknown) {
      if (cause instanceof MobileApiError && cause.status === 409 && id) {
        clearApiCache();
        void reloadCountDetail(id);
      }
      Alert.alert('Không thể lưu', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const diffCounts = useMemo(() => {
    let diff = 0;
    let match = 0;
    for (const item of countItems) {
      const actual = values[item.id] ?? 0;
      if (actual === item.system) match += 1;
      else diff += 1;
    }
    return { all: countItems.length, diff, match };
  }, [countItems, values]);

  const filteredCountItems = useMemo(() => {
    const query = localSearch.trim().toLowerCase();
    return countItems.filter((item) => {
      const actual = values[item.id] ?? 0;
      const isMatch = actual === item.system;
      if (diffFilter === 'DIFF' && isMatch) return false;
      if (diffFilter === 'MATCH' && !isMatch) return false;
      if (!query) return true;
      return `${item.name} ${item.code} ${item.lotCode ?? ''}`
        .toLowerCase()
        .includes(query);
    });
  }, [countItems, values, diffFilter, localSearch]);

  const warehouseName =
    (warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId) ||
    'Chưa chọn kho';
  const hasMoreBalances = canEditCount && !effectiveCountId && balancePage < balanceTotalPages;
  const remainingBalancesCount = Math.max(0, balanceTotalItems - balancePage * COUNT_BALANCE_PAGE_SIZE);

  const renderCountCard = useCallback(
    ({ item }: { item: CountItem }) => (
      <StockCountItemCard
        item={item}
        actual={values[item.id] ?? 0}
        rawInput={quantityInputs[item.id]}
        reasonValue={reasons[item.id]}
        highlighted={highlightedId === item.id}
        editable={canEditCount}
        onAdjustCount={adjustCount}
        onChangeCountInput={changeCountInput}
        onChangeReason={changeReason}
      />
    ),
    [values, quantityInputs, reasons, highlightedId, canEditCount, adjustCount, changeCountInput, changeReason],
  );

  const listHeaderElement = (
    <View style={styles.listHeaderWrap}>
      <View style={styles.pageIntro}>
        <View style={styles.pageIntroCopy}>
          <Text style={styles.title} numberOfLines={2}>
            Phiếu Kho &amp; Kiểm kê
          </Text>
          <Text style={styles.introSubtitle} numberOfLines={2}>
            Kiểm đếm định kỳ &amp; cân bằng kho hiện trường
          </Text>
        </View>
        <Pill tone="amber">
          <Icon name="schedule" size={14} color={colors.deepAmber} />
          <Text style={styles.today}>Hôm nay</Text>
        </Pill>
      </View>

      <View style={styles.businessTabs}>
        <Pressable
          onPress={() => undefined}
          android_ripple={{ color: colors.primaryFixed }}
          style={({ pressed }) => [styles.businessTabActive, pressed && styles.pressed]}
        >
          <Icon name="fact-check" size={17} color={colors.onPrimary} />
          <Text style={styles.businessTabActiveText}>Kiểm kê kho</Text>
        </Pressable>
        <Pressable
          onPress={() => undefined}
          android_ripple={{ color: colors.primaryFixed }}
          style={({ pressed }) => [styles.businessTab, pressed && styles.pressed]}
        >
          <Icon name="input" size={17} color={colors.onSurfaceVariant} />
          <Text style={styles.businessTabText}>Phiếu nhập</Text>
        </Pressable>
        <Pressable
          onPress={() => undefined}
          android_ripple={{ color: colors.primaryFixed }}
          style={({ pressed }) => [styles.businessTab, pressed && styles.pressed]}
        >
          <Icon name="output" size={17} color={colors.onSurfaceVariant} />
          <Text style={styles.businessTabText}>Phiếu xuất</Text>
        </Pressable>
      </View>

      <Card style={styles.countInfo}>
        <View style={styles.countInfoBanner}>
          <Image source={{ uri: honeycombBorderImage }} style={styles.honeycombImage} resizeMode="cover" />
        </View>
        <View style={styles.countInfoBody}>
          <View style={styles.countInfoTop}>
            <View style={styles.countCode}>
              <Icon name="inventory" size={16} color={colors.deepAmber} />
              <Text style={styles.countCodeText}>{countCode || 'Mã cấp khi xác nhận'}</Text>
            </View>
            <View
              style={[
                styles.draftBadge,
                countStatus === 'CONFIRMED' && styles.statusBadgeSuccess,
                (countStatus === 'REJECTED' || countStatus === 'CANCELLED') && styles.statusBadgeDanger,
              ]}
            >
              <View
                style={[
                  styles.draftDot,
                  countStatus === 'CONFIRMED' && styles.statusDotSuccess,
                  (countStatus === 'REJECTED' || countStatus === 'CANCELLED') && styles.statusDotDanger,
                ]}
              />
              <Text
                style={[
                  styles.draftText,
                  countStatus === 'CONFIRMED' && styles.statusTextSuccess,
                  (countStatus === 'REJECTED' || countStatus === 'CANCELLED') && styles.statusTextDanger,
                ]}
              >
                {statusLabel(countStatus)}
              </Text>
            </View>
          </View>
          <View style={styles.countInfoBottom}>
            <View style={styles.countInfoCopy}>
              <Pressable
                disabled={!canEditCount || Boolean(effectiveCountId)}
                onPress={() => {
                  if (!canEditCountRef.current || effectiveCountId) return;
                  setWarehousePickerOpen(true);
                }}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [
                  styles.metaLine,
                  (!canEditCount || Boolean(effectiveCountId)) && styles.readOnlyControl,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.metaIcon}>
                  <Icon name="warehouse" size={16} color={colors.primary} />
                </View>
                <Text style={styles.warehouseMetaText} numberOfLines={2}>
                  {warehouseName}
                </Text>
                {canEditCount && !effectiveCountId ? (
                  <Icon name="expand-more" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
              <View style={styles.metaLine}>
                <View style={styles.metaIcon}>
                  <Icon name="badge" size={16} color={colors.primary} />
                </View>
                <Text style={styles.counterMetaText}>Người dùng hiện tại</Text>
              </View>
            </View>
            <Image source={{ uri: countHeaderImage }} style={styles.countHeaderImage} resizeMode="contain" />
          </View>
        </View>
      </Card>

      <SectionTitle
        title="Chi tiết vật tư & thiết bị"
        count={`${countItems.length} mục`}
        action={
          canEditCount ? (
            <View style={styles.sectionActions}>
              <Pressable
                onPress={openQuickQr}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
                accessibilityLabel="Quét QR vật tư"
              >
                <Icon name="qr-code-scanner" size={17} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!canEditCountRef.current) return;
                  setItemPickerOpen(true);
                }}
                android_ripple={{ color: colors.primaryFixed }}
                style={({ pressed }) => [styles.addItem, pressed && styles.pressed]}
              >
                <Icon name="add-circle" size={17} color={colors.primary} />
                <Text style={styles.addItemText}>Thêm vật tư</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />

      {countItems.length > 0 ? (
        <View style={styles.filterBlock}>
          <View style={styles.localSearchWrap}>
            <Icon name="search" size={18} color={colors.outline} />
            <TextInput
              value={localSearch}
              onChangeText={setLocalSearch}
              placeholder="Lọc nhanh tên, mã vật tư hoặc mã lô..."
              placeholderTextColor={colors.outline}
              style={styles.localSearchInput}
            />
            {localSearch ? (
              <Pressable onPress={() => setLocalSearch('')}>
                <Icon name="cancel" size={17} color={colors.outline} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.diffFilterRow}>
            {(
              [
                { key: 'ALL', label: `Tất cả (${diffCounts.all})` },
                { key: 'DIFF', label: `Chênh lệch (${diffCounts.diff})` },
                { key: 'MATCH', label: `Khớp tồn (${diffCounts.match})` },
              ] as const
            ).map((chip) => {
              const active = diffFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setDiffFilter(chip.key)}
                  style={({ pressed }) => [
                    styles.diffChip,
                    active && styles.diffChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.diffChipText, active && styles.diffChipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  const listFooterElement = (
    <View style={styles.listFooterWrap}>
      {hasMoreBalances ? (
        <Pressable
          disabled={loadingMoreBalances}
          onPress={() => void loadMoreBalances()}
          android_ripple={{ color: colors.primaryFixed }}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
        >
          {loadingMoreBalances ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="expand-more" size={20} color={colors.primary} />
          )}
          <Text style={styles.loadMoreText}>
            {loadingMoreBalances
              ? 'Đang tải thêm tồn kho...'
              : `Tải thêm tồn kho (${remainingBalancesCount > 0 ? `còn ${remainingBalancesCount}` : `trang ${balancePage + 1}/${balanceTotalPages}`})`}
          </Text>
        </Pressable>
      ) : null}

      {canEditCount ? (
        <>
          <Card style={styles.warning}>
            <Icon name="warning" color={colors.primary} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Lưu ý trước khi xác nhận</Text>
              <Text style={styles.warningText}>
                Hệ thống sẽ tạo transaction điều chỉnh theo chênh lệch. Không thể hoàn tác sau khi quản lý xác nhận.
              </Text>
            </View>
          </Card>

          <View style={styles.actions}>
            <View style={styles.saveAction}>
              <PrimaryButton
                label="Lưu nháp"
                icon="save"
                compact
                loading={saving}
                onPress={saving ? undefined : () => void saveCount(false)}
              />
            </View>
            <View style={styles.confirmAction}>
              <PrimaryButton
                label={saving ? 'Đang gửi...' : 'Gửi duyệt'}
                icon="task-alt"
                loading={saving}
                onPress={saving ? undefined : () => void saveCount(true)}
              />
            </View>
          </View>
        </>
      ) : (
        <Card style={styles.readOnlyCard}>
          <Icon name="lock" size={18} color={colors.onSurfaceVariant} />
          <Text style={styles.readOnlyText}>
            {error
              ? 'Không tải được dữ liệu phiếu kiểm kê.'
              : 'Chỉ phiếu kiểm kê nháp hoặc đang kiểm kê mới được chỉnh sửa.'}
          </Text>
        </Card>
      )}
    </View>
  );

  return (
    <>
      <AppShell active="receipts" scroll={false}>
        <View style={styles.countTopBar}>
          <Pressable
            onPress={() => router.back()}
            android_ripple={{ color: colors.primaryFixed }}
            style={({ pressed }) => [styles.countSync, pressed && styles.pressed]}
            accessibilityLabel="Quay lại"
          >
            <Icon name="arrow-back" size={21} color={colors.primary} />
          </Pressable>
          <View style={styles.countBrand}>
            <View style={styles.countBrandMark}>
              <Icon name="hive" size={24} color={colors.primary} filled />
            </View>
            <View style={styles.countBrandCopy}>
              <Text style={styles.countBrandLabel}>NHẬT KÝ KHO VẬN</Text>
              <Text style={styles.countFarmName} numberOfLines={1}>
                {currentFarmName}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell />
            <Pressable
              onPress={() => {
                if (effectiveCountId) {
                  clearApiCache();
                  void reloadCountDetail(effectiveCountId);
                } else {
                  Alert.alert('Đồng bộ', 'Phiếu mới chưa lưu trên máy chủ.');
                }
              }}
              android_ripple={{ color: colors.primaryFixed }}
              style={({ pressed }) => [styles.countSync, pressed && styles.pressed]}
              accessibilityLabel="Đồng bộ và làm mới"
            >
              <Icon name="sync" size={21} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={loading || error ? [] : filteredCountItems}
          keyExtractor={(item) => item.id}
          renderItem={renderCountCard}
          style={styles.flatList}
          contentContainerStyle={{
            gap: spacing.spaceMd,
            paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={false}
          ListHeaderComponent={listHeaderElement}
          ListEmptyComponent={
            loading ? (
              <Text style={styles.emptyText}>Đang tải danh sách vật tư kiểm kê...</Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : countItems.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Chưa có vật tư trong kho này.</Text>
                <Text style={styles.emptyHint}>Bấm “Thêm vật tư” để thêm vào phiếu kiểm kê.</Text>
              </Card>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>Không có dòng kiểm kê khớp bộ lọc.</Text>
                <Text style={styles.emptyHint}>Xóa từ khóa hoặc chuyển về tab “Tất cả”.</Text>
              </Card>
            )
          }
          ListFooterComponent={listFooterElement}
        />
      </AppShell>

      <Modal
        visible={warehousePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWarehousePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn kho kiểm kê</Text>
              <Pressable onPress={() => setWarehousePickerOpen(false)} style={styles.modalClose}>
                <Icon name="close" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <ScrollView>
              {warehouses.map((warehouse) => (
                <Pressable
                  key={warehouse.id}
                  onPress={() => void selectWarehouse(warehouse.id)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    warehouse.id === warehouseId && styles.pickerRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerName}>{warehouse.name}</Text>
                    <Text style={styles.pickerMeta}>{warehouse.code}</Text>
                  </View>
                  {warehouse.id === warehouseId ? (
                    <Icon name="check" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ItemMultiSelectModal
        visible={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        title="Thêm vật tư kiểm kê"
        subtitle={`Kho: ${warehouseName} (nhập số đếm ban đầu hoặc bấm Chọn)`}
        fetchPage={fetchModalItemsPage}
        trackingFilterOptions={COUNT_TRACKING_FILTER_OPTIONS}
        searchPlaceholder="Tìm theo tên hoặc mã vật tư..."
        onConfirm={(lines) => void handleAddCatalogConfirm(lines)}
      />

      <LotPickerModal
        visible={Boolean(currentLotPrompt)}
        farmId={currentFarmId ?? null}
        itemId={currentLotPrompt?.itemId ?? null}
        itemName={currentLotPrompt?.name ?? ''}
        title="Chọn lô cần kiểm kê"
        emptyMessage="Mặt hàng này chưa có lô nào trong hệ thống."
        onSelectLot={(lot) => void handleSelectLotForQueue(lot)}
        onClose={() => setPendingLotQueue([])}
        onSkip={() => setPendingLotQueue((prev) => prev.slice(1))}
        skipLabel="Bỏ qua mặt hàng này"
      />

      <Modal
        visible={qrModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quét nhanh QR vật tư</Text>
              <Pressable onPress={() => setQrModalOpen(false)} style={styles.modalClose}>
                <Icon name="close" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <View style={styles.qrFrame}>
              {cameraPermission?.granted ? (
                <CameraView
                  style={styles.qrCamera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={barcodeScanned ? undefined : handleQrScanned}
                />
              ) : (
                <View style={styles.qrPermission}>
                  <Icon name="photo-camera" size={28} color={colors.onSurfaceVariant} />
                  <Text style={styles.qrPermissionText}>Cần quyền camera để quét trực tiếp</Text>
                  <Pressable onPress={() => void requestCameraPermission()} style={styles.qrGrantBtn}>
                    <Text style={styles.qrGrantText}>Cấp quyền camera</Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View style={styles.qrManualRow}>
              <TextInput
                value={qrTokenInput}
                onChangeText={setQrTokenInput}
                placeholder="Hoặc dán link / qrToken..."
                placeholderTextColor={colors.onSurfaceVariant}
                autoCapitalize="none"
                style={styles.qrManualInput}
              />
              <Pressable
                disabled={qrProcessing}
                onPress={() => void resolveScannedQr(qrTokenInput)}
                style={({ pressed }) => [styles.qrLookupBtn, pressed && styles.pressed]}
              >
                {qrProcessing ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.qrLookupText}>Tìm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <OperationResultDialog
        visible={Boolean(successId)}
        title={successSubmitted ? 'Phiếu kiểm kê đã gửi duyệt' : 'Đã lưu phiếu kiểm kê'}
        details={[
          { label: 'Mã phiếu', value: countCode || (successId ? documentCodeLabel(null, successId, 'KK') : '—') },
          { label: 'Kho kiểm kê', value: warehouseName },
          { label: 'Số mặt hàng', value: `${countItems.length} mặt hàng` },
        ]}
        items={countItems.map((item) => ({
          name: item.name,
          quantity: `${formatQuantity(values[item.id] ?? 0)} ${item.unit}`,
        }))}
        actionLabel="Về danh sách phiếu"
        onAction={() => {
          setSuccessId(null);
          navigateToReceiptList(router, navigation, 'COUNT');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  countTopBar: { minHeight: 64, marginHorizontal: -spacing.gutterMobile, paddingHorizontal: spacing.spaceMd, backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  countBrand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  countBrandMark: { width: 44, height: 44, borderRadius: radius.default, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  countBrandCopy: { flex: 1, minWidth: 0 },
  countBrandLabel: { ...typography.labelSm, color: colors.primary, letterSpacing: 0.7 },
  countFarmName: { ...typography.headlineSm, color: colors.onSurface, marginTop: 2, flexShrink: 1 },
  countSync: { width: 40, height: 40, borderRadius: radius.default, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  flatList: { flex: 1 },
  listHeaderWrap: { gap: spacing.spaceMd },
  listFooterWrap: { gap: spacing.spaceMd, marginTop: spacing.spaceXs },
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
  statusBadgeSuccess: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  statusDotSuccess: { backgroundColor: colors.statusSuccess },
  statusTextSuccess: { color: colors.statusSuccess },
  statusBadgeDanger: { backgroundColor: colors.errorContainer, borderColor: colors.error },
  statusDotDanger: { backgroundColor: colors.error },
  statusTextDanger: { color: colors.error },
  readOnlyControl: { opacity: 0.72 },
  countInfoBottom: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceMd, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant, flexWrap: 'wrap' },
  countInfoCopy: { flex: 1, minWidth: 0, gap: spacing.spaceSm },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, minWidth: 0 },
  metaIcon: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  warehouseMetaText: { ...typography.labelSm, color: colors.deepAmber, fontWeight: '600', flexShrink: 1 },
  counterMetaText: { ...typography.labelSm, color: colors.onSurfaceVariant, flexShrink: 1 },
  countHeaderImage: { width: 56, height: 56, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.secondaryContainer, flexShrink: 0 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  qrButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  addItem: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addItemText: { ...typography.labelSm, color: colors.deepAmber },
  filterBlock: { gap: spacing.spaceSm },
  localSearchWrap: { minHeight: 40, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  localSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.onSurface, ...typography.bodySm },
  diffFilterRow: { flexDirection: 'row', gap: spacing.spaceXs, flexWrap: 'wrap' },
  diffChip: { paddingHorizontal: spacing.spaceSm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant },
  diffChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  diffChipText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  diffChipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  title: { fontFamily: 'VollkornSemiBold', fontSize: 24, fontWeight: '700', lineHeight: 32, color: colors.deepAmberStrong, flexShrink: 1 },
  item: { gap: spacing.spaceMd },
  itemHighlighted: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.parchmentWarm },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap' },
  itemIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  itemIcon: { width: 44, height: 44, borderRadius: radius.default, backgroundColor: colors.statusSuccessSurface, borderWidth: 1, borderColor: colors.statusSuccessBorder, alignItems: 'center', justifyContent: 'center' },
  countError: { ...typography.bodySm, color: colors.error },
  itemImage: { width: 42, height: 42, borderRadius: radius.default },
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
  actualReadOnly: { ...typography.bodyLg, fontWeight: '700', color: colors.primary, marginTop: 4, textAlign: 'right' },
  actualReadOnlyDanger: { color: colors.error },
  reason: { gap: spacing.spaceSm },
  reasonLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  reasonText: { ...typography.labelLg, color: colors.onSurfaceVariant, flexShrink: 1 },
  reasonInput: { minHeight: 42, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, textAlignVertical: 'top', ...typography.bodySm },
  reasonReadOnly: { paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, ...typography.bodySm },
  loadMoreButton: { minHeight: 44, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, borderWidth: 1, borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  loadMoreText: { ...typography.labelMd, color: colors.deepAmber },
  warning: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'flex-start', backgroundColor: colors.parchmentWarm },
  warningCopy: { flex: 1 },
  warningTitle: { ...typography.labelLg, color: colors.primary },
  warningText: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3 },
  readOnlyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
  readOnlyText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center' },
  saveAction: { flex: 1 },
  confirmAction: { flex: 1.6 },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  errorText: { ...typography.bodySm, color: colors.error, textAlign: 'center', padding: spacing.spaceSm, backgroundColor: colors.errorContainer, borderRadius: radius.default },
  emptyCard: { alignItems: 'center', gap: spacing.spaceXs },
  emptyHint: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 18, 13, 0.45)' },
  modalSheet: { maxHeight: '78%', backgroundColor: colors.surfaceContainerLowest, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.spaceMd, gap: spacing.spaceSm },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, paddingBottom: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  modalTitle: { ...typography.headlineSm, color: colors.onSurface, flexShrink: 1 },
  modalClose: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  pickerRow: { minHeight: 60, paddingVertical: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  pickerRowActive: { backgroundColor: colors.honeyChip },
  pickerCopy: { flex: 1, minWidth: 0 },
  pickerName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  pickerMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  qrFrame: { height: 220, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant },
  qrCamera: { flex: 1 },
  qrPermission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, padding: spacing.spaceMd },
  qrPermissionText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  qrGrantBtn: { paddingHorizontal: spacing.spaceMd, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.primary },
  qrGrantText: { ...typography.labelMd, color: colors.onPrimary },
  qrManualRow: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center' },
  qrManualInput: { flex: 1, minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, color: colors.onSurface, ...typography.bodySm },
  qrLookupBtn: { minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  qrLookupText: { ...typography.labelMd, color: colors.onPrimary },
});

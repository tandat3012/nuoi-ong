import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps, ReactNode } from 'react';

import { colors, dimensions, gradients, radius, shadows, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { HoneycombDecor } from '@/src/shared/ui/MobileShell';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';
import { formatQuantity } from '@/src/shared/format-quantity';
import { formatApiDateTime, formatVietnamDateOnly } from '@/src/shared/format-date-time';
import { quantityInputNumber, validateQuantityInput } from '@/src/shared/quantity-input';
import {
  balanceMatchesTrackingMode,
  documentCodeLabel,
  filterAvailableAssetsForScope,
  filterPositiveBalancesForScope,
  getAssetById,
  getInventoryLot,
  getItemById,
  listAssetsPage,
  listBalancesPage,
  listItemsPage,
  listLocationsPage,
  listLotsPage,
  listPositiveBalancesForItems,
  listWarehouses,
  statusLabel,
  unwrap,
  type AvailableAsset,
  type InventoryBalance,
  type InventoryLot,
  type Item,
  type StockIssueDetail,
  type StockReceiptDetail,
  type WarehouseLocation,
} from '@/src/features/inventory/api';
import {
  ItemMultiSelectModal,
  type MultiSelectFetchParams,
  type MultiSelectLine,
} from '@/src/features/inventory/presentation/ItemMultiSelectModal';
import { LotPickerModal } from '@/src/features/inventory/presentation/LotPickerModal';
import { isReceiptDocumentEditable, navigateToReceiptList } from '@/src/features/inventory/receipt-list.logic';
import { receiptItemsPayload } from '@/src/features/inventory/receipt-payload';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type DocumentType = 'receipt' | 'issue';

type ReceiptItem = {
  id: string;
  itemId?: string;
  itemCode?: string;
  name: string;
  codeLabel: string;
  code: string;
  metadata: string;
  unit: string;
  quantity: number;
  quantityInput?: string;
  availableQuantity?: number;
  badge: string;
  badgeTone: 'green' | 'cream' | 'amber';
  note: string;
  image?: string;
  lotId?: string | null;
  lotMode?: 'NEW' | 'EXISTING';
  assetId?: string | null;
  lineId?: string;
  lotCode?: string;
  supplierLotNumber?: string;
  legacyLotNumber?: string;
  expiryDate?: string;
  manufacturedDate?: string;
  assetCode?: string;
  serialNumber?: string;
  locationId?: string | null;
  locationCode?: string;
  locationName?: string;
};

const ISSUE_PICKER_TRACKING_FILTERS = [
  { key: 'ALL', label: 'SL & Theo lô' },
  { key: 'QUANTITY', label: 'Theo số lượng' },
  { key: 'LOT', label: 'Theo lô' },
  { key: 'ASSET', label: 'Tài sản lẻ' },
];

const RECEIPT_PICKER_TRACKING_FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'QUANTITY', label: 'Theo số lượng' },
  { key: 'LOT', label: 'Theo lô' },
  { key: 'ASSET', label: 'Tài sản' },
];

function catalogItemToReceiptItem(item: Item): ReceiptItem {
  return {
    id: item.id,
    itemId: item.id,
    itemCode: item.code,
    name: item.name,
    codeLabel: 'Mã VT',
    code: item.code,
    metadata: item.trackingMode,
    unit: item.unitSymbol ?? item.unitName ?? item.itemType,
    quantity: 1,
    badge: item.status,
    badgeTone: 'cream',
    note: '',
    image: item.imageUrl ?? undefined,
  };
}

async function fetchScopedIssueStock(
  token: string,
  farmId: string,
  warehouseId: string,
  targetLines: ReceiptItem[],
  signal?: AbortSignal,
): Promise<{ balances: InventoryBalance[]; assets: AvailableAsset[] }> {
  const nonAssetIds = Array.from(
    new Set(targetLines.filter((line) => line.metadata !== 'ASSET').map((line) => line.itemId ?? line.id)),
  );
  const assetItemIds = Array.from(
    new Set(targetLines.filter((line) => line.metadata === 'ASSET').map((line) => line.itemId ?? line.id)),
  );
  const allItemIds = Array.from(new Set([...nonAssetIds, ...assetItemIds]));
  const assetIds = Array.from(
    new Set(targetLines.filter((line) => line.metadata === 'ASSET' && line.assetId).map((line) => line.assetId!)),
  );

  const loadBalances = async (): Promise<InventoryBalance[]> => {
    if (allItemIds.length === 0) return [];
    return listPositiveBalancesForItems(token, farmId, warehouseId, allItemIds, signal);
  };

  const loadAssets = async (): Promise<AvailableAsset[]> => {
    if (assetIds.length === 0) return [];
    const details = await Promise.all(
      assetIds.map((id) => getAssetById(token, farmId, id, signal).catch(() => null)),
    );
    return filterAvailableAssetsForScope(
      details.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      farmId,
      warehouseId,
    );
  };

  const [balances, assets] = await Promise.all([loadBalances(), loadAssets()]);
  return { balances, assets };
}

type LotDateField = 'manufacturedDate' | 'expiryDate';
type CalendarTarget = { itemId: string; field: LotDateField };

const MAX_ASSETS_PER_ITEM = 100;

function suggestAssetCode(itemCode: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
  return `${itemCode.slice(0, 70)}-AS-${suffix}`;
}

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function dateOnlyParts(value?: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month: month - 1, day };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}



function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}
function lotExpiryState(lot: Pick<InventoryLot, 'expiryDate'>, today = formatDateOnly(new Date())) {
  if (!lot.expiryDate) return { label: 'Không có hạn sử dụng', expired: false, warning: false };
  if (lot.expiryDate < today) return { label: 'ĐÃ HẾT HẠN', expired: true, warning: true };
  const days = Math.ceil((Date.parse(`${lot.expiryDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000);
  if (days <= 30) return { label: `Sắp hết hạn · còn ${days} ngày`, expired: false, warning: true };
  return { label: 'Còn hạn', expired: false, warning: false };
}

const navItems: Array<{ label: string; icon: IconName }> = [
  { label: 'Tổng quan', icon: 'dashboard' },
  { label: 'Tồn kho', icon: 'inventory-2' },
  { label: 'Quét QR', icon: 'qr-code-scanner' },
  { label: 'Phiếu kho', icon: 'assignment' },
];

function Icon({ name, size = 20, color = colors.onSurfaceVariant, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  return <MaterialIcons name={name} size={size} color={color} style={filled ? styles.filledIcon : undefined} />;
}

function Pill({ children, tone = 'cream' }: { children: ReactNode; tone?: 'cream' | 'green' | 'amber' | 'neutral' | 'danger' }) {
  const toneStyle = tone === 'green' ? styles.pillGreen : tone === 'amber' ? styles.pillAmber : tone === 'danger' ? styles.pillDanger : tone === 'neutral' ? styles.pillNeutral : styles.pillCream;
  return <View style={[styles.pill, toneStyle]}>{children}</View>;
}

function isIssueLineAvailable(item: ReceiptItem, balances: InventoryBalance[], assets: AvailableAsset[]) {
  const itemId = item.itemId ?? item.id;
  if (item.metadata === 'ASSET') {
    return Boolean(item.assetId && assets.some(({ asset }) => asset.id === item.assetId
      && asset.itemId === itemId && asset.status === 'AVAILABLE')
      && balances.some(({ balance }) => balance.itemId === itemId && !balance.lotId && Number(balance.quantityOnHand) > 0));
  }
  return balances.some(({ balance }) => Number(balance.quantityOnHand) > 0
    && balance.itemId === itemId
    && balanceMatchesTrackingMode(balance, item.metadata)
    && (item.metadata !== 'LOT' || Boolean(item.lotId && balance.lotId === item.lotId)));
}

function getIssueLineAvailableQuantity(item: ReceiptItem, balances: InventoryBalance[]) {
  if (item.metadata === 'ASSET') return item.assetId ? 1 : 0;
  const itemId = item.itemId ?? item.id;
  return balances.reduce((total, { balance }) => {
    if (balance.itemId !== itemId) return total;
    if (!balanceMatchesTrackingMode(balance, item.metadata)) return total;
    if (item.metadata === 'LOT' && balance.lotId !== item.lotId) return total;
    const quantity = Number(balance.quantityOnHand);
    return Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
  }, 0);
}

function issueStockError(lines: ReceiptItem[], balances: InventoryBalance[], assets: AvailableAsset[]) {
  const totals = new Map<string, number>();
  for (const item of lines) {
    if (!isIssueLineAvailable(item, balances, assets)) return `${item.name} không còn khả dụng ở kho đã chọn.`;
    const key = `${item.itemId ?? item.id}:${item.lotId ?? ''}:${item.assetId ?? ''}`;
    const total = (totals.get(key) ?? 0) + item.quantity;
    const available = getIssueLineAvailableQuantity(item, balances);
    if (total > available) return `${item.name}: yêu cầu ${formatQuantity(total)} ${item.unit}, tồn khả dụng ${formatQuantity(available)} ${item.unit}.`;
    totals.set(key, total);
  }
  return null;
}

function quantityForPayload(item: ReceiptItem) {
  return (item.quantityInput ?? String(item.quantity)).trim().replace(',', '.');
}

function draftSnapshot(input: {
  warehouseId: string | null;
  documentNote: string | null;
  documentBusinessDate: string | null;
  items: ReceiptItem[];
}) {
  return JSON.stringify({
    warehouseId: input.warehouseId,
    documentNote: input.documentNote?.trim() ?? '',
    documentBusinessDate: input.documentBusinessDate,
    items: input.items.map((item) => ({
      itemId: item.itemId ?? item.id,
      quantity: quantityForPayload(item),
      note: item.note?.trim() ?? '',
      lotId: item.lotId ?? null,
      supplierLotNumber: item.supplierLotNumber?.trim() ?? '',
      manufacturedDate: item.manufacturedDate ?? null,
      expiryDate: item.expiryDate ?? null,
      assetId: item.assetId ?? null,
      assetCode: item.assetCode?.trim() ?? '',
      serialNumber: item.serialNumber?.trim() ?? '',
      locationId: item.locationId ?? null,
    })),
  });
}

export default function ReceiptDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; type?: string | string[]; itemId?: string; warehouseId?: string; lotId?: string; assetId?: string }>();
  const routeType = Array.isArray(params.type) ? params.type[0] : params.type;
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [documentType, setDocumentType] = useState<DocumentType>(routeType === 'issue' ? 'issue' : 'receipt');
  const [activeNav, setActiveNav] = useState('Phiếu kho');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [assetCountDrafts, setAssetCountDrafts] = useState<Record<string, string>>({});
  const [documentStatus, setDocumentStatus] = useState('DRAFT');
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState<string | null>(null);
  const [documentBusinessDate, setDocumentBusinessDate] = useState<string | null>(null);
  const [currentDeviceTime, setCurrentDeviceTime] = useState(() => new Date().toISOString());
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [documentNote, setDocumentNote] = useState<string | null>(null);
  const [creatorMemberId, setCreatorMemberId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(params.id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const [lotPickerOpen, setLotPickerOpen] = useState(false);
  const [lotPickerItem, setLotPickerItem] = useState<ReceiptItem | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [issueInventoryLoading, setIssueInventoryLoading] = useState(false);
  const [issueInventoryError, setIssueInventoryError] = useState<string | null>(null);
  const [requestedCatalogItem, setRequestedCatalogItem] = useState<Item | null>(null);
  const newReceiptLineId = useRef(0);
  const itemsRef = useRef<ReceiptItem[]>(items);
  itemsRef.current = items;
  const savedSnapshotRef = useRef(draftSnapshot({
    warehouseId: null,
    documentNote: null,
    documentBusinessDate: null,
    items: [],
  }));
  const hasUnsavedChangesRef = useRef(false);

  const submittingDocument = useRef(false);
  const savingDraftRef = useRef(false);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<Awaited<ReturnType<typeof listWarehouses>>['data']>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsLoadingMore, setLocationsLoadingMore] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locationPickerItemId, setLocationPickerItemId] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [debouncedLocationSearch, setDebouncedLocationSearch] = useState('');
  const [locationPage, setLocationPage] = useState(1);
  const [locationTotalPages, setLocationTotalPages] = useState(0);
  const [locationTotalItems, setLocationTotalItems] = useState(0);
  const [locationReloadNonce, setLocationReloadNonce] = useState(0);
  const loadMoreLocationsControllerRef = useRef<AbortController | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const pendingBackAction = useRef<unknown>(null);
  const allowRemoval = useRef(false);
  const effectiveId = params.id ?? createdDocumentId;
  const canEditDocument = isReceiptDocumentEditable(loading, documentError, documentStatus);
  const canEditDocumentRef = useRef(canEditDocument);
  canEditDocumentRef.current = canEditDocument;
  const hasUnsavedChanges = documentStatus === 'DRAFT' && draftSnapshot({
    warehouseId,
    documentNote,
    documentBusinessDate,
    items,
  }) !== savedSnapshotRef.current;
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  useEffect(() => {
    if (documentDate || effectiveId) return;
    const timer = setInterval(() => setCurrentDeviceTime(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, [documentDate, effectiveId]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!hasUnsavedChangesRef.current || allowRemoval.current) {
      allowRemoval.current = false;
      return;
    }
    event.preventDefault();
    pendingBackAction.current = event.data.action;
    setDraftSaveError(null);
    setExitPromptOpen(true);
  }), [navigation]);

  function leaveWithoutSaving() {
    setExitPromptOpen(false);
    allowRemoval.current = true;
    const action = pendingBackAction.current;
    pendingBackAction.current = null;
    if (action) navigation.dispatch(action as never);
    else router.back();
  }

  function leaveAfterSavingDraft() {
    setExitPromptOpen(false);
    allowRemoval.current = true;
    const action = pendingBackAction.current;
    pendingBackAction.current = null;
    if (action) navigation.dispatch(action as never);
    else router.back();
  }

  async function validateDraftBeforeSave() {
    if (!currentFarmId || !warehouseId || documentItems.length === 0) {
      throw new Error('Để lưu nháp, hãy chọn kho và thêm ít nhất một vật tư hợp lệ.');
    }
    const quantityError = documentQuantityError();
    if (quantityError) throw new Error(quantityError);
    if (documentType === 'issue') {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const { balances, assets } = await fetchScopedIssueStock(token, currentFarmId, warehouseId, documentItems);
      const stockError = issueStockError(documentItems, balances, assets);
      if (stockError) throw new Error(stockError);
    }
  }

  async function persistDraftDocument() {
    if (!currentFarmId || !warehouseId) throw new Error('Hãy chọn trang trại và kho trước khi lưu.');
    const token = await getAccessToken();
    if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
    const base = documentType === 'receipt' ? 'stock-receipts' : 'stock-issues';
    const businessDate = documentBusinessDate ?? formatVietnamDateOnly(new Date());
    const body = documentType === 'receipt'
      ? { warehouseId, receiptDate: businessDate, note: documentNote ?? undefined, items: receiptItemsPayload(documentItems.map((item) => ({ ...item, itemId: item.itemId ?? item.id, quantity: quantityForPayload(item) }))) }
      : { warehouseId, issueDate: businessDate, reason: documentNote ?? undefined, items: documentItems.map((item) => ({ itemId: item.itemId ?? item.id, quantity: quantityForPayload(item), lotId: item.lotId, assetId: item.assetId })) };
    let id = params.id ?? createdDocumentId ?? undefined;

    if (id) {
      await apiRequest(`/${base}/${id}`, { method: 'PATCH', token, params: { farmId: currentFarmId }, body });
    } else {
      const created = await apiRequest<{ data: StockReceiptDetail | StockIssueDetail }>(`/${base}`, { method: 'POST', token, params: { farmId: currentFarmId }, body });
      const createdData = unwrap(created);
      const document = documentType === 'receipt' ? (createdData as StockReceiptDetail).receipt : (createdData as StockIssueDetail).issue;
      id = document.id;
      setCreatedDocumentId(id);
      setDocumentStatus(document.status);
      setSavedCode(documentType === 'receipt'
        ? (document as StockReceiptDetail['receipt']).receiptCode ?? null
        : (document as StockIssueDetail['issue']).issueCode ?? null);
      setDocumentDate(document.createdAt ?? null);
      setCreatorMemberId(document.createdByMemberId ?? currentMemberId ?? null);
    }
    if (!id) throw new Error('Không nhận được mã phiếu sau khi lưu nháp.');

    setDocumentBusinessDate(businessDate);
    savedSnapshotRef.current = draftSnapshot({
      warehouseId,
      documentNote,
      documentBusinessDate: businessDate,
      items: documentItems,
    });
    hasUnsavedChangesRef.current = false;
    clearApiCache();
    return { id, businessDate };
  }

  async function saveDraftInPlace() {
    if (!canEditDocumentRef.current || !hasUnsavedChangesRef.current) return;
    if (savingDraftRef.current || submittingDocument.current) return;
    savingDraftRef.current = true;
    setSavingDraft(true);
    setDraftSaveError(null);
    try {
      await validateDraftBeforeSave();
      await persistDraftDocument();
      Alert.alert('Đã lưu nháp', 'Các thay đổi đã được lưu và phiếu vẫn ở trạng thái nháp.');
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Không thể lưu nháp. Vui lòng thử lại.';
      setDraftSaveError(message);
      Alert.alert('Không thể lưu nháp', message);
    } finally {
      savingDraftRef.current = false;
      setSavingDraft(false);
    }
  }

  async function saveDraftAndLeave() {
    if (!canEditDocumentRef.current) {
      leaveWithoutSaving();
      return;
    }
    if (savingDraftRef.current || submittingDocument.current) return;
    savingDraftRef.current = true;
    setSavingDraft(true);
    setDraftSaveError(null);
    try {
      await validateDraftBeforeSave();
      await persistDraftDocument();
      leaveAfterSavingDraft();
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Không thể lưu nháp. Vui lòng thử lại.';
      setDraftSaveError(message);
      Alert.alert('Không thể lưu nháp', message);
    } finally {
      savingDraftRef.current = false;
      setSavingDraft(false);
    }
  }

  useEffect(() => {
    setDocumentType(routeType === 'issue' ? 'issue' : 'receipt');
  }, [routeType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationSearch(locationSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  useEffect(() => {
    loadMoreLocationsControllerRef.current?.abort();
    if (documentType !== 'receipt' || !currentFarmId || !warehouseId || !locationPickerItemId) {
      setLocations([]);
      setLocationPage(1);
      setLocationTotalPages(0);
      setLocationTotalItems(0);
      setLocationsLoading(false);
      setLocationsError(null);
      return;
    }
    const controller = new AbortController();
    setLocationsLoading(true);
    setLocationsError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return listLocationsPage(
          token,
          currentFarmId,
          {
            warehouseId,
            status: 'ACTIVE',
            search: debouncedLocationSearch,
            page: 1,
            pageSize: 20,
            skipCache: true,
          },
          controller.signal,
        );
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        setLocations(response.data.filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE'));
        setLocationPage(response.page.number);
        setLocationTotalPages(response.page.totalPages);
        setLocationTotalItems(response.page.totalItems);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause) || controller.signal.aborted) return;
        setLocations([]);
        setLocationsError(cause instanceof Error ? cause.message : 'Không thể tải vị trí trong kho.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLocationsLoading(false);
      });
    return () => {
      controller.abort();
      loadMoreLocationsControllerRef.current?.abort();
    };
  }, [currentFarmId, debouncedLocationSearch, documentType, getAccessToken, locationPickerItemId, locationReloadNonce, warehouseId]);

  const loadMoreLocations = useCallback(async () => {
    if (
      documentType !== 'receipt' ||
      !currentFarmId ||
      !warehouseId ||
      !locationPickerItemId ||
      locationsLoading ||
      locationsLoadingMore ||
      locationPage >= locationTotalPages
    ) {
      return;
    }
    loadMoreLocationsControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreLocationsControllerRef.current = controller;
    setLocationsLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listLocationsPage(
        token,
        currentFarmId,
        {
          warehouseId,
          status: 'ACTIVE',
          search: debouncedLocationSearch,
          page: locationPage + 1,
          pageSize: 20,
          skipCache: true,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const incoming = response.data.filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE');
      setLocations((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const next = [...prev];
        for (const row of incoming) {
          if (!seen.has(row.id)) next.push(row);
        }
        return next;
      });
      setLocationPage(response.page.number);
      setLocationTotalPages(response.page.totalPages);
      setLocationTotalItems(response.page.totalItems);
    } catch (cause: unknown) {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        Alert.alert('Không thể tải thêm vị trí', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted) setLocationsLoadingMore(false);
    }
  }, [
    currentFarmId,
    debouncedLocationSearch,
    documentType,
    getAccessToken,
    locationPage,
    locationPickerItemId,
    locationsLoading,
    locationsLoadingMore,
    locationTotalPages,
    warehouseId,
  ]);

  const reloadDocumentById = useCallback(
    async (docId: string, signal?: AbortSignal) => {
      if (!currentFarmId || hasUnsavedChangesRef.current) return;
      setLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const [detailResponse, warehouseResponse] = await Promise.all([
          apiRequest<StockReceiptDetail | StockIssueDetail>(
            `/${documentType === 'receipt' ? 'stock-receipts' : 'stock-issues'}/${docId}`,
            { token, params: { farmId: currentFarmId }, skipCache: true, signal },
          ),
          listWarehouses(token, currentFarmId),
        ]);
        if (signal?.aborted) return;
        const detail = unwrap(detailResponse);
        const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
        setWarehouses(farmWarehouses);
        const document = documentType === 'receipt' ? (detail as StockReceiptDetail).receipt : (detail as StockIssueDetail).issue;
        const lines = detail.items;
        const loadedBusinessDate = documentType === 'receipt'
          ? (document as StockReceiptDetail['receipt']).receiptDate ?? null
          : (document as StockIssueDetail['issue']).issueDate ?? null;
        const loadedNote = documentType === 'receipt'
          ? (document as StockReceiptDetail['receipt']).note ?? null
          : (document as StockIssueDetail['issue']).reason ?? (document as StockIssueDetail['issue']).note ?? null;
        setDocumentStatus(document.status);
        setSavedCode(documentType === 'receipt' ? (document as StockReceiptDetail['receipt']).receiptCode : (document as StockIssueDetail['issue']).issueCode);
        setDocumentDate(document.createdAt ?? null);
        setDocumentBusinessDate(loadedBusinessDate);
        setCreatorMemberId(document.createdByMemberId ?? null);
        setWarehouseId(document.warehouseId);
        setDocumentNote(loadedNote);

        let mapped: ReceiptItem[] = lines.map((line) => {
          const trackingMode = line.trackingMode ?? 'UNKNOWN';
          const itemCode = line.itemCode ?? line.itemId;
          const lotCode = line.lotCode ?? undefined;
          return {
            id: line.id,
            lineId: line.id,
            itemId: line.itemId,
            itemCode,
            name: line.itemName ?? 'Vật tư không còn trong danh mục',
            codeLabel: lotCode ? 'Mã lô' : 'Mã VT',
            code: lotCode ?? itemCode,
            metadata: trackingMode,
            unit: line.unitSymbol ?? line.unitName ?? line.itemType ?? 'đơn vị',
            quantity: Number(line.quantity ?? line.actualQuantity ?? 0),
            badge: 'ACTIVE',
            badgeTone: 'cream' as const,
            note: line.note ?? '',
            image: line.itemImageUrl ?? undefined,
            lotId: line.lotId ?? null,
            lotMode: line.lotId ? 'EXISTING' as const : 'NEW' as const,
            assetId: line.assetId ?? null,
            lotCode,
            supplierLotNumber: line.lotId ? line.lotSupplierLotNumber ?? undefined : line.supplierLotNumber ?? undefined,
            legacyLotNumber: line.legacyLotNumber ?? line.lotLegacyLotNumber ?? undefined,
            manufacturedDate: line.lotManufacturedDate ?? line.manufacturedDate ?? undefined,
            expiryDate: line.lotExpiryDate ?? line.expiryDate ?? undefined,
            assetCode: line.assetCode ?? line.assetCodeFromAsset ?? (trackingMode === 'ASSET' ? suggestAssetCode(itemCode) : undefined),
            serialNumber: line.serialNumber ?? line.assetSerialNumber ?? undefined,
            locationId: line.locationId ?? null,
            locationCode: line.locationCode ?? undefined,
            locationName: line.locationName ?? undefined,
          };
        });

        if (documentType === 'issue' && document.status === 'DRAFT' && mapped.length > 0) {
          try {
            const { balances, assets } = await fetchScopedIssueStock(token, currentFarmId, document.warehouseId, mapped, signal);
            if (!signal?.aborted) {
              mapped = mapped.map((row) => ({
                ...row,
                availableQuantity: isIssueLineAvailable(row, balances, assets)
                  ? getIssueLineAvailableQuantity(row, balances)
                  : 0,
              }));
            }
          } catch {
            // Keep draft openable even if balance check fails transiently; submit validates again.
          }
        }
        if (signal?.aborted) return;
        savedSnapshotRef.current = draftSnapshot({
          warehouseId: document.warehouseId,
          documentNote: loadedNote,
          documentBusinessDate: loadedBusinessDate,
          items: mapped,
        });
        hasUnsavedChangesRef.current = false;
        setItems(mapped);
        setDocumentError(null);
      } catch (cause: unknown) {
        if (!isAbortError(cause) && !signal?.aborted) {
          setDocumentError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết phiếu.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentFarmId, documentType, getAccessToken],
  );

  useEffect(() => {
    if (!params.id || !currentFarmId) {
      if (!currentFarmId) setLoading(false);
      return;
    }
    const controller = new AbortController();
    void reloadDocumentById(params.id, controller.signal);
    return () => controller.abort();
  }, [currentFarmId, params.id, reloadDocumentById]);

  useEffect(() => {
    if (params.id || !currentFarmId) return;
    const controller = new AbortController();
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listWarehouses(token, currentFarmId),
        params.itemId ? getItemById(token, currentFarmId, params.itemId, controller.signal) : Promise.resolve(null),
        routeType !== 'issue' && params.itemId && params.lotId
          ? getInventoryLot(token, currentFarmId, params.lotId, controller.signal).catch(() => null)
          : Promise.resolve(null),
      ]);
    }).then(([warehouseResponse, fetchedItem, fetchedLot]) => {
      if (controller.signal.aborted) return;
      const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
      setWarehouses(farmWarehouses);
      const requestedWarehouse = farmWarehouses.find((warehouse) => warehouse.id === params.warehouseId);
      setWarehouseId((current) => {
        if (params.warehouseId) return requestedWarehouse?.id ?? null;
        if (current && farmWarehouses.some((warehouse) => warehouse.id === current)) return current;
        if (routeType === 'issue') return null;
        return warehouseResponse.data[0]?.id ?? null;
      });
      setRequestedCatalogItem(fetchedItem);
      if (fetchedItem && routeType !== 'issue') {
        const baseLine = catalogItemToReceiptItem(fetchedItem);
        const validLot = fetchedLot && fetchedLot.farmId === currentFarmId && fetchedLot.itemId === fetchedItem.id ? fetchedLot : null;
        if (baseLine.metadata === 'ASSET') {
          setItems((current) => (current.length ? current : [newAssetLine(baseLine)]));
        } else if (validLot && lotExpiryState(validLot).expired) {
          setItems((current) => (current.length ? current : [{ ...baseLine, lotId: null, lotMode: 'NEW' }]));
          Alert.alert('Lô đã hết hạn', `Lô ${validLot.lotCode} hết hạn ngày ${validLot.expiryDate}. Bạn có chắc muốn chọn lô này để nhập?`, [
            { text: 'Chọn lô khác', style: 'cancel' },
            {
              text: 'Vẫn chọn lô',
              style: 'destructive',
              onPress: () => setItems((current) => current.map((row) => row.itemId === fetchedItem.id
                ? {
                    ...row,
                    lotId: validLot.id,
                    lotMode: 'EXISTING',
                    lotCode: validLot.lotCode,
                    supplierLotNumber: validLot.supplierLotNumber ?? undefined,
                    legacyLotNumber: validLot.legacyLotNumber ?? undefined,
                    manufacturedDate: validLot.manufacturedDate ?? undefined,
                    expiryDate: validLot.expiryDate ?? undefined,
                  }
                : row)),
            },
          ]);
        } else if (validLot) {
          setItems((current) => (current.length ? current : [{
            ...baseLine,
            lotId: validLot.id,
            lotMode: 'EXISTING',
            lotCode: validLot.lotCode,
            supplierLotNumber: validLot.supplierLotNumber ?? undefined,
            legacyLotNumber: validLot.legacyLotNumber ?? undefined,
            manufacturedDate: validLot.manufacturedDate ?? undefined,
            expiryDate: validLot.expiryDate ?? undefined,
          }]));
        } else {
          setItems((current) => (current.length ? current : [{ ...baseLine, lotId: null, lotMode: 'NEW' }]));
        }
      }
      setDocumentError(null);
    }).catch((cause: unknown) => {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        setDocumentError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu phiếu.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [currentFarmId, getAccessToken, params.id, params.itemId, params.lotId, params.warehouseId, routeType]);

  useEffect(() => {
    if (documentType !== 'issue' || params.id || !currentFarmId || !warehouseId) {
      setIssueInventoryError(null);
      setIssueInventoryLoading(false);
      return;
    }
    const controller = new AbortController();

    async function hydrateIssueContext() {
      setIssueInventoryLoading(true);
      setIssueInventoryError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

        if (params.itemId && warehouseId) {
          const item = requestedCatalogItem?.id === params.itemId
            ? requestedCatalogItem
            : await getItemById(token, currentFarmId!, params.itemId, controller.signal);
          if (controller.signal.aborted) return;
          const baseLine = catalogItemToReceiptItem(item);

          if (item.trackingMode === 'ASSET') {
            if (!params.assetId) {
              setPickerNotice('Vật tư này theo dõi từng tài sản. Chọn đúng mã tài sản đang có tại kho hiện tại.');
            } else {
              const [assetDetail, assetBalances] = await Promise.all([
                getAssetById(token, currentFarmId!, params.assetId, controller.signal).catch(() => null),
                listBalancesPage(
                  token,
                  currentFarmId!,
                  { warehouseId, itemIds: [item.id], positiveOnly: true, page: 1, pageSize: 5, skipCache: true },
                  controller.signal,
                ),
              ]);
              if (controller.signal.aborted) return;
              const assetAvailable = assetDetail
                && assetDetail.asset.farmId === currentFarmId
                && assetDetail.asset.status === 'AVAILABLE'
                && assetDetail.locationWarehouseId === warehouseId
                && assetBalances.data.some(({ balance }) => !balance.lotId && Number(balance.quantityOnHand) > 0);
              if (assetAvailable && assetDetail) {
                const line: ReceiptItem = {
                  ...baseLine,
                  id: `${item.id}:${assetDetail.asset.id}`,
                  itemId: item.id,
                  assetId: assetDetail.asset.id,
                  assetCode: assetDetail.asset.assetCode,
                  codeLabel: 'Mã tài sản',
                  code: assetDetail.asset.assetCode,
                  quantity: 1,
                  availableQuantity: 1,
                  note: assetDetail.locationName ? `Đang ở ${assetDetail.locationName}` : 'Đang ở kho đã chọn',
                };
                setItems((current) => current.some((row) => (row.itemId ?? row.id) === line.itemId && (row.assetId ?? null) === (line.assetId ?? null))
                  ? current
                  : [...current, line]);
                setPickerNotice(null);
              } else {
                setPickerNotice('Vật phẩm/lô này không có số dư dương tại kho đã chọn nên chưa được thêm vào phiếu xuất.');
              }
            }
          } else {
            const scoped = await listBalancesPage(
              token,
              currentFarmId!,
              {
                warehouseId,
                itemId: item.id,
                lotId: params.lotId || undefined,
                trackingMode: item.trackingMode,
                positiveOnly: true,
                page: 1,
                pageSize: 20,
                skipCache: true,
              },
              controller.signal,
            );
            if (controller.signal.aborted) return;
            const matchingRows = scoped.data.filter(({ balance }) =>
              balance.farmId === currentFarmId
              && balance.warehouseId === warehouseId
              && balance.itemId === item.id
              && balanceMatchesTrackingMode(balance, item.trackingMode)
              && Number(balance.quantityOnHand) > 0
              && (item.trackingMode !== 'LOT' || Boolean(balance.lotId) && (!params.lotId || balance.lotId === params.lotId)),
            );
            const firstRow = matchingRows[0];
            if (firstRow) {
              const targetLotId = item.trackingMode === 'LOT' ? firstRow.balance.lotId : null;
              const availableQty = matchingRows
                .filter(({ balance }) => (item.trackingMode !== 'LOT' ? !balance.lotId : balance.lotId === targetLotId))
                .reduce((sum, { balance }) => sum + Number(balance.quantityOnHand), 0);
              const line: ReceiptItem = {
                ...baseLine,
                id: targetLotId ? `${item.id}:${targetLotId}` : item.id,
                itemId: item.id,
                lotId: targetLotId,
                lotCode: firstRow.lot?.lotCode ?? firstRow.lotCode ?? undefined,
                supplierLotNumber: firstRow.lot?.supplierLotNumber ?? undefined,
                expiryDate: firstRow.lot?.expiryDate ?? undefined,
                codeLabel: targetLotId ? 'Mã lô' : 'Mã VT',
                code: targetLotId ? (firstRow.lot?.lotCode ?? firstRow.lotCode ?? targetLotId) : item.code,
                quantity: 1,
                availableQuantity: availableQty,
                note: targetLotId
                  ? `Còn ${formatQuantity(availableQty)} ${baseLine.unit} trong lô này`
                  : `Còn ${formatQuantity(availableQty)} ${baseLine.unit} tại kho`,
              };
              const addLine = () => setItems((current) => current.some((row) => (row.itemId ?? row.id) === line.itemId
                && (row.lotId ?? null) === (line.lotId ?? null)
                && (row.assetId ?? null) === (line.assetId ?? null))
                ? current
                : [...current, line]);
              if (line.metadata === 'LOT' && line.expiryDate && lotExpiryState({ expiryDate: line.expiryDate }).expired) {
                Alert.alert('Lô đã hết hạn', `Lô ${line.lotCode ?? ''} đã hết hạn ngày ${line.expiryDate}. Bạn vẫn muốn thêm lô này vào phiếu xuất?`, [
                  { text: 'Chọn lô khác', style: 'cancel' },
                  { text: 'Vẫn chọn lô', style: 'destructive', onPress: addLine },
                ]);
              } else {
                addLine();
              }
              setPickerNotice(null);
            } else {
              setPickerNotice('Vật phẩm/lô này không có số dư dương tại kho đã chọn nên chưa được thêm vào phiếu xuất.');
            }
          }
        }

        const currentLines = itemsRef.current;
        if (currentLines.length > 0 && warehouseId) {
          const { balances, assets } = await fetchScopedIssueStock(token, currentFarmId!, warehouseId, currentLines, controller.signal);
          if (controller.signal.aborted) return;
          setItems((current) => current.map((item) => ({
            ...item,
            availableQuantity: isIssueLineAvailable(item, balances, assets)
              ? getIssueLineAvailableQuantity(item, balances)
              : 0,
          })));
        }
      } catch (cause: unknown) {
        if (!isAbortError(cause) && !controller.signal.aborted) {
          setIssueInventoryError(cause instanceof Error ? cause.message : 'Không thể kiểm tra số dư của kho.');
        }
      } finally {
        if (!controller.signal.aborted) setIssueInventoryLoading(false);
      }
    }

    void hydrateIssueContext();
    return () => controller.abort();
  }, [currentFarmId, documentType, getAccessToken, params.assetId, params.id, params.itemId, params.lotId, requestedCatalogItem, warehouseId]);

  const actionLabel = documentType === 'receipt' ? 'Gửi duyệt Nhập kho' : 'Gửi duyệt Xuất kho';
  const title = documentNote || (documentType === 'receipt' ? 'Phiếu nhập kho' : 'Phiếu xuất kho');
  const documentCode = effectiveId ? documentCodeLabel(savedCode, effectiveId, documentType === 'receipt' ? 'PN' : 'PX') : 'Cấp khi xác nhận';
  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);
  const warehouseInheritedFromInventory = !effectiveId && Boolean(params.warehouseId);
  const lockTypeAndWarehouse = !canEditDocument || Boolean(effectiveId);
  const statusPillTone = documentStatus === 'CONFIRMED'
    ? 'green'
    : documentStatus === 'REJECTED' || documentStatus === 'CANCELLED'
    ? 'danger'
    : documentStatus === 'PENDING_APPROVAL'
    ? 'amber'
    : 'cream';
  const documentStatusLabel = statusLabel(documentStatus);
  const documentItems = items;
  const calendarOffset = (calendarMonth.getDay() + 6) % 7;
  const calendarDays = Array.from({ length: Math.ceil((calendarOffset + new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = index - calendarOffset + 1;
    return day > 0 && day <= new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() ? day : null;
  });
  const totalUnits = useMemo(() => documentItems.reduce((total, item) => total + item.quantity, 0), [documentItems]);

  const assetLineStats = useMemo(() => {
    const map = new Map<string, { count: number; index: number }>();
    if (documentType !== 'receipt') return map;
    const grouped = new Map<string, ReceiptItem[]>();
    for (const line of documentItems) {
      if (line.metadata !== 'ASSET') continue;
      const key = line.itemId ?? line.id;
      const arr = grouped.get(key) ?? [];
      arr.push(line);
      grouped.set(key, arr);
    }
    for (const arr of grouped.values()) {
      arr.forEach((line, idx) => map.set(line.id, { count: arr.length, index: idx + 1 }));
    }
    return map;
  }, [documentItems, documentType]);

  const locationMap = useMemo(() => new Map(locations.map((loc) => [loc.id, loc])), [locations]);

  const summaryItems = useMemo(() => {
    const groups = new Map<string, { name: string; quantity: number; unit: string }>();
    for (const item of documentItems) {
      const key = item.metadata === 'ASSET'
        ? (item.itemId ?? item.name)
        : `${item.itemId ?? item.name}:${item.lotCode ?? item.lotId ?? ''}`;
      const qty = item.metadata === 'ASSET' ? 1 : (Number(item.quantityInput ?? item.quantity) || 0);
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        const lotSuffix = item.lotCode ? ` (Lô ${item.lotCode})` : '';
        groups.set(key, {
          name: `${item.name}${lotSuffix}`,
          quantity: qty,
          unit: item.unit || (item.metadata === 'ASSET' ? 'cá thể' : 'đơn vị'),
        });
      }
    }
    return Array.from(groups.values()).map((g) => ({
      name: g.name,
      quantity: `${formatQuantity(g.quantity)} ${g.unit}`,
    }));
  }, [documentItems]);

  function documentQuantityError() {
    for (const item of documentItems) {
      const entered = item.quantityInput ?? String(item.quantity);
      const error = validateQuantityInput(entered, { max: documentType === 'issue' ? item.availableQuantity : undefined });
      if (error) return `${item.name}: “${entered || 'trống'}”. ${error}`;
      if (item.metadata === 'ASSET' && quantityInputNumber(entered) !== 1) return `${item.name}: mỗi tài sản phải có số lượng bằng 1.`;
    }
    return null;
  }

  const currentMemberId = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.memberId;
  const creatorName = creatorMemberId && creatorMemberId !== currentMemberId
    ? `Thành viên ${creatorMemberId.slice(0, 8)}`
    : data?.user.fullName || data?.user.email || 'Tài khoản hiện tại';

  const changeQuantity = useCallback((id: string, change: number) => {
    if (!canEditDocumentRef.current) return;
    const selected = itemsRef.current.find((item) => item.id === id);
    if (!selected || selected.metadata === 'ASSET') return;
    const entered = selected.quantityInput ?? String(selected.quantity);
    const options = { max: documentType === 'issue' ? selected.availableQuantity : undefined };
    const error = validateQuantityInput(entered, options) ?? validateQuantityInput(String(selected.quantity + change), options);
    if (error) {
      Alert.alert('Số lượng không hợp lệ', error);
      return;
    }
    setItems((current) => current.map((item) => {
      if (item.id !== id || item.metadata === 'ASSET') return item;
      const next = item.quantity + change;
      return validateQuantityInput(String(next), { max: documentType === 'issue' ? item.availableQuantity : undefined })
        ? item : { ...item, quantity: next, quantityInput: String(next) };
    }));
  }, [documentType]);

  const changeQuantityInput = useCallback((id: string, raw: string) => {
    if (!canEditDocumentRef.current) return;
    setItems((current) => current.map((item) => {
      if (item.id !== id || item.metadata === 'ASSET') return item;
      const error = validateQuantityInput(raw, { max: documentType === 'issue' ? item.availableQuantity : undefined });
      return { ...item, quantityInput: raw, ...(!error ? { quantity: quantityInputNumber(raw) } : {}) };
    }));
  }, [documentType]);

  const newAssetLine = useCallback((item: ReceiptItem): ReceiptItem => {
    return {
      ...item,
      id: `${item.itemId ?? item.id}:asset:${++newReceiptLineId.current}`,
      itemId: item.itemId ?? item.id,
      itemCode: item.itemCode ?? (item.codeLabel === 'Mã VT' ? item.code : undefined),
      quantity: 1,
      quantityInput: undefined,
      assetCode: suggestAssetCode(item.itemCode ?? item.code),
      serialNumber: '',
      locationId: item.locationId ?? null,
      locationCode: item.locationCode,
      locationName: item.locationName,
    };
  }, []);

  const adjustAssetCount = useCallback((item: ReceiptItem, change: number) => {
    if (!canEditDocumentRef.current) return;
    const itemId = item.itemId ?? item.id;
    setAssetCountDrafts((current) => { const next = { ...current }; delete next[itemId]; return next; });
    setItems((current) => {
      const matching = current.filter((line) => line.metadata === 'ASSET' && (line.itemId ?? line.id) === itemId);
      const target = matching.length + change;
      if (target < 0 || target > MAX_ASSETS_PER_ITEM) return current;
      if (change > 0) return [...current, newAssetLine(item)];
      if (change < 0) return current.filter((line) => line.id !== matching[matching.length - 1]?.id);
      return current;
    });
  }, [newAssetLine]);

  const commitAssetCount = useCallback((item: ReceiptItem) => {
    if (!canEditDocumentRef.current) return;
    const itemId = item.itemId ?? item.id;
    const raw = assetCountDrafts[itemId];
    if (raw === undefined) return;
    setAssetCountDrafts((current) => { const next = { ...current }; delete next[itemId]; return next; });
    const target = Number(raw);
    if (!/^\d{1,3}$/.test(raw) || !Number.isInteger(target) || target < 1 || target > MAX_ASSETS_PER_ITEM) {
      Alert.alert('Số tài sản không hợp lệ', `Nhập số nguyên từ 1 đến ${MAX_ASSETS_PER_ITEM}.`);
      return;
    }
    setItems((current) => {
      const matching = current.filter((line) => line.metadata === 'ASSET' && (line.itemId ?? line.id) === itemId);
      if (target === matching.length) return current;
      if (target > matching.length) return [...current, ...Array.from({ length: target - matching.length }, () => newAssetLine(item))];
      const keep = new Set(matching.slice(0, target).map((line) => line.id));
      return current.filter((line) => line.metadata !== 'ASSET' || (line.itemId ?? line.id) !== itemId || keep.has(line.id));
    });
  }, [assetCountDrafts, newAssetLine]);

  const updateItemField = useCallback((id: string, field: 'supplierLotNumber' | 'manufacturedDate' | 'expiryDate' | 'assetCode' | 'serialNumber', value: string) => {
    if (!canEditDocumentRef.current) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }, []);

  const openLotPicker = useCallback((item: ReceiptItem) => {
    if (!canEditDocumentRef.current) return;
    setLotPickerItem(item);
    setLotPickerOpen(true);
  }, []);

  const openLocationPicker = useCallback((itemId: string) => {
    if (!canEditDocumentRef.current) return;
    setLocationPickerItemId(itemId);
  }, []);

  const chooseLot = useCallback((lot: InventoryLot, target = lotPickerItem) => {
    if (!canEditDocumentRef.current) return;
    if (!target || lot.farmId !== currentFarmId || lot.itemId !== (target.itemId ?? target.id)) {
      Alert.alert('Lô không hợp lệ', 'Lô không thuộc đúng farm và vật tư đang chọn. Tải lại danh sách lô.');
      return;
    }
    const status = lotExpiryState(lot);
    const apply = () => {
      setItems((current) => current.map((item) => item.id === target.id
        ? { ...item, lotId: lot.id, lotMode: 'EXISTING', lotCode: lot.lotCode, supplierLotNumber: lot.supplierLotNumber ?? undefined, legacyLotNumber: lot.legacyLotNumber ?? undefined, manufacturedDate: lot.manufacturedDate ?? undefined, expiryDate: lot.expiryDate ?? undefined }
        : item));
      setLotPickerOpen(false);
    };
    if (status.expired) {
      Alert.alert('Lô đã hết hạn', `Lô ${lot.lotCode} hết hạn ngày ${lot.expiryDate}. Bạn có chắc muốn chọn lô này để nhập?`, [
        { text: 'Chọn lô khác', style: 'cancel' },
        { text: 'Vẫn chọn lô', style: 'destructive', onPress: apply },
      ]);
      return;
    }
    apply();
  }, [currentFarmId, lotPickerItem]);

  const switchToNewLot = useCallback((item: ReceiptItem) => {
    if (!canEditDocumentRef.current) return;
    const switchMode = () => setItems((current) => current.map((row) => row.id === item.id
      ? { ...row, lotId: null, lotMode: 'NEW', lotCode: undefined, supplierLotNumber: '', manufacturedDate: '', expiryDate: '' }
      : row));
    if (item.lotId) {
      Alert.alert('Tạo lô mới', 'Dòng này sẽ không còn sử dụng lô đã chọn. Tiếp tục?', [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Tạo lô mới', onPress: switchMode },
      ]);
      return;
    }
    switchMode();
  }, []);

  const addNewLotLine = useCallback((item: ReceiptItem) => {
    if (!canEditDocumentRef.current) return;
    const itemId = item.itemId ?? item.id;
    const baseCode = item.itemCode ?? (item.codeLabel === 'Mã VT' ? item.code : itemId);
    setItems((current) => [...current, {
      ...item,
      id: `${itemId}:new:${++newReceiptLineId.current}`,
      itemId,
      itemCode: baseCode,
      codeLabel: 'Mã VT',
      code: baseCode,
      quantity: 1,
      quantityInput: undefined,
      lotId: null,
      lotMode: 'NEW',
      lotCode: undefined,
      supplierLotNumber: '',
      manufacturedDate: '',
      expiryDate: '',
    }]);
  }, []);

  const openCalendar = useCallback((itemId: string, field: LotDateField, value?: string) => {
    if (!canEditDocumentRef.current) return;
    setCalendarTarget({ itemId, field });
    const parts = dateOnlyParts(value);
    setCalendarMonth(new Date(parts.year, parts.month, 1));
  }, []);

  function chooseCalendarDay(day: number) {
    if (!canEditDocumentRef.current || !calendarTarget) return;
    updateItemField(calendarTarget.itemId, calendarTarget.field, formatDateOnly(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)));
    setCalendarTarget(null);
  }

  const fetchModalPickerPage = useCallback(
    async (fetchParams: MultiSelectFetchParams) => {
      if (!currentFarmId) {
        return {
          items: [],
          page: { number: 1, size: fetchParams.pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);

      if (documentType === 'receipt') {
        const res = await listItemsPage(
          token,
          currentFarmId,
          {
            page: fetchParams.page,
            pageSize: fetchParams.pageSize,
            search: fetchParams.search || undefined,
            categoryId: fetchParams.categoryId || undefined,
            trackingMode: fetchParams.trackingMode || undefined,
          },
          fetchParams.signal,
        );
        return {
          items: res.data.map((item) => ({
            id: item.id,
            itemId: item.id,
            name: item.name,
            code: item.code,
            categoryName: item.categoryName,
            unit: item.unitSymbol ?? item.unitName ?? item.itemType,
            trackingMode: item.trackingMode,
            imageUrl: item.imageUrl,
          })),
          page: res.page,
        };
      }

      if (!warehouseId) {
        throw new Error('Cần chọn kho trước để kiểm tra vật phẩm còn tồn.');
      }

      if (fetchParams.trackingMode === 'ASSET') {
        const res = await listAssetsPage(
          token,
          currentFarmId,
          {
            warehouseId,
            status: 'AVAILABLE',
            search: fetchParams.search || undefined,
            page: fetchParams.page,
            pageSize: fetchParams.pageSize,
            skipCache: true,
          },
          fetchParams.signal,
        );
        return {
          items: res.data
            .filter(({ asset, locationWarehouseId }) =>
              asset.farmId === currentFarmId && asset.status === 'AVAILABLE' && locationWarehouseId === warehouseId)
            .map(({ asset, itemCode, itemName, itemImageUrl, locationName }) => ({
              id: `${asset.itemId}:${asset.id}`,
              itemId: asset.itemId,
              name: itemName,
              code: itemCode,
              unit: locationName ? `cá thể (${locationName})` : 'cá thể',
              trackingMode: 'ASSET',
              assetId: asset.id,
              assetCode: asset.assetCode,
              imageUrl: itemImageUrl,
              availableQuantity: 1,
            })),
          page: res.page,
        };
      }

      const res = await listBalancesPage(
        token,
        currentFarmId,
        {
          warehouseId,
          excludeTrackingMode: 'ASSET',
          trackingMode: fetchParams.trackingMode || undefined,
          categoryId: fetchParams.categoryId || undefined,
          search: fetchParams.search || undefined,
          positiveOnly: true,
          page: fetchParams.page,
          pageSize: fetchParams.pageSize,
          skipCache: true,
        },
        fetchParams.signal,
      );

      return {
        items: res.data
          .filter(({ balance, trackingMode }) =>
            balance.farmId === currentFarmId
            && balance.warehouseId === warehouseId
            && Number(balance.quantityOnHand) > 0
            && trackingMode !== 'ASSET'
            && balanceMatchesTrackingMode(balance, trackingMode))
          .map((row) => {
            const isLot = row.trackingMode === 'LOT';
            return {
              id: isLot && row.balance.lotId ? `${row.balance.itemId}:${row.balance.lotId}` : row.balance.itemId,
              itemId: row.balance.itemId,
              name: row.itemName,
              code: row.itemCode,
              categoryName: row.categoryName,
              unit: row.item?.unit?.symbol ?? row.item?.unit?.name ?? row.itemType,
              trackingMode: row.trackingMode,
              lotId: row.balance.lotId,
              lotCode: row.lot?.lotCode ?? row.lotCode ?? undefined,
              supplierLotNumber: row.lot?.supplierLotNumber ?? undefined,
              expiryDate: row.lot?.expiryDate ?? undefined,
              imageUrl: row.itemImageUrl ?? row.item?.imageUrl,
              availableQuantity: Number(row.balance.quantityOnHand),
            };
          }),
        page: res.page,
      };
    },
    [currentFarmId, documentType, getAccessToken, warehouseId],
  );

  const mergeSelectedModalLines = useCallback((linesToMerge: MultiSelectLine[]) => {
    if (linesToMerge.length === 0) return;

    if (documentType === 'receipt') {
      setItems((current) => {
        const next = [...current];
        for (const selected of linesToMerge) {
          const qtyNum = Math.max(0, quantityInputNumber(selected.quantity));
          if (!Number.isFinite(qtyNum) || qtyNum <= 0) continue;

          if (selected.trackingMode === 'ASSET') {
            const existingCount = next.filter(
              (row) => row.metadata === 'ASSET' && (row.itemId ?? row.id) === selected.itemId,
            ).length;
            const remainingSlots = Math.max(0, MAX_ASSETS_PER_ITEM - existingCount);
            const desiredCount = Math.min(remainingSlots, Math.max(1, Math.round(qtyNum)));
            const template: ReceiptItem = {
              id: selected.itemId,
              itemId: selected.itemId,
              itemCode: selected.code,
              name: selected.name,
              codeLabel: 'Mã VT',
              code: selected.code,
              metadata: 'ASSET',
              unit: selected.unit,
              quantity: 1,
              badge: 'ACTIVE',
              badgeTone: 'cream',
              note: '',
              image: selected.imageUrl ?? undefined,
            };
            for (let i = 0; i < desiredCount; i += 1) {
              next.push(newAssetLine(template));
            }
            continue;
          }

          if (selected.trackingMode === 'LOT') {
            next.push({
              id: `${selected.itemId}:new:${++newReceiptLineId.current}`,
              itemId: selected.itemId,
              itemCode: selected.code,
              name: selected.name,
              codeLabel: 'Mã VT',
              code: selected.code,
              metadata: 'LOT',
              unit: selected.unit,
              quantity: qtyNum,
              quantityInput: selected.quantity,
              badge: 'ACTIVE',
              badgeTone: 'cream',
              note: '',
              image: selected.imageUrl ?? undefined,
              lotId: null,
              lotMode: 'NEW',
              supplierLotNumber: '',
              manufacturedDate: '',
              expiryDate: '',
            });
            continue;
          }

          const existingIdx = next.findIndex(
            (row) => (row.itemId ?? row.id) === selected.itemId && row.metadata !== 'LOT' && row.metadata !== 'ASSET',
          );
          if (existingIdx >= 0) {
            const existing = next[existingIdx];
            const updatedQty = existing.quantity + qtyNum;
            next[existingIdx] = {
              ...existing,
              quantity: updatedQty,
              quantityInput: String(updatedQty),
            };
          } else {
            next.push({
              id: selected.itemId,
              itemId: selected.itemId,
              itemCode: selected.code,
              name: selected.name,
              codeLabel: 'Mã VT',
              code: selected.code,
              metadata: selected.trackingMode,
              unit: selected.unit,
              quantity: qtyNum,
              quantityInput: selected.quantity,
              badge: 'ACTIVE',
              badgeTone: 'cream',
              note: '',
              image: selected.imageUrl ?? undefined,
            });
          }
        }
        return next;
      });
      return;
    }

    setItems((current) => {
      const next = [...current];
      for (const selected of linesToMerge) {
        const qtyNum = Math.max(0, quantityInputNumber(selected.quantity));
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) continue;

        if (selected.trackingMode === 'ASSET') {
          const alreadyExists = next.some(
            (row) => (row.itemId ?? row.id) === selected.itemId && (row.assetId ?? null) === (selected.assetId ?? null),
          );
          if (alreadyExists) continue;
          next.push({
            id: `${selected.itemId}:${selected.assetId ?? ''}`,
            itemId: selected.itemId,
            itemCode: selected.code,
            name: selected.name,
            codeLabel: 'Mã tài sản',
            code: selected.assetCode ?? selected.code,
            metadata: 'ASSET',
            unit: selected.unit,
            quantity: 1,
            availableQuantity: 1,
            badge: 'ACTIVE',
            badgeTone: 'cream',
            note: '',
            image: selected.imageUrl ?? undefined,
            assetId: selected.assetId ?? null,
            assetCode: selected.assetCode ?? undefined,
          });
          continue;
        }

        const existingIdx = next.findIndex(
          (row) =>
            (row.itemId ?? row.id) === selected.itemId &&
            (row.lotId ?? null) === (selected.lotId ?? null) &&
            row.metadata !== 'ASSET',
        );
        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          const maxAvail = selected.availableQuantity ?? existing.availableQuantity;
          const rawCombined = existing.quantity + qtyNum;
          const clamped = maxAvail !== undefined ? Math.min(maxAvail, rawCombined) : rawCombined;
          next[existingIdx] = {
            ...existing,
            availableQuantity: maxAvail,
            quantity: clamped,
            quantityInput: String(clamped),
          };
        } else {
          const maxAvail = selected.availableQuantity;
          const clamped = maxAvail !== undefined ? Math.min(maxAvail, qtyNum) : qtyNum;
          next.push({
            id: selected.lotId ? `${selected.itemId}:${selected.lotId}` : selected.itemId,
            itemId: selected.itemId,
            itemCode: selected.code,
            name: selected.name,
            codeLabel: selected.lotId ? 'Mã lô' : 'Mã VT',
            code: selected.lotId ? (selected.lotCode ?? selected.code) : selected.code,
            metadata: selected.trackingMode,
            unit: selected.unit,
            quantity: clamped,
            quantityInput: String(clamped),
            availableQuantity: maxAvail,
            badge: 'ACTIVE',
            badgeTone: 'cream',
            note: selected.lotId
              ? `Còn ${formatQuantity(maxAvail ?? 0)} ${selected.unit} trong lô này`
              : `Còn ${formatQuantity(maxAvail ?? 0)} ${selected.unit} tại kho`,
            image: selected.imageUrl ?? undefined,
            lotId: selected.lotId ?? null,
            lotCode: selected.lotCode ?? undefined,
            supplierLotNumber: selected.supplierLotNumber ?? undefined,
            expiryDate: selected.expiryDate ?? undefined,
          });
        }
      }
      return next;
    });
  }, [documentType, newAssetLine]);

  const handleModalConfirm = useCallback(
    (selectedLines: MultiSelectLine[]) => {
      if (!canEditDocumentRef.current || selectedLines.length === 0) return;
      if (documentType !== 'issue') {
        mergeSelectedModalLines(selectedLines);
        return;
      }

      const ready: MultiSelectLine[] = [];
      const expiredLots: MultiSelectLine[] = [];
      for (const line of selectedLines) {
        if (
          line.trackingMode === 'LOT' &&
          line.expiryDate &&
          lotExpiryState({ expiryDate: line.expiryDate }).expired
        ) {
          expiredLots.push(line);
        } else {
          ready.push(line);
        }
      }

      if (ready.length > 0) mergeSelectedModalLines(ready);
      if (expiredLots.length > 0) {
        const message = expiredLots.length === 1
          ? `Lô ${expiredLots[0].lotCode ?? ''} (${expiredLots[0].name}) đã hết hạn ngày ${expiredLots[0].expiryDate}. Bạn vẫn muốn xuất từ lô này?`
          : `Có ${expiredLots.length} lô đã hết hạn. Bạn vẫn muốn thêm các lô này vào phiếu xuất?`;
        Alert.alert('Lô đã hết hạn', message, [
          { text: 'Chọn lô khác', style: 'cancel' },
          {
            text: 'Vẫn chọn lô',
            style: 'destructive',
            onPress: () => mergeSelectedModalLines(expiredLots),
          },
        ]);
      }
    },
    [documentType, mergeSelectedModalLines],
  );

  function openItemPicker() {
    if (!canEditDocumentRef.current) return;
    setPickerNotice(null);
    setPickerOpen(true);
  }

  const openItemDetails = useCallback((item: ReceiptItem) => {
    const itemId = item.itemId ?? item.id;
    const lotId = item.lotId ?? (params.id ? undefined : params.lotId);
    router.push(`/inventory-detail?itemId=${encodeURIComponent(itemId)}${warehouseId ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ''}${lotId ? `&lotId=${encodeURIComponent(lotId)}` : ''}` as never);
  }, [params.id, params.lotId, router, warehouseId]);

  const removeDocumentLine = useCallback((id: string) => {
    if (!canEditDocumentRef.current) return;
    setItems((current) => current.filter((currentItem) => currentItem.id !== id));
  }, []);

  async function submitDocument() {
    if (!canEditDocumentRef.current || submittingDocument.current || savingDraftRef.current) return;
    submittingDocument.current = true;
    setSubmitting(true);
    try {
      await performSubmitDocument();
    } finally {
      submittingDocument.current = false;
      setSubmitting(false);
    }
  }

  async function performSubmitDocument() {
    if (!canEditDocumentRef.current) return;
    if (documentType === 'issue' && (issueInventoryLoading || issueInventoryError || !warehouseId)) {
      Alert.alert('Chưa xác thực tồn kho', issueInventoryError ?? 'Đang kiểm tra số dư của kho. Hãy thử gửi lại sau khi kiểm tra hoàn tất.');
      return;
    }
    if (!currentFarmId || !warehouseId || documentItems.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Hãy chọn trang trại, kho và ít nhất một vật tư.');
      return;
    }
    const quantityError = documentQuantityError();
    if (quantityError) {
      Alert.alert('Số lượng không hợp lệ', quantityError);
      return;
    }
    if (documentType === 'issue') {
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const { balances, assets } = await fetchScopedIssueStock(token, currentFarmId, warehouseId, documentItems);
        const stockError = issueStockError(documentItems, balances, assets);
        if (stockError) {
          setItems((current) => current.map((item) => ({
            ...item,
            availableQuantity: isIssueLineAvailable(item, balances, assets)
              ? getIssueLineAvailableQuantity(item, balances)
              : 0,
          })));
          Alert.alert('Tồn kho đã thay đổi', `${stockError} Kiểm tra lại phiếu trước khi gửi.`);
          return;
        }
      } catch (cause: unknown) {
        Alert.alert('Không kiểm tra được tồn kho', cause instanceof Error ? cause.message : 'Không thể xác nhận số dư mới nhất.');
        return;
      }
    }
    const missingLot = documentType === 'receipt' && documentItems.find((item) => item.metadata === 'LOT' && item.lotId && item.lotMode !== 'EXISTING');
    if (missingLot) {
      Alert.alert('Thông tin lô không hợp lệ', `Vui lòng chọn lại lô có sẵn cho vật tư “${missingLot.name}”.`);
      return;
    }
    const invalidLotDates = documentType === 'receipt' && documentItems.find((item) => item.metadata === 'LOT' && !item.lotId && item.manufacturedDate && item.expiryDate && item.expiryDate < item.manufacturedDate);
    if (invalidLotDates) {
      Alert.alert('Ngày lô không hợp lệ', `Hạn sử dụng của “${invalidLotDates.name}” không thể sớm hơn ngày sản xuất.`);
      return;
    }
    const missingAsset = documentType === 'receipt' && documentItems.find((item) => item.metadata === 'ASSET' && (!item.assetCode?.trim() || item.quantity !== 1));
    if (missingAsset) {
      Alert.alert('Thiếu thông tin tài sản', `Tài sản “${missingAsset.name}” cần mã tài sản và số lượng bằng 1.`);
      return;
    }
    const missingAssetLocation = documentType === 'receipt' && documentItems.find((item) => item.metadata === 'ASSET' && !item.locationId?.trim());
    if (missingAssetLocation) {
      Alert.alert('Thiếu vị trí', `Tài sản “${missingAssetLocation.name}” cần chọn vị trí trong kho.`);
      return;
    }
    if (documentType === 'receipt') {
      const assetCodes = new Set<string>();
      const serialNumbers = new Set<string>();
      for (const item of documentItems.filter((line) => line.metadata === 'ASSET')) {
        const code = item.assetCode!.trim();
        const serial = item.serialNumber?.trim();
        if (assetCodes.has(code) || (serial && serialNumbers.has(serial))) {
          Alert.alert('Trùng thông tin tài sản', `“${item.name}” có mã tài sản hoặc số serial trùng trong phiếu. Mỗi tài sản cần thông tin riêng.`);
          return;
        }
        assetCodes.add(code);
        if (serial) serialNumbers.add(serial);
      }
    }
    const missingIssueTracking = documentType === 'issue' && documentItems.find((item) => (item.metadata === 'LOT' && !item.lotId) || (item.metadata === 'ASSET' && !item.assetId));
    if (missingIssueTracking) {
      Alert.alert('Cần chọn đúng đối tượng tồn', `Vật tư “${missingIssueTracking.name}” cần chọn lô hoặc tài sản cụ thể trước khi xuất.`);
      return;
    }
    let persistedId: string | undefined;
    let draftPersisted = false;
    try {
      const persisted = await persistDraftDocument();
      persistedId = persisted.id;
      draftPersisted = true;
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const base = documentType === 'receipt' ? 'stock-receipts' : 'stock-issues';
      await apiRequest(`/${base}/${persistedId}/submit`, { method: 'POST', token, params: { farmId: currentFarmId } });
      clearApiCache();
      setDocumentStatus('PENDING_APPROVAL');
      setPickerOpen(false);
      setLotPickerOpen(false);
      setCalendarTarget(null);
      setWarehousePickerOpen(false);
      setLocationPickerItemId(null);
      setSuccessDialogOpen(true);
    } catch (cause: unknown) {
      if (cause instanceof MobileApiError && cause.status === 409 && draftPersisted) {
        if (persistedId) {
          clearApiCache();
          void reloadDocumentById(persistedId);
        }
      }
      Alert.alert('Không thể gửi phiếu', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  }

  const handleGenerateAssetCode = useCallback(
    (target: ReceiptItem) => updateItemField(target.id, 'assetCode', suggestAssetCode(target.itemCode ?? target.code)),
    [updateItemField],
  );
  const handleSelectSuggestedLot = useCallback(
    (lot: InventoryLot, target: ReceiptItem) => chooseLot(lot, target),
    [chooseLot],
  );
  const handleChangeAssetCountText = useCallback(
    (itemId: string, value: string) => setAssetCountDrafts((current) => ({ ...current, [itemId]: value })),
    [],
  );

  const renderDocumentItem = useCallback(
    ({ item }: { item: ReceiptItem }) => {
      const itemId = item.itemId ?? item.id;
      const assetMeta = assetLineStats.get(item.id);
      const assetCount = assetMeta?.count ?? 0;
      const assetIndex = assetMeta ? assetMeta.index : undefined;
      const loc = item.locationId ? locationMap.get(item.locationId) : undefined;
      const locCode = loc?.code ?? item.locationCode;
      const locName = loc?.name ?? item.locationName;
      const locationLabel = locCode && locName ? `${locCode} · ${locName}` : locCode || locName || undefined;

      return (
        <View style={styles.itemRowWrap}>
          <ItemCard
            item={item}
            documentType={documentType}
            editable={canEditDocument}
            detailView={Boolean(effectiveId)}
            assetCount={assetCount}
            assetIndex={assetIndex}
            assetCountInput={assetCountDrafts[itemId] ?? String(assetCount)}
            onChangeAssetCountText={handleChangeAssetCountText}
            onCommitAssetCount={commitAssetCount}
            onAdjustAssetCount={adjustAssetCount}
            locationLabel={locationLabel}
            onChooseLocation={openLocationPicker}
            onChangeQuantity={changeQuantity}
            onChangeQuantityInput={changeQuantityInput}
            onChangeField={updateItemField}
            onGenerateAssetCode={handleGenerateAssetCode}
            onChooseExistingLot={openLotPicker}
            onSelectSuggestedLot={handleSelectSuggestedLot}
            onCreateNewLot={switchToNewLot}
            onAddNewLot={addNewLotLine}
            onPickDate={openCalendar}
            onRemove={removeDocumentLine}
            onOpenDetail={openItemDetails}
          />
        </View>
      );
    },
    [
      assetLineStats,
      locationMap,
      documentType,
      canEditDocument,
      effectiveId,
      assetCountDrafts,
      handleChangeAssetCountText,
      commitAssetCount,
      adjustAssetCount,
      changeQuantity,
      changeQuantityInput,
      updateItemField,
      handleGenerateAssetCode,
      openLotPicker,
      handleSelectSuggestedLot,
      switchToNewLot,
      addNewLotLine,
      openCalendar,
      removeDocumentLine,
      openItemDetails,
    ],
  );

  const detailView = Boolean(effectiveId);

  const listHeaderElement = (
    <View style={styles.contentCenter}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="Quay lại">
          <Icon name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <View style={styles.titleLine}>
            <Text numberOfLines={2} style={styles.topTitle}>Chi tiết {documentType === 'receipt' ? 'Phiếu Nhập Kho' : 'Phiếu Xuất Kho'}</Text>
            <Pill tone="cream"><Text style={styles.farmPillText} numberOfLines={2}>{currentFarmName}</Text></Pill>
          </View>
          <View style={styles.onlineLine}>
            <View style={styles.onlineDot} />
            <Text numberOfLines={2} style={styles.onlineText}>Phiếu kho</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={() => {
          if (effectiveId) {
            clearApiCache();
            void reloadDocumentById(effectiveId);
          } else {
            Alert.alert('Đồng bộ', 'Phiếu mới chưa lưu trên máy chủ.');
          }
        }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="Đồng bộ dữ liệu">
          <Icon name="sync" size={21} color={colors.primary} />
        </Pressable></View>
      </View>

      <View style={styles.workspace}>
        <View style={styles.subHeader}>
          <View style={styles.segmentedControl}>
            <Pressable disabled={lockTypeAndWarehouse} onPress={() => { if (!lockTypeAndWarehouse) setDocumentType('receipt'); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.segment, documentType === 'receipt' && styles.segmentActive, lockTypeAndWarehouse && styles.readOnlyControl, pressed && styles.pressed]}>
              <Text style={[styles.segmentText, documentType === 'receipt' && styles.segmentTextActive]}>Phiếu Nhập</Text>
            </Pressable>
            <Pressable disabled={lockTypeAndWarehouse} onPress={() => { if (!lockTypeAndWarehouse) setDocumentType('issue'); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.segment, documentType === 'issue' && styles.segmentActive, lockTypeAndWarehouse && styles.readOnlyControl, pressed && styles.pressed]}>
              <Text style={[styles.segmentText, documentType === 'issue' && styles.segmentTextActive]}>Phiếu Xuất</Text>
            </Pressable>
          </View>
          <Pill tone={statusPillTone}>
            <View
              style={[
                styles.statusDot,
                documentStatus === 'CONFIRMED' && styles.statusDotGreen,
                (documentStatus === 'REJECTED' || documentStatus === 'CANCELLED') && styles.statusDotDanger,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                documentStatus === 'CONFIRMED' && styles.statusTextGreen,
                (documentStatus === 'REJECTED' || documentStatus === 'CANCELLED') && styles.statusTextDanger,
              ]}
            >
              {documentStatusLabel}
            </Text>
          </Pill>
        </View>

        {loading ? <Text style={styles.documentMessage}>Đang tải chi tiết phiếu...</Text> : documentError ? <Text style={styles.documentError}>{documentError}</Text> : null}
        <View style={styles.primaryCard}>
          <HoneycombDecor />
          <View style={styles.primaryAccent} />
          <View style={styles.primaryHeader}>
            <View style={styles.primaryTitleBlock}>
              <Pill tone="cream"><Text style={styles.codePillText}>MÃ PHIẾU: {documentCode}</Text></Pill>
              <Text style={styles.receiptTitle}>{title}</Text>
            </View>
            <Pressable onPress={() => Alert.alert('Đã sao chép', documentCode)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]} accessibilityLabel="Sao chép mã">
              <Icon name="content-copy" size={19} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
          <View style={styles.infoGrid}>
            <InfoBlock label={documentDate || effectiveId ? 'Thời gian tạo' : 'Giờ hiện tại'} icon="calendar-today">
              <Text style={styles.infoValue}>{formatApiDateTime(documentDate ?? (!effectiveId ? currentDeviceTime : null))}</Text>
              <Text style={styles.infoSubvalue}>{documentDate ? 'Máy chủ ghi nhận • Giờ Việt Nam' : effectiveId ? 'Chưa tải được thời gian từ máy chủ' : 'Theo đồng hồ điện thoại • cập nhật khi lưu phiếu'}</Text>
            </InfoBlock>
            <InfoBlock label="Người tạo" icon="person">
              <Text style={styles.infoValue}>{creatorName}</Text>
              <Text style={styles.infoSubvalue}>{creatorMemberId ? `Member: ${creatorMemberId.slice(0, 8)}` : 'Lấy từ tài khoản đăng nhập'}</Text>
            </InfoBlock>
            <InfoBlock label="Kho tạo phiếu" icon="warehouse">
              <Pressable disabled={lockTypeAndWarehouse || warehouseInheritedFromInventory} onPress={() => setWarehousePickerOpen(true)} style={[styles.warehouseSelect, (lockTypeAndWarehouse || warehouseInheritedFromInventory) && styles.readOnlyControl]}>
                <Text numberOfLines={2} style={styles.infoValue}>{selectedWarehouse?.name ?? 'Chọn kho'}</Text>
                {!lockTypeAndWarehouse && !warehouseInheritedFromInventory ? <Icon name="arrow-drop-down" size={20} color={colors.primary} /> : null}
              </Pressable>
              <Text style={styles.infoSubvalue}>{selectedWarehouse?.code ?? 'Kho thuộc trang trại đang chọn'}{warehouseInheritedFromInventory ? ' • Lấy từ màn hình Tồn kho' : ''}</Text>
            </InfoBlock>
          </View>
          <View style={styles.sourceRow}>
            <View style={styles.sourceTextRow}>
              <Icon name="eco" size={17} color={colors.primary} />
              <Text style={styles.sourceText}>Ghi chú: <Text style={styles.sourceStrong}>{documentNote || 'Chưa thêm ghi chú'}</Text></Text>
            </View>
            <Pill tone={statusPillTone}>
              <Text
                style={[
                  styles.statusText,
                  documentStatus === 'CONFIRMED' && styles.statusTextGreen,
                  (documentStatus === 'REJECTED' || documentStatus === 'CANCELLED') && styles.statusTextDanger,
                ]}
              >
                {documentStatusLabel}
              </Text>
            </Pill>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Danh mục vật tư & mật</Text>
          <View style={styles.headingActions}>
            <Pill tone="neutral"><Text style={styles.countText}>{documentItems.length} mục</Text></Pill>
            {canEditDocument ? <Pressable onPress={openItemPicker} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Icon name="add-box" size={19} color={colors.primary} />
              <Text style={styles.addButtonText}>Thêm mục</Text>
            </Pressable> : null}
          </View>
        </View>

        {documentType === 'issue' && issueInventoryLoading ? <Text style={styles.documentMessage}>Đang xác thực tồn tại kho trước khi hiển thị vật phẩm xuất...</Text> : null}
        {documentType === 'issue' && issueInventoryError ? <Text style={styles.documentError}>{issueInventoryError}</Text> : null}
        {pickerNotice && !pickerOpen ? <Text style={styles.pickerNotice}>{pickerNotice}</Text> : null}
      </View>
    </View>
  );

  const listFooterElement = (
    <View style={[styles.contentCenter, styles.footerWrap]}>
      <View style={[detailView && styles.detailSectionCard]} collapsable={false}>
        <View style={[styles.summaryCard, shadows.surface, detailView && styles.detailCardContent]}>
          <View style={styles.summaryIcon}><Icon name="summarize" size={23} color={colors.primary} /></View>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>TỔNG SỐ LƯỢNG {documentType === 'receipt' ? 'NHẬP' : 'XUẤT'}</Text>
            <Text style={styles.summaryValue}>{formatQuantity(totalUnits)} đơn vị hàng hóa</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryWeight}>
            <Text style={styles.summaryLabel}>KHO</Text>
            <Text numberOfLines={2} style={styles.weightValue}>{selectedWarehouse?.name ?? 'Chưa chọn'}</Text>
          </View>
        </View>

        <View style={[styles.notesCard, shadows.surface, detailView && styles.detailCardContent]}>
          <View style={styles.notesHeader}>
            <View style={styles.notesTitleRow}>
              <View style={styles.notesIcon}><Icon name="local-shipping" size={20} color={colors.primary} /></View>
              <Text style={styles.notesTitle}>Ghi chú phiếu</Text>
            </View>
            <Pill tone="cream"><Icon name="cloud-done" size={15} color={colors.primary} /><Text style={styles.greenPillText}>Lưu cùng phiếu</Text></Pill>
          </View>
          <TextInput value={documentNote ?? ''} onChangeText={setDocumentNote} editable={canEditDocument} multiline maxLength={4000} placeholder="Nhập ghi chú cho phiếu (không bắt buộc)" placeholderTextColor={colors.onSurfaceVariant} style={[styles.noteInput, !canEditDocument && styles.readOnlyControl]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={documentItems}
        keyExtractor={(item) => item.id}
        renderItem={renderDocumentItem}
        style={styles.listFlex}
        contentContainerStyle={[
          styles.flatListContent,
          { paddingBottom: dimensions.bottomNavHeight + 106 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={false}
        ListHeaderComponent={listHeaderElement}
        ListFooterComponent={listFooterElement}
        ListEmptyComponent={
          !loading && !documentError && !issueInventoryLoading ? (
            canEditDocument ? (
              <View style={styles.itemRowWrap}>
                <Pressable onPress={openItemPicker} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.emptyItems, pressed && styles.pressed]}>
                  <Icon name="add-circle-outline" size={24} color={colors.primary} />
                  <Text style={styles.emptyItemsTitle}>Chưa có vật tư trong phiếu</Text>
                  <Text style={styles.emptyItemsText}>
                    {documentType === 'issue'
                      ? 'Chỉ vật phẩm có tồn tại kho đang chọn mới được thêm vào phiếu xuất.'
                      : 'Chọn “Thêm mục” để thêm vật tư vào phiếu trước khi gửi duyệt.'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.itemRowWrap}>
                <View style={styles.emptyItems}>
                  <Icon name="inventory-2" size={24} color={colors.onSurfaceVariant} />
                  <Text style={styles.emptyItemsTitle}>Phiếu không có dòng vật tư</Text>
                </View>
              </View>
            )
          ) : null
        }
      />

      <Modal visible={exitPromptOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.exitBackdrop}>
          <View style={styles.exitCard} accessibilityRole="alert">
            <View style={styles.exitIcon}><Icon name="save-as" size={23} color={colors.primary} /></View>
            <Text style={styles.exitEyebrow}>PHIẾU CHƯA HOÀN TẤT</Text>
            <Text style={styles.exitTitle}>Bạn muốn xử lý phiếu này thế nào?</Text>
            <Text style={styles.exitDescription}>Phiếu chưa gửi duyệt. Bạn có thể lưu lại ở trạng thái nháp để tiếp tục sau, hoặc thoát và bỏ các thay đổi hiện tại.</Text>
            {draftSaveError ? <Text style={styles.exitError}>{draftSaveError}</Text> : null}
            <View style={styles.exitActions}>
              <Pressable disabled={savingDraft} onPress={leaveWithoutSaving} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [styles.exitDiscard, pressed && styles.pressed, savingDraft && styles.disabledAction]}>
                <Text style={styles.exitDiscardText}>Thoát không lưu</Text>
              </Pressable>
              <Pressable disabled={savingDraft} onPress={() => void saveDraftAndLeave()} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.exitSave, pressed && styles.pressed, savingDraft && styles.disabledAction]}>
                <Icon name={savingDraft ? 'hourglass-top' : 'save'} size={18} color={colors.onPrimary} />
                <Text style={styles.exitSaveText}>{savingDraft ? 'Đang lưu nháp...' : 'Lưu nháp'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ItemMultiSelectModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Chọn vật tư & mật"
        subtitle={selectedWarehouse ? `Kho: ${selectedWarehouse.name}` : undefined}
        hint={documentType === 'receipt' ? 'Mã mặt hàng được lấy từ danh mục. Mặt hàng chưa có cần được quản lý tạo trên web.' : undefined}
        notice={pickerNotice}
        fetchPage={fetchModalPickerPage}
        trackingFilterOptions={documentType === 'issue' ? ISSUE_PICKER_TRACKING_FILTERS : RECEIPT_PICKER_TRACKING_FILTERS}
        hideCategoriesWhenTracking={['ASSET']}
        searchPlaceholder={documentType === 'issue' ? 'Tìm tên, mã VT, mã lô, mã TS...' : 'Tìm theo tên hoặc mã vật tư...'}
        onConfirm={handleModalConfirm}
      />

      <LotPickerModal
        visible={lotPickerOpen}
        farmId={currentFarmId}
        itemId={lotPickerItem ? (lotPickerItem.itemId ?? lotPickerItem.id) : null}
        itemName={lotPickerItem?.name ?? ''}
        title="Chọn lô có sẵn"
        emptyMessage="Vật tư này chưa có lô. Chọn “Tạo lô mới” để tiếp tục."
        onSelectLot={(lot) => chooseLot(lot)}
        onClose={() => setLotPickerOpen(false)}
      />

      <Modal visible={Boolean(calendarTarget)} transparent animationType="fade" onRequestClose={() => setCalendarTarget(null)}>
        <View style={styles.exitBackdrop}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.calendarArrow}><Icon name="chevron-left" color={colors.primary} /></Pressable>
              <Text style={styles.calendarTitle}>{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</Text>
              <Pressable onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.calendarArrow}><Icon name="chevron-right" color={colors.primary} /></Pressable>
            </View>
            <View style={styles.calendarGrid}>{weekdays.map((day) => <Text key={day} style={styles.calendarWeekday}>{day}</Text>)}</View>
            <View style={styles.calendarGrid}>{calendarDays.map((day, index) => day ? <Pressable key={`${day}-${index}`} onPress={() => chooseCalendarDay(day)} style={styles.calendarDay}><Text style={styles.calendarDayText}>{day}</Text></Pressable> : <View key={`empty-${index}`} style={styles.calendarDay} />)}</View>
            <Pressable onPress={() => setCalendarTarget(null)} style={styles.calendarCancel}><Text style={styles.calendarCancelText}>Huỷ</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={warehousePickerOpen} transparent animationType="slide" onRequestClose={() => setWarehousePickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}><Text style={styles.pickerEyebrow}>KHO CỦA FARM</Text><Text style={styles.pickerTitle}>Chọn kho tạo phiếu</Text></View>
              <Pressable onPress={() => setWarehousePickerOpen(false)} style={styles.pickerClose} accessibilityLabel="Đóng danh sách kho"><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {warehouses.map((warehouse) => <Pressable key={warehouse.id} onPress={() => { if (!canEditDocumentRef.current || Boolean(effectiveId)) return; if (warehouse.id !== warehouseId) { setItems((current) => current.map((entry) => ({ ...entry, locationId: null, locationCode: undefined, locationName: undefined }))); setLocationSearch(''); setDebouncedLocationSearch(''); } setWarehouseId(warehouse.id); setWarehousePickerOpen(false); }} style={({ pressed }) => [styles.pickerItem, warehouse.id === warehouseId && styles.pickerItemActive, pressed && styles.pressed]}>
                <View style={styles.pickerItemIcon}><Icon name="warehouse" size={20} color={colors.primary} /></View>
                <View style={styles.pickerItemCopy}><Text style={styles.pickerItemName}>{warehouse.name}</Text><Text style={styles.pickerItemMeta}>{warehouse.code}</Text></View>
                {warehouse.id === warehouseId ? <Icon name="check-circle" color={colors.statusSuccess} /> : <Icon name="radio-button-unchecked" color={colors.outline} />}
              </Pressable>)}
              {warehouses.length === 0 ? <Text style={styles.emptyItemsText}>Farm chưa có kho đang hoạt động.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(locationPickerItemId)}
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => { setLocationPickerItemId(null); setLocationSearch(''); setDebouncedLocationSearch(''); }}
      >
        <View style={[styles.locationModalScreen, { paddingTop: insets.top }]}>
          <View style={styles.locationModalTopBar}>
            <Pressable
              onPress={() => { setLocationPickerItemId(null); setLocationSearch(''); setDebouncedLocationSearch(''); }}
              android_ripple={{ color: colors.primaryFixed }}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
              accessibilityLabel="Quay lại"
            >
              <Icon name="arrow-back" size={22} color={colors.primary} />
            </Pressable>
            <View style={styles.pickerHeaderCopy}>
              <Text style={styles.pickerEyebrow}>VỊ TRÍ LƯU KHO</Text>
              <Text numberOfLines={2} style={styles.pickerTitle}>Chọn vị trí cho tài sản</Text>
              <Text numberOfLines={1} style={styles.pickerItemMeta}>{selectedWarehouse?.name ?? 'Kho đang chọn'}</Text>
            </View>
          </View>
          <View style={[styles.locationModalBody, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
            <View style={styles.locationSearchBox}>
              <Icon name="search" size={18} color={colors.primary} />
              <TextInput
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder="Tìm mã hoặc tên vị trí..."
                placeholderTextColor={colors.onSurfaceVariant}
                style={styles.locationSearchInput}
                returnKeyType="search"
              />
              {locationSearch ? (
                <Pressable onPress={() => setLocationSearch('')} accessibilityLabel="Xóa tìm kiếm vị trí">
                  <Icon name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              ) : null}
            </View>
            {locationsError ? (
              <View style={styles.locationErrorRow}>
                <Text style={[styles.documentError, styles.locationErrorText]}>{locationsError}</Text>
                <Pressable onPress={() => setLocationReloadNonce((n) => n + 1)} style={styles.locationRetryButton}>
                  <Text style={styles.locationRetryText}>Thử lại</Text>
                </Pressable>
              </View>
            ) : null}
            <FlatList
              data={locationsLoading ? [] : locations}
              keyExtractor={(loc) => loc.id}
              style={styles.locationModalList}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerList}
              renderItem={({ item: loc }) => {
                const targetItem = items.find((entry) => entry.id === locationPickerItemId);
                const selected = targetItem?.locationId === loc.id;
                return (
                  <Pressable
                    onPress={() => {
                      if (locationPickerItemId) {
                        setItems((current) => current.map((entry) => entry.id === locationPickerItemId ? { ...entry, locationId: loc.id, locationCode: loc.code, locationName: loc.name } : entry));
                      }
                      setLocationPickerItemId(null);
                      setLocationSearch('');
                      setDebouncedLocationSearch('');
                    }}
                    style={({ pressed }) => [styles.pickerItem, selected && styles.pickerItemActive, pressed && styles.pressed]}
                  >
                    <View style={styles.pickerItemIcon}><Icon name="place" size={20} color={colors.primary} /></View>
                    <View style={styles.pickerItemCopy}>
                      <Text style={styles.pickerItemName}>{loc.name}</Text>
                      <Text style={styles.pickerItemMeta}>{loc.code}</Text>
                    </View>
                    {selected ? <Icon name="check-circle" color={colors.statusSuccess} /> : <Icon name="radio-button-unchecked" color={colors.outline} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                locationsLoading ? (
                  <View style={styles.locationLoadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.documentMessage}>Đang tải vị trí lưu kho...</Text>
                  </View>
                ) : !locationsError ? (
                  <Text style={styles.emptyItemsText}>
                    {debouncedLocationSearch
                      ? 'Không tìm thấy vị trí khớp từ khóa.'
                      : 'Kho này chưa có vị trí đang hoạt động. Vui lòng tạo vị trí lưu kho trước khi nhập tài sản.'}
                  </Text>
                ) : null
              }
              ListFooterComponent={
                !locationsLoading && !locationsError && locationPage < locationTotalPages ? (
                  <Pressable
                    disabled={locationsLoadingMore}
                    onPress={() => void loadMoreLocations()}
                    style={styles.locationLoadMoreButton}
                  >
                    {locationsLoadingMore ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Icon name="expand-more" size={18} color={colors.primary} />
                    )}
                    <Text style={styles.locationLoadMoreText}>
                      {locationsLoadingMore
                        ? 'Đang tải thêm...'
                        : `Tải thêm vị trí (${locations.length}/${locationTotalItems})`}
                    </Text>
                  </Pressable>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>

      <View style={[styles.bottomDock, { paddingBottom: insets.bottom }]}> 
        <View style={styles.actionShelf}>
          <Pressable onPress={() => router.back()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]} accessibilityLabel="Quay lại danh sách">
            <Icon name="arrow-back" size={19} color={colors.onSurfaceVariant} />
          </Pressable>
          {canEditDocument ? <Pressable disabled={submitting || savingDraft} onPress={() => void submitDocument()} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.confirmAction, (submitting || savingDraft) && styles.disabledAction, pressed && styles.pressed]}>
            <LinearGradient colors={gradients.honeyCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.confirmGradient}>
              <Icon name={submitting ? 'hourglass-top' : 'check-circle'} size={19} color={colors.onPrimary} filled={!submitting} />
              <Text style={styles.confirmText}>{submitting ? 'Đang gửi...' : actionLabel}</Text>
            </LinearGradient>
          </Pressable> : <View style={styles.readOnlyNotice}><Icon name="lock" size={16} color={colors.onSurfaceVariant} /><Text style={styles.readOnlyText}>{documentError ? 'Không tải được dữ liệu phiếu' : 'Chỉ phiếu nháp mới được chỉnh sửa'}</Text></View>}
          {canEditDocument ? <Pressable disabled={submitting || savingDraft || !hasUnsavedChanges} onPress={() => void saveDraftInPlace()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.saveDraftAction, (submitting || savingDraft || !hasUnsavedChanges) && styles.disabledAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Lưu nháp">
            <Icon name={savingDraft ? 'hourglass-top' : 'save'} size={17} color={colors.primary} />
            <Text style={styles.saveDraftText}>{savingDraft ? 'Đang lưu...' : 'Lưu nháp'}</Text>
          </Pressable> : null}
        </View>
        <View style={styles.bottomNav}>
          {navItems.map((item) => {
            const isActive = activeNav === item.label;
            return (
              <Pressable key={item.label} onPress={() => router.push((item.label === 'Tổng quan' ? '/dashboard' : item.label === 'Tồn kho' ? '/inventory' : item.label === 'Quét QR' ? '/scan' : '/receipts') as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]} accessibilityRole="button">
                <View style={[styles.navIconWrap, isActive && styles.navIconActive]}>
                  <Icon name={item.icon} size={isActive ? 21 : 22} color={isActive ? colors.onPrimary : colors.onSurfaceVariant} filled={isActive} />
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <OperationResultDialog
        visible={successDialogOpen}
        title={`Phiếu ${documentType === 'receipt' ? 'nhập' : 'xuất'} đã gửi duyệt`}
        details={[
          { label: 'Mã phiếu', value: savedCode ?? (effectiveId ? documentCodeLabel(null, effectiveId, documentType === 'receipt' ? 'PN' : 'PX') : '—') },
          { label: 'Kho', value: selectedWarehouse?.name ?? '—' },
          { label: 'Ngày phiếu', value: documentBusinessDate ? formatDisplayDate(documentBusinessDate) : '—' },
        ]}
        items={summaryItems}
        actionLabel="Về danh sách phiếu"
        onAction={() => {
          allowRemoval.current = true;
          pendingBackAction.current = null;
          setSuccessDialogOpen(false);
          navigateToReceiptList(router, navigation, documentType === 'issue' ? 'ISSUE' : 'RECEIPT');
        }}
      />
    </View>
  );
}

function InfoBlock({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}><Icon name={icon} size={16} color={colors.primary} /><View style={styles.infoText}>{children}</View></View>
    </View>
  );
}


const ItemCard = memo(function ItemCard({ item, documentType, editable, detailView, assetCount = 1, assetIndex, assetCountInput, onChangeAssetCountText, onCommitAssetCount, onAdjustAssetCount, locationLabel, onChooseLocation, onChangeQuantity, onChangeQuantityInput, onChangeField, onGenerateAssetCode, onChooseExistingLot, onSelectSuggestedLot, onCreateNewLot, onAddNewLot, onPickDate, onRemove, onOpenDetail }: { item: ReceiptItem; documentType: DocumentType; editable: boolean; detailView: boolean; assetCount?: number; assetIndex?: number; assetCountInput?: string; onChangeAssetCountText?: (itemId: string, value: string) => void; onCommitAssetCount?: (item: ReceiptItem) => void; onAdjustAssetCount?: (item: ReceiptItem, change: number) => void; locationLabel?: string; onChooseLocation: (id: string) => void; onChangeQuantity: (id: string, change: number) => void; onChangeQuantityInput: (id: string, value: string) => void; onChangeField: (id: string, field: 'supplierLotNumber' | 'manufacturedDate' | 'expiryDate' | 'assetCode' | 'serialNumber', value: string) => void; onGenerateAssetCode: (item: ReceiptItem) => void; onChooseExistingLot: (item: ReceiptItem) => void; onSelectSuggestedLot: (lot: InventoryLot, item: ReceiptItem) => void; onCreateNewLot: (item: ReceiptItem) => void; onAddNewLot: (item: ReceiptItem) => void; onPickDate: (id: string, field: LotDateField, value?: string) => void; onRemove: (id: string) => void; onOpenDetail: (item: ReceiptItem) => void }) {
  const itemKey = item.itemId ?? item.id;
  const isReceiptAsset = documentType === 'receipt' && item.metadata === 'ASSET';
  const assetMinusDisabled = assetCount <= 1;
  const assetPlusDisabled = assetCount >= MAX_ASSETS_PER_ITEM;
  const badgeStyle = item.badgeTone === 'green' ? styles.badgeGreen : item.badgeTone === 'amber' ? styles.badgeAmber : styles.badgeCream;
  const quantityError = editable && item.metadata !== 'ASSET'
    ? validateQuantityInput(item.quantityInput ?? String(item.quantity), { max: documentType === 'issue' ? item.availableQuantity : undefined })
    : null;
  const thumbUrl = toThumbnailUrl(item.image, 128);
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => editable && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-110, Math.min(110, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 70) {
        onRemove(item.id);
        return;
      }
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 4 }).start(),
  }), [editable, item.id, onRemove, translateX]);
  return (
    <Animated.View {...swipeResponder.panHandlers} style={[styles.itemCard, detailView && styles.detailItemCard, !detailView && shadows.surface, { transform: [{ translateX }] }]}>
      {!detailView ? <HoneycombDecor tone={item.badgeTone === 'green' ? 'green' : 'amber'} /> : null}
      <View style={styles.itemTopRow}>
        <Pressable onPress={() => onOpenDetail(item)} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`} style={styles.itemImageFrame}>
          {thumbUrl ? <Image source={{ uri: thumbUrl }} style={styles.itemImage} resizeMode="cover" /> : <View style={styles.itemImagePlaceholder}><Icon name="inventory-2" size={30} color={colors.primary} /></View>}
        </Pressable>
        <View style={styles.itemBody}>
          <Pressable onPress={() => onOpenDetail(item)} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`} style={styles.itemNamePressable}>
            <Text style={styles.itemTitle}>{item.name}</Text>
          </Pressable>
          <Text style={styles.itemMeta}>{item.codeLabel}: <Text style={styles.itemMetaStrong}>{item.code}</Text></Text>
          <View style={[styles.itemBadge, badgeStyle]}><Text style={styles.badgeText}>{item.badge}</Text></View>
        </View>
      </View>
      <View style={styles.quantityBox}>
        <Text style={styles.quantityLabel}>{isReceiptAsset ? `Số tài sản (${assetCount > 1 && assetIndex ? `Cá thể ${assetIndex}/${assetCount} · ` : ''}1–${MAX_ASSETS_PER_ITEM} cá thể)` : 'Số lượng'}</Text>
        <View style={styles.quantityControls}>
          {editable ? (
            <Pressable
              disabled={isReceiptAsset && assetMinusDisabled}
              onPress={() => isReceiptAsset ? onAdjustAssetCount?.(item, -1) : onChangeQuantity(item.id, -1)}
              android_ripple={{ color: colors.primaryFixed }}
              style={({ pressed }) => [styles.quantityButton, isReceiptAsset && assetMinusDisabled && styles.assetStepBtnDisabled, pressed && styles.pressed]}
              accessibilityLabel={`Giảm ${item.name}`}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </Pressable>
          ) : null}
          {editable
            ? (
              <TextInput
                value={isReceiptAsset ? (assetCountInput ?? String(assetCount)) : (item.quantityInput ?? formatQuantity(item.quantity))}
                onChangeText={(value) => isReceiptAsset ? onChangeAssetCountText?.(itemKey, value) : onChangeQuantityInput(item.id, value)}
                onBlur={isReceiptAsset ? () => onCommitAssetCount?.(item) : undefined}
                onSubmitEditing={isReceiptAsset ? () => onCommitAssetCount?.(item) : undefined}
                keyboardType={isReceiptAsset ? 'number-pad' : 'decimal-pad'}
                maxLength={isReceiptAsset ? 3 : undefined}
                selectTextOnFocus
                accessibilityLabel={`Số lượng ${item.name}`}
                style={[styles.quantityInput, quantityError && styles.quantityInputError]}
              />
            )
            : <Text style={styles.quantityValue}>{formatQuantity(isReceiptAsset ? 1 : item.quantity)}</Text>}
          {editable ? (
            <Pressable
              disabled={isReceiptAsset && assetPlusDisabled}
              onPress={() => isReceiptAsset ? onAdjustAssetCount?.(item, 1) : onChangeQuantity(item.id, 1)}
              android_ripple={{ color: colors.primaryFixed }}
              style={({ pressed }) => [styles.quantityButton, isReceiptAsset && assetPlusDisabled && styles.assetStepBtnDisabled, pressed && styles.pressed]}
              accessibilityLabel={`Tăng ${item.name}`}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </Pressable>
          ) : null}
          <Text style={styles.unitText}>{isReceiptAsset ? `cá thể (${item.unit})` : item.unit}</Text>
        </View>
      </View>
      {quantityError ? <Text style={styles.quantityError}>{quantityError}</Text> : null}
      {documentType === 'receipt' && item.metadata === 'LOT' ? <View style={styles.lotFields}>
        <View style={styles.lotModeRow}>
          <Pressable disabled={!editable} onPress={() => onChooseExistingLot(item)} style={[styles.lotModeButton, item.lotMode === 'EXISTING' && styles.lotModeActive, !editable && styles.readOnlyControl]}><Icon name="inventory" size={16} color={item.lotMode === 'EXISTING' ? colors.onPrimary : colors.primary} /><Text style={[styles.lotModeText, item.lotMode === 'EXISTING' && styles.lotModeTextActive]}>Chọn lô có sẵn</Text></Pressable>
          <Pressable disabled={!editable} onPress={() => onCreateNewLot(item)} style={[styles.lotModeButton, item.lotMode !== 'EXISTING' && styles.lotModeActive, !editable && styles.readOnlyControl]}><Icon name="add-circle-outline" size={16} color={item.lotMode !== 'EXISTING' ? colors.onPrimary : colors.primary} /><Text style={[styles.lotModeText, item.lotMode !== 'EXISTING' && styles.lotModeTextActive]}>Tạo lô mới</Text></Pressable>
        </View>
        {item.lotMode === 'EXISTING' && item.lotId ? <View style={styles.selectedLotBox}>
          <Text style={styles.selectedLotTitle}>{item.lotCode || 'Lô đã chọn'}</Text>
          {item.supplierLotNumber ? <Text style={styles.lotDateText}>Số lô trên hàng: {item.supplierLotNumber}</Text> : null}
          {item.legacyLotNumber ? <Text style={styles.lotDateText}>Số lô cũ (tham khảo): {item.legacyLotNumber}</Text> : null}
          <Text style={styles.lotDateText}>Ngày sản xuất: {item.manufacturedDate || 'Không ghi nhận'}</Text>
          <Text style={styles.lotDateText}>Hạn sử dụng: {item.expiryDate || 'Không có hạn'}</Text>
          {(() => { const status = lotExpiryState({ expiryDate: item.expiryDate }); return <Text style={[styles.lotStatus, status.expired && styles.lotExpired, status.warning && !status.expired && styles.lotExpiring]}>{status.label}</Text>; })()}
        </View> : <View style={styles.trackingFields}>
          <Text style={styles.lotDateText}>Mã lô nội bộ: {item.lotCode || 'Tự cấp khi xác nhận phiếu'}</Text>
          <Text style={styles.lotDateText}>Số lô trên hàng (không bắt buộc)</Text>
          <TextInput value={item.supplierLotNumber ?? ''} onChangeText={(value) => onChangeField(item.id, 'supplierLotNumber', value)} editable={editable} maxLength={100} placeholder="Số lô do nhà sản xuất/nhà cung cấp ghi trên hàng" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, !editable && styles.readOnlyControl]} />
          {item.legacyLotNumber ? <Text style={styles.lotDateText}>Số lô cũ (tham khảo): {item.legacyLotNumber}</Text> : null}
          {editable ? <LotDuplicateHint item={item} onSelect={(lot) => onSelectSuggestedLot(lot, item)} /> : null}
          <Pressable disabled={!editable} onPress={() => onPickDate(item.id, 'manufacturedDate', item.manufacturedDate)} style={[styles.datePickerButton, !editable && styles.readOnlyControl]}><Icon name="calendar-today" size={17} color={colors.primary} /><Text style={styles.datePickerText}>{item.manufacturedDate || (editable ? 'Chọn ngày sản xuất' : 'Không ghi nhận')}</Text></Pressable>
          <Pressable disabled={!editable} onPress={() => onPickDate(item.id, 'expiryDate', item.expiryDate)} style={[styles.datePickerButton, !editable && styles.readOnlyControl]}><Icon name="event" size={17} color={colors.primary} /><Text style={styles.datePickerText}>{item.expiryDate || (editable ? 'Chọn hạn sử dụng' : 'Không có hạn')}</Text></Pressable>
        </View>}
        {editable ? <Pressable accessibilityRole="button" onPress={() => onAddNewLot(item)} style={styles.addLotButton}><Icon name="add" size={17} color={colors.primary} /><Text style={styles.addLotText}>Thêm lô khác của mặt hàng này</Text></Pressable> : null}
      </View> : null}
      {documentType === 'receipt' && item.metadata === 'ASSET' ? <View style={styles.trackingFields}>
        <Text style={styles.assetCodeHint}>Mã tài sản riêng cho cá thể này, gợi ý từ mã mặt hàng. Có thể sửa trước khi gửi.</Text>
        <View style={styles.assetCodeRow}>
          <TextInput value={item.assetCode ?? ''} onChangeText={(value) => onChangeField(item.id, 'assetCode', value)} editable={editable} maxLength={100} placeholder="Mã tài sản *" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, styles.assetCodeInput, !editable && styles.readOnlyControl]} />
          {editable ? <Pressable accessibilityRole="button" accessibilityLabel={`Tạo mã tài sản khác cho ${item.name}`} onPress={() => onGenerateAssetCode(item)} style={styles.generateCodeButton}><Icon name="autorenew" size={19} color={colors.primary} /></Pressable> : null}
        </View>
        <TextInput value={item.serialNumber ?? ''} onChangeText={(value) => onChangeField(item.id, 'serialNumber', value)} editable={editable} placeholder="Số serial (không bắt buộc)" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, !editable && styles.readOnlyControl]} />
        <Pressable disabled={!editable} onPress={() => onChooseLocation(item.id)} accessibilityRole="button" accessibilityLabel={`Chọn vị trí lưu kho cho ${item.name}`} style={[styles.datePickerButton, !editable && styles.readOnlyControl]}>
          <Icon name="place" size={17} color={colors.primary} />
          <Text style={styles.datePickerText}>{locationLabel ? `Vị trí: ${locationLabel}` : (editable ? 'Chọn vị trí lưu kho *' : 'Chưa gắn vị trí lưu kho')}</Text>
        </Pressable>
      </View> : null}
      {item.note.trim() ? <View style={styles.itemNote}><Icon name="info-outline" size={16} color={colors.tertiary} /><Text style={styles.noteText}>{item.note}</Text></View> : null}
      <View style={styles.itemFooter}>
        <View style={styles.footerActions}>
          <Pressable onPress={() => onOpenDetail(item)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`}><Text style={styles.detailActionText}>Chi tiết</Text><Icon name="open-in-new" size={15} color={colors.primary} /></Pressable>
          {editable ? <Pressable onPress={() => onRemove(item.id)} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [styles.removeAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Xóa ${item.name} khỏi phiếu`}><Icon name="delete-outline" size={18} color={colors.error} /><Text style={styles.removeActionText}>Xóa</Text></Pressable> : null}
        </View>
        <Text selectable style={styles.itemIdText}>Item ID: {item.itemId ?? item.id}</Text>
      </View>
    </Animated.View>
  );
});

function LotDuplicateHint({ item, onSelect }: { item: ReceiptItem; onSelect: (lot: InventoryLot) => void }) {
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [matches, setMatches] = useState<InventoryLot[]>([]);
  const number = item.supplierLotNumber?.trim();
  const itemId = item.itemId ?? item.id;

  useEffect(() => {
    setMatches([]);
    if (!currentFarmId || !number) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void getAccessToken().then((token) => {
        if (!token) return [];
        return listLotsPage(
          token,
          currentFarmId,
          { itemId, supplierLotNumber: number, page: 1, pageSize: 20, skipCache: true },
          controller.signal,
        ).then((response) =>
          response.data.filter(
            (lot) => lot.farmId === currentFarmId && lot.itemId === itemId && lot.supplierLotNumber === number,
          ),
        );
      }).then((lots) => {
        if (!controller.signal.aborted) setMatches(lots);
      }).catch((cause: unknown) => {
        if (!isAbortError(cause) && !controller.signal.aborted) setMatches([]);
      });
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [currentFarmId, getAccessToken, itemId, number]);

  if (!matches.length) return null;
  return <View style={styles.lotSuggestionBox}>
    <Text style={styles.lotDateText}>Đã có lô cùng số trên hàng. Kiểm tra trước khi tạo lô mới:</Text>
    {matches.map((lot) => <Pressable key={lot.id} onPress={() => onSelect(lot)} style={styles.lotSuggestion} accessibilityRole="button" accessibilityLabel={`Nhập thêm vào lô ${lot.lotCode}`}>
      <Text style={styles.selectedLotTitle}>{lot.lotCode}</Text>
      <Text style={styles.lotDateText}>Số trên hàng: {lot.supplierLotNumber} · Hạn: {lot.expiryDate || 'Không có hạn'}</Text>
      {lot.sourceSupplierName ? <Text style={styles.lotDateText}>Nhà cung cấp: {lot.sourceSupplierName}</Text> : null}
      <Text style={styles.lotStatus}>Nhập thêm vào lô này</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  listFlex: { flex: 1, width: '100%' },
  flatListContent: { gap: spacing.spaceMd },
  contentCenter: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  itemRowWrap: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.gutterMobile },
  footerWrap: { paddingHorizontal: spacing.gutterMobile, gap: spacing.spaceMd },
  scrollContent: { alignItems: 'center' },
  contentWidth: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, minHeight: '100%' },
  topBar: { minHeight: 56, paddingHorizontal: spacing.spaceMd, backgroundColor: colors.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  circleButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', ...shadows.surface },
  topBarTitle: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, flexWrap: 'wrap' },
  topTitle: { flexShrink: 1, ...typography.headlineSm, fontSize: 17, lineHeight: 22, color: colors.onSurface },
  farmPillText: { ...typography.labelSm, color: colors.primary },
  onlineLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.tertiary },
  onlineText: { ...typography.bodySm, fontSize: 11, lineHeight: 15, color: colors.onSurfaceVariant, flexShrink: 1 },
  workspace: { paddingHorizontal: spacing.gutterMobile, paddingTop: spacing.spaceMd, gap: spacing.spaceMd },
  documentMessage: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  documentError: { ...typography.bodySm, color: colors.error, textAlign: 'center', padding: spacing.spaceSm, backgroundColor: colors.errorContainer, borderRadius: radius.default },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  segmentedControl: { flexDirection: 'row', padding: 4, backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, flexShrink: 1, minWidth: 0 },
  segment: { minHeight: 30, paddingHorizontal: 14, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  segmentActive: { backgroundColor: colors.surfaceContainerLowest, ...shadows.surface },
  readOnlyControl: { opacity: 0.72 },
  segmentText: { ...typography.labelMd, color: colors.onSurfaceVariant, flexShrink: 1, textAlign: 'center' },
  segmentTextActive: { color: colors.primary },
  pill: { minHeight: 24, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, flexWrap: 'wrap' },
  pillCream: { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
  pillGreen: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  pillAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer },
  pillDanger: { backgroundColor: colors.errorContainer, borderColor: colors.error },
  pillNeutral: { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
  statusDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primaryContainer },
  statusDotGreen: { backgroundColor: colors.statusSuccess },
  statusDotDanger: { backgroundColor: colors.error },
  statusText: { ...typography.labelSm, color: colors.primary, letterSpacing: 0.28 },
  statusTextGreen: { color: colors.statusSuccess },
  statusTextDanger: { color: colors.error },
  primaryCard: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceLg, position: 'relative', overflow: 'hidden', ...shadows.surface },
  detailSectionCard: { gap: spacing.spaceMd, padding: spacing.spaceMd, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, ...shadows.surface },
  detailCardContent: { borderWidth: 0, borderRadius: 0, padding: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  detailItemCard: { borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, borderColor: colors.outlineVariant, paddingHorizontal: 0, backgroundColor: 'transparent' },
  lotSuggestionBox: { gap: spacing.spaceXs, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.honeyChip },
  lotSuggestion: { gap: 2, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  primaryAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, backgroundColor: colors.primary },
  primaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm },
  primaryTitleBlock: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  codePillText: { ...typography.labelSm, color: colors.primary, letterSpacing: 0.4 },
  receiptTitle: { ...typography.headlineSm, fontSize: 22, lineHeight: 28, color: colors.onPrimaryFixedVariant, flexShrink: 1 },
  smallAction: { padding: 4 },
  infoGrid: { flexDirection: 'row', gap: spacing.spaceMd, marginTop: spacing.spaceMd, paddingTop: spacing.spaceMd, borderTopWidth: 1, borderTopColor: colors.outlineVariant, flexWrap: 'wrap' },
  infoBlock: { flex: 1, minWidth: 140, gap: 3 },
  warehouseSelect: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceXs },
  infoLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase', flexShrink: 1 },
  infoValueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  infoText: { flex: 1, minWidth: 0, gap: 2 },
  infoValue: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '500', flexShrink: 1 },
  infoSubvalue: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap', marginTop: spacing.spaceMd, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  sourceTextRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  sourceText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  sourceStrong: { color: colors.onSurface, fontWeight: '600' },
  greenPillText: { ...typography.labelSm, color: colors.onTertiaryFixedVariant },
  sectionHeading: { gap: spacing.spaceSm, alignItems: 'stretch' },
  headingActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  sectionTitle: { ...typography.headlineSm, color: colors.onSurface, flexShrink: 1 },
  countText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  addButtonText: { ...typography.labelLg, color: colors.primary },
  itemCard: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceMd, position: 'relative', overflow: 'hidden' },
  itemTopRow: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'flex-start' },
  itemImageFrame: { width: 76, height: 76, flexShrink: 0, borderRadius: radius.default, overflow: 'hidden', backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.outlineVariant, position: 'relative' },
  itemImage: { width: '100%', height: '100%' },
  itemImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, minWidth: 0, gap: 4 },
  itemNamePressable: { width: '100%', minWidth: 0 },
  itemTitle: { ...typography.headlineSm, fontSize: 17, lineHeight: 23, color: colors.onPrimaryFixedVariant, flexShrink: 1 },
  itemBadge: { alignSelf: 'flex-start' },
  badgeGreen: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeCream: { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { ...typography.labelSm, color: colors.primary, flexShrink: 1, textAlign: 'center' },
  itemMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1, minWidth: 0 },
  itemMetaStrong: { color: colors.onSurface, fontWeight: '600' },
  quantityBox: { minHeight: 64, marginTop: spacing.spaceMd, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, gap: spacing.spaceXs },
  quantityLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, width: '100%' },
  quantityButton: { width: 26, height: 26, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  quantityButtonText: { fontSize: 18, lineHeight: 20, fontWeight: '700', color: colors.onSurfaceVariant },
  quantityValue: { minWidth: 22, textAlign: 'center', ...typography.bodyMd, fontWeight: '700', color: colors.primary },
  quantityInput: { width: 72, height: 34, paddingHorizontal: 4, paddingVertical: 0, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, textAlign: 'center', ...typography.bodyMd, fontWeight: '700', color: colors.primary },
  quantityInputError: { borderColor: colors.error },
  quantityError: { ...typography.bodySm, color: colors.error, marginTop: 4 },
  unitText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },

  assetCountCard: { marginBottom: spacing.spaceSm, padding: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, gap: spacing.spaceSm },
  assetCountTitle: { ...typography.labelLg, color: colors.deepAmberStrong },
  assetCountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd },
  assetCountUnit: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  assetCountHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  assetCountInput: { width: 64, height: 44, paddingHorizontal: 4, paddingVertical: 0, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, textAlign: 'center', fontSize: 22, lineHeight: 26, fontWeight: '700', color: colors.primary },
  assetStepBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  assetStepBtnDisabled: { backgroundColor: colors.surfaceContainerLowest, opacity: 0.45 },
  assetStepBtnText: { fontSize: 26, lineHeight: 30, fontWeight: '700', color: colors.primary, includeFontPadding: false },
  assetStepBtnTextDisabled: { color: colors.onSurfaceVariant },
  assetCodeHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  assetCodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  assetCodeInput: { flex: 1, minWidth: 0 },
  generateCodeButton: { width: 42, height: 42, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  trackingFields: { gap: spacing.spaceSm, marginTop: spacing.spaceSm },
  trackingInput: { minHeight: 42, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, ...typography.bodySm },
  lotFields: { marginTop: spacing.spaceSm, gap: spacing.spaceSm },
  addLotButton: { minHeight: 38, paddingHorizontal: spacing.spaceSm, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment },
  addLotText: { ...typography.labelMd, color: colors.primary, flexShrink: 1 },
  lotModeRow: { flexDirection: 'row', gap: spacing.spaceXs, flexWrap: 'wrap' },
  lotModeButton: { minHeight: 38, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  lotModeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  lotModeText: { ...typography.labelSm, color: colors.primary },
  lotModeTextActive: { color: colors.onPrimary },
  selectedLotBox: { padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, gap: 3 },
  selectedLotTitle: { ...typography.labelLg, color: colors.onPrimaryFixedVariant },
  lotDateText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  lotStatus: { ...typography.labelSm, color: colors.statusSuccess, marginTop: 2 },
  lotExpired: { color: colors.error },
  lotExpiring: { color: colors.secondary },
  datePickerButton: { minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  datePickerText: { ...typography.bodySm, color: colors.onSurface },
  itemFooter: { gap: spacing.spaceSm, marginTop: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  footerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.spaceMd },
  itemIdText: { ...typography.labelSm, fontSize: 11, lineHeight: 16, color: colors.onSurfaceVariant },
  detailAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 4 },
  detailActionText: { ...typography.labelSm, color: colors.primary },
  removeAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 4 },
  removeActionText: { ...typography.labelSm, color: colors.error },
  itemNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs, marginTop: spacing.spaceSm },
  noteText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1, minWidth: 0 },
  summaryCard: { minHeight: 102, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceMd, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd },
  emptyItems: { padding: spacing.spaceLg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.secondaryContainer, backgroundColor: colors.parchmentWarm, alignItems: 'center', gap: spacing.spaceXs },
  emptyItemsTitle: { ...typography.labelLg, color: colors.deepAmber, textAlign: 'center' },
  emptyItemsText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center' },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.default, backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  summaryMain: { flex: 1 },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  summaryValue: { ...typography.bodyLg, fontWeight: '700', color: colors.onSurface },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.outlineVariant },
  summaryWeight: { width: 92, alignItems: 'flex-end' },
  weightValue: { ...typography.bodyLg, fontWeight: '700', color: colors.primary },
  notesCard: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceLg, gap: spacing.spaceMd },
  notesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  notesTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  notesIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  notesTitle: { ...typography.headlineSm, color: colors.onPrimaryFixedVariant, flexShrink: 1 },
  noteInput: { minHeight: 88, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, textAlignVertical: 'top', ...typography.bodySm },
  exitBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.spaceLg, backgroundColor: colors.modalOverlay },
  exitCard: { width: '100%', maxWidth: 400, padding: spacing.spaceLg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surface, gap: spacing.spaceSm, ...shadows.floating },
  exitIcon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.spaceXs },
  exitEyebrow: { ...typography.labelSm, color: colors.secondary, letterSpacing: 0.6 },
  exitTitle: { ...typography.headlineSm, color: colors.deepAmberStrong },
  exitDescription: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 21 },
  exitError: { ...typography.bodySm, color: colors.error, backgroundColor: colors.errorContainer, padding: spacing.spaceSm, borderRadius: radius.default },
  exitActions: { gap: spacing.spaceSm, marginTop: spacing.spaceSm },
  exitDiscard: { minHeight: 46, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLowest },
  exitDiscardText: { ...typography.labelLg, color: colors.onSurfaceVariant },
  exitSave: { minHeight: 48, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, backgroundColor: colors.primary, ...shadows.surface },
  exitSaveText: { ...typography.labelLg, color: colors.onPrimary },
  disabledAction: { opacity: 0.6 },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  pickerSheet: { maxHeight: '78%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.spaceLg, gap: spacing.spaceSm, shadowColor: colors.deepAmber, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  locationModalScreen: { flex: 1, backgroundColor: colors.surface },
  locationModalTopBar: { minHeight: 56, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  locationModalBody: { flex: 1, paddingHorizontal: spacing.gutterMobile, paddingTop: spacing.spaceMd, gap: spacing.spaceSm },
  locationModalList: { flex: 1 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd },
  pickerHeaderCopy: { flex: 1, minWidth: 0 },
  pickerEyebrow: { ...typography.labelSm, color: colors.secondary },
  pickerTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  pickerClose: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  pickerDone: { minHeight: 36, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pickerDoneText: { ...typography.labelMd, color: colors.onPrimary },
  pickerNotice: { ...typography.bodySm, color: colors.onTertiaryFixedVariant, paddingVertical: 2 },
  pickerHint: { ...typography.bodySm, color: colors.onSurfaceVariant, paddingVertical: spacing.spaceXs },
  pickerList: { gap: spacing.spaceSm, paddingTop: spacing.spaceSm, paddingBottom: spacing.spaceSm },
  lotSearch: { minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, color: colors.onSurface, ...typography.bodySm },
  locationSearchBox: { minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  locationSearchInput: { flex: 1, minWidth: 0, color: colors.onSurface, ...typography.bodySm },
  locationErrorRow: { gap: spacing.spaceXs },
  locationErrorText: { textAlign: 'left' },
  locationRetryButton: { alignSelf: 'flex-start', paddingVertical: spacing.spaceXs, paddingHorizontal: spacing.spaceSm },
  locationRetryText: { ...typography.labelMd, color: colors.primary },
  locationLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, paddingVertical: spacing.spaceMd },
  locationLoadMoreButton: { minHeight: 42, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceMd },
  locationLoadMoreText: { ...typography.labelMd, color: colors.primary },
  lotOption: { minHeight: 76, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  lotOptionExpired: { borderColor: colors.error, backgroundColor: colors.errorContainer },
  calendarCard: { width: '100%', maxWidth: 360, padding: spacing.spaceLg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surface, gap: spacing.spaceMd, ...shadows.floating },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarArrow: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  calendarTitle: { ...typography.headlineSm, color: colors.onPrimaryFixedVariant, textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: { width: '14.2857%', textAlign: 'center', ...typography.labelSm, color: colors.onSurfaceVariant, paddingVertical: spacing.spaceXs },
  calendarDay: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  calendarDayText: { ...typography.bodyMd, color: colors.onSurface },
  calendarCancel: { alignSelf: 'flex-end', paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm },
  calendarCancelText: { ...typography.labelLg, color: colors.primary },
  pickerItem: { minHeight: 66, padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  pickerItemActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip },
  pickerItemIcon: { width: 36, height: 36, borderRadius: radius.default, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  pickerItemImage: { width: 36, height: 36, borderRadius: radius.default },
  pickerItemCopy: { flex: 1, minWidth: 0, gap: 2 },
  pickerItemName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  pickerItemMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  pickerItemState: { minWidth: 54, alignItems: 'center', justifyContent: 'center' },
  pickerSelected: { ...typography.labelSm, color: colors.statusSuccess, textAlign: 'center' },
  createMaterial: { minHeight: 46, borderRadius: radius.default, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.secondaryContainer, backgroundColor: colors.honeyChip, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  createMaterialText: { ...typography.labelLg, color: colors.primary },
  bottomDock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: colors.outlineVariant, ...shadows.floating },
  actionShelf: { maxWidth: 440, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, paddingHorizontal: spacing.gutterMobile, paddingVertical: 10 },
  outlineAction: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  saveDraftAction: { height: 48, minWidth: 104, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  saveDraftText: { ...typography.labelSm, color: colors.primary },
  confirmAction: { flex: 1, minHeight: 48, borderRadius: radius.full, overflow: 'hidden', ...shadows.surface },
  confirmGradient: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm },
  confirmText: { ...typography.labelLg, color: colors.onPrimary, textAlign: 'center', flexShrink: 1 },
  readOnlyNotice: { flex: 1, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceSm },
  readOnlyText: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  bottomNav: { height: 68, maxWidth: 440, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest },
  navItem: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIconWrap: { minWidth: 44, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: colors.primaryContainer },
  navLabel: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  filledIcon: { fontWeight: '700' },
});

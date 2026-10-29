import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
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
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { formatQuantity } from '@/src/shared/format-quantity';
import { balanceMatchesTrackingMode, filterPositiveBalancesForScope, listAvailableAssets, listBalances, listInventoryLots, listItems, listWarehouses, unwrap, type AvailableAsset, type InventoryBalance, type InventoryLot, type Item, type StockIssueDetail, type StockReceiptDetail } from '@/src/features/inventory/api';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type DocumentType = 'receipt' | 'issue';

type ReceiptItem = {
  id: string;
  itemId?: string;
  name: string;
  codeLabel: string;
  code: string;
  metadata: string;
  unit: string;
  quantity: number;
  availableQuantity?: number;
  badge: string;
  badgeTone: 'green' | 'cream' | 'amber';
  note: string;
  image?: string;
  lotId?: string | null;
  lotMode?: 'NEW' | 'EXISTING';
  assetId?: string | null;
  lotNumber?: string;
  expiryDate?: string;
  manufacturedDate?: string;
  assetCode?: string;
  serialNumber?: string;
};

type LotDateField = 'manufacturedDate' | 'expiryDate';
type CalendarTarget = { itemId: string; field: LotDateField };

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

function lotExpiryState(lot: InventoryLot, today = formatDateOnly(new Date())) {
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

function Pill({ children, tone = 'cream' }: { children: ReactNode; tone?: 'cream' | 'green' | 'amber' | 'neutral' }) {
  const toneStyle = tone === 'green' ? styles.pillGreen : tone === 'amber' ? styles.pillAmber : tone === 'neutral' ? styles.pillNeutral : styles.pillCream;
  return <View style={[styles.pill, toneStyle]}>{children}</View>;
}

function buildIssuePickerItems(catalogItems: ReceiptItem[], balances: InventoryBalance[], assets: AvailableAsset[]) {
  const itemById = new Map(catalogItems.map((item) => [item.id, item]));
  const quantityItems = new Map<string, ReceiptItem>();
  const lotItems = new Map<string, ReceiptItem>();
  const availableByItem = new Map<string, number>();

  for (const row of balances) {
    const { balance } = row;
    const item = itemById.get(balance.itemId);
    const quantity = Number(balance.quantityOnHand);
    if (!item || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (!balanceMatchesTrackingMode(balance, item.metadata)) continue;
    if (item.metadata === 'ASSET') {
      if (!balance.lotId) availableByItem.set(item.id, (availableByItem.get(item.id) ?? 0) + quantity);
      continue;
    }

    if (item.metadata === 'LOT') {
      if (!balance.lotId) continue;
      const key = `${item.id}:${balance.lotId}`;
      const existing = lotItems.get(key);
      const availableQuantity = (existing?.availableQuantity ?? 0) + quantity;
      lotItems.set(key, {
        ...item,
        id: key,
        itemId: item.id,
        lotId: balance.lotId,
        lotNumber: row.lot?.lotNumber ?? row.lotNumber ?? undefined,
        expiryDate: row.lot?.expiryDate ?? undefined,
        codeLabel: 'Mã lô',
        code: row.lot?.lotNumber ?? row.lotNumber ?? balance.lotId,
        quantity: 1,
        availableQuantity,
        note: `Còn ${formatQuantity(availableQuantity)} ${item.unit} trong lô này`,
      });
      continue;
    }

    const existing = quantityItems.get(item.id);
    const availableQuantity = (existing?.availableQuantity ?? 0) + quantity;
    quantityItems.set(item.id, {
      ...item,
      itemId: item.id,
      quantity: 1,
      availableQuantity,
      note: `Còn ${formatQuantity(availableQuantity)} ${item.unit} tại kho`,
    });
  }

  const assetItems = assets.flatMap(({ asset, locationName }) => {
    const item = itemById.get(asset.itemId);
    if (!item || item.metadata !== 'ASSET' || asset.status !== 'AVAILABLE' || !availableByItem.get(item.id)) return [];
    return [{
      ...item,
      id: `${item.id}:${asset.id}`,
      itemId: item.id,
      assetId: asset.id,
      codeLabel: 'Mã tài sản',
      code: asset.assetCode,
      quantity: 1,
      availableQuantity: 1,
      note: locationName ? `Đang ở ${locationName}` : 'Đang ở kho đã chọn',
    }];
  });

  return [...quantityItems.values(), ...lotItems.values(), ...assetItems];
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
  const [catalogItems, setCatalogItems] = useState<ReceiptItem[]>([]);
  const [documentStatus, setDocumentStatus] = useState('DRAFT');
  const [documentDate, setDocumentDate] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [documentNote, setDocumentNote] = useState<string | null>(null);
  const [creatorMemberId, setCreatorMemberId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(params.id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const [lotPickerOpen, setLotPickerOpen] = useState(false);
  const [lotPickerItem, setLotPickerItem] = useState<ReceiptItem | null>(null);
  const [lotOptions, setLotOptions] = useState<InventoryLot[]>([]);
  const [lotOptionsLoading, setLotOptionsLoading] = useState(false);
  const [lotOptionsError, setLotOptionsError] = useState<string | null>(null);
  const [lotSearch, setLotSearch] = useState('');
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [issueBalanceRows, setIssueBalanceRows] = useState<InventoryBalance[]>([]);
  const [issueAssetRows, setIssueAssetRows] = useState<AvailableAsset[]>([]);
  const [issuePickerItems, setIssuePickerItems] = useState<ReceiptItem[]>([]);
  const [issueInventoryScope, setIssueInventoryScope] = useState<string | null>(null);
  const [issueInventoryLoading, setIssueInventoryLoading] = useState(false);
  const [issueInventoryError, setIssueInventoryError] = useState<string | null>(null);
  const issueRequestId = useRef(0);
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<Awaited<ReturnType<typeof listWarehouses>>['data']>([]);
  const [createdDocumentId, setCreatedDocumentId] = useState<string | null>(null);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const pendingBackAction = useRef<unknown>(null);
  const allowRemoval = useRef(false);
  const hasUnsavedChanges = !params.id && (items.length > 0 || Boolean(documentNote?.trim()));

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!hasUnsavedChanges || allowRemoval.current) {
      allowRemoval.current = false;
      return;
    }
    event.preventDefault();
    pendingBackAction.current = event.data.action;
    setDraftSaveError(null);
    setExitPromptOpen(true);
  }), [hasUnsavedChanges, navigation]);

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

  async function saveDraftAndLeave() {
    if (!currentFarmId || !warehouseId || documentItems.length === 0) {
      setDraftSaveError('Để lưu nháp, hãy chọn kho và thêm ít nhất một vật tư hợp lệ.');
      return;
    }
    setSavingDraft(true);
    setDraftSaveError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const base = documentType === 'receipt' ? 'stock-receipts' : 'stock-issues';
      const createdAt = new Date().toISOString();
      const body = documentType === 'receipt'
        ? { warehouseId, receiptDate: createdAt, note: documentNote ?? undefined, receiptCode: `REC-${Date.now()}`, items: documentItems.map((item) => ({ itemId: item.itemId ?? item.id, quantity: String(item.quantity), lotId: item.lotId || undefined, lotNumber: item.lotId ? undefined : item.lotNumber?.trim() || undefined, manufacturedDate: item.lotId ? undefined : item.manufacturedDate || undefined, expiryDate: item.lotId ? undefined : item.expiryDate || undefined, assetCode: item.assetCode?.trim() || undefined, serialNumber: item.serialNumber?.trim() || undefined })) }
        : { warehouseId, issueDate: createdAt, reason: documentNote ?? undefined, issueCode: `ISS-${Date.now()}`, items: documentItems.map((item) => ({ itemId: item.itemId ?? item.id, quantity: String(item.quantity), lotId: item.lotId, assetId: item.assetId })) };

      if (params.id) {
        await apiRequest(`/${base}/${params.id}`, { method: 'PATCH', token, params: { farmId: currentFarmId }, body });
      } else if (createdDocumentId) {
        await apiRequest(`/${base}/${createdDocumentId}`, { method: 'PATCH', token, params: { farmId: currentFarmId }, body });
      } else {
        const created = await apiRequest<{ data: StockReceiptDetail | StockIssueDetail }>(`/${base}`, { method: 'POST', token, params: { farmId: currentFarmId }, body });
        const createdData = unwrap(created);
        const document = documentType === 'receipt' ? (createdData as StockReceiptDetail).receipt : (createdData as StockIssueDetail).issue;
        setCreatedDocumentId(document.id);
        setDocumentStatus(document.status);
      }
      leaveAfterSavingDraft();
    } catch (cause: unknown) {
      setDraftSaveError(cause instanceof Error ? cause.message : 'Không thể lưu nháp. Vui lòng thử lại.');
    } finally {
      setSavingDraft(false);
    }
  }

  useEffect(() => {
    setDocumentType(routeType === 'issue' ? 'issue' : 'receipt');
  }, [routeType]);

  useEffect(() => {
    if (!params.id || !currentFarmId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<StockReceiptDetail | StockIssueDetail>(`/${documentType === 'receipt' ? 'stock-receipts' : 'stock-issues'}/${params.id}`, { token, params: { farmId: currentFarmId } }),
        listItems(token, currentFarmId),
        listWarehouses(token, currentFarmId),
      ]);
    }).then(([detailResponse, itemResponse, warehouseResponse]) => {
      if (cancelled) return;
      const detail = unwrap(detailResponse);
      const catalog = itemResponse.data;
      const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
      setWarehouses(farmWarehouses);
      const document = documentType === 'receipt' ? (detail as StockReceiptDetail).receipt : (detail as StockIssueDetail).issue;
      const lines = detail.items;
      const itemById = new Map(catalog.map((item) => [item.id, item]));
      setDocumentStatus(document.status);
      setDocumentDate(documentType === 'receipt' ? (document as StockReceiptDetail['receipt']).receiptDate ?? document.createdAt ?? null : (document as StockIssueDetail['issue']).issueDate ?? document.createdAt ?? null);
      setCreatorMemberId(document.createdByMemberId ?? null);
      setWarehouseId(document.warehouseId);
      setDocumentNote(documentType === 'receipt' ? (document as StockReceiptDetail['receipt']).note ?? null : (document as StockIssueDetail['issue']).reason ?? (document as StockIssueDetail['issue']).note ?? null);
      setCatalogItems(catalog.map((item) => ({ id: item.id, name: item.name, codeLabel: 'Mã VT', code: item.code, metadata: item.trackingMode, unit: item.itemType, quantity: 1, badge: item.status, badgeTone: 'cream' as const, note: `Theo dõi ${item.trackingMode}` })));
      setItems(lines.map((line) => {
        const item = itemById.get(line.itemId);
        const lotNumber = line.lotNumberFromLot ?? line.lotNumber ?? undefined;
        return { id: line.id, itemId: line.itemId, name: item?.name ?? 'Vật tư không còn trong danh mục', codeLabel: lotNumber ? 'Mã lô' : 'Mã VT', code: lotNumber ?? item?.code ?? line.itemId, metadata: item?.trackingMode ?? 'UNKNOWN', unit: item?.itemType ?? 'đơn vị', quantity: Number(line.quantity ?? line.actualQuantity ?? 0), badge: item?.status ?? 'ACTIVE', badgeTone: 'cream' as const, note: line.note ?? `Item ID: ${line.itemId}`, lotId: line.lotId ?? null, lotMode: line.lotId ? 'EXISTING' as const : 'NEW' as const, lotNumber, manufacturedDate: line.lotManufacturedDate ?? line.manufacturedDate ?? undefined, expiryDate: line.lotExpiryDate ?? line.expiryDate ?? undefined };
      }));
      setDocumentError(null);
    }).catch((cause: unknown) => { if (!cancelled) setDocumentError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết phiếu.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, documentType, getAccessToken, params.id]);

  useEffect(() => {
    if (params.id || !currentFarmId) return;
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([listItems(token, currentFarmId), listWarehouses(token, currentFarmId)]);
    }).then(([itemResponse, warehouseResponse]) => {
      if (cancelled) return;
      const catalog = itemResponse.data.map((item) => ({ id: item.id, name: item.name, codeLabel: 'Mã VT', code: item.code, metadata: item.trackingMode, unit: item.unitSymbol ?? item.unitName ?? item.itemType, quantity: 1, badge: item.status, badgeTone: 'cream' as const, note: `Theo dõi ${item.trackingMode}` }));
      setCatalogItems(catalog);
      const farmWarehouses = warehouseResponse.data.filter((warehouse) => warehouse.farmId === currentFarmId);
      setWarehouses(farmWarehouses);
      const requestedWarehouse = farmWarehouses.find((warehouse) => warehouse.id === params.warehouseId);
      setWarehouseId((current) => {
        if (params.warehouseId) return requestedWarehouse?.id ?? null;
        if (current && farmWarehouses.some((warehouse) => warehouse.id === current)) return current;
        if (routeType === 'issue') return null;
        return warehouseResponse.data[0]?.id ?? null;
      });
      const requestedItem = catalog.find((item) => item.id === params.itemId);
      if (requestedItem && routeType !== 'issue') setItems((current) => current.length ? current : [{ ...requestedItem, itemId: requestedItem.id, lotId: params.lotId }]);
      setDocumentError(null);
    }).catch((cause: unknown) => { if (!cancelled) setDocumentError(cause instanceof Error ? cause.message : 'Không thể tải danh mục từ DB.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, params.id, params.itemId, params.lotId, params.warehouseId, routeType]);

  useEffect(() => {
    if (!params.lotId || !params.itemId || !currentFarmId || !catalogItems.length || routeType === 'issue') return;
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listInventoryLots(token, currentFarmId, params.itemId!);
    }).then((lots) => {
      if (cancelled) return;
      const lot = lots.find((entry) => entry.id === params.lotId && entry.farmId === currentFarmId && entry.itemId === params.itemId);
      if (!lot) return;
      const applyLot = () => setItems((current) => current.map((row) => row.itemId === params.itemId
        ? { ...row, lotId: lot.id, lotMode: 'EXISTING', lotNumber: lot.lotNumber, manufacturedDate: lot.manufacturedDate ?? undefined, expiryDate: lot.expiryDate ?? undefined }
        : row));
      if (lotExpiryState(lot).expired) {
        Alert.alert('Lô đã hết hạn', `Lô ${lot.lotNumber} hết hạn ngày ${lot.expiryDate}. Bạn có chắc muốn chọn lô này để nhập?`, [
          { text: 'Chọn lô khác', style: 'cancel' },
          { text: 'Vẫn chọn lô', style: 'destructive', onPress: applyLot },
        ]);
      } else applyLot();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [catalogItems.length, currentFarmId, getAccessToken, params.itemId, params.lotId, routeType]);

  useEffect(() => {
    if (documentType !== 'issue' || !currentFarmId || !warehouseId) {
      issueRequestId.current += 1;
      setIssueBalanceRows([]);
      setIssueAssetRows([]);
      setIssuePickerItems([]);
      setIssueInventoryScope(null);
      setIssueInventoryError(null);
      setIssueInventoryLoading(false);
      return;
    }
    let cancelled = false;
    const requestId = ++issueRequestId.current;
    const scope = `${currentFarmId}:${warehouseId}`;
    setIssueInventoryLoading(true);
    setIssueInventoryError(null);
    setIssueBalanceRows([]);
    setIssueAssetRows([]);
    setIssuePickerItems([]);
    setIssueInventoryScope(null);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listBalances(token, currentFarmId, warehouseId, true, true),
        listAvailableAssets(token, currentFarmId, warehouseId),
      ]);
    }).then(([balanceResponse, assetResponse]) => {
      if (cancelled || requestId !== issueRequestId.current) return;
      const positiveBalances = filterPositiveBalancesForScope(balanceResponse.data, currentFarmId, warehouseId);
      const pickerOptions = buildIssuePickerItems(catalogItems, positiveBalances, assetResponse);
      setIssueBalanceRows(positiveBalances);
      setIssueAssetRows(assetResponse);
      setIssuePickerItems(pickerOptions);
      setIssueInventoryScope(scope);
      if (params.itemId) {
        const requestedCatalogItem = catalogItems.find((item) => item.id === params.itemId);
        const requestedItem = requestedCatalogItem?.metadata === 'ASSET' && !params.assetId
          ? undefined
          : pickerOptions.find((item) => item.itemId === params.itemId
            && (!params.lotId || item.lotId === params.lotId)
            && (!params.assetId || item.assetId === params.assetId));
        if (requestedItem) {
          const addRequestedItem = () => setItems((current) => current.some((item) => (item.itemId ?? item.id) === requestedItem.itemId
            && (item.lotId ?? null) === (requestedItem.lotId ?? null)
            && (item.assetId ?? null) === (requestedItem.assetId ?? null))
            ? current
            : [...current, requestedItem]);
          const requestedLotExpired = requestedItem.metadata === 'LOT' && Boolean(requestedItem.expiryDate)
            && lotExpiryState({ id: requestedItem.lotId ?? '', farmId: currentFarmId, itemId: requestedItem.itemId ?? requestedItem.id, lotNumber: requestedItem.lotNumber ?? '', expiryDate: requestedItem.expiryDate, initialQuantity: '0', createdAt: '' }).expired;
          if (requestedLotExpired) {
            Alert.alert('Lô đã hết hạn', `Lô ${requestedItem.lotNumber ?? ''} đã hết hạn ngày ${requestedItem.expiryDate}. Bạn vẫn muốn thêm lô này vào phiếu xuất?`, [
              { text: 'Chọn lô khác', style: 'cancel' },
              { text: 'Vẫn chọn lô', style: 'destructive', onPress: addRequestedItem },
            ]);
          } else addRequestedItem();
          setPickerNotice(null);
        } else if (requestedCatalogItem?.metadata === 'ASSET' && !params.assetId) {
          setPickerNotice('Vật tư này theo dõi từng tài sản. Chọn đúng mã tài sản đang có tại kho hiện tại.');
        } else {
          setPickerNotice('Vật phẩm/lô này không có số dư dương tại kho đã chọn nên chưa được thêm vào phiếu xuất.');
        }
      }
      if (!params.id) {
        setItems((current) => current.filter((item) => isIssueLineAvailable(item, positiveBalances, assetResponse)));
      }
    }).catch((cause: unknown) => {
      if (!cancelled && requestId === issueRequestId.current) {
        setIssueBalanceRows([]);
        setIssueAssetRows([]);
        setIssuePickerItems([]);
        setIssueInventoryScope(null);
        setIssueInventoryError(cause instanceof Error ? cause.message : 'Không thể tải số dư của kho.');
      }
    }).finally(() => { if (!cancelled && requestId === issueRequestId.current) setIssueInventoryLoading(false); });
    return () => { cancelled = true; };
  }, [catalogItems, currentFarmId, documentType, getAccessToken, params.assetId, params.itemId, params.lotId, warehouseId]);

  const actionLabel = documentType === 'receipt' ? 'Gửi duyệt Nhập kho' : 'Gửi duyệt Xuất kho';
  const canEditDocument = !params.id ? true : !loading && documentStatus === 'DRAFT';
  const title = documentNote || (documentType === 'receipt' ? 'Phiếu nhập kho' : 'Phiếu xuất kho');
  const documentCode = params.id ?? 'Phiếu mới chưa tạo';
  const currentFarmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại';
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);
  const warehouseInheritedFromInventory = !params.id && Boolean(params.warehouseId);
  const currentIssueScope = currentFarmId && warehouseId ? `${currentFarmId}:${warehouseId}` : null;
  const issueInventoryReady = Boolean(currentIssueScope && issueInventoryScope === currentIssueScope);
  const pickerItems = documentType === 'issue'
    ? issueInventoryLoading || issueInventoryError || !issueInventoryReady
      ? []
      : issuePickerItems
    : catalogItems;
  const documentItems = documentType === 'issue'
    ? params.id
      ? items
      : issueInventoryLoading || issueInventoryError || !issueInventoryReady
      ? []
      : items.filter((item) => isIssueLineAvailable(item, issueBalanceRows, issueAssetRows))
    : items;
  const visibleLots = lotOptions.filter((lot) => `${lot.lotNumber} ${lot.expiryDate ?? ''}`.toLocaleLowerCase().includes(lotSearch.toLocaleLowerCase()));
  const calendarOffset = (calendarMonth.getDay() + 6) % 7;
  const calendarDays = Array.from({ length: Math.ceil((calendarOffset + new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = index - calendarOffset + 1;
    return day > 0 && day <= new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() ? day : null;
  });
  const totalUnits = useMemo(() => documentItems.reduce((total, item) => total + item.quantity, 0), [documentItems]);
  const currentMemberId = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.memberId;
  const creatorName = creatorMemberId && creatorMemberId !== currentMemberId
    ? `Thành viên ${creatorMemberId.slice(0, 8)}`
    : data?.user.fullName || data?.user.email || 'Tài khoản hiện tại';

  function changeQuantity(id: string, change: number) {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, quantity: item.metadata === 'ASSET' ? 1 : Math.max(0, Math.min(item.availableQuantity ?? Number.POSITIVE_INFINITY, item.quantity + change)) }
      : item));
  }

  function updateItemField(id: string, field: 'lotNumber' | 'manufacturedDate' | 'expiryDate' | 'assetCode' | 'serialNumber', value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function openLotPicker(item: ReceiptItem) {
    setLotPickerItem(item);
    setLotOptions([]);
    setLotOptionsError(null);
    setLotSearch('');
    setLotOptionsLoading(true);
    setLotPickerOpen(true);
    try {
      if (!currentFarmId) throw new Error('Chưa chọn farm.');
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      setLotOptions(await listInventoryLots(token, currentFarmId, item.itemId ?? item.id));
    } catch (cause: unknown) {
      setLotOptionsError(cause instanceof Error ? cause.message : 'Không tải được danh sách lô.');
    } finally {
      setLotOptionsLoading(false);
    }
  }

  function chooseLot(lot: InventoryLot) {
    const target = lotPickerItem;
    if (!target || lot.farmId !== currentFarmId || lot.itemId !== (target.itemId ?? target.id)) {
      setLotOptionsError('Lô không thuộc đúng farm và vật tư đang chọn. Tải lại danh sách lô.');
      return;
    }
    const status = lotExpiryState(lot);
    const apply = () => {
      setItems((current) => current.map((item) => item.id === target.id
        ? { ...item, lotId: lot.id, lotMode: 'EXISTING', lotNumber: lot.lotNumber, manufacturedDate: lot.manufacturedDate ?? undefined, expiryDate: lot.expiryDate ?? undefined }
        : item));
      setLotPickerOpen(false);
    };
    if (status.expired) {
      Alert.alert('Lô đã hết hạn', `Lô ${lot.lotNumber} hết hạn ngày ${lot.expiryDate}. Bạn có chắc muốn chọn lô này để nhập?`, [
        { text: 'Chọn lô khác', style: 'cancel' },
        { text: 'Vẫn chọn lô', style: 'destructive', onPress: apply },
      ]);
      return;
    }
    apply();
  }

  function switchToNewLot(item: ReceiptItem) {
    const switchMode = () => setItems((current) => current.map((row) => row.id === item.id
      ? { ...row, lotId: null, lotMode: 'NEW', lotNumber: '', manufacturedDate: '', expiryDate: '' }
      : row));
    if (item.lotId) {
      Alert.alert('Tạo lô mới', 'Dòng này sẽ không còn sử dụng lô đã chọn. Tiếp tục?', [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Tạo lô mới', onPress: switchMode },
      ]);
      return;
    }
    switchMode();
  }

  function openCalendar(itemId: string, field: LotDateField, value?: string) {
    setCalendarTarget({ itemId, field });
    const parts = dateOnlyParts(value);
    setCalendarMonth(new Date(parts.year, parts.month, 1));
  }

  function chooseCalendarDay(day: number) {
    if (!calendarTarget) return;
    updateItemField(calendarTarget.itemId, calendarTarget.field, formatDateOnly(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)));
    setCalendarTarget(null);
  }

  function addItem(item: ReceiptItem) {
    if (documentType === 'issue' && (issueInventoryLoading || Boolean(issueInventoryError) || !warehouseId || !issuePickerItems.some((option) => option.id === item.id))) {
      setPickerNotice(`${item.name} không có số dư tồn phù hợp tại kho đang chọn nên không thể thêm vào phiếu xuất.`);
      return;
    }
    if (items.some((currentItem) => (currentItem.itemId ?? currentItem.id) === (item.itemId ?? item.id)
      && (currentItem.lotId ?? null) === (item.lotId ?? null)
      && (documentType !== 'issue' || (currentItem.assetId ?? null) === (item.assetId ?? null)))) {
      setPickerNotice(`${item.name} đã có trong phiếu.`);
      return;
    }
    setItems((current) => current.some((currentItem) => (currentItem.itemId ?? currentItem.id) === (item.itemId ?? item.id)
      && (currentItem.lotId ?? null) === (item.lotId ?? null)
      && (documentType !== 'issue' || (currentItem.assetId ?? null) === (item.assetId ?? null))) ? current : [...current, { ...item, itemId: item.itemId ?? item.id, ...(documentType === 'receipt' && item.metadata === 'LOT' ? { lotId: null, lotMode: 'NEW' as const, lotNumber: '' } : {}) }]);
    setPickerNotice(`Đã thêm ${item.name}.`);
  }

  function addIssueItemWithExpiryCheck(item: ReceiptItem) {
    if (item.metadata === 'LOT' && item.expiryDate && lotExpiryState({ id: item.lotId ?? '', farmId: currentFarmId ?? '', itemId: item.itemId ?? item.id, lotNumber: item.lotNumber ?? '', expiryDate: item.expiryDate, initialQuantity: '0', createdAt: '' }).expired) {
      Alert.alert('Lô đã hết hạn', `Lô ${item.lotNumber ?? ''} đã hết hạn ngày ${item.expiryDate}. Bạn vẫn muốn xuất từ lô này?`, [
        { text: 'Chọn lô khác', style: 'cancel' },
        { text: 'Vẫn chọn lô', style: 'destructive', onPress: () => addItem(item) },
      ]);
      return;
    }
    addItem(item);
  }

  function openItemPicker() {
    setPickerNotice(null);
    setPickerOpen(true);
    if (documentType !== 'issue') return;
    if (!currentFarmId || !warehouseId) {
      issueRequestId.current += 1;
      setIssueBalanceRows([]);
      setIssueAssetRows([]);
      setIssuePickerItems([]);
      setIssueInventoryScope(null);
      setIssueInventoryError('Chưa chọn được farm hoặc kho để kiểm tra tồn.');
      setIssueInventoryLoading(false);
      return;
    }

    const requestId = ++issueRequestId.current;
    const scope = `${currentFarmId}:${warehouseId}`;
    setIssueInventoryLoading(true);
    setIssueInventoryError(null);
    setIssueBalanceRows([]);
    setIssueAssetRows([]);
    setIssuePickerItems([]);
    setIssueInventoryScope(null);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listBalances(token, currentFarmId, warehouseId, true, true),
        listAvailableAssets(token, currentFarmId, warehouseId),
      ]);
    }).then(([balanceResponse, assetResponse]) => {
      if (requestId !== issueRequestId.current) return;
      const positiveBalances = filterPositiveBalancesForScope(balanceResponse.data, currentFarmId, warehouseId);
      const pickerOptions = buildIssuePickerItems(catalogItems, positiveBalances, assetResponse);
      setIssueBalanceRows(positiveBalances);
      setIssueAssetRows(assetResponse);
      setIssuePickerItems(pickerOptions);
      setIssueInventoryScope(scope);
      const removedUnavailableItem = items.some((item) => !isIssueLineAvailable(item, positiveBalances, assetResponse));
      setItems((current) => current.filter((item) => isIssueLineAvailable(item, positiveBalances, assetResponse)));
      if (params.itemId) {
        const requestedCatalogItem = catalogItems.find((item) => item.id === params.itemId);
        const requestedItem = requestedCatalogItem?.metadata === 'ASSET' && !params.assetId
          ? undefined
          : pickerOptions.find((item) => item.itemId === params.itemId
            && (!params.lotId || item.lotId === params.lotId)
            && (!params.assetId || item.assetId === params.assetId));
        if (requestedItem) {
          const addRequestedItem = () => setItems((current) => current.some((item) => (item.itemId ?? item.id) === (requestedItem.itemId ?? requestedItem.id)
            && (item.lotId ?? null) === (requestedItem.lotId ?? null)
            && (item.assetId ?? null) === (requestedItem.assetId ?? null))
            ? current
            : [...current, requestedItem]);
          const requestedLotExpired = requestedItem.metadata === 'LOT' && Boolean(requestedItem.expiryDate)
            && lotExpiryState({ id: requestedItem.lotId ?? '', farmId: currentFarmId, itemId: requestedItem.itemId ?? requestedItem.id, lotNumber: requestedItem.lotNumber ?? '', expiryDate: requestedItem.expiryDate, initialQuantity: '0', createdAt: '' }).expired;
          if (requestedLotExpired) {
            Alert.alert('Lô đã hết hạn', `Lô ${requestedItem.lotNumber ?? ''} đã hết hạn ngày ${requestedItem.expiryDate}. Bạn vẫn muốn thêm lô này vào phiếu xuất?`, [
              { text: 'Chọn lô khác', style: 'cancel' },
              { text: 'Vẫn chọn lô', style: 'destructive', onPress: addRequestedItem },
            ]);
          } else addRequestedItem();
          setPickerNotice(null);
        } else if (requestedCatalogItem?.metadata === 'ASSET' && !params.assetId) {
          setPickerNotice('Vật tư này theo dõi từng tài sản. Chọn đúng mã tài sản đang có tại kho hiện tại.');
        } else {
          setPickerNotice('Vật phẩm/lô từ trang chi tiết không có số dư dương tại kho này nên đã bị loại khỏi phiếu xuất.');
        }
      } else if (removedUnavailableItem) {
        setPickerNotice('Đã loại vật phẩm không còn tồn khỏi phiếu xuất.');
      }
    }).catch((cause: unknown) => {
      if (requestId !== issueRequestId.current) return;
      setIssueBalanceRows([]);
      setIssueAssetRows([]);
      setIssuePickerItems([]);
      setIssueInventoryScope(null);
      setIssueInventoryError(cause instanceof Error ? cause.message : 'Không thể kiểm tra tồn kho.');
    }).finally(() => { if (requestId === issueRequestId.current) setIssueInventoryLoading(false); });
  }

  function openItemDetails(item: ReceiptItem) {
    const itemId = item.itemId ?? item.id;
    const lotId = item.lotId ?? (params.id ? undefined : params.lotId);
    router.push(`/inventory-detail?itemId=${encodeURIComponent(itemId)}${warehouseId ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ''}${lotId ? `&lotId=${encodeURIComponent(lotId)}` : ''}` as never);
  }

  async function submitDocument() {
    if (documentType === 'issue' && (issueInventoryLoading || issueInventoryError || !warehouseId)) {
      Alert.alert('Chưa xác thực tồn kho', issueInventoryError ?? 'Đang kiểm tra số dư của kho. Hãy thử gửi lại sau khi kiểm tra hoàn tất.');
      return;
    }
    if (!currentFarmId || !warehouseId || documentItems.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Cần có farm, kho và ít nhất một vật tư từ DB.');
      return;
    }
    if (documentType === 'issue') {
      try {
        const token = await getAccessToken();
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        const [latest, latestAssets] = await Promise.all([
          listBalances(token, currentFarmId, warehouseId, true, true),
          listAvailableAssets(token, currentFarmId, warehouseId),
        ]);
        const positiveBalances = filterPositiveBalancesForScope(latest.data, currentFarmId, warehouseId);
        const unavailable = documentItems.find((item) => !isIssueLineAvailable(item, positiveBalances, latestAssets)
          || item.quantity > getIssueLineAvailableQuantity(item, positiveBalances));
        if (unavailable) {
          setIssueBalanceRows(positiveBalances);
          setIssueAssetRows(latestAssets);
          setIssuePickerItems(buildIssuePickerItems(catalogItems, positiveBalances, latestAssets));
          setIssueInventoryScope(`${currentFarmId}:${warehouseId}`);
          setItems((current) => current.filter((item) => isIssueLineAvailable(item, positiveBalances, latestAssets)));
          Alert.alert('Tồn kho đã thay đổi', `“${unavailable.name}” không còn đủ số lượng tại kho này. Danh sách đã được cập nhật; kiểm tra lại phiếu trước khi gửi.`);
          return;
        }
      } catch (cause: unknown) {
        Alert.alert('Không kiểm tra được tồn kho', cause instanceof Error ? cause.message : 'Không thể xác nhận số dư mới nhất.');
        return;
      }
    }
    const missingLot = documentType === 'receipt' && documentItems.find((item) => item.metadata === 'LOT' && (item.lotId ? item.lotMode !== 'EXISTING' : !item.lotNumber?.trim()));
    if (missingLot) {
      Alert.alert('Thiếu thông tin lô', `Chọn lô có sẵn hoặc nhập mã lô mới cho vật tư “${missingLot.name}” trước khi gửi.`);
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
    const missingIssueTracking = documentType === 'issue' && documentItems.find((item) => (item.metadata === 'LOT' && !item.lotId) || (item.metadata === 'ASSET' && !item.assetId));
    if (missingIssueTracking) {
      Alert.alert('Cần chọn đúng đối tượng tồn', `Vật tư “${missingIssueTracking.name}” cần chọn lô hoặc tài sản cụ thể trước khi xuất.`);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const base = documentType === 'receipt' ? 'stock-receipts' : 'stock-issues';
      let id = params.id ?? createdDocumentId ?? undefined;
      const createdAt = new Date().toISOString();
      const body = documentType === 'receipt'
        ? { warehouseId, receiptDate: createdAt, note: documentNote ?? undefined, receiptCode: `REC-${Date.now()}`, items: documentItems.map((item) => ({ itemId: item.itemId ?? item.id, quantity: String(item.quantity), lotId: item.lotId || undefined, lotNumber: item.lotId ? undefined : item.lotNumber?.trim() || undefined, manufacturedDate: item.lotId ? undefined : item.manufacturedDate || undefined, expiryDate: item.lotId ? undefined : item.expiryDate || undefined, assetCode: item.assetCode?.trim() || undefined, serialNumber: item.serialNumber?.trim() || undefined })) }
        : { warehouseId, issueDate: createdAt, reason: documentNote ?? undefined, issueCode: `ISS-${Date.now()}`, items: documentItems.map((item) => ({ itemId: item.itemId ?? item.id, quantity: String(item.quantity), lotId: item.lotId, assetId: item.assetId })) };
      if (!id) {
        const created = await apiRequest<{ data: StockReceiptDetail | StockIssueDetail }>(`/${base}`, { method: 'POST', token, params: { farmId: currentFarmId }, body });
        const createdData = unwrap(created);
        const createdDocument = documentType === 'receipt' ? (createdData as StockReceiptDetail).receipt : (createdData as StockIssueDetail).issue;
        id = createdDocument.id;
        setCreatedDocumentId(id);
        setDocumentDate(createdDocument.createdAt ?? (documentType === 'receipt' ? (createdDocument as StockReceiptDetail['receipt']).receiptDate : (createdDocument as StockIssueDetail['issue']).issueDate) ?? createdAt);
        setCreatorMemberId(createdDocument.createdByMemberId ?? currentMemberId ?? null);
      } else if (!params.id) {
        await apiRequest(`/${base}/${id}`, { method: 'PATCH', token, params: { farmId: currentFarmId }, body });
      }
      await apiRequest(`/${base}/${id}/submit`, { method: 'POST', token, params: { farmId: currentFarmId } });
      setSuccessDialogOpen(true);
    } catch (cause: unknown) { Alert.alert('Không thể gửi phiếu', cause instanceof Error ? cause.message : 'API trả về lỗi.'); }
  }

  const detailView = Boolean(params.id);
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: dimensions.bottomNavHeight + 106 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWidth}>
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
                <Text numberOfLines={2} style={styles.onlineText}>Hệ thống quản lý kho • Trực tuyến</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={() => Alert.alert('Đồng bộ', 'Dữ liệu đang được đồng bộ.')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="Đồng bộ dữ liệu">
              <Icon name="sync" size={21} color={colors.primary} />
            </Pressable></View>
          </View>

          <View style={styles.workspace}>
            <View style={styles.subHeader}>
              <View style={styles.segmentedControl}>
                <Pressable disabled={Boolean(params.id)} onPress={() => setDocumentType('receipt')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.segment, documentType === 'receipt' && styles.segmentActive, Boolean(params.id) && styles.readOnlyControl, pressed && styles.pressed]}>
                  <Text style={[styles.segmentText, documentType === 'receipt' && styles.segmentTextActive]}>Phiếu Nhập</Text>
                </Pressable>
                <Pressable disabled={Boolean(params.id)} onPress={() => setDocumentType('issue')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.segment, documentType === 'issue' && styles.segmentActive, Boolean(params.id) && styles.readOnlyControl, pressed && styles.pressed]}>
                  <Text style={[styles.segmentText, documentType === 'issue' && styles.segmentTextActive]}>Phiếu Xuất</Text>
                </Pressable>
              </View>
                <Pill tone={documentStatus === 'CONFIRMED' ? 'green' : documentStatus === 'REJECTED' ? 'amber' : 'amber'}><View style={styles.statusDot} /><Text style={styles.statusText}>{documentStatus}</Text></Pill>
            </View>

             {loading ? <Text style={styles.documentMessage}>Đang tải chi tiết phiếu từ cơ sở dữ liệu...</Text> : documentError ? <Text style={styles.documentError}>{documentError}</Text> : null}
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
                <InfoBlock label="Thời gian tạo" icon="calendar-today">
                  <Text style={styles.infoValue}>{documentDate ? new Date(documentDate).toLocaleString('vi-VN') : 'Ghi nhận khi tạo phiếu'}</Text>
                  <Text style={styles.infoSubvalue}>{documentDate ? 'Thời gian từ API' : 'Máy chủ ghi nhận lúc gửi'}</Text>
                </InfoBlock>
                <InfoBlock label="Người tạo" icon="person">
                  <Text style={styles.infoValue}>{creatorName}</Text>
                  <Text style={styles.infoSubvalue}>{creatorMemberId ? `Member: ${creatorMemberId.slice(0, 8)}` : 'Lấy từ tài khoản đăng nhập'}</Text>
                </InfoBlock>
                <InfoBlock label="Kho tạo phiếu" icon="warehouse">
                <Pressable disabled={!canEditDocument || warehouseInheritedFromInventory} onPress={() => setWarehousePickerOpen(true)} style={[styles.warehouseSelect, !canEditDocument && styles.readOnlyControl]}>
                    <Text numberOfLines={2} style={styles.infoValue}>{selectedWarehouse?.name ?? 'Chọn kho'}</Text>
                    {canEditDocument && !warehouseInheritedFromInventory ? <Icon name="arrow-drop-down" size={20} color={colors.primary} /> : null}
                  </Pressable>
                  <Text style={styles.infoSubvalue}>{selectedWarehouse?.code ?? 'Kho thuộc farm hiện tại'}{warehouseInheritedFromInventory ? ' • Lấy từ màn hình Tồn kho' : ''}</Text>
                </InfoBlock>
              </View>
              <View style={styles.sourceRow}>
                <View style={styles.sourceTextRow}>
                  <Icon name="eco" size={17} color={colors.primary} />
                  <Text style={styles.sourceText}>Ghi chú: <Text style={styles.sourceStrong}>{documentNote || 'Chưa thêm ghi chú'}</Text></Text>
                </View>
                <Pill tone="green"><Text style={styles.greenPillText}>{documentStatus}</Text></Pill>
              </View>
            </View>

            <View style={detailView ? styles.detailSectionCard : undefined}>
            <View style={styles.sectionHeading}>
              <View style={styles.headingWithCount}>
                <Text style={styles.sectionTitle}>Danh mục vật tư & mật</Text>
                <Pill tone="neutral"><Text style={styles.countText}>{documentItems.length} mục</Text></Pill>
              </View>
              {canEditDocument ? <Pressable onPress={openItemPicker} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                <Icon name="add-box" size={19} color={colors.primary} />
                <Text style={styles.addButtonText}>Thêm mục</Text>
              </Pressable> : null}
            </View>

            {documentType === 'issue' && issueInventoryLoading ? <Text style={styles.documentMessage}>Đang xác thực tồn tại kho trước khi hiển thị vật phẩm xuất...</Text> : null}
            {documentType === 'issue' && issueInventoryError ? <Text style={styles.documentError}>{issueInventoryError}</Text> : null}
            {!params.id && !loading && !documentError && !issueInventoryLoading && documentItems.length === 0 ? <Pressable onPress={openItemPicker} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.emptyItems, pressed && styles.pressed]}><Icon name="add-circle-outline" size={24} color={colors.primary} /><Text style={styles.emptyItemsTitle}>Chưa có vật tư trong phiếu</Text><Text style={styles.emptyItemsText}>{documentType === 'issue' ? 'Chỉ vật phẩm có tồn tại kho đang chọn mới được thêm vào phiếu xuất.' : 'Chọn “Thêm mục” để lấy vật tư đang hoạt động từ DB trước khi gửi duyệt.'}</Text></Pressable> : null}
            {documentItems.map((item) => <ItemCard key={item.id} item={item} documentType={documentType} editable={canEditDocument} detailView={detailView} onChangeQuantity={changeQuantity} onChangeField={updateItemField} onChooseExistingLot={() => void openLotPicker(item)} onCreateNewLot={() => switchToNewLot(item)} onPickDate={(field, value) => openCalendar(item.id, field, value)} onRemove={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))} onOpenDetail={() => openItemDetails(item)} />)}
            </View>

            <View style={detailView ? styles.detailSectionCard : undefined}>
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
        </View>
      </ScrollView>

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

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={styles.pickerEyebrow}>DANH MỤC KHO</Text>
                <Text style={styles.pickerTitle}>Chọn vật tư & mật</Text>
              </View>
              <Pressable onPress={() => setPickerOpen(false)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.pickerDone, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Xong, đóng danh sách vật tư">
                <Text style={styles.pickerDoneText}>Xong</Text>
              </Pressable>
            </View>
            {pickerNotice ? <Text style={styles.pickerNotice}>{pickerNotice}</Text> : null}
            <ScrollView contentContainerStyle={styles.pickerList} showsVerticalScrollIndicator={false}>
              {pickerItems.map((item) => {
                const selected = items.some((selectedItem) => (selectedItem.itemId ?? selectedItem.id) === (item.itemId ?? item.id)
                  && (selectedItem.lotId ?? null) === (item.lotId ?? null)
                  && (documentType !== 'issue' || (selectedItem.assetId ?? null) === (item.assetId ?? null)));
                const lotStatus = documentType === 'issue' && item.metadata === 'LOT'
                  ? lotExpiryState({ id: item.lotId ?? '', farmId: currentFarmId ?? '', itemId: item.itemId ?? item.id, lotNumber: item.lotNumber ?? '', expiryDate: item.expiryDate, initialQuantity: '0', createdAt: '' })
                  : null;
                return (
                  <Pressable key={item.id} onPress={() => documentType === 'issue' ? addIssueItemWithExpiryCheck(item) : addItem(item)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.pickerItem, selected && styles.pickerItemActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected }}>
                    <View style={styles.pickerItemIcon}>
                      <Icon name={item.id === 'honey' ? 'water-drop' : item.id === 'sugar' ? 'grain' : 'inventory-2'} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.pickerItemCopy}>
                      <Text style={styles.pickerItemName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.pickerItemMeta} numberOfLines={2}>{item.metadata === 'LOT' ? `Lô ${item.lotNumber ?? item.code} • Còn ${formatQuantity(item.availableQuantity ?? 0)} ${item.unit}` : `${item.code} • ${item.metadata}`}</Text>
                      {lotStatus ? <Text style={[styles.lotStatus, lotStatus.expired && styles.lotExpired, lotStatus.warning && !lotStatus.expired && styles.lotExpiring]}>{lotStatus.label}{item.expiryDate ? ` · HSD ${item.expiryDate}` : ''}{lotStatus.expired ? ' · Cần xác nhận khi chọn' : ''}</Text> : null}
                    </View>
                    <View style={styles.pickerItemState}>
                      {selected ? <Text style={styles.pickerSelected}>Đã thêm</Text> : <Icon name="add-circle-outline" size={23} color={colors.primary} />}
                    </View>
                  </Pressable>
                );
              })}
              {documentType === 'issue' && issueInventoryLoading ? <Text style={styles.emptyItemsText}>Đang kiểm tra tồn khả dụng tại kho...</Text> : null}
              {documentType === 'issue' && issueInventoryError ? <Text style={styles.documentError}>{issueInventoryError}</Text> : null}
              {documentType === 'issue' && !warehouseId ? <Text style={styles.emptyItemsText}>Cần chọn kho trước để kiểm tra vật phẩm còn tồn.</Text> : null}
              {documentType === 'issue' && warehouseId && !issueInventoryLoading && !issueInventoryError && issueInventoryReady && pickerItems.length === 0 ? <Text style={styles.emptyItemsText}>Kho này chưa có vật phẩm nào còn tồn để xuất. Vật phẩm chưa có tồn chỉ xuất hiện khi lập phiếu nhập.</Text> : null}
              <Pressable onPress={() => { setPickerOpen(false); router.push('/materials/new' as never); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.createMaterial, pressed && styles.pressed]}>
                <Icon name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.createMaterialText}>Tạo vật tư mới</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={lotPickerOpen} transparent animationType="slide" onRequestClose={() => setLotPickerOpen(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}><Text style={styles.pickerEyebrow}>LÔ CỦA VẬT TƯ</Text><Text style={styles.pickerTitle}>Chọn lô có sẵn</Text><Text style={styles.pickerItemMeta}>{lotPickerItem?.name}</Text></View>
              <Pressable onPress={() => setLotPickerOpen(false)} style={styles.pickerClose} accessibilityLabel="Đóng danh sách lô"><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable>
            </View>
            <TextInput value={lotSearch} onChangeText={setLotSearch} placeholder="Tìm mã lô" placeholderTextColor={colors.onSurfaceVariant} style={styles.lotSearch} />
            {lotOptionsLoading ? <Text style={styles.documentMessage}>Đang tải lô thuộc farm và vật tư này...</Text> : null}
            {lotOptionsError ? <Text style={styles.documentError}>{lotOptionsError}</Text> : null}
            <ScrollView contentContainerStyle={styles.pickerList} showsVerticalScrollIndicator>
              {visibleLots.map((lot) => {
                const status = lotExpiryState(lot);
                return <Pressable key={lot.id} onPress={() => chooseLot(lot)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.lotOption, status.expired && styles.lotOptionExpired, pressed && styles.pressed]}>
                  <View style={styles.pickerItemCopy}><Text style={styles.pickerItemName}>{lot.lotNumber}</Text><Text style={styles.pickerItemMeta}>Sản xuất: {lot.manufacturedDate || 'Không ghi nhận'} · Hạn: {lot.expiryDate || 'Không có hạn'}</Text><Text style={[styles.lotStatus, status.expired && styles.lotExpired, status.warning && !status.expired && styles.lotExpiring]}>{status.label}{status.expired ? ' · Chọn sẽ cần xác nhận' : ''}</Text></View>
                  <Icon name="chevron-right" size={22} color={colors.primary} />
                </Pressable>;
              })}
              {!lotOptionsLoading && !lotOptionsError && visibleLots.length === 0 ? <Text style={styles.emptyItemsText}>{lotOptions.length ? 'Không có lô khớp nội dung tìm kiếm.' : 'Vật tư này chưa có lô. Chọn “Tạo lô mới” để tiếp tục.'}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}><Text style={styles.pickerEyebrow}>KHO CỦA FARM</Text><Text style={styles.pickerTitle}>Chọn kho tạo phiếu</Text></View>
              <Pressable onPress={() => setWarehousePickerOpen(false)} style={styles.pickerClose} accessibilityLabel="Đóng danh sách kho"><Icon name="close" size={20} color={colors.onSurfaceVariant} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {warehouses.map((warehouse) => <Pressable key={warehouse.id} onPress={() => { setWarehouseId(warehouse.id); setWarehousePickerOpen(false); }} style={({ pressed }) => [styles.pickerItem, warehouse.id === warehouseId && styles.pickerItemActive, pressed && styles.pressed]}>
                <View style={styles.pickerItemIcon}><Icon name="warehouse" size={20} color={colors.primary} /></View>
                <View style={styles.pickerItemCopy}><Text style={styles.pickerItemName}>{warehouse.name}</Text><Text style={styles.pickerItemMeta}>{warehouse.code}</Text></View>
                {warehouse.id === warehouseId ? <Icon name="check-circle" color={colors.statusSuccess} /> : <Icon name="radio-button-unchecked" color={colors.outline} />}
              </Pressable>)}
              {warehouses.length === 0 ? <Text style={styles.emptyItemsText}>Farm chưa có kho đang hoạt động.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={[styles.bottomDock, { paddingBottom: insets.bottom }]}> 
        <View style={styles.actionShelf}>
          <Pressable onPress={() => router.back()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]} accessibilityLabel="Quay lại danh sách">
            <Icon name="arrow-back" size={19} color={colors.onSurfaceVariant} />
          </Pressable>
          {canEditDocument ? <Pressable onPress={() => void submitDocument()} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.confirmAction, pressed && styles.pressed]}>
            <LinearGradient colors={gradients.honeyCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.confirmGradient}>
              <Icon name="check-circle" size={19} color={colors.onPrimary} filled />
              <Text style={styles.confirmText}>{actionLabel}</Text>
            </LinearGradient>
          </Pressable> : <View style={styles.readOnlyNotice}><Icon name="lock" size={16} color={colors.onSurfaceVariant} /><Text style={styles.readOnlyText}>Chỉ phiếu nháp mới được chỉnh sửa</Text></View>}
          <Pressable onPress={() => Alert.alert('Xuất phiếu', 'Chức năng xuất PDF sẽ được nối sau.')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.exportAction, pressed && styles.pressed]} accessibilityLabel="Xuất phiếu">
            <Icon name="print" size={19} color={colors.onSurfaceVariant} />
            <Text style={styles.exportText}>Xuất</Text>
          </Pressable>
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
        message="Phiếu đã được lưu và chuyển sang trạng thái Chờ duyệt. Bạn sẽ nhận thông báo khi có kết quả xử lý."
        actionLabel="Về danh sách phiếu"
        onAction={() => {
          setSuccessDialogOpen(false);
          leaveWithoutSaving();
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

function ItemCard({ item, documentType, editable, detailView, onChangeQuantity, onChangeField, onChooseExistingLot, onCreateNewLot, onPickDate, onRemove, onOpenDetail }: { item: ReceiptItem; documentType: DocumentType; editable: boolean; detailView: boolean; onChangeQuantity: (id: string, change: number) => void; onChangeField: (id: string, field: 'lotNumber' | 'manufacturedDate' | 'expiryDate' | 'assetCode' | 'serialNumber', value: string) => void; onChooseExistingLot: () => void; onCreateNewLot: () => void; onPickDate: (field: LotDateField, value?: string) => void; onRemove: () => void; onOpenDetail: () => void }) {
  const badgeStyle = item.badgeTone === 'green' ? styles.badgeGreen : item.badgeTone === 'amber' ? styles.badgeAmber : styles.badgeCream;
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => editable && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-110, Math.min(110, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 70) {
        onRemove();
        return;
      }
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 4 }).start(),
  }), [editable, onRemove, translateX]);
  return (
    <Animated.View {...swipeResponder.panHandlers} style={[styles.itemCard, detailView && styles.detailItemCard, !detailView && shadows.surface, { transform: [{ translateX }] }]}>
      {!detailView ? <HoneycombDecor tone={item.badgeTone === 'green' ? 'green' : 'amber'} /> : null}
      <View style={styles.itemTopRow}>
        <Pressable onPress={onOpenDetail} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`} style={styles.itemImageFrame}>
           {item.image ? <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" /> : <View style={styles.itemImagePlaceholder}><Icon name="inventory-2" size={30} color={colors.primary} /></View>}
           <View style={styles.imageTag}><Text style={styles.imageTagText}>DB</Text></View>
        </Pressable>
        <View style={styles.itemBody}>
          <View style={styles.itemTitleRow}>
            <Pressable onPress={onOpenDetail} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`} style={styles.itemNamePressable}>
              <Text numberOfLines={3} style={styles.itemTitle}>{item.name}</Text>
            </Pressable>
            <View style={badgeStyle}><Text style={styles.badgeText}>{item.badge}</Text></View>
          </View>
          <Pressable onPress={onOpenDetail} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`}>
            <Text numberOfLines={3} style={styles.itemMeta}>{item.codeLabel}: <Text style={styles.itemMetaStrong}>{item.code}</Text> • {item.metadata}</Text>
          </Pressable>
          <View style={styles.quantityBox}>
            <View style={styles.quantityControls}>
              {editable && item.metadata !== 'ASSET' ? <Pressable onPress={() => onChangeQuantity(item.id, -1)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]} accessibilityLabel={`Giảm ${item.name}`}><Text style={styles.quantityButtonText}>−</Text></Pressable> : null}
              <Text style={styles.quantityValue}>{formatQuantity(item.quantity)}</Text>
              {editable && item.metadata !== 'ASSET' ? <Pressable onPress={() => onChangeQuantity(item.id, 1)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]} accessibilityLabel={`Tăng ${item.name}`}><Text style={styles.quantityButtonText}>+</Text></Pressable> : null}
              <Text style={styles.unitText}>{item.unit}</Text>
            </View>
            <Text style={styles.quantityDetail}>{item.metadata} • {item.note}</Text>
          </View>
        </View>
      </View>
      {documentType === 'receipt' && item.metadata === 'LOT' ? <View style={styles.lotFields}>
        <View style={styles.lotModeRow}>
          <Pressable disabled={!editable} onPress={onChooseExistingLot} style={[styles.lotModeButton, item.lotMode === 'EXISTING' && styles.lotModeActive, !editable && styles.readOnlyControl]}><Icon name="inventory" size={16} color={item.lotMode === 'EXISTING' ? colors.onPrimary : colors.primary} /><Text style={[styles.lotModeText, item.lotMode === 'EXISTING' && styles.lotModeTextActive]}>Chọn lô có sẵn</Text></Pressable>
          <Pressable disabled={!editable} onPress={onCreateNewLot} style={[styles.lotModeButton, item.lotMode !== 'EXISTING' && styles.lotModeActive, !editable && styles.readOnlyControl]}><Icon name="add-circle-outline" size={16} color={item.lotMode !== 'EXISTING' ? colors.onPrimary : colors.primary} /><Text style={[styles.lotModeText, item.lotMode !== 'EXISTING' && styles.lotModeTextActive]}>Tạo lô mới</Text></Pressable>
        </View>
        {item.lotMode === 'EXISTING' && item.lotId ? <View style={styles.selectedLotBox}>
          <Text style={styles.selectedLotTitle}>{item.lotNumber || 'Lô đã chọn'}</Text>
          <Text style={styles.lotDateText}>Ngày sản xuất: {item.manufacturedDate || 'Không ghi nhận'}</Text>
          <Text style={styles.lotDateText}>Hạn sử dụng: {item.expiryDate || 'Không có hạn'}</Text>
          {(() => { const status = lotExpiryState({ id: item.lotId!, farmId: '', itemId: '', lotNumber: item.lotNumber ?? '', expiryDate: item.expiryDate, initialQuantity: '0', createdAt: '' }); return <Text style={[styles.lotStatus, status.expired && styles.lotExpired, status.warning && !status.expired && styles.lotExpiring]}>{status.label}</Text>; })()}
        </View> : <View style={styles.trackingFields}>
          <TextInput value={item.lotNumber ?? ''} onChangeText={(value) => onChangeField(item.id, 'lotNumber', value)} editable={editable} placeholder="Mã lô từ nhà cung cấp *" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, !editable && styles.readOnlyControl]} />
          <Pressable disabled={!editable} onPress={() => onPickDate('manufacturedDate', item.manufacturedDate)} style={[styles.datePickerButton, !editable && styles.readOnlyControl]}><Icon name="calendar-today" size={17} color={colors.primary} /><Text style={styles.datePickerText}>{item.manufacturedDate || 'Chọn ngày sản xuất'}</Text></Pressable>
          <Pressable disabled={!editable} onPress={() => onPickDate('expiryDate', item.expiryDate)} style={[styles.datePickerButton, !editable && styles.readOnlyControl]}><Icon name="event" size={17} color={colors.primary} /><Text style={styles.datePickerText}>{item.expiryDate || 'Chọn hạn sử dụng'}</Text></Pressable>
        </View>}
      </View> : null}
      {documentType === 'receipt' && item.metadata === 'ASSET' ? <View style={styles.trackingFields}>
        <TextInput value={item.assetCode ?? ''} onChangeText={(value) => onChangeField(item.id, 'assetCode', value)} editable={editable} placeholder="Mã tài sản *" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, !editable && styles.readOnlyControl]} />
        <TextInput value={item.serialNumber ?? ''} onChangeText={(value) => onChangeField(item.id, 'serialNumber', value)} editable={editable} placeholder="Số serial (không bắt buộc)" placeholderTextColor={colors.onSurfaceVariant} style={[styles.trackingInput, !editable && styles.readOnlyControl]} />
      </View> : null}
      <View style={styles.itemFooter}>
         <View style={styles.itemNote}><Icon name="check-circle" size={16} color={colors.tertiary} /><Text style={styles.noteText}>{item.note}</Text></View>
        <Pressable onPress={onOpenDetail} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.name}`}><Text style={styles.detailActionText}>Chi tiết</Text><Icon name="open-in-new" size={15} color={colors.primary} /></Pressable>
        {editable ? <Pressable onPress={onRemove} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [styles.removeAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Xóa ${item.name} khỏi phiếu`}><Icon name="delete-outline" size={18} color={colors.error} /><Text style={styles.removeActionText}>Xóa</Text></Pressable> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
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
  pillGreen: { backgroundColor: colors.tertiaryFixed, borderColor: colors.tertiaryFixedDim },
  pillAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer },
  pillNeutral: { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
  statusDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primaryContainer },
  statusText: { ...typography.labelSm, color: colors.primary, letterSpacing: 0.28 },
  primaryCard: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceLg, position: 'relative', overflow: 'hidden', ...shadows.surface },
  detailSectionCard: { gap: spacing.spaceMd, padding: spacing.spaceMd, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, ...shadows.surface },
  detailCardContent: { borderWidth: 0, borderRadius: 0, padding: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  detailItemCard: { borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, borderColor: colors.outlineVariant, paddingHorizontal: 0, backgroundColor: 'transparent' },
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
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  headingWithCount: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexShrink: 1 },
  sectionTitle: { ...typography.headlineSm, color: colors.onSurface, flexShrink: 1 },
  countText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  addButtonText: { ...typography.labelLg, color: colors.primary },
  itemCard: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.lg, padding: spacing.spaceMd, position: 'relative', overflow: 'hidden' },
  itemTopRow: { flexDirection: 'row', gap: spacing.spaceMd, alignItems: 'flex-start', flexWrap: 'wrap' },
  itemImageFrame: { width: 80, height: 80, borderRadius: radius.default, overflow: 'hidden', backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.outlineVariant, position: 'relative' },
  itemImage: { width: '100%', height: '100%' },
  itemImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imageTag: { position: 'absolute', bottom: 4, right: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary, borderRadius: radius.sm },
  imageTagText: { ...typography.labelSm, color: colors.onPrimary },
  itemBody: { flex: 1, minWidth: 0, gap: 3 },
  itemNamePressable: { flex: 1, minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs, flexWrap: 'wrap', minWidth: 0 },
  itemTitle: { ...typography.headlineSm, fontSize: 17, lineHeight: 23, color: colors.onPrimaryFixedVariant, flex: 1, minWidth: 0, flexShrink: 1 },
  badgeGreen: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeCream: { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { ...typography.labelSm, color: colors.primary, flexShrink: 1, textAlign: 'center' },
  itemMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1, minWidth: 0 },
  itemMetaStrong: { color: colors.onSurface, fontWeight: '600' },
  quantityBox: { minHeight: 40, marginTop: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, paddingVertical: 6, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  quantityButton: { width: 26, height: 26, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  quantityButtonText: { fontSize: 18, lineHeight: 20, fontWeight: '700', color: colors.onSurfaceVariant },
  quantityValue: { minWidth: 22, textAlign: 'center', ...typography.bodyMd, fontWeight: '700', color: colors.primary },
  unitText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  quantityDetail: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1, minWidth: 0, textAlign: 'right' },
  trackingFields: { gap: spacing.spaceSm, marginTop: spacing.spaceSm },
  trackingInput: { minHeight: 42, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, ...typography.bodySm },
  lotFields: { marginTop: spacing.spaceSm, gap: spacing.spaceSm },
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
  itemFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, marginTop: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  detailAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 4 },
  detailActionText: { ...typography.labelSm, color: colors.primary },
  removeAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 4 },
  removeActionText: { ...typography.labelSm, color: colors.error },
  itemNote: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  noteText: { ...typography.bodySm, color: colors.onTertiaryFixedVariant, fontWeight: '500', flexShrink: 1 },
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
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceMd },
  pickerHeaderCopy: { flex: 1, minWidth: 0 },
  pickerEyebrow: { ...typography.labelSm, color: colors.secondary },
  pickerTitle: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  pickerClose: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  pickerDone: { minHeight: 36, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pickerDoneText: { ...typography.labelMd, color: colors.onPrimary },
  pickerNotice: { ...typography.bodySm, color: colors.onTertiaryFixedVariant, paddingVertical: 2 },
  pickerList: { gap: spacing.spaceSm, paddingTop: spacing.spaceSm, paddingBottom: spacing.spaceSm },
  lotSearch: { minHeight: 42, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, color: colors.onSurface, ...typography.bodySm },
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
  confirmAction: { flex: 1, minHeight: 48, borderRadius: radius.full, overflow: 'hidden', ...shadows.surface },
  confirmGradient: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm },
  confirmText: { ...typography.labelLg, color: colors.onPrimary, textAlign: 'center', flexShrink: 1 },
  exportAction: { minWidth: 58, minHeight: 48, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  exportText: { ...typography.labelMd, color: colors.onSurfaceVariant, flexShrink: 1 },
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

import { apiRequest } from '@/src/shared/api/client';

export type Page = {
  number: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type Paginated<T> = { data: T[]; page: Page };

// Keep pagination complete without making a large farm wait for each page in turn.
// Limit concurrency so opening several screens does not overwhelm the API/DB pool.
const MAX_CONCURRENT_PAGE_REQUESTS = 4;

async function loadRemainingPages<T>(totalPages: number, loadPage: (page: number) => Promise<T[]>): Promise<T[][]> {
  if (totalPages <= 1) return [];
  const pages: T[][] = new Array(totalPages - 1);
  let nextPage = 2;
  async function worker() {
    while (nextPage <= totalPages) {
      const page = nextPage++;
      pages[page - 2] = await loadPage(page);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_PAGE_REQUESTS, totalPages - 1) }, () => worker()));
  return pages;
}

export type Warehouse = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  address?: string | null;
  description?: string | null;
  status: string;
};

export type Category = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
};

export type Item = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  imageUrl?: string | null;
  itemType: 'MATERIAL' | 'PRODUCT' | 'EQUIPMENT' | string;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | string;
  minStockLevel?: string;
  status: string;
  categoryName?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
};

type ItemApiRow = Item | {
  item: Item;
  categoryName?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
};

export type InventoryBalance = {
  balance: {
    id: string;
    farmId: string;
    warehouseId: string;
    itemId: string;
    lotId: string | null;
    quantityOnHand: string;
    updatedAt?: string;
  };
  itemCode: string;
  itemName: string;
  itemType: string;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | string;
  itemImageUrl?: string | null;
  minStockLevel?: string;
  categoryName?: string | null;
  item?: {
    id?: string;
    code?: string;
    name?: string;
    trackingMode?: string;
    imageUrl?: string | null;
    minStockLevel?: string;
    categoryName?: string | null;
    unit?: { id?: string; name?: string | null; symbol?: string | null };
  };
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
  lot?: { id: string; lotCode: string; supplierLotNumber?: string | null; legacyLotNumber?: string | null; expiryDate?: string | null } | null;
  lotCode?: string | null;
};

export type InventorySummaryRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | string;
  itemImageUrl?: string | null;
  minStockLevel: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  unitSymbol?: string | null;
  quantityOnHand: string;
  lotCount: number;
  singleLotId?: string | null;
  singleLotCode?: string | null;
};

export type InventorySummaryTotals = {
  stockedItemCount: number;
  lotItemCount: number;
  totalQuantity: string;
  belowMinimumCount: number;
};

export type InventoryItemsSummaryResponse = {
  data: InventorySummaryRow[];
  summary: InventorySummaryTotals;
  page: Page;
};

export type InventoryLot = {
  id: string;
  farmId: string;
  itemId: string;
  lotCode: string;
  supplierLotNumber?: string | null;
  legacyLotNumber?: string | null;
  sourceSupplierName?: string | null;
  manufacturedDate?: string | null;
  expiryDate?: string | null;
  initialQuantity: string;
  createdAt: string;
};

export type InventoryTransaction = {
  id: string;
  transactionType: 'RECEIPT' | 'ISSUE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'ASSIGNMENT_OUT' | 'RETURN_IN' | 'MAINTENANCE_ISSUE' | string;
  quantityChange: string;
  createdAt: string;
  item: { id: string; code: string; name: string; unit?: { name?: string; symbol?: string | null } };
  warehouse: { id: string; code: string; name: string };
  reason?: string | null;
  lot?: { id: string; lotCode: string; supplierLotNumber?: string | null } | null;
  asset?: { id: string; assetCode: string } | null;
  performer?: { id: string; displayName: string } | null;
};

export type InventoryTransactionFilters = {
  warehouseId?: string;
  itemId?: string;
  transactionType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export function listInventoryTransactions(token: string, farmId: string, filters: InventoryTransactionFilters) {
  return apiRequest<Paginated<InventoryTransaction>>('/inventory/transactions', {
    token,
    params: { farmId, ...filters },
    skipCache: true,
  });
}

export type InventoryForecast = {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  averageDailyOutflow: number;
  estimatedDaysRemaining: number;
};

const OUTFLOW_TRANSACTION_TYPES = new Set([
  'ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'ASSIGNMENT_OUT', 'MAINTENANCE_ISSUE',
]);
const FORECAST_WINDOW_DAYS = 30;

export function calculateInventoryForecast(
  transactions: InventoryTransaction[],
  balances: InventoryBalance[],
  farmId: string,
  warehouseId: string,
  now = Date.now(),
): InventoryForecast[] {
  const cutoff = now - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const scopedOutflow = new Map<string, { quantity: number; oldestTimestamp: number; item: InventoryTransaction['item'] }>();
  for (const transaction of transactions) {
    const timestamp = Date.parse(transaction.createdAt);
    if (transaction.warehouse.id !== warehouseId || !Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now) continue;
    if (!OUTFLOW_TRANSACTION_TYPES.has(transaction.transactionType)) continue;
    const change = Number(transaction.quantityChange);
    if (!Number.isFinite(change) || change >= 0) continue;
    const entry = scopedOutflow.get(transaction.item.id) ?? { quantity: 0, oldestTimestamp: timestamp, item: transaction.item };
    entry.quantity += Math.abs(change);
    entry.oldestTimestamp = Math.min(entry.oldestTimestamp, timestamp);
    scopedOutflow.set(transaction.item.id, entry);
  }

  const quantities = new Map<string, number>();
  for (const { balance } of balances) {
    if (balance.farmId !== farmId || balance.warehouseId !== warehouseId) continue;
    const quantity = Number(balance.quantityOnHand);
    if (Number.isFinite(quantity)) quantities.set(balance.itemId, (quantities.get(balance.itemId) ?? 0) + quantity);
  }

  return [...scopedOutflow.entries()].flatMap(([itemId, outflow]) => {
    const quantityOnHand = quantities.get(itemId) ?? 0;
    if (quantityOnHand <= 0 || outflow.quantity <= 0) return [];
    const observedDays = Math.max(1, Math.min(FORECAST_WINDOW_DAYS, (now - outflow.oldestTimestamp) / (24 * 60 * 60 * 1000)));
    const averageDailyOutflow = outflow.quantity / observedDays;
    return [{
      itemId,
      code: outflow.item.code,
      name: outflow.item.name,
      unit: outflow.item.unit?.symbol || outflow.item.unit?.name || '',
      quantityOnHand,
      averageDailyOutflow,
      estimatedDaysRemaining: quantityOnHand / averageDailyOutflow,
    }];
  }).sort((left, right) => left.estimatedDaysRemaining - right.estimatedDaysRemaining);
}

export type LowStockItem = Item & { quantityOnHand: number };

export function findLowStockItems(items: Item[], balances: InventoryBalance[], farmId: string, warehouseId: string): LowStockItem[] {
  const quantities = new Map<string, number>();
  for (const { balance } of balances) {
    if (balance.farmId !== farmId || balance.warehouseId !== warehouseId) continue;
    const quantity = Number(balance.quantityOnHand);
    if (Number.isFinite(quantity)) {
      quantities.set(balance.itemId, (quantities.get(balance.itemId) ?? 0) + quantity);
    }
  }

  return items
    .filter((item) => item.farmId === farmId && item.status === 'ACTIVE')
    .filter((item) => {
      const threshold = Number(item.minStockLevel ?? 0);
      return Number.isFinite(threshold) && threshold > 0
        && (quantities.get(item.id) ?? 0) < threshold;
    })
    .map((item) => ({ ...item, quantityOnHand: quantities.get(item.id) ?? 0 }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export type AvailableAsset = {
  asset: {
    id: string;
    farmId: string;
    itemId: string;
    currentLocationId: string | null;
    assetCode: string;
    serialNumber?: string | null;
    status: string;
  };
  locationWarehouseId: string | null;
  locationCode?: string | null;
  itemCode: string;
  itemName: string;
  itemImageUrl?: string | null;
  locationName: string | null;
};

export type AssetDetailRecord = AvailableAsset & {
  asset: AvailableAsset['asset'] & {
    qrToken?: string;
    purchaseDate?: string | null;
    warrantyExpiryDate?: string | null;
    lastMaintenanceDate?: string | null;
    nextMaintenanceDate?: string | null;
    note?: string | null;
  };
  maintenanceRetryEligible?: boolean;
  latestMaintenanceStatus?: string | null;
  latestMaintenanceReturnStatus?: string | null;
};

export type InventoryLotDetail = InventoryLot & {
  sourceSupplierId?: string | null;
  itemCode: string;
  itemName: string;
  itemType: string;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | string;
  itemImageUrl?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
};

export type MaintenanceRecord = {
  id: string;
  assetId: string;
  maintenanceType: string;
  scheduledAt: string | null;
  startedAt: string | null;
  issuedByMemberId: string | null;
  issuedByName: string | null;
  completedAt: string | null;
  receivedAt?: string | null;
  returnStatus?: string | null;
  returnRejectionReason?: string | null;
  finalDecision?: string | null;
  finalDecisionNote?: string | null;
  status: string;
  description: string | null;
  resultNote: string | null;
  performedByMemberId: string | null;
  supplierId: string | null;
  laborCost: string;
  materialCost: string;
  otherCost: string;
  totalCost?: string | null;
  createdAt: string;
};

export type StockDocumentStatus =
  | 'DRAFT'
  | 'COUNTING'
  | 'PENDING_APPROVAL'
  | 'IN_TRANSIT'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

/** Drafts have no permanent code until confirmation; name them by a short id. */
export type DocumentCodePrefix = 'PN' | 'PX' | 'KK' | 'CK' | 'MNT' | 'ATR' | 'BT';
export function documentCodeLabel(code: string | null | undefined, id: string, prefix: DocumentCodePrefix = 'PN') {
  return code ?? `${prefix}-${id.slice(0, 8)}`;
}

export type StockReceipt = {
  id: string;
  farmId: string;
  warehouseId: string;
  receiptCode: string | null;
  receiptDate?: string | null;
  status: StockDocumentStatus;
  note?: string | null;
  createdAt?: string;
  createdByMemberId?: string;
  rejectionReason?: string | null;
  warehouseCode?: string;
  warehouseName?: string;
  supplierCode?: string | null;
  supplierName?: string | null;
};

export type StockIssue = {
  id: string;
  farmId: string;
  warehouseId: string;
  issueCode: string | null;
  issueDate?: string | null;
  issueType?: string | null;
  status: StockDocumentStatus;
  reason?: string | null;
  note?: string | null;
  createdAt?: string;
  createdByMemberId?: string;
  rejectionReason?: string | null;
};

export type StockCount = {
  id: string;
  farmId: string;
  warehouseId: string;
  countCode: string | null;
  status: StockDocumentStatus;
  note?: string | null;
  createdAt?: string;
  rejectionReason?: string | null;
};

export type StockDocumentLine = {
  id: string;
  itemId: string;
  itemCode?: string | null;
  itemName?: string | null;
  itemImageUrl?: string | null;
  itemType?: string | null;
  trackingMode?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
  quantity?: string;
  actualQuantity?: string;
  systemQuantity?: string;
  lotId?: string | null;
  assetId?: string | null;
  assetCode?: string | null;
  serialNumber?: string | null;
  assetCodeFromAsset?: string | null;
  assetSerialNumber?: string | null;
  locationId?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  assetCondition?: 'GOOD' | 'DAMAGED' | null;
  foundLocationId?: string | null;
  foundLocationCode?: string | null;
  foundLocationName?: string | null;
  lotCode?: string | null;
  supplierLotNumber?: string | null;
  legacyLotNumber?: string | null;
  lotSupplierLotNumber?: string | null;
  lotLegacyLotNumber?: string | null;
  manufacturedDate?: string | null;
  expiryDate?: string | null;
  lotManufacturedDate?: string | null;
  lotExpiryDate?: string | null;
  note?: string | null;
};

export type StockReceiptDetail = { receipt: StockReceipt; items: StockDocumentLine[] };
export type StockIssueDetail = { issue: StockIssue; items: StockDocumentLine[] };
export type StockCountDetail = { count: StockCount; items: StockDocumentLine[] };

export function unwrap<T>(value: { data: T } | T): T {
  return typeof value === 'object' && value !== null && 'data' in value
    ? (value.data as T)
    : (value as T);
}

export function statusLabel(status: string) {
  switch (status) {
    case 'PENDING_APPROVAL': return 'CHỜ DUYỆT';
    case 'IN_TRANSIT': return 'ĐANG CHUYỂN';
    case 'CONFIRMED': return 'ĐÃ DUYỆT';
    case 'REJECTED': return 'TỪ CHỐI';
    case 'CANCELLED': return 'ĐÃ HỦY';
    case 'COUNTING': return 'ĐANG KIỂM KÊ';
    default: return 'BẢN NHÁP';
  }
}

export function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  return new Date(value).toLocaleDateString('vi-VN');
}

export type WarehouseLocation = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  status: string;
};

export type LocationPageFilters = {
  warehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  skipCache?: boolean;
};

export function listLocationsPage(
  token: string,
  farmId: string,
  filters: LocationPageFilters = {},
  signal?: AbortSignal,
) {
  return apiRequest<Paginated<WarehouseLocation>>('/locations', {
    token,
    params: {
      farmId,
      warehouseId: filters.warehouseId || undefined,
      status: filters.status ?? 'ACTIVE',
      search: filters.search?.trim() || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export async function listActiveLocations(token: string, farmId: string, warehouseId: string) {
  const firstPage = await apiRequest<Paginated<WarehouseLocation>>('/locations', {
    token,
    params: { farmId, warehouseId, status: 'ACTIVE', page: 1, pageSize: 100 },
    skipCache: true,
  });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
    const nextPage = await apiRequest<Paginated<WarehouseLocation>>('/locations', {
      token,
      params: { farmId, warehouseId, status: 'ACTIVE', page, pageSize: 100 },
      skipCache: true,
    });
    return nextPage.data;
  });
  return [firstPage.data, ...remainingPages]
    .flat()
    .filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE');
}

export async function listWarehouses(token: string, farmId: string, destination = false, signal?: AbortSignal) {
  return apiRequest<Paginated<Warehouse>>('/warehouses', {
    token,
    params: { farmId, page: 1, pageSize: 100, status: 'ACTIVE', destination: destination ? 'true' : undefined },
    signal,
  });
}

export function listCategories(token: string, signal?: AbortSignal) {
  return apiRequest<{ data: Category[] }>('/categories', {
    token,
    signal,
  });
}

export type ItemPageFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  itemType?: string;
  trackingMode?: string;
  excludeTrackingMode?: string;
  status?: string;
  skipCache?: boolean;
};

function normalizeItemRow(row: ItemApiRow): Item {
  if ('item' in row) {
    return {
      ...row.item,
      categoryName: row.categoryName,
      unitName: row.unitName,
      unitSymbol: row.unitSymbol,
    };
  }
  return row;
}

function normalizeItems(response: Paginated<ItemApiRow>): Paginated<Item> {
  return {
    ...response,
    data: response.data.map(normalizeItemRow),
  } satisfies Paginated<Item>;
}

export async function listItemsPage(
  token: string,
  farmId: string,
  filters: ItemPageFilters = {},
  signal?: AbortSignal,
): Promise<Paginated<Item>> {
  const response = await apiRequest<Paginated<ItemApiRow>>('/items', {
    token,
    params: {
      farmId,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      search: filters.search?.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      itemType: filters.itemType || undefined,
      trackingMode: filters.trackingMode || undefined,
      excludeTrackingMode: filters.excludeTrackingMode || undefined,
      status: filters.status ?? 'ACTIVE',
    },
    skipCache: filters.skipCache,
    signal,
  });
  return normalizeItems(response);
}

export async function getItemById(
  token: string,
  farmId: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<Item> {
  const response = await apiRequest<{ data: ItemApiRow }>(
    `/items/${encodeURIComponent(itemId)}`,
    {
      token,
      params: { farmId },
      signal,
    },
  );
  return normalizeItemRow(unwrap(response));
}

export async function listItems(token: string, farmId: string, search?: string) {
  const firstPage = await listItemsPage(token, farmId, { page: 1, pageSize: 100, search, status: 'ACTIVE' });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) =>
    (await listItemsPage(token, farmId, { page, pageSize: 100, search, status: 'ACTIVE' })).data);
  const data = [firstPage.data, ...remainingPages].flat();

  return {
    data,
    page: {
      ...firstPage.page,
      number: 1,
      size: data.length,
      totalPages: firstPage.page.totalPages,
    },
  } satisfies Paginated<Item>;
}

export type BalancePageFilters = {
  warehouseId?: string;
  itemId?: string;
  lotId?: string;
  assetId?: string;
  search?: string;
  categoryId?: string;
  trackingMode?: string;
  excludeTrackingMode?: string;
  itemIds?: string[];
  positiveOnly?: boolean;
  page?: number;
  pageSize?: number;
  skipCache?: boolean;
};

export type BalancePageResponse = {
  data: InventoryBalance[];
  page: Page;
  summary?: {
    lotBalanceRows: number;
    assetBalanceRows: number;
    lotRowsWithoutLot: number;
    lotsWithoutExpiry: number;
    expiredLots: number;
    expiringLots: number;
    healthyLots: number;
  };
};

export function listBalancesPage(
  token: string,
  farmId: string,
  filters: BalancePageFilters = {},
  signal?: AbortSignal,
) {
  return apiRequest<BalancePageResponse>('/inventory', {
    token,
    params: {
      farmId,
      warehouseId: filters.warehouseId || undefined,
      itemId: filters.itemId || undefined,
      lotId: filters.lotId || undefined,
      assetId: filters.assetId || undefined,
      search: filters.search?.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      trackingMode: filters.trackingMode || undefined,
      excludeTrackingMode: filters.excludeTrackingMode || undefined,
      itemIds: filters.itemIds?.length ? filters.itemIds.join(',') : undefined,
      positiveOnly: filters.positiveOnly ? 'true' : undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export async function listPositiveBalancesForItems(
  token: string,
  farmId: string,
  warehouseId: string,
  itemIds: string[],
  signal?: AbortSignal,
): Promise<InventoryBalance[]> {
  if (itemIds.length === 0) return [];
  const collected: InventoryBalance[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const chunk = itemIds.slice(i, i + 50);
    const firstPage = await listBalancesPage(
      token,
      farmId,
      { warehouseId, itemIds: chunk, positiveOnly: true, page: 1, pageSize: 100, skipCache: true },
      signal,
    );
    collected.push(...firstPage.data);
    const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
      const nextPage = await listBalancesPage(
        token,
        farmId,
        { warehouseId, itemIds: chunk, positiveOnly: true, page, pageSize: 100, skipCache: true },
        signal,
      );
      return nextPage.data;
    });
    collected.push(...remainingPages.flat());
  }
  return filterPositiveBalancesForScope(collected, farmId, warehouseId);
}

export type InventorySummaryFilters = {
  warehouseId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  trackingMode?: string;
  excludeTrackingMode?: string;
  lowStockOnly?: boolean;
  skipCache?: boolean;
};

export function listInventorySummaryPage(
  token: string,
  farmId: string,
  filters: InventorySummaryFilters = {},
  signal?: AbortSignal,
) {
  return apiRequest<InventoryItemsSummaryResponse>('/inventory/items-summary', {
    token,
    params: {
      farmId,
      warehouseId: filters.warehouseId || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      search: filters.search?.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      trackingMode: filters.trackingMode || undefined,
      excludeTrackingMode: filters.excludeTrackingMode || undefined,
      lowStockOnly: filters.lowStockOnly ? 'true' : undefined,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export function getInventoryForecastPage(
  token: string,
  farmId: string,
  warehouseId: string,
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
) {
  return apiRequest<Paginated<InventoryForecast>>('/inventory/forecast', {
    token,
    params: {
      farmId,
      warehouseId,
      page,
      pageSize,
    },
    signal,
  });
}

export type LotPageFilters = {
  itemId?: string;
  supplierLotNumber?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  skipCache?: boolean;
};

export function listLotsPage(
  token: string,
  farmId: string,
  filters: LotPageFilters = {},
  signal?: AbortSignal,
) {
  return apiRequest<Paginated<InventoryLot>>('/lots', {
    token,
    params: {
      farmId,
      itemId: filters.itemId || undefined,
      supplierLotNumber: filters.supplierLotNumber?.trim() || undefined,
      search: filters.search?.trim() || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export async function getInventoryLot(
  token: string,
  farmId: string,
  lotId: string,
  signal?: AbortSignal,
): Promise<InventoryLotDetail> {
  const response = await apiRequest<{ data: InventoryLotDetail }>(
    `/lots/${encodeURIComponent(lotId)}`,
    {
      token,
      params: { farmId },
      signal,
    },
  );
  return unwrap(response);
}

export type AssetPageFilters = {
  warehouseId?: string;
  itemId?: string;
  locationId?: string;
  status?: string;
  excludeStatuses?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
  skipCache?: boolean;
};

export function listAssetsPage(
  token: string,
  farmId: string,
  filters: AssetPageFilters = {},
  signal?: AbortSignal,
) {
  return apiRequest<{
    data: AvailableAsset[];
    summary?: { available: number; inUse: number; attention: number };
    page: Page;
  }>('/assets', {
    token,
    params: {
      farmId,
      warehouseId: filters.warehouseId || undefined,
      itemId: filters.itemId || undefined,
      locationId: filters.locationId || undefined,
      status: filters.status || undefined,
      excludeStatuses: filters.excludeStatuses?.length
        ? filters.excludeStatuses.join(',')
        : undefined,
      search: filters.search?.trim() || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export async function getAssetById(
  token: string,
  farmId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<AssetDetailRecord> {
  const response = await apiRequest<{ data: AssetDetailRecord }>(
    `/assets/${encodeURIComponent(assetId)}`,
    {
      token,
      params: { farmId },
      signal,
    },
  );
  return unwrap(response);
}

export function listMaintenanceRecordsPage(
  token: string,
  farmId: string,
  filters: {
    assetId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
    skipCache?: boolean;
  } = {},
  signal?: AbortSignal,
) {
  return apiRequest<Paginated<MaintenanceRecord>>('/maintenance-records', {
    token,
    params: {
      farmId,
      assetId: filters.assetId || undefined,
      status: filters.status || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    },
    skipCache: filters.skipCache,
    signal,
  });
}

export async function listBalances(token: string, farmId: string, warehouseId?: string, positiveOnly = false, skipCache = false) {
  const params = {
    farmId,
    warehouseId,
    positiveOnly: positiveOnly ? 'true' : undefined,
    page: 1,
    pageSize: 100,
  };
  const firstPage = await apiRequest<{ data: InventoryBalance[]; page?: Page }>(
    '/inventory',
    { token, params, skipCache },
  );
  const remainingPages = await loadRemainingPages(firstPage.page?.totalPages ?? 1, async (page) => {
    const nextPage = await apiRequest<{ data: InventoryBalance[] }>(
      '/inventory',
      {
        token,
        params: { ...params, page },
        skipCache,
      },
    );
    return nextPage.data;
  });

  return { data: [firstPage.data, ...remainingPages].flat() };
}

export async function listInventoryLots(token: string, farmId: string, itemId?: string) {
  const params = { farmId, itemId, page: 1, pageSize: 100 };
  const firstPage = await apiRequest<Paginated<InventoryLot>>('/lots', { token, params, skipCache: true });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
    const nextPage = await apiRequest<Paginated<InventoryLot>>('/lots', {
      token,
      params: { ...params, page },
      skipCache: true,
    });
    return nextPage.data;
  });
  return [firstPage.data, ...remainingPages].flat().filter((lot) => lot.farmId === farmId && (!itemId || lot.itemId === itemId));
}

export async function findInventoryLotsBySupplierNumber(token: string, farmId: string, itemId: string, supplierLotNumber: string) {
  const params = { farmId, itemId, supplierLotNumber, page: 1, pageSize: 100 };
  const firstPage = await apiRequest<Paginated<InventoryLot>>('/lots', { token, params, skipCache: true });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
    const nextPage = await apiRequest<Paginated<InventoryLot>>('/lots', { token, params: { ...params, page }, skipCache: true });
    return nextPage.data;
  });
  return [firstPage.data, ...remainingPages].flat().filter((lot) => lot.farmId === farmId && lot.itemId === itemId && lot.supplierLotNumber === supplierLotNumber);
}

export async function listRecentInventoryTransactions(token: string, farmId: string, warehouseId: string, now = Date.now()) {
  const cutoff = now - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // API dates use Vietnam calendar days. The UTC day of the exact cutoff is
  // equal to or earlier than its Vietnam day, so no in-window row is lost.
  const params = { farmId, warehouseId, dateFrom: new Date(cutoff).toISOString().slice(0, 10), page: 1, pageSize: 100 };
  const firstPage = await apiRequest<Paginated<InventoryTransaction>>('/inventory/transactions', {
    token, params, skipCache: true,
  });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
    const nextPage = await apiRequest<Paginated<InventoryTransaction>>('/inventory/transactions', {
      token, params: { ...params, page }, skipCache: true,
    });
    return nextPage.data;
  });
  return [firstPage.data, ...remainingPages].flat().filter((transaction) => {
    const timestamp = Date.parse(transaction.createdAt);
    return transaction.warehouse.id === warehouseId && Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
  });
}

export function filterPositiveBalancesForScope(rows: InventoryBalance[], farmId: string, warehouseId: string) {
  return rows.filter(({ balance }) => balance.farmId === farmId
    && balance.warehouseId === warehouseId
    && Number.isFinite(Number(balance.quantityOnHand))
    && Number(balance.quantityOnHand) > 0);
}

export function balanceMatchesTrackingMode(balance: InventoryBalance['balance'], trackingMode: string) {
  return trackingMode === 'LOT' ? Boolean(balance.lotId) : !balance.lotId;
}

export function filterAvailableAssetsForScope(rows: AvailableAsset[], farmId: string, warehouseId: string) {
  return rows.filter(({ asset, locationWarehouseId }) =>
    asset.farmId === farmId && asset.status === 'AVAILABLE' && locationWarehouseId === warehouseId);
}

export async function listAvailableAssets(token: string, farmId: string, warehouseId: string) {
  const firstPage = await apiRequest<Paginated<AvailableAsset>>('/assets', {
    token,
    params: { farmId, warehouseId, status: 'AVAILABLE', page: 1, pageSize: 100 },
    skipCache: true,
  });
  const remainingPages = await loadRemainingPages(firstPage.page.totalPages, async (page) => {
    const nextPage = await apiRequest<Paginated<AvailableAsset>>('/assets', {
      token,
      params: { farmId, warehouseId, status: 'AVAILABLE', page, pageSize: 100 },
      skipCache: true,
    });
    return nextPage.data;
  });

  return filterAvailableAssetsForScope([firstPage.data, ...remainingPages].flat(), farmId, warehouseId);
}

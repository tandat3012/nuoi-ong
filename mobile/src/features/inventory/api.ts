import { apiRequest } from '@/src/shared/api/client';

export type Page = {
  number: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type Paginated<T> = { data: T[]; page: Page };

export type Warehouse = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  address?: string | null;
  description?: string | null;
  status: string;
};

export type Item = {
  id: string;
  farmId: string;
  code: string;
  name: string;
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
  item?: {
    unit?: { name?: string | null; symbol?: string | null };
  };
  lot?: { id: string; lotNumber?: string | null; expiryDate?: string | null } | null;
  lotNumber?: string | null;
};

export type InventoryLot = {
  id: string;
  farmId: string;
  itemId: string;
  lotNumber: string;
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
};

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
    status: string;
  };
  locationWarehouseId: string | null;
  itemCode: string;
  itemName: string;
  locationName: string | null;
};

export type StockDocumentStatus =
  | 'DRAFT'
  | 'COUNTING'
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export type StockReceipt = {
  id: string;
  farmId: string;
  warehouseId: string;
  receiptCode: string;
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
  issueCode: string;
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
  countCode: string;
  status: StockDocumentStatus;
  note?: string | null;
  createdAt?: string;
  rejectionReason?: string | null;
};

export type StockDocumentLine = {
  id: string;
  itemId: string;
  quantity?: string;
  actualQuantity?: string;
  systemQuantity?: string;
  lotId?: string | null;
  assetId?: string | null;
  lotNumber?: string | null;
  lotNumberFromLot?: string | null;
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

export async function listWarehouses(token: string, farmId: string) {
  return apiRequest<Paginated<Warehouse>>('/warehouses', {
    token,
    params: { farmId, page: 1, pageSize: 100, status: 'ACTIVE' },
  });
}

async function listItemsPage(token: string, farmId: string, page: number, search?: string) {
  return apiRequest<Paginated<ItemApiRow>>('/items', {
    token,
    params: { farmId, page, pageSize: 100, search: search || undefined, status: 'ACTIVE' },
  });
}

function normalizeItems(response: Paginated<ItemApiRow>): Paginated<Item> {
  return {
    ...response,
    data: response.data.map((row) => {
      if ('item' in row) {
        return {
          ...row.item,
          categoryName: row.categoryName,
          unitName: row.unitName,
          unitSymbol: row.unitSymbol,
        };
      }
      return row;
    }),
  } satisfies Paginated<Item>;
}

export async function listItems(token: string, farmId: string, search?: string) {
  const firstPage = normalizeItems(await listItemsPage(token, farmId, 1, search));
  const pages = [firstPage.data];

  for (let page = 2; page <= firstPage.page.totalPages; page += 1) {
    const nextPage = normalizeItems(await listItemsPage(token, farmId, page, search));
    pages.push(nextPage.data);
  }

  return {
    data: pages.flat(),
    page: {
      ...firstPage.page,
      number: 1,
      size: pages.flat().length,
      totalPages: firstPage.page.totalPages,
    },
  } satisfies Paginated<Item>;
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
  const pages = [firstPage.data];

  for (let page = 2; page <= (firstPage.page?.totalPages ?? 1); page += 1) {
    const nextPage = await apiRequest<{ data: InventoryBalance[] }>(
      '/inventory',
      {
        token,
        params: { ...params, page },
        skipCache,
      },
    );
    pages.push(nextPage.data);
  }

  return { data: pages.flat() };
}

export async function listInventoryLots(token: string, farmId: string, itemId: string) {
  const params = { farmId, itemId, page: 1, pageSize: 100 };
  const firstPage = await apiRequest<Paginated<InventoryLot>>('/lots', { token, params, skipCache: true });
  const pages = [firstPage.data];
  for (let page = 2; page <= firstPage.page.totalPages; page += 1) {
    const nextPage = await apiRequest<Paginated<InventoryLot>>('/lots', {
      token,
      params: { ...params, page },
      skipCache: true,
    });
    pages.push(nextPage.data);
  }
  return pages.flat().filter((lot) => lot.farmId === farmId && lot.itemId === itemId);
}

export async function listRecentInventoryTransactions(token: string, farmId: string, warehouseId: string, now = Date.now()) {
  const params = { farmId, warehouseId, page: 1, pageSize: 100 };
  const firstPage = await apiRequest<Paginated<InventoryTransaction>>('/inventory/transactions', {
    token, params, skipCache: true,
  });
  const transactions = [...firstPage.data];
  const cutoff = now - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  for (let page = 2; page <= firstPage.page.totalPages; page += 1) {
    const oldestTimestamp = transactions.reduce((oldest, row) => Math.min(oldest, Date.parse(row.createdAt)), Number.POSITIVE_INFINITY);
    if (oldestTimestamp < cutoff) break;
    const nextPage = await apiRequest<Paginated<InventoryTransaction>>('/inventory/transactions', {
      token, params: { ...params, page }, skipCache: true,
    });
    transactions.push(...nextPage.data);
  }
  return transactions.filter((transaction) => {
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
  const pages = [firstPage.data];

  for (let page = 2; page <= firstPage.page.totalPages; page += 1) {
    const nextPage = await apiRequest<Paginated<AvailableAsset>>('/assets', {
      token,
      params: { farmId, warehouseId, status: 'AVAILABLE', page, pageSize: 100 },
      skipCache: true,
    });
    pages.push(nextPage.data);
  }

  return filterAvailableAssetsForScope(pages.flat(), farmId, warehouseId);
}

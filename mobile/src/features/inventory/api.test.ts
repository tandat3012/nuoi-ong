import { describe, expect, it, jest } from '@jest/globals';
import { apiRequest } from '@/src/shared/api/client';
import { balanceMatchesTrackingMode, calculateInventoryForecast, documentCodeLabel, filterAvailableAssetsForScope, filterPositiveBalancesForScope, findInventoryLotsBySupplierNumber, findLowStockItems, listBalances, listInventoryTransactions, listRecentInventoryTransactions, type AvailableAsset, type InventoryBalance, type InventoryTransaction, type Item } from './api';

jest.mock('@/src/shared/api/client', () => ({ apiRequest: jest.fn() }));

const balance = (farmId: string, warehouseId: string, quantityOnHand: string, itemId: string): InventoryBalance => ({
  balance: { id: `${farmId}-${warehouseId}-${itemId}`, farmId, warehouseId, itemId, lotId: null, quantityOnHand },
  itemCode: itemId,
  itemName: itemId,
  itemType: 'MATERIAL',
  trackingMode: 'QUANTITY',
});

describe('inventory balance scope', () => {
  it('only keeps positive balances from the selected farm and warehouse', () => {
    const rows = [
      balance('farm-a', 'warehouse-a', '4', 'valid'),
      balance('farm-a', 'warehouse-b', '9', 'other-warehouse'),
      balance('farm-b', 'warehouse-a', '7', 'other-farm'),
      balance('farm-a', 'warehouse-a', '0', 'empty'),
      balance('farm-a', 'warehouse-a', '-1', 'negative'),
    ];

    expect(filterPositiveBalancesForScope(rows, 'farm-a', 'warehouse-a').map(({ balance: row }) => row.itemId))
      .toEqual(['valid']);
  });

  it('loads every paginated balance row instead of silently stopping at the API default page', async () => {
    const request = jest.mocked(apiRequest);
    request
      .mockResolvedValueOnce({
        data: [balance('farm-a', 'warehouse-a', '2', 'first')],
        page: { number: 1, size: 100, totalItems: 101, totalPages: 2 },
      } as never)
      .mockResolvedValueOnce({
        data: [balance('farm-a', 'warehouse-b', '3', 'last')],
        page: { number: 2, size: 100, totalItems: 101, totalPages: 2 },
      } as never);

    const result = await listBalances('token', 'farm-a');

    expect(result.data.map(({ balance: row }) => row.itemId)).toEqual(['first', 'last']);
    expect(request).toHaveBeenNthCalledWith(1, '/inventory', expect.objectContaining({
      params: expect.objectContaining({ farmId: 'farm-a', page: 1, pageSize: 100 }),
    }));
    expect(request).toHaveBeenNthCalledWith(2, '/inventory', expect.objectContaining({
      params: expect.objectContaining({ farmId: 'farm-a', page: 2, pageSize: 100 }),
    }));
  });

  it('loads remaining pages concurrently but returns balances in page order', async () => {
    const request = jest.mocked(apiRequest);
    request.mockReset();
    let releasePageTwo!: (value: unknown) => void;
    const pageTwo = new Promise<unknown>((resolve) => { releasePageTwo = resolve; });
    request.mockImplementation((_, options) => {
      const page = Number(options.params?.page);
      if (page === 1) return Promise.resolve({ data: [], page: { number: 1, size: 100, totalItems: 300, totalPages: 3 } }) as never;
      if (page === 2) return pageTwo as never;
      return Promise.resolve({ data: [balance('farm-a', 'warehouse-a', '1', 'third')] }) as never;
    });

    const resultPromise = listBalances('token', 'farm-a');
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledWith('/inventory', expect.objectContaining({ params: expect.objectContaining({ page: 3 }) }));
    releasePageTwo({ data: [balance('farm-a', 'warehouse-a', '1', 'second')] });
    const result = await resultPromise;
    expect(result.data.map(({ balance: row }) => row.itemId)).toEqual(['second', 'third']);
  });

  it('does not treat a quantity-tracked item balance as a lot balance', () => {
    const row = balance('farm-a', 'warehouse-a', '4', 'item-a').balance;
    expect(balanceMatchesTrackingMode(row, 'QUANTITY')).toBe(true);
    expect(balanceMatchesTrackingMode({ ...row, lotId: 'lot-a' }, 'QUANTITY')).toBe(false);
    expect(balanceMatchesTrackingMode({ ...row, lotId: 'lot-a' }, 'LOT')).toBe(true);
    expect(balanceMatchesTrackingMode(row, 'LOT')).toBe(false);
  });
});

describe('available asset scope', () => {
  it('uses the API locationWarehouseId field and excludes other farms, warehouses, and statuses', () => {
    const asset = (farmId: string, locationWarehouseId: string | null, status: string, id: string): AvailableAsset => ({
      asset: { id, farmId, itemId: 'item-a', currentLocationId: null, assetCode: id, status },
      locationWarehouseId,
      itemCode: 'EQ-01',
      itemName: 'Thiết bị',
      locationName: null,
    });
    const rows = [
      asset('farm-a', 'warehouse-a', 'AVAILABLE', 'valid'),
      asset('farm-a', 'warehouse-b', 'AVAILABLE', 'other-warehouse'),
      asset('farm-b', 'warehouse-a', 'AVAILABLE', 'other-farm'),
      asset('farm-a', 'warehouse-a', 'IN_USE', 'in-use'),
      asset('farm-a', null, 'AVAILABLE', 'unlocated'),
    ];

    expect(filterAvailableAssetsForScope(rows, 'farm-a', 'warehouse-a').map(({ asset: row }) => row.id))
      .toEqual(['valid']);
  });
});

describe('low stock alerts', () => {
  const item = (id: string, threshold: string, farmId = 'farm-a'): Item => ({
    id, farmId, code: id, name: id, itemType: 'MATERIAL', trackingMode: 'QUANTITY',
    minStockLevel: threshold, status: 'ACTIVE', unitName: 'cái', unitSymbol: null,
  });

  it('sums lots in the selected warehouse without counting balances from other warehouses', () => {
    const rows = [
      balance('farm-a', 'warehouse-a', '3', 'low'),
      balance('farm-a', 'warehouse-a', '1', 'low'),
      balance('farm-a', 'warehouse-b', '2', 'low'),
      balance('farm-a', 'warehouse-a', '5', 'at-minimum'),
      balance('farm-b', 'warehouse-a', '1', 'low'),
    ];

    expect(findLowStockItems([item('low', '6'), item('at-minimum', '5'), item('zero-limit', '0'), item('other-farm', '8', 'farm-b')], rows, 'farm-a', 'warehouse-a'))
      .toMatchObject([{ id: 'low', quantityOnHand: 4 }]);
  });

  it('includes active items with no balance as zero stock when a minimum is configured', () => {
    expect(findLowStockItems([item('empty', '1')], [], 'farm-a', 'warehouse-a'))
      .toMatchObject([{ id: 'empty', quantityOnHand: 0 }]);
  });
});

describe('inventory forecast', () => {
  const now = Date.parse('2026-10-16T12:00:00.000Z');
  const transaction = (overrides: Partial<InventoryTransaction> = {}): InventoryTransaction => ({
    id: 'tx-1', transactionType: 'ISSUE', quantityChange: '-10', createdAt: '2026-10-06T12:00:00.000Z',
    item: { id: 'item-a', code: 'MAT-01', name: 'Đường', unit: { symbol: 'kg' } },
    warehouse: { id: 'warehouse-a', code: 'WH-A', name: 'Kho A' },
    ...overrides,
  });

  it('estimates remaining days from recent outbound transactions in the selected warehouse only', () => {
    const rows = [
      transaction(),
      transaction({ id: 'inbound', transactionType: 'RECEIPT', quantityChange: '100' }),
      transaction({ id: 'other-warehouse', warehouse: { id: 'warehouse-b', code: 'WH-B', name: 'Kho B' } }),
      transaction({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' }),
    ];
    const result = calculateInventoryForecast(rows, [balance('farm-a', 'warehouse-a', '20', 'item-a')], 'farm-a', 'warehouse-a', now);
    expect(result).toMatchObject([{ itemId: 'item-a', quantityOnHand: 20, averageDailyOutflow: 1, estimatedDaysRemaining: 20 }]);
  });

  it('does not forecast zero stock, positive adjustments, or transactions outside the 30-day window', () => {
    const rows = [
      transaction({ transactionType: 'ADJUSTMENT_IN', quantityChange: '3' }),
      transaction({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' }),
    ];
    expect(calculateInventoryForecast(rows, [balance('farm-a', 'warehouse-a', '0', 'item-a')], 'farm-a', 'warehouse-a', now)).toEqual([]);
  });

  it('queries only the 30-day forecast window and preserves the exact cutoff locally', async () => {
    const request = jest.mocked(apiRequest);
    request.mockClear();
    request.mockResolvedValueOnce({ data: [transaction()], page: { number: 1, size: 100, totalItems: 150, totalPages: 2 } } as never);
    request.mockResolvedValueOnce({ data: [transaction({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' })], page: { number: 2, size: 100, totalItems: 150, totalPages: 2 } } as never);
    const result = await listRecentInventoryTransactions('token', 'farm-a', 'warehouse-a', now);
    expect(result.map(({ id }) => id)).toEqual(['tx-1']);
    expect(request).toHaveBeenNthCalledWith(1, '/inventory/transactions', expect.objectContaining({
      params: { farmId: 'farm-a', warehouseId: 'warehouse-a', dateFrom: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), page: 1, pageSize: 100 }, skipCache: true,
    }));
    expect(request).toHaveBeenNthCalledWith(2, '/inventory/transactions', expect.objectContaining({
      params: { farmId: 'farm-a', warehouseId: 'warehouse-a', dateFrom: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), page: 2, pageSize: 100 }, skipCache: true,
    }));
  });
});

describe('inventory ledger filters', () => {
  it('keeps the warehouse and type while sending the selected date and page', async () => {
    const request = jest.mocked(apiRequest);
    request.mockReset();
    request.mockResolvedValueOnce({ data: [], page: { number: 2, size: 20, totalItems: 25, totalPages: 2 } } as never);
    await listInventoryTransactions('token', 'farm-a', {
      warehouseId: 'warehouse-a', transactionType: 'ISSUE', dateFrom: '2026-10-01', page: 2, pageSize: 20,
    });
    expect(request).toHaveBeenCalledWith('/inventory/transactions', {
      token: 'token',
      params: { farmId: 'farm-a', warehouseId: 'warehouse-a', transactionType: 'ISSUE', dateFrom: '2026-10-01', page: 2, pageSize: 20 },
      skipCache: true,
    });
  });
});

describe('document code label', () => {
  it('names an uncoded draft by its short id and keeps a permanent code', () => {
    expect(documentCodeLabel(null, '1a2b3c4d-0000-4000-8000-000000000000')).toBe('Nháp #1a2b3c4d');
    expect(documentCodeLabel('PN-2026-000001', '1a2b3c4d')).toBe('PN-2026-000001');
  });
});

describe('lot suggestion lookup', () => {
  it('requests an exact supplier number within the selected farm and item', async () => {
    const request = jest.mocked(apiRequest);
    request.mockReset();
    request.mockResolvedValueOnce({
      data: [
        { id: 'lot-a', farmId: 'farm-a', itemId: 'item-a', lotCode: 'LOT-000000001', supplierLotNumber: '001' },
        { id: 'lot-b', farmId: 'farm-b', itemId: 'item-a', lotCode: 'LOT-000000002', supplierLotNumber: '001' },
      ],
      page: { number: 1, size: 100, totalItems: 2, totalPages: 1 },
    } as never);

    const lots = await findInventoryLotsBySupplierNumber('token', 'farm-a', 'item-a', '001');

    expect(lots.map((lot) => lot.id)).toEqual(['lot-a']);
    expect(request).toHaveBeenCalledWith('/lots', expect.objectContaining({
      params: { farmId: 'farm-a', itemId: 'item-a', supplierLotNumber: '001', page: 1, pageSize: 100 },
    }));
  });
});

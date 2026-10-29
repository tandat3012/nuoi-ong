import { describe, expect, it, jest } from '@jest/globals';
import { apiRequest } from '@/src/shared/api/client';
import { balanceMatchesTrackingMode, calculateInventoryForecast, filterAvailableAssetsForScope, filterPositiveBalancesForScope, findLowStockItems, listBalances, listRecentInventoryTransactions, type AvailableAsset, type InventoryBalance, type InventoryTransaction, type Item } from './api';

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

  it('requests transaction pages by farm and selected warehouse and stops once history exceeds 30 days', async () => {
    const request = jest.mocked(apiRequest);
    request.mockClear();
    request.mockResolvedValueOnce({ data: [transaction()], page: { number: 1, size: 100, totalItems: 150, totalPages: 2 } } as never);
    request.mockResolvedValueOnce({ data: [transaction({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' })], page: { number: 2, size: 100, totalItems: 150, totalPages: 2 } } as never);
    const result = await listRecentInventoryTransactions('token', 'farm-a', 'warehouse-a', now);
    expect(result.map(({ id }) => id)).toEqual(['tx-1']);
    expect(request).toHaveBeenNthCalledWith(1, '/inventory/transactions', expect.objectContaining({
      params: { farmId: 'farm-a', warehouseId: 'warehouse-a', page: 1, pageSize: 100 }, skipCache: true,
    }));
    expect(request).toHaveBeenNthCalledWith(2, '/inventory/transactions', expect.objectContaining({
      params: { farmId: 'farm-a', warehouseId: 'warehouse-a', page: 2, pageSize: 100 }, skipCache: true,
    }));
  });
});

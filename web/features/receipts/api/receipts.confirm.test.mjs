import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmReceipt,
  getReceiptCatalogItems,
  getReceiptLocations,
  getReceiptSuppliers,
  getReceipts,
} from './receipts.api.ts';

test('confirms a draft through the dedicated farm-scoped action', async () => {
  const response = {
    data: { receipt: { id: 'receipt-a', status: 'CONFIRMED' }, items: [] },
  };
  assert.equal(
    await confirmReceipt(
      async (path, options) => {
        assert.equal(path, '/stock-receipts/receipt-a/confirm');
        assert.deepEqual(options, {
          method: 'POST',
          params: { farmId: 'farm-a' },
        });
        return response;
      },
      'farm-a',
      'receipt-a',
    ),
    response,
  );
});

test('scopes receipt lists and all dropdown lookups to the selected farm', async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, options });
    return { data: [], page: { number: 1, size: 10, totalItems: 0, totalPages: 0 } };
  };

  await getReceipts(request, 'farm-selected', {
    page: 1,
    pageSize: 20,
    warehouseId: 'warehouse-selected',
    status: 'DRAFT',
  });
  await getReceiptSuppliers(request, 'farm-selected', {
    page: 1,
    pageSize: 10,
    search: 'supplier',
  });
  await getReceiptLocations(request, 'farm-selected', {
    page: 1,
    pageSize: 10,
    warehouseId: 'warehouse-selected',
  });
  await getReceiptCatalogItems(request, 'farm-selected', {
    page: 1,
    pageSize: 10,
    trackingMode: 'ASSET',
  });

  assert.deepEqual(calls.map(({ path }) => path), [
    '/stock-receipts',
    '/suppliers',
    '/locations',
    '/items',
  ]);
  assert.ok(
    calls.every(({ options }) => options.params.farmId === 'farm-selected'),
  );
  assert.equal(calls[0].options.params.warehouseId, 'warehouse-selected');
  assert.equal(calls[1].options.params.status, 'ACTIVE');
  assert.equal(calls[2].options.params.warehouseId, 'warehouse-selected');
  assert.equal(calls[3].options.params.trackingMode, 'ASSET');
});

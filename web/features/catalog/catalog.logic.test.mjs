import assert from 'node:assert/strict';
import test from 'node:test';

import { canWriteCatalog, catalogError, catalogFieldValue, catalogPayload, flattenCatalogItem, withCurrentOption } from './catalog.logic.ts';

test('shared catalog lists are writable by ADMIN only', () => {
  assert.equal(canWriteCatalog({ shared: true }, ['FARM_OWNER']), false);
  assert.equal(canWriteCatalog({ shared: true }, ['ADMIN']), true);
  assert.equal(canWriteCatalog({ shared: false }, ['FARM_OWNER']), true);
  assert.equal(canWriteCatalog({ shared: false }, ['EMPLOYEE', 'GUEST']), false);
});

test('catalogPayload trims values and clears blank optional fields', () => {
  const data = new FormData();
  data.set('code', '  sup-1 ');
  data.set('email', '   ');
  const body = catalogPayload(
    [
      { name: 'code', label: 'Mã', required: true },
      { name: 'email', label: 'Email' },
      { name: 'warehouseId', label: 'Kho', type: 'select' },
    ],
    data,
  );
  assert.deepEqual(body, { code: 'sup-1', email: null, warehouseId: null });
});

test('equipment templates send numbers, flatten list rows and show numeric values', () => {
  const data = new FormData();
  data.set('maintenanceIntervalDays', ' 90 ');
  data.set('minStockLevel', '0');
  const fields = [
    { name: 'maintenanceIntervalDays', label: 'Chu kỳ', type: 'number' },
    { name: 'minStockLevel', label: 'Tồn tối thiểu', required: true },
    { name: 'description', label: 'Mô tả' },
  ];
  assert.deepEqual(catalogPayload(fields, data), { maintenanceIntervalDays: 90, minStockLevel: '0', description: null });
  const row = flattenCatalogItem({ item: { id: 'i1', code: 'EQ', name: 'Bình khói', status: 'ACTIVE', maintenanceIntervalDays: 90 }, categoryName: 'Thiết bị', unitName: 'Cái' });
  assert.deepEqual(row, { id: 'i1', code: 'EQ', name: 'Bình khói', status: 'ACTIVE', maintenanceIntervalDays: 90, categoryName: 'Thiết bị', unitName: 'Cái' });
  assert.equal(catalogFieldValue(row, 'maintenanceIntervalDays'), '90');
  const active = [{ value: 'c1', label: 'C1 - Thiết bị' }];
  assert.equal(withCurrentOption(active, 'c1', 'Thiết bị'), active);
  assert.equal(withCurrentOption(active, '', ''), active);
  assert.deepEqual(withCurrentOption(active, 'c0', 'Nhóm cũ').at(-1), { value: 'c0', label: 'Nhóm cũ (đã ngưng)' });
  assert.match(catalogError({ status: 400, details: { message: 'Items sold through a storefront variant must keep the variant unit' } }), /sản phẩm cửa hàng/);
  assert.match(catalogError({ status: 409, details: { message: 'Tracking mode cannot change after inventory data exists' } }), /cách theo dõi/);
});

test('catalogError maps API failures to Vietnamese messages', () => {
  assert.match(catalogError({ status: 409 }), /Mã đã tồn tại/);
  assert.match(catalogError({ status: 409, details: { message: 'Location still holds assets; transfer them to another location first' } }), /đang chứa tài sản/);
  assert.match(catalogError({ status: 403 }), /không có quyền/);
  assert.equal(
    catalogError({ status: 400, details: { message: ['email must be an email'] } }),
    'Dữ liệu không hợp lệ: email must be an email',
  );
  assert.match(catalogError(new Error('boom')), /Không thể xử lý/);
});

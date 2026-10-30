import assert from 'node:assert/strict';
import test from 'node:test';

import { canWriteCatalog, catalogError, catalogPayload } from './catalog.logic.ts';

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

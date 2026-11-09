import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRoleName } from './types/dashboard.ts';

test('formatRoleName formats known farm roles into friendly Vietnamese labels', () => {
  assert.equal(formatRoleName('ADMIN'), 'Quản trị viên hệ thống');
  assert.equal(formatRoleName('FARM_OWNER'), 'Chủ trang trại');
  assert.equal(formatRoleName('WAREHOUSE_MANAGER'), 'Quản lý kho');
  assert.equal(formatRoleName('STORE_MANAGER'), 'Quản lý cửa hàng');
  assert.equal(formatRoleName('EMPLOYEE'), 'Nhân viên vận hành');
  assert.equal(formatRoleName('MAINTENANCE_STAFF'), 'Kỹ thuật bảo trì');
  assert.equal(formatRoleName('DELIVERY_STAFF'), 'Nhân viên giao nhận');
});

test('formatRoleName falls back gracefully for unknown or undefined roles', () => {
  assert.equal(formatRoleName(undefined), 'Nhân viên');
  assert.equal(formatRoleName(''), 'Nhân viên');
  assert.equal(formatRoleName('CUSTOM_ROLE'), 'CUSTOM_ROLE');
});


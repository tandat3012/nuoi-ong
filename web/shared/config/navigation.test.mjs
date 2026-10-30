import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNavigationItemVisible, primaryNavigationSections } from './navigation.ts';

const item = (href) =>
  primaryNavigationSections.flatMap((s) => s.items).find((i) => i.href === href);
const access = (overrides = {}) => ({
  canManageFarm: true,
  canManageOrders: true,
  isStoreFarm: true,
  ...overrides,
});

test('store screens are hidden on farms that do not own the store', () => {
  for (const href of ['/store-products', '/store-orders', '/store-reports']) {
    assert.equal(isNavigationItemVisible(item(href), access()), true, href);
    assert.equal(isNavigationItemVisible(item(href), access({ isStoreFarm: false })), false, href);
  }
  assert.equal(isNavigationItemVisible(item('/inventory'), access({ isStoreFarm: false })), true);
});

test('orders need an order role; reports need a manager role', () => {
  assert.equal(isNavigationItemVisible(item('/store-orders'), access({ canManageFarm: false })), true);
  assert.equal(isNavigationItemVisible(item('/store-orders'), access({ canManageOrders: false })), false);
  assert.equal(isNavigationItemVisible(item('/store-reports'), access({ canManageFarm: false })), false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findNavigationItem, isNavigationItemAllowed, isNavigationItemVisible, primaryNavigationSections } from './navigation.ts';

const item = (href) =>
  primaryNavigationSections.flatMap((s) => s.items).find((i) => i.href === href);
const access = (overrides = {}) => ({
  canManageFarm: true,
  canManageStore: true,
  canDeliver: true,
  canAccessFarmArea: true,
  canViewHistory: true,
  isStoreFarm: true,
  ...overrides,
});

test('order screens are hidden on farms that do not sell online; products stay for setup', () => {
  for (const href of ['/store-orders', '/store-payments', '/store-reports']) {
    assert.equal(isNavigationItemVisible(item(href), access()), true, href);
    assert.equal(isNavigationItemVisible(item(href), access({ isStoreFarm: false })), false, href);
  }
  for (const href of ['/store-products', '/inventory'])
    assert.equal(isNavigationItemVisible(item(href), access({ isStoreFarm: false })), true, href);
});

test('store screens need a store role; farm-area screens hide from store-only managers', () => {
  const storeOnly = access({ canManageFarm: false, canAccessFarmArea: false });
  for (const href of ['/store-products', '/store-orders', '/store-reports'])
    assert.equal(isNavigationItemVisible(item(href), storeOnly), true, href);
  for (const href of ['/inventory', '/receipts', '/assets', '/materials', '/catalog', '/personnel'])
    assert.equal(isNavigationItemVisible(item(href), storeOnly), false, href);
  assert.equal(isNavigationItemVisible(item('/store-orders'), access({ canManageStore: false })), false);
});

test('direct routes resolve to their navigation item', () => {
  assert.equal(findNavigationItem('/receipts/abc')?.href, '/receipts');
  assert.equal(findNavigationItem('/receipts-x'), undefined);
  assert.equal(findNavigationItem('/dashboard'), undefined);
  assert.equal(isNavigationItemAllowed(item('/store-orders'), access({ isStoreFarm: false })), true);
});

test('delivery staff see only the delivery screen of the store section', () => {
  const shipper = access({ canManageFarm: false, canManageStore: false, canAccessFarmArea: false, canViewHistory: false });
  assert.equal(isNavigationItemVisible(item('/deliveries'), shipper), true);
  assert.equal(isNavigationItemVisible(item('/deliveries'), { ...shipper, isStoreFarm: false }), false);
  for (const href of ['/store-orders', '/store-products', '/inventory'])
    assert.equal(isNavigationItemVisible(item(href), shipper), false, href);
  assert.equal(isNavigationItemVisible(item('/deliveries'), access({ canDeliver: false })), false);
});

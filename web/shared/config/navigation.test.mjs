import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findNavigationItem, isNavigationItemAllowed, isNavigationItemVisible, primaryNavigationSections } from './navigation.ts';

const item = (href) =>
  primaryNavigationSections.flatMap((s) => s.items).find((i) => i.href === href);
const access = (overrides = {}) => ({
  canManageFarm: true,
  canManageStore: true,
  canAccessFarmArea: true,
  canViewHistory: true,
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

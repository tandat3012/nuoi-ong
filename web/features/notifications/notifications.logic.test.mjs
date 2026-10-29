import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notificationBadgeText, notificationErrorMessage, notificationHref,
  notificationTargetsCurrentPage,
} from './notifications.logic.ts';

const targets = [
  ['STOCK_RECEIPT', '/receipts?id='],
  ['STOCK_ISSUE', '/issues/'],
  ['STOCK_TRANSFER', '/transfers?id='],
  ['STOCK_COUNT', '/counts?id='],
  ['MAINTENANCE_REQUEST', '/requests?type=maintenance&id='],
  ['ASSET_TRANSFER_REQUEST', '/requests?type=transfer&id='],
];

for (const [type, prefix] of targets) {
  test(`notificationHref maps ${type} and encodes its ID`, () => {
    assert.equal(notificationHref(type, 'document-1'), `${prefix}document-1`);
    assert.equal(notificationHref(type, 'a/b?x=1&name=Đ #+%'),
      `${prefix}a%2Fb%3Fx%3D1%26name%3D%C4%90%20%23%2B%25`);
  });
}

test('unknown types and missing IDs do not navigate', () => {
  for (const type of ['UNKNOWN', 'toString', '__proto__', '', null, undefined]) {
    assert.equal(notificationHref(type, 'document-1'), null);
  }
  for (const [type] of targets) {
    for (const id of ['', null, undefined]) assert.equal(notificationHref(type, id), null);
  }
});

test('notifications refresh the current target page even when its ID or query changes', () => {
  for (const [type] of targets) {
    const href = notificationHref(type, '123e4567-e89b-42d3-a456-426614174000');
    const pathname = href.split('?')[0];
    assert.equal(notificationTargetsCurrentPage(pathname, href), true, type);
    assert.equal(notificationTargetsCurrentPage(pathname, `${href}${href.includes('?') ? '&' : '?'}page=2&status=ALL`), true, type);
    assert.equal(notificationTargetsCurrentPage('/dashboard', href), false, type);
  }
  assert.equal(notificationTargetsCurrentPage('/requests', '/requests?type=transfer&id=other'), true);
  assert.equal(notificationTargetsCurrentPage('/requests', '/requests?type=maintenance&id=other'), true);
  assert.equal(notificationTargetsCurrentPage('/receipts', '/transfers?id=other'), false);
});

test('badge hides zero and caps only the displayed count at 99+', () => {
  for (const count of [0, -1]) assert.equal(notificationBadgeText(count), null);
  for (const count of [1, 9, 10, 98, 99]) assert.equal(notificationBadgeText(count), String(count));
  for (const count of [100, 101, 1000]) assert.equal(notificationBadgeText(count), '99+');
});

test('notification errors explain auth, farm scope, invalid data and conflict reasons in Vietnamese', () => {
  assert.match(notificationErrorMessage(401, 'Unauthorized'), /Phiên đăng nhập đã hết hạn/);
  assert.match(notificationErrorMessage(403, 'Forbidden'), /không có quyền/);
  assert.match(notificationErrorMessage(404, 'Notification not found'), /không tồn tại hoặc không thuộc trang trại/);
  assert.equal(notificationErrorMessage(409, 'Đã được xử lý'), 'Trạng thái thông báo đã thay đổi: Đã được xử lý');
  assert.equal(notificationErrorMessage(400, 'farmId không hợp lệ'), 'Dữ liệu không hợp lệ: farmId không hợp lệ');
  for (const status of [null, 0, 500]) {
    assert.equal(notificationErrorMessage(status, 'Internal error'), 'Không tải được thông báo');
  }
});

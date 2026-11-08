import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notificationBadgeText,
  notificationBodyText,
  notificationDocumentCode,
  notificationErrorMessage,
  notificationHref,
  notificationTargetsCurrentPage,
} from './notifications.logic.ts';

const targets = [
  ['STOCK_RECEIPT', '/receipts?id='],
  ['STOCK_ISSUE', '/issues/'],
  ['STOCK_TRANSFER', '/transfers?id='],
  ['STOCK_COUNT', '/counts?id='],
  ['MAINTENANCE_RECORD', '/maintenance?id='],
  ['MAINTENANCE_RETURN', '/maintenance?id='],
  ['MAINTENANCE_ASSET', '/assets/'],
  ['MAINTENANCE_REQUEST', '/requests?type=maintenance&id='],
  ['ASSET_TRANSFER_REQUEST', '/requests?type=transfer&id='],
  ['ASSET', '/assets/'],
  ['PERSONNEL', '/personnel/'],
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

test('formats notification document codes with PN, PX, KK, CK, MNT, ATR, BT prefixes and actual document id', () => {
  const id = '8d049163-1111-4222-8333-444444444444';
  assert.equal(notificationDocumentCode({ entityType: 'STOCK_RECEIPT', entityId: id, data: { documentCode: null } }), 'PN-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'STOCK_ISSUE', entityId: id, data: { documentCode: null } }), 'PX-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'STOCK_COUNT', entityId: id, data: { documentCode: null } }), 'KK-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'STOCK_TRANSFER', entityId: id, data: { documentCode: null } }), 'CK-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'MAINTENANCE_REQUEST', entityId: id, data: { documentCode: 'SURV-083' } }), 'MNT-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'ASSET_TRANSFER_REQUEST', entityId: id, data: { documentCode: 'SURV-083' } }), 'ATR-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'MAINTENANCE_RETURN', entityId: id, data: { documentCode: `BT-${id}` } }), 'BT-8d049163');
  assert.equal(notificationDocumentCode({ entityType: 'MAINTENANCE_RECORD', entityId: id, data: { documentCode: `BT-${id}` } }), 'BT-8d049163');
  assert.equal(
    notificationBodyText({
      type: 'MAINTENANCE_RECORD_IN_PROGRESS',
      body: 'Kho đã xuất thiết bị đi sửa',
      entityType: 'MAINTENANCE_RECORD',
      entityId: id,
      data: { documentType: 'MAINTENANCE_RECORD', documentId: id, status: 'IN_PROGRESS' },
    }),
    'Hồ sơ bảo trì BT-8d049163 đã được kho xác nhận xuất đi sửa, chờ nhận lại thiết bị.',
  );
  assert.equal(notificationDocumentCode({ entityType: 'STOCK_RECEIPT', entityId: id, data: { documentCode: 'PN-2026-000001' } }), 'PN-8d049163');
  assert.equal(
    notificationBodyText({
      type: 'STOCK_RECEIPT_PENDING_APPROVAL',
      body: 'Phiếu nhập kho đang chờ duyệt.',
      entityType: 'STOCK_RECEIPT',
      entityId: id,
      data: { documentType: 'STOCK_RECEIPT', documentId: id, documentCode: null, status: 'PENDING_APPROVAL' },
    }),
    'Phiếu nhập kho PN-8d049163 đang chờ duyệt.',
  );
});

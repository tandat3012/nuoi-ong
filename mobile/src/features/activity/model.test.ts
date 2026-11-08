import { describe, expect, it } from '@jest/globals';
import type { AuditLog } from './api';
import { actionLabel, entityLabel, formatValue, getStatus, recordLabel, relatedRecordRoute, snapshotChanges, snapshotEntries } from './model';

const log: AuditLog = {
  id: 'log-1', farmId: 'farm-1', userId: null, actor: null, createdAt: '2026-10-14T09:00:00Z',
  action: 'REJECT', entityType: 'stock_issue', entityId: 'issue-1', oldData: null, newData: null,
};
describe('Audit history presentation', () => {
  it('handles seeded lower-case entity types and opens an existing issue, never a new form', () => {
    expect(entityLabel('stock_issue')).toBe('Phiếu xuất kho');
    expect(relatedRecordRoute(log)).toBe('/receipts/issue-1?type=issue');
    expect(relatedRecordRoute({ ...log, entityType: 'stock_transfer' })).toBe('/activity/record?type=STOCK_TRANSFER&id=issue-1');
    expect(entityLabel('asset_transfer_request')).toBe('Yêu cầu chuyển tài sản');
    expect(relatedRecordRoute({ ...log, entityType: 'asset_transfer_request' })).toBe('/assets/transfer-requests/issue-1');
  });
  it('does not invent a diff when a snapshot was not stored', () => {
    expect(snapshotChanges(null, { status: 'CONFIRMED' })).toBeNull();
    expect(snapshotChanges({ status: 'DRAFT' }, null)).toBeNull();
  });
  it('reads document snapshots without borrowing the status of line items', () => {
    const newData = { issue: { status: 'REJECTED', issue_code: 'PX-001' }, items: [{ status: 'ACTIVE' }] };
    expect(getStatus(newData)).toBe('REJECTED');
    expect(recordLabel({ ...log, newData })).toBe('PX-001');
    expect(getStatus({ items: [{ status: 'ACTIVE' }] })).toBeNull();
  });
  it('compares nested fields independent of key order or SQL/JS naming', () => {
    expect(snapshotChanges({ rejection_reason: null, items: [{ item_id: 'a', quantity: 3 }] },
      { items: [{ quantity: 2, itemId: 'a' }], rejectionReason: 'Kho đóng cửa' })).toEqual([
      { path: 'rejectionReason', label: 'Lý do từ chối', before: null, after: 'Kho đóng cửa' },
      { path: 'items.0.quantity', label: 'Danh sách vật tư / Mục 1 / Số lượng', before: 3, after: 2 },
    ]);
  });
  it('distinguishes absent fields, null, zero, false and empty strings', () => {
    expect(snapshotChanges({ note: null }, {})).toEqual([{ path: 'note', label: 'Ghi chú', before: null, after: undefined }]);
    expect(snapshotEntries({ quantity: 0, active: false, note: '' })).toHaveLength(3);
    expect(formatValue(0, 'quantity')).toBe('0');
    expect(formatValue(false, 'active')).toBe('Không');
    expect(formatValue('', 'note')).toBe('(Trống)');
    expect(formatValue(null, 'note')).not.toBe(formatValue(undefined, 'note'));
  });
  it('does not mistake reordered receipt lines for quantity changes', () => {
    const a = { id: 'line-a', item_name: 'Mật ong', quantity: '10' };
    const b = { id: 'line-b', item_name: 'Găng tay', quantity: '2' };
    expect(snapshotChanges({ items: [a, b] }, { items: [b, a] })).toEqual([]);
    expect(snapshotChanges({ items: [a, b] }, { items: [b, { ...a, quantity: '9' }] })).toEqual([
      { path: 'items.@line-a.quantity', label: 'Danh sách vật tư / Mật ong / Số lượng', before: '10', after: '9' },
    ]);
  });
  it('keeps snapshots available but does not link deleted or unsupported records', () => {
    expect(relatedRecordRoute({ ...log, action: 'delete' })).toBeNull();
    expect(relatedRecordRoute({ ...log, entityId: null })).toBeNull();
    expect(relatedRecordRoute({ ...log, entityType: 'INVENTORY' })).toBeNull();
    expect(relatedRecordRoute({ ...log, entityType: 'INVENTORY', newData: { item_id: 'a', warehouse_id: 'b', lot_id: 'c' } }))
      .toBe('/inventory-detail?itemId=a&warehouseId=b&lotId=c');
  });
  it('uses the farm name only when the snapshot matches the selected farm', () => {
    expect(formatValue('farm-1', 'farmId', { id: 'farm-1', name: 'Trại A' })).toBe('Trại A');
    expect(formatValue('farm-2', 'farmId', { id: 'farm-1', name: 'Trại A' })).toBe('farm-2');
    expect(entityLabel('STORE_ORDER')).toBe('Đơn hàng');
    expect(entityLabel('STORE_SHIPPING_FEES')).toBe('Phí giao hàng');
    expect(actionLabel('DELIVERY_CLAIM')).toBe('Nhận giao đơn');
    expect(actionLabel('DELIVERY_RETURN')).toBe('Trả đơn giao');
    expect(actionLabel('DELIVERY_COMPLETE')).toBe('Giao xong đơn');
    expect(actionLabel('SHIPPING_FEES_UPDATED')).toBe('Sửa phí giao hàng');
    expect(recordLabel({ ...log, entityType: 'STORE_ORDER', newData: { code: 'DH000123' } })).toBe('DH000123');
    expect(recordLabel({ ...log, entityType: 'STORE_SHIPPING_FEES', entityId: null })).toBe('Phí giao hàng');
    expect(snapshotChanges({ NORTH: '40000', CENTRAL: '20000', SOUTH: '30000' }, { NORTH: '45000', CENTRAL: '20000', SOUTH: '30000' })).toEqual([
      { path: 'NORTH', label: 'Phí miền Bắc', before: '40000', after: '45000' },
    ]);
  });
});

import { describe, expect, it } from '@jest/globals';
import type { AuditLog } from './api';
import {
  actionLabel,
  entityLabel,
  formatValue,
  getStatus,
  presentSnapshot,
  readableChangeLabel,
  recordLabel,
  relatedRecordRoute,
  snapshotChanges,
  snapshotEntries,
  synthesizeReferences,
  visibleChanges,
} from './model';

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

  it('resolves UUID references, masks unknown UUIDs, and formats enums, dates and VND money', () => {
    const warehouseUuid = '1eb6a938-594a-443c-beb2-d6e981f49c5c';
    const memberUuid = '8f25cfb5-256a-4dd2-babd-ff4fc0d3da69';
    const lotUuid = '22222222-2222-4222-8222-222222222222';
    const locationUuid = '33333333-3333-4333-8333-333333333333';
    const unknownUuid = '44444444-4444-4444-8444-444444444444';
    const refs = {
      [warehouseUuid]: 'KHO-01 — Kho điểm nuôi số 1',
      [memberUuid]: 'Nguyễn Văn An',
      [lotUuid]: 'LO-2026-01',
      [locationUuid]: 'V1 — Kệ thiết bị A',
    };

    expect(formatValue(warehouseUuid, 'warehouseId', { references: refs })).toBe('KHO-01 — Kho điểm nuôi số 1');
    expect(formatValue(memberUuid, 'createdByMemberId', { references: refs })).toBe('Nguyễn Văn An');
    expect(formatValue(lotUuid, 'lotId', { references: refs })).toBe('Lô LO-2026-01');
    expect(
      formatValue(`Đã nhận lại tài sản tại vị trí ${locationUuid}`, 'summary', { references: refs }),
    ).toBe('Đã nhận lại tài sản tại vị trí V1 — Kệ thiết bị A');
    expect(formatValue(unknownUuid, 'warehouseId', { references: refs })).toBe('Chưa xác định');
    expect(formatValue(unknownUuid, 'farmId', { farm: { id: 'farm-1', name: 'Trại A' }, references: refs })).toBe('Trang trại khác');
    expect(formatValue('CONSUMPTION', 'issueType')).toBe('Xuất sử dụng');
    expect(formatValue('AUTO', 'codeSource')).toBe('Hệ thống tự cấp');
    expect(formatValue('RETURN_TO_SOURCE', 'resolution')).toBe('Trả phần thiếu về kho nguồn');
    expect(formatValue('REUSE', 'finalDecision')).toBe('Tiếp tục sử dụng');
    expect(formatValue('2026-11-11', 'receiptDate')).toBe('11/11/2026');
    expect(formatValue('150000', 'unitPrice')).toContain('150.000');
  });

  it('builds a clean visual snapshot without internal surrogate IDs and pairs warehouse transfer routes', () => {
    const receiptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const farmId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const fromWarehouseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const toWarehouseId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const memberId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const itemId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const lotId = '11111111-1111-4111-8111-111111111111';

    const presented = presentSnapshot(
      {
        id: receiptId,
        farmId,
        fromWarehouseId,
        toWarehouseId,
        createdByMemberId: memberId,
        status: 'IN_TRANSIT',
        transferDate: '2026-11-11',
        createdAt: '2026-11-11T09:00:00Z',
        updatedAt: '2026-11-11T09:05:00Z',
        items: [
          {
            id: 'line-1',
            stockTransferId: receiptId,
            itemId,
            lotId,
            systemQuantity: '10',
            actualQuantity: '8',
            difference: '-2',
            unitPrice: '50000',
            discrepancyReason: 'SHRINKAGE',
            unitSymbol: 'cái',
          },
        ],
      },
      {
        farm: { id: farmId, name: 'Trại Mộc Ong' },
        references: {
          [fromWarehouseId]: 'KHO-01 — Kho trung tâm',
          [toWarehouseId]: 'KHO-02 — Kho điểm nuôi 1',
          [memberId]: 'Trần Bình',
          [itemId]: 'EQ-001 — Bẫy bọ cánh cứng',
          [lotId]: 'LO-009',
        },
      },
    );

    expect(presented.warehouseRoute).toEqual({
      from: 'KHO-01 — Kho trung tâm',
      to: 'KHO-02 — Kho điểm nuôi 1',
    });
    expect(presented.fields[0]).toEqual({
      key: 'status',
      label: 'Trạng thái',
      value: 'Đang chuyển',
      kind: 'status',
      statusTone: 'amber',
    });
    expect(presented.fields.some((f) => f.key === 'id' || f.key === 'farmId' || f.key === 'fromWarehouseId')).toBe(false);
    expect(presented.fields.find((f) => f.key === 'createdByMemberId')?.value).toBe('Trần Bình');
    expect(presented.fields.find((f) => f.key === 'transferDate')?.value).toBe('11/11/2026');
    expect(presented.items).toHaveLength(1);
    expect(presented.items[0].title).toBe('EQ-001 — Bẫy bọ cánh cứng');
    expect(presented.items[0].metrics.map((m) => m.label)).toEqual(['Hệ thống', 'Thực tế', 'Chênh lệch', 'Đơn giá']);
    expect(presented.items[0].metrics[2]).toEqual({ label: 'Chênh lệch', value: '-2 cái', tone: 'danger' });
    expect(presented.items[0].details).toEqual([
      { label: 'Lô', value: 'Lô LO-009' },
      { label: 'Lý do lệch', value: 'Hao hụt' },
    ]);
  });

  it('synthesizes references across wrapped related records and enriches diff item labels', () => {
    const assetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const itemId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const locationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const synthesized = synthesizeReferences({
      asset: {
        id: assetId,
        assetCode: 'TS-009',
        itemId,
        currentLocationId: locationId,
        qrToken: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
      itemCode: 'EQ-008',
      itemName: 'Đáy nhựa Hive Doctor',
      locationCode: 'K1-A1',
      locationName: 'Kệ A1',
    });

    expect(synthesized[assetId]).toBe('TS-009');
    expect(synthesized[itemId]).toBe('EQ-008 — Đáy nhựa Hive Doctor');
    expect(synthesized[locationId]).toBe('K1-A1 — Kệ A1');

    const presentedAsset = presentSnapshot(
      {
        asset: {
          id: assetId,
          assetCode: 'TS-009',
          itemId,
          currentLocationId: locationId,
          qrToken: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          status: 'AVAILABLE',
        },
        itemCode: 'EQ-008',
        itemName: 'Đáy nhựa Hive Doctor',
        locationCode: 'K1-A1',
        locationName: 'Kệ A1',
      },
      { references: synthesized },
    );
    expect(presentedAsset.fields.map((f) => f.key)).not.toContain('qrToken');
    expect(presentedAsset.fields.map((f) => f.key)).not.toContain('itemName');
    expect(presentedAsset.fields.find((f) => f.key === 'itemId')?.value).toBe('EQ-008 — Đáy nhựa Hive Doctor');
    expect(presentedAsset.fields.find((f) => f.key === 'currentLocationId')?.value).toBe('K1-A1 — Kệ A1');

    const diffChanges = snapshotChanges(
      { status: 'DRAFT', updatedAt: '2026-11-11T08:00:00Z', items: [{ id: 'line-1', itemId, quantity: '2' }] },
      { status: 'PENDING_APPROVAL', updatedAt: '2026-11-11T09:00:00Z', items: [{ id: 'line-1', itemId, quantity: '5' }] },
    )!;
    const filtered = visibleChanges(diffChanges);
    expect(filtered.map((c) => c.path)).toEqual(['status', 'items.@line-1.quantity']);
    expect(readableChangeLabel(filtered[1], null, { items: [{ id: 'line-1', itemId, quantity: '5' }] }, synthesized)).toBe(
      'Vật tư: EQ-008 — Đáy nhựa Hive Doctor • Số lượng',
    );
    expect(recordLabel({ ...log, entityType: 'ASSET', entityId: assetId }, synthesized)).toBe('TS-009');
  });
});

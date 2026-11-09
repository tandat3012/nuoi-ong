import { describe, expect, it } from '@jest/globals';
import {
  notificationBodyText,
  notificationDocumentCode,
  notificationRoute,
  type AppNotification,
} from './api';

const notification = (entityType: string): AppNotification => ({
  id: 'notification-id', farmId: 'farm-id', type: `${entityType}_CONFIRMED`,
  title: 'Phiếu đã được duyệt', body: 'Đã duyệt',
  data: { documentType: entityType, documentId: 'document-id' },
  entityType, entityId: 'document-id', readAt: null, createdAt: '2026-10-16T12:00:00.000Z',
});

describe('notification detail navigation', () => {
  it.each([
    ['STOCK_RECEIPT', '/receipts/document-id?type=receipt'],
    ['STOCK_ISSUE', '/receipts/document-id?type=issue'],
    ['STOCK_COUNT', '/counts/document-id'],
    ['STOCK_TRANSFER', '/transfers/document-id'],
    ['MAINTENANCE_REQUEST', '/maintenance/requests/document-id'],
    ['ASSET_TRANSFER_REQUEST', '/assets/transfer-requests/document-id'],
  ])('routes %s notifications to their corresponding document detail', (type, route) => {
    expect(notificationRoute(notification(type))).toBe(route);
  });

  it('supports missing entity metadata and unsupported notification kinds', () => {
    expect(notificationRoute({ ...notification('OTHER'), entityId: null, data: null })).toBeNull();
    expect(notificationRoute(notification('OTHER'))).toBeNull();
  });

  it('formats notification document codes with PN, PX, KK, CK, MNT, ATR, BT prefixes and actual document id', () => {
    const id = '8d049163-1111-4222-8333-444444444444';
    const withType = (entityType: string, documentCode: string | null = null, status = 'PENDING_APPROVAL'): AppNotification => ({
      ...notification(entityType),
      type: `${entityType}_${status}`,
      entityId: id,
      data: { documentType: entityType, documentId: id, documentCode, status },
    });

    expect(notificationDocumentCode(withType('STOCK_RECEIPT'))).toBe('PN-8d049163');
    expect(notificationDocumentCode(withType('STOCK_ISSUE'))).toBe('PX-8d049163');
    expect(notificationDocumentCode(withType('STOCK_COUNT'))).toBe('KK-8d049163');
    expect(notificationDocumentCode(withType('STOCK_TRANSFER'))).toBe('CK-8d049163');
    expect(notificationDocumentCode(withType('MAINTENANCE_REQUEST', 'SURV-083'))).toBe('MNT-8d049163');
    expect(notificationDocumentCode(withType('ASSET_TRANSFER_REQUEST', 'SURV-083'))).toBe('ATR-8d049163');
    expect(notificationDocumentCode(withType('MAINTENANCE_RETURN', `BT-${id}`))).toBe('BT-8d049163');
    expect(notificationDocumentCode(withType('MAINTENANCE_RECORD', `BT-${id}`, 'IN_PROGRESS'))).toBe('BT-8d049163');
    expect(notificationBodyText(withType('MAINTENANCE_RECORD', `BT-${id}`, 'IN_PROGRESS'))).toBe('Hồ sơ bảo trì BT-8d049163 đã được kho xác nhận xuất đi sửa, chờ nhận lại thiết bị.');
    expect(notificationDocumentCode(withType('STOCK_RECEIPT', 'PN-2026-000001', 'CONFIRMED'))).toBe('PN-8d049163');
    expect(notificationBodyText(withType('STOCK_RECEIPT', 'PN-2026-000001', 'CONFIRMED'))).toBe('Phiếu nhập kho PN-8d049163 đã được duyệt.');
    expect(notificationBodyText(withType('STOCK_RECEIPT'))).toBe('Phiếu nhập kho PN-8d049163 đang chờ duyệt.');
    expect(notificationBodyText(withType('STOCK_ISSUE'))).toBe('Phiếu xuất kho PX-8d049163 đang chờ duyệt.');
  });
});

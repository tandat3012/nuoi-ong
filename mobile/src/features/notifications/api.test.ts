import { describe, expect, it } from '@jest/globals';
import { notificationRoute, type AppNotification } from './api';

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
  ])('routes %s notifications to their corresponding document detail', (type, route) => {
    expect(notificationRoute(notification(type))).toBe(route);
  });

  it('supports missing entity metadata and unsupported notification kinds', () => {
    expect(notificationRoute({ ...notification('OTHER'), entityId: null, data: null })).toBeNull();
    expect(notificationRoute(notification('OTHER'))).toBeNull();
  });
});

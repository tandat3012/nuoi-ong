import { describe, expect, it } from '@jest/globals';
import { recentDocumentRoute } from './dashboard.logic';

describe('dashboard.logic', () => {
  it('builds detail routes for recent receipt, issue, transfer, count, and maintenance items', () => {
    expect(recentDocumentRoute('RECEIPT', 'rec-1')).toBe('/receipts/rec-1?type=receipt');
    expect(recentDocumentRoute('ISSUE', 'iss-1')).toBe('/receipts/iss-1?type=issue');
    expect(recentDocumentRoute('TRANSFER', 'trf-1')).toBe('/transfers/trf-1');
    expect(recentDocumentRoute('COUNT', 'cnt-1')).toBe('/counts/cnt-1');
    expect(recentDocumentRoute('MAINTENANCE', 'mnt-1')).toBe('/maintenance/requests/mnt-1');
  });

  it('encodes special characters and returns null for missing or blank document ids', () => {
    expect(recentDocumentRoute('RECEIPT', 'id with/space')).toBe('/receipts/id%20with%2Fspace?type=receipt');
    expect(recentDocumentRoute('RECEIPT', '  rec-2  ')).toBe('/receipts/rec-2?type=receipt');
    expect(recentDocumentRoute('RECEIPT', '')).toBeNull();
    expect(recentDocumentRoute('ISSUE', '   ')).toBeNull();
    expect(recentDocumentRoute('TRANSFER', null)).toBeNull();
    expect(recentDocumentRoute('TRANSFER', undefined)).toBeNull();
  });
});

import { describe, expect, it } from '@jest/globals';
import {
  firstRouteParam,
  isReceiptDocumentEditable,
  isStockCountEditable,
  navigateToReceiptList,
  normalizeReceiptListFilter,
} from './receipt-list.logic';

describe('receipt-list.logic', () => {
  it('extracts trimmed first route param value', () => {
    expect(firstRouteParam(undefined)).toBeUndefined();
    expect(firstRouteParam('   ')).toBeUndefined();
    expect(firstRouteParam('COUNT')).toBe('COUNT');
    expect(firstRouteParam(['TRANSFER', 'OTHER'])).toBe('TRANSFER');
  });

  it('normalizes valid receipt list tab params case-insensitively', () => {
    expect(normalizeReceiptListFilter('COUNT')).toBe('COUNT');
    expect(normalizeReceiptListFilter('receipt')).toBe('RECEIPT');
    expect(normalizeReceiptListFilter('issue')).toBe('ISSUE');
    expect(normalizeReceiptListFilter(['transfer'])).toBe('TRANSFER');
    expect(normalizeReceiptListFilter('MAINTENANCE')).toBe('MAINTENANCE');
  });

  it('falls back to MAINTENANCE when maintenanceAssetId is set and tab is missing or invalid', () => {
    expect(normalizeReceiptListFilter(undefined, 'asset-1')).toBe('MAINTENANCE');
    expect(normalizeReceiptListFilter('UNKNOWN', 'asset-1')).toBe('MAINTENANCE');
  });

  it('prefers explicit valid tab over maintenanceAssetId and defaults to RECEIPT', () => {
    expect(normalizeReceiptListFilter('COUNT', 'asset-1')).toBe('COUNT');
    expect(normalizeReceiptListFilter(undefined, undefined)).toBe('RECEIPT');
    expect(normalizeReceiptListFilter('INVALID', null)).toBe('RECEIPT');
  });

  it('enforces editable lock for stock receipts/issues after leaving DRAFT or on error/loading', () => {
    expect(isReceiptDocumentEditable(false, null, 'DRAFT')).toBe(true);
    expect(isReceiptDocumentEditable(true, null, 'DRAFT')).toBe(false);
    expect(isReceiptDocumentEditable(false, 'Load failed', 'DRAFT')).toBe(false);
    expect(isReceiptDocumentEditable(false, null, 'PENDING_APPROVAL')).toBe(false);
    expect(isReceiptDocumentEditable(false, null, 'CONFIRMED')).toBe(false);
    expect(isReceiptDocumentEditable(false, null, 'REJECTED')).toBe(false);
    expect(isReceiptDocumentEditable(false, null, 'CANCELLED')).toBe(false);
  });

  it('enforces editable lock for stock counts after leaving DRAFT/COUNTING or on error/loading', () => {
    expect(isStockCountEditable(false, null, 'DRAFT')).toBe(true);
    expect(isStockCountEditable(false, null, 'COUNTING')).toBe(true);
    expect(isStockCountEditable(true, null, 'DRAFT')).toBe(false);
    expect(isStockCountEditable(false, 'Network error', 'COUNTING')).toBe(false);
    expect(isStockCountEditable(false, null, 'PENDING_APPROVAL')).toBe(false);
    expect(isStockCountEditable(false, null, 'CONFIRMED')).toBe(false);
    expect(isStockCountEditable(false, null, 'REJECTED')).toBe(false);
    expect(isStockCountEditable(false, null, 'CANCELLED')).toBe(false);
  });

  it('navigates back to existing receipt list screen when present in stack, otherwise replaces', () => {
    const calls: string[] = [];
    const router = {
      navigate: (href: never) => calls.push(`navigate:${String(href)}`),
      replace: (href: never) => calls.push(`replace:${String(href)}`),
    };

    navigateToReceiptList(
      router,
      { getState: () => ({ routes: [{ name: 'dashboard' }, { name: 'receipts/index' }, { name: 'transfers/new' }] }) },
      'TRANSFER',
    );
    navigateToReceiptList(
      router,
      { getState: () => ({ routes: [{ name: 'dashboard' }, { name: 'counts/new' }] }) },
      'COUNT',
    );

    expect(calls).toEqual([
      'navigate:/receipts?tab=TRANSFER',
      'replace:/receipts?tab=COUNT',
    ]);
  });
});

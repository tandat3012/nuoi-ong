import { describe, expect, it } from '@jest/globals';
import { formatStockDateInput, parseStockDateRange, toDisplayDate } from './stock-date-range';

describe('stock date range', () => {
  it('converts two inclusive Vietnamese calendar dates to API dates', () => {
    expect(parseStockDateRange('01/10/2026', '31/10/2026')).toEqual({ range: { dateFrom: '2026-10-01', dateTo: '2026-10-31' } });
    expect(toDisplayDate('2026-10-31')).toBe('31/10/2026');
    expect(formatStockDateInput('31102026')).toBe('31/10/2026');
  });
  it('allows one-sided and cleared filters', () => {
    expect(parseStockDateRange('29/02/2024', '')).toEqual({ range: { dateFrom: '2024-02-29', dateTo: undefined } });
    expect(parseStockDateRange('', '01/11/2026')).toEqual({ range: { dateFrom: undefined, dateTo: '2026-11-01' } });
    expect(parseStockDateRange('', '')).toEqual({ range: { dateFrom: undefined, dateTo: undefined } });
    expect(parseStockDateRange('01/11/2026', '01/11/2026')).toEqual({ range: { dateFrom: '2026-11-01', dateTo: '2026-11-01' } });
  });
  it('blocks impossible and reversed dates before requesting', () => {
    expect(parseStockDateRange('30/02/2026', '').error).toBeTruthy();
    expect(parseStockDateRange('2026-10-01', '').error).toBeTruthy();
    expect(parseStockDateRange('02/11/2026', '01/11/2026').error).toBeTruthy();
  });
});

import { describe, expect, it } from '@jest/globals';
import { receiptItemsPayload } from './receipt-payload';

describe('receipt lot payload', () => {
  it('allows a new lot without a printed number and never sends an internal code', () => {
    expect(receiptItemsPayload([{ itemId: 'item', quantity: 2 }])).toEqual([{ itemId: 'item', quantity: '2', lineId: undefined, lotId: undefined, supplierLotNumber: undefined, manufacturedDate: undefined, expiryDate: undefined, assetCode: undefined, serialNumber: undefined }]);
  });

  it('sends only lotId for an existing lot while retaining its saved line identity', () => {
    expect(receiptItemsPayload([{ itemId: 'item', quantity: 3, lineId: 'line', lotId: 'lot', supplierLotNumber: 'OLD', manufacturedDate: '2026-01-01', expiryDate: '2027-01-01' }])).toEqual([expect.objectContaining({ lineId: 'line', lotId: 'lot', supplierLotNumber: undefined, manufacturedDate: undefined, expiryDate: undefined })]);
  });

  it('keeps the printed number for a new lot even if another line has the same value', () => {
    expect(receiptItemsPayload([{ itemId: 'item', quantity: 1, supplierLotNumber: ' 001 ' }, { itemId: 'item', quantity: 1, supplierLotNumber: '001' }]).map((item) => item.supplierLotNumber)).toEqual(['001', '001']);
  });

  it('keeps the saved line ID when resaving a new-lot draft without turning legacy data into a supplier number', () => {
    const [item] = receiptItemsPayload([{ itemId: 'item', quantity: 1, lineId: 'old-line' }]);
    expect(item.lineId).toBe('old-line');
    expect(item.supplierLotNumber).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain('lotNumber');
  });
});

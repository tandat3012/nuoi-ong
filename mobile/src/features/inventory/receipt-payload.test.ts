import { describe, expect, it } from '@jest/globals';
import { receiptItemsPayload } from './receipt-payload';

describe('receipt lot payload', () => {
  it('allows a new lot without a printed number and never sends an internal code', () => {
    expect(receiptItemsPayload([{ itemId: 'item', quantity: 2 }])).toEqual([
      {
        itemId: 'item',
        quantity: '2',
        lineId: undefined,
        lotId: undefined,
        supplierLotNumber: undefined,
        manufacturedDate: undefined,
        expiryDate: undefined,
        assetCode: undefined,
        serialNumber: undefined,
        locationId: undefined,
      },
    ]);
  });

  it('sends only lotId for an existing lot while retaining its saved line identity', () => {
    expect(
      receiptItemsPayload([
        {
          itemId: 'item',
          quantity: 3,
          lineId: 'line',
          lotId: 'lot',
          supplierLotNumber: 'OLD',
          manufacturedDate: '2026-01-01',
          expiryDate: '2027-01-01',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        lineId: 'line',
        lotId: 'lot',
        supplierLotNumber: undefined,
        manufacturedDate: undefined,
        expiryDate: undefined,
      }),
    ]);
  });

  it('keeps the printed number for a new lot even if another line has the same value', () => {
    expect(
      receiptItemsPayload([
        { itemId: 'item', quantity: 1, supplierLotNumber: ' 001 ' },
        { itemId: 'item', quantity: 1, supplierLotNumber: '001' },
      ]).map((item) => item.supplierLotNumber),
    ).toEqual(['001', '001']);
  });

  it('keeps the saved line ID when resaving a new-lot draft without turning legacy data into a supplier number', () => {
    const [item] = receiptItemsPayload([{ itemId: 'item', quantity: 1, lineId: 'old-line' }]);
    expect(item.lineId).toBe('old-line');
    expect(item.supplierLotNumber).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain('lotNumber');
  });

  it('sends locationId for ASSET lines and retains it when resaving a draft, while omitting it on QUANTITY/LOT lines', () => {
    const payload = receiptItemsPayload([
      {
        itemId: 'asset-item',
        quantity: 1,
        metadata: 'ASSET',
        lineId: 'saved-asset-line',
        assetCode: 'EQ-01-AS-001',
        serialNumber: 'SN-01',
        locationId: 'loc-1',
      },
      {
        itemId: 'qty-item',
        quantity: 5,
        metadata: 'QUANTITY',
        locationId: 'loc-1',
      },
      {
        itemId: 'lot-item',
        quantity: 3,
        metadata: 'LOT',
        lotId: 'lot-1',
        locationId: 'loc-1',
      },
    ]);

    expect(payload[0]).toEqual(
      expect.objectContaining({
        itemId: 'asset-item',
        lineId: 'saved-asset-line',
        assetCode: 'EQ-01-AS-001',
        serialNumber: 'SN-01',
        locationId: 'loc-1',
      }),
    );
    expect(payload[1]?.locationId).toBeUndefined();
    expect(payload[2]?.locationId).toBeUndefined();
  });
});

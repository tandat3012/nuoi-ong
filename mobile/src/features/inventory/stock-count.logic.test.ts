import { describe, expect, it } from '@jest/globals';
import {
  canEditStockCount,
  isAssetCountLine,
  serializeStockCountPayload,
  validateStockCountLines,
} from './stock-count.logic';

describe('stock-count.logic', () => {
  it('determines if stock count line is for an asset', () => {
    expect(isAssetCountLine({ assetId: 'asset-1' })).toBe(true);
    expect(isAssetCountLine({ assetId: null })).toBe(false);
    expect(isAssetCountLine({})).toBe(false);
  });

  it('determines if stock count is editable based on status', () => {
    expect(canEditStockCount('DRAFT')).toBe(true);
    expect(canEditStockCount('COUNTING')).toBe(true);
    expect(canEditStockCount('PENDING_APPROVAL')).toBe(false);
    expect(canEditStockCount('CONFIRMED')).toBe(false);
    expect(canEditStockCount('CANCELLED')).toBe(false);
  });

  it('serializes quantity and lot lines accurately', () => {
    const payload = serializeStockCountPayload([
      { itemId: 'item-1', actualQuantity: '15.5', note: 'Đếm lại' },
      { itemId: 'item-2', lotId: 'lot-1', actualQuantity: 20 },
    ]);
    expect(payload).toEqual([
      { itemId: 'item-1', actualQuantity: '15.5', note: 'Đếm lại' },
      { itemId: 'item-2', lotId: 'lot-1', actualQuantity: '20', note: null },
    ]);
  });

  it('preserves assetId, assetCondition, and foundLocationId for present assets', () => {
    const payload = serializeStockCountPayload([
      {
        itemId: 'item-asset',
        assetId: 'asset-001',
        actualQuantity: '1.000',
        assetCondition: 'DAMAGED',
        foundLocationId: 'loc-123',
        note: 'Bị xước vỏ',
      },
    ]);
    expect(payload).toEqual([
      {
        itemId: 'item-asset',
        assetId: 'asset-001',
        actualQuantity: '1',
        assetCondition: 'DAMAGED',
        foundLocationId: 'loc-123',
        note: 'Bị xước vỏ',
      },
    ]);
  });

  it('strips condition and foundLocationId when an asset is missing (quantity 0)', () => {
    const payload = serializeStockCountPayload([
      {
        itemId: 'item-asset',
        assetId: 'asset-002',
        actualQuantity: '0.000',
        assetCondition: 'GOOD',
        foundLocationId: 'loc-123',
        note: 'Không thấy ở vị trí',
      },
    ]);
    expect(payload).toEqual([
      {
        itemId: 'item-asset',
        assetId: 'asset-002',
        actualQuantity: '0',
        assetCondition: undefined,
        foundLocationId: undefined,
        note: 'Không thấy ở vị trí',
      },
    ]);
  });

  it('validates stock count lines correctly', () => {
    expect(validateStockCountLines([])).toBe('Phiếu phải có ít nhất một dòng kiểm kê.');

    expect(
      validateStockCountLines([{ itemId: '', actualQuantity: 1 }]),
    ).toBe('Dòng 1: Chưa chọn vật tư.');

    expect(
      validateStockCountLines([
        { itemId: 'item-1', assetId: 'asset-1', actualQuantity: 5 },
      ]),
    ).toBe('Dòng 1: Tài sản kiểm kê chỉ ghi 1 (có mặt) hoặc 0 (thiếu).');

    expect(
      validateStockCountLines([
        { itemId: 'item-1', assetId: 'asset-1', actualQuantity: 1, assetCondition: null },
      ]),
    ).toBe('Dòng 1: Cần chọn tình trạng tài sản (Tốt hoặc Hỏng).');

    expect(
      validateStockCountLines([
        { itemId: 'item-1', assetId: 'asset-1', actualQuantity: 1, assetCondition: 'GOOD' },
        { itemId: 'item-2', actualQuantity: 10 },
      ]),
    ).toBeNull();
  });
});

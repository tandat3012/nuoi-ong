import { type LedgerMove, moveKind, valueMoves } from './stock-valuation';

const move = (
  kind: LedgerMove['kind'],
  quantity: number,
  options: Partial<LedgerMove> = {},
): LedgerMove => ({
  warehouseId: 'A',
  itemId: 'sugar',
  kind,
  quantity,
  ownPrice: null,
  transferKey: null,
  ...options,
});

const values = (moves: LedgerMove[]) => valueMoves(moves).map((m) => m.value);

describe('valueMoves', () => {
  it('issues at the moving average', () => {
    expect(
      values([
        move('receipt', 10, { ownPrice: 20_000 }),
        move('receipt', 10, { ownPrice: 25_000 }),
        move('issue', -5),
        move('issue', -15),
      ]),
    ).toEqual([200_000, 250_000, -112_500, -337_500]);
  });

  it('leaves no rounding residue once the stock is gone', () => {
    const result = values([
      move('receipt', 3, { ownPrice: 333.33 }),
      move('issue', -1),
      move('issue', -2),
    ]);
    expect(result).toEqual([1000, -333, -667]);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it('moves the sending warehouse average with a transfer', () => {
    const transfer = { transferKey: 't1' };
    expect(
      values([
        move('receipt', 10, { ownPrice: 1000 }),
        move('receipt', 10, { ownPrice: 2000 }),
        move('receipt', 4, { warehouseId: 'B', ownPrice: 3000 }),
        move('transferOut', -4, transfer),
        move('transferIn', 4, { ...transfer, warehouseId: 'B' }),
        // B: 4 × 3000 + 4 × 1500 = 18000 over 8 units.
        move('issue', -2, { warehouseId: 'B' }),
      ]),
    ).toEqual([10_000, 20_000, 12_000, -6_000, 6_000, -4_500]);
  });

  it('prices moves without their own price from the warehouse, then the farm', () => {
    const result = valueMoves([
      move('adjustmentIn', 2),
      move('receipt', 1, { warehouseId: 'B', ownPrice: 500 }),
      move('adjustmentIn', 2, { warehouseId: 'C' }),
      move('receipt', 1, { warehouseId: 'C', ownPrice: 800 }),
      move('issue', -3, { warehouseId: 'C' }),
      move('assetReturn', 1, { warehouseId: 'C' }),
    ]);
    expect(result).toEqual([
      { value: 0, unpriced: true, unpricedQuantity: 2 },
      { value: 500, unpriced: false, unpricedQuantity: 0 },
      // No average in C yet: the item's latest price in the farm.
      { value: 1000, unpriced: false, unpricedQuantity: 0 },
      { value: 800, unpriced: false, unpricedQuantity: 0 },
      { value: -1800, unpriced: false, unpricedQuantity: 0 },
      // C is empty but keeps its last average.
      { value: 600, unpriced: false, unpricedQuantity: 0 },
    ]);
  });

  it('flags issues from stock that has no value', () => {
    expect(valueMoves([move('adjustmentIn', 2), move('issue', -1)])).toEqual([
      { value: 0, unpriced: true, unpricedQuantity: 2 },
      { value: 0, unpriced: true, unpricedQuantity: -1 },
    ]);
  });

  // NV09-F01: unknown prices are not 0 VND and never pull the average down.
  it('keeps unpriced units out of the average of the priced ones', () => {
    const result = valueMoves([
      move('adjustmentIn', 10),
      move('receipt', 10, { ownPrice: 100 }),
      move('issue', -10),
      move('receipt', 5, { ownPrice: 100 }),
      move('issue', -10),
    ]);
    expect(result).toEqual([
      { value: 0, unpriced: true, unpricedQuantity: 10 },
      { value: 1000, unpriced: false, unpricedQuantity: 0 },
      // Half of the stock leaves: half its value, half of the unpriced units.
      { value: -500, unpriced: true, unpricedQuantity: -5 },
      // The average is still 100 for the priced units.
      { value: 500, unpriced: false, unpricedQuantity: 0 },
      { value: -667, unpriced: true, unpricedQuantity: -3.333 },
    ]);
  });

  it('prices a move without its own price at the priced average', () => {
    expect(
      values([
        move('adjustmentIn', 10),
        move('receipt', 10, { ownPrice: 100 }),
        // Not 50 (1000 VND over 20 units): the 10 unpriced units are unknown, not free.
        move('adjustmentIn', 1),
      ]),
    ).toEqual([0, 1000, 100]);
  });

  it('carries the unpriced part through a transfer', () => {
    const transfer = { transferKey: 't1' };
    expect(
      valueMoves([
        move('adjustmentIn', 2),
        move('receipt', 2, { ownPrice: 1000 }),
        move('transferOut', -4, transfer),
        move('transferIn', 4, { ...transfer, warehouseId: 'B' }),
      ]).slice(2),
    ).toEqual([
      { value: -2000, unpriced: true, unpricedQuantity: -2 },
      { value: 2000, unpriced: true, unpricedQuantity: 2 },
    ]);
  });
});

describe('moveKind', () => {
  it('splits returns and maintenance by source', () => {
    expect(moveKind('RETURN_IN', 'MAINTENANCE_RETURN')).toBe(
      'maintenanceReturn',
    );
    expect(moveKind('RETURN_IN', 'ASSET_RETURN')).toBe('assetReturn');
    expect(moveKind('MAINTENANCE_ISSUE', 'ASSET_MAINTENANCE')).toBe(
      'maintenanceOut',
    );
    expect(moveKind('MAINTENANCE_ISSUE', 'STOCK_ISSUE')).toBe('issue');
    expect(() => moveKind('NEW_TYPE', '')).toThrow();
  });
});

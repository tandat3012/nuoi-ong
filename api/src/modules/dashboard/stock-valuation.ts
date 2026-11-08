/** Report columns a ledger row can fall into; quantities and values per kind are unsigned. */
export const MOVE_KINDS = [
  'receipt',
  'transferIn',
  'adjustmentIn',
  'issue',
  'transferOut',
  'adjustmentOut',
  'assetAssign',
  'assetReturn',
  'maintenanceOut',
  'maintenanceReturn',
] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

export function moveKind(
  transactionType: string,
  sourceType: string,
): MoveKind {
  switch (transactionType) {
    case 'RECEIPT':
      return 'receipt';
    case 'TRANSFER_IN':
      return 'transferIn';
    case 'ADJUSTMENT_IN':
      return 'adjustmentIn';
    case 'TRANSFER_OUT':
      return 'transferOut';
    case 'ADJUSTMENT_OUT':
      return 'adjustmentOut';
    case 'ASSIGNMENT_OUT':
      return 'assetAssign';
    case 'RETURN_IN':
      return sourceType === 'MAINTENANCE_RETURN'
        ? 'maintenanceReturn'
        : 'assetReturn';
    case 'MAINTENANCE_ISSUE':
      // Equipment sent out for repair vs. materials issued for a maintenance job.
      return sourceType === 'ASSET_MAINTENANCE' ? 'maintenanceOut' : 'issue';
    case 'ISSUE':
      return 'issue';
    default:
      throw new Error(`Unknown inventory transaction type ${transactionType}`);
  }
}

export type LedgerMove = {
  warehouseId: string;
  itemId: string;
  kind: MoveKind;
  /** Signed, as in inventory_transactions.quantity_change. */
  quantity: number;
  /** The move's own unit price: its receipt line, or the asset's purchase price. */
  ownPrice: number | null;
  /** Share of the quantity `ownPrice` covers (receipt mixing priced and unpriced lines); default 1. */
  pricedShare?: number;
  /** Same for the outgoing and incoming row of one transfer line, null otherwise. */
  transferKey: string | null;
};

/**
 * `value` is whole VND of the priced part, signed like the quantity.
 * `unpricedQuantity` (signed too) is the part with no known price: never valued
 * as 0 VND, never mixed into the average. `unpriced` = that part is not zero.
 */
export type ValuedMove = {
  value: number;
  unpriced: boolean;
  unpricedQuantity: number;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Moving weighted average per warehouse and item (bình quân gia quyền di động).
 * `moves` must be the farm's whole ledger in order, a transfer's outgoing row
 * before its incoming row.
 *
 * Out moves take their share of the stock: of its value and of its unpriced
 * quantity. In moves bring their own price, else the warehouse's current
 * average, else the item's latest own price in the farm, else stay unpriced;
 * transfers bring what left the sending warehouse. The average is the value
 * over the priced quantity only.
 * shortcut: whole VND in JS numbers, exact below 9e15 VND per stock.
 */
export function valueMoves(moves: LedgerMove[]): ValuedMove[] {
  const stocks = new Map<
    string,
    { quantity: number; priced: number; value: number; unitCost: number | null }
  >();
  const latestPrice = new Map<string, number>();
  const inTransit = new Map<
    string,
    { quantity: number; value: number; unpricedQuantity: number }
  >();
  const result = (value: number, unpricedQuantity: number): ValuedMove => ({
    value: value || 0,
    unpriced: unpricedQuantity !== 0,
    unpricedQuantity: unpricedQuantity || 0,
  });

  return moves.map((move) => {
    const key = `${move.warehouseId}:${move.itemId}`;
    let stock = stocks.get(key);
    if (!stock) {
      stock = { quantity: 0, priced: 0, value: 0, unitCost: null };
      stocks.set(key, stock);
    }

    if (move.quantity < 0) {
      const out = -move.quantity;
      // The last units take whatever is left, so no rounding residue stays behind.
      const all = stock.quantity <= out;
      const share = all ? 1 : out / stock.quantity;
      const priced = Math.max(
        0,
        all
          ? stock.priced
          : Math.min(stock.priced, round3(stock.priced * share)),
      );
      // Value follows the priced units, so no value stays on an unpriced remainder.
      const value =
        all || priced >= stock.priced
          ? stock.value
          : stock.priced > 0
            ? Math.round((stock.value * priced) / stock.priced)
            : 0;
      const unpricedOut = round3(Math.max(0, out - priced));
      stock.quantity = round3(stock.quantity - out);
      stock.priced = stock.quantity > 0 ? round3(stock.priced - priced) : 0;
      stock.value = stock.quantity > 0 ? stock.value - value : 0;
      if (move.transferKey) {
        const transit = inTransit.get(move.transferKey) ?? {
          quantity: 0,
          value: 0,
          unpricedQuantity: 0,
        };
        transit.quantity = round3(transit.quantity + out);
        transit.value += value;
        transit.unpricedQuantity = round3(
          transit.unpricedQuantity + unpricedOut,
        );
        inTransit.set(move.transferKey, transit);
      }
      return result(-value, -unpricedOut);
    }

    const quantity = move.quantity;
    let value: number;
    let unpricedIn: number;
    const transit = move.transferKey
      ? inTransit.get(move.transferKey)
      : undefined;
    // A transfer's incoming row, or what a discrepancy returns to the source.
    if (transit && transit.quantity > 0) {
      const all = quantity >= transit.quantity;
      const share = all ? 1 : quantity / transit.quantity;
      value = all ? transit.value : Math.round(transit.value * share);
      unpricedIn = all
        ? transit.unpricedQuantity
        : round3(transit.unpricedQuantity * share);
      transit.quantity = round3(transit.quantity - quantity);
      transit.value -= value;
      transit.unpricedQuantity = round3(transit.unpricedQuantity - unpricedIn);
    } else {
      const own =
        move.ownPrice === null
          ? 0
          : round3(quantity * Math.min(1, move.pricedShare ?? 1));
      const rest = round3(quantity - own);
      const fallback = stock.unitCost ?? latestPrice.get(move.itemId) ?? null;
      value =
        Math.round(own * (move.ownPrice ?? 0)) +
        (fallback === null ? 0 : Math.round(rest * fallback));
      unpricedIn = fallback === null ? rest : 0;
      if (move.ownPrice !== null) latestPrice.set(move.itemId, move.ownPrice);
    }
    stock.quantity = round3(stock.quantity + quantity);
    stock.priced = round3(stock.priced + quantity - unpricedIn);
    stock.value += value;
    if (stock.priced > 0 && stock.value > 0)
      stock.unitCost = stock.value / stock.priced;
    return result(value, unpricedIn);
  });
}

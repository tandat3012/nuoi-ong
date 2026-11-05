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
  /** Same for the outgoing and incoming row of one transfer line, null otherwise. */
  transferKey: string | null;
};

/** `value` is whole VND, signed like the quantity; `unpriced` = no price was known. */
export type ValuedMove = { value: number; unpriced: boolean };

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Moving weighted average per warehouse and item (bình quân gia quyền di động).
 * `moves` must be the farm's whole ledger in order, a transfer's outgoing row
 * before its incoming row.
 *
 * Out moves take their share of the stock's value. In moves bring their own
 * price, else the warehouse's current average, else the item's latest own price
 * in the farm; transfers bring the value that left the sending warehouse.
 * shortcut: whole VND in JS numbers, exact below 9e15 VND per stock.
 */
export function valueMoves(moves: LedgerMove[]): ValuedMove[] {
  const stocks = new Map<
    string,
    { quantity: number; value: number; unitCost: number | null }
  >();
  const latestPrice = new Map<string, number>();
  const inTransit = new Map<
    string,
    { quantity: number; value: number; unpriced: boolean }
  >();

  return moves.map((move) => {
    const key = `${move.warehouseId}:${move.itemId}`;
    let stock = stocks.get(key);
    if (!stock) {
      stock = { quantity: 0, value: 0, unitCost: null };
      stocks.set(key, stock);
    }

    if (move.quantity < 0) {
      const out = -move.quantity;
      const unpriced = stock.value <= 0;
      // The last units take whatever value is left, so no rounding residue stays behind.
      const value =
        stock.quantity <= out
          ? stock.value
          : Math.round((stock.value * out) / stock.quantity);
      stock.quantity = round3(stock.quantity - out);
      stock.value = stock.quantity > 0 ? stock.value - value : 0;
      if (move.transferKey) {
        const transit = inTransit.get(move.transferKey) ?? {
          quantity: 0,
          value: 0,
          unpriced: false,
        };
        transit.quantity = round3(transit.quantity + out);
        transit.value += value;
        transit.unpriced ||= unpriced;
        inTransit.set(move.transferKey, transit);
      }
      return { value: value ? -value : 0, unpriced };
    }

    const quantity = move.quantity;
    let value: number;
    let unpriced: boolean;
    const transit = move.transferKey
      ? inTransit.get(move.transferKey)
      : undefined;
    if (move.kind === 'transferIn' && transit && transit.quantity > 0) {
      value =
        quantity >= transit.quantity
          ? transit.value
          : Math.round((transit.value * quantity) / transit.quantity);
      unpriced = transit.unpriced;
      transit.quantity = round3(transit.quantity - quantity);
      transit.value -= value;
    } else {
      const unit =
        move.ownPrice ?? stock.unitCost ?? latestPrice.get(move.itemId) ?? null;
      value = unit === null ? 0 : Math.round(quantity * unit);
      unpriced = unit === null;
      if (move.ownPrice !== null) latestPrice.set(move.itemId, move.ownPrice);
    }
    stock.quantity = round3(stock.quantity + quantity);
    stock.value += value;
    if (stock.value > 0) stock.unitCost = stock.value / stock.quantity;
    return { value, unpriced };
  });
}

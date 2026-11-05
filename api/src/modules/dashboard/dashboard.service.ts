import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  STOCK_WRITE_ROLES,
  STORE_MANAGE_ROLES,
  hasAnyRole,
} from '../auth/farm-access/farm-role-groups';
import { assetInScope } from '../assets/asset-warehouse';
import type { WarehouseScope } from '../warehouses/warehouse-scope';
import {
  MOVE_KINDS,
  type LedgerMove,
  type MoveKind,
  moveKind,
  valueMoves,
} from './stock-valuation';

type Summary = {
  /** Whole VND: on-hand quantity × the item's latest confirmed receipt price (quantity-weighted across that receipt's lines). */
  stockValue: string;
  /** Items in stock with no priced confirmed receipt, left out of stockValue. */
  unpricedItems: number;
  belowMinimum: number;
  expiringLots: number;
  expiredLots: number;
  assetsInMaintenance: number;
  pendingAdjustments: number;
  ordersToday: number;
  ordersPending: number;
};
/** Fields outside the caller's area (farm operations or store) are null. */
export type DashboardSummary = { [K in keyof Summary]: Summary[K] | null };

const STORE_FIELDS = ['ordersToday', 'ordersPending'] as const;

const EXPIRY_WINDOW_DAYS = 30;

export const TIMESERIES_MAX_DAYS = 366;
export type Granularity = 'day' | 'week' | 'month';

/** Day buckets up to a month, week buckets up to a quarter, month buckets beyond. */
export function granularityFor(dateFrom: string, dateTo: string): Granularity {
  const days = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000 + 1;
  if (days > TIMESERIES_MAX_DAYS)
    throw new BadRequestException(
      `The range must be at most ${TIMESERIES_MAX_DAYS} days`,
    );
  return days <= 31 ? 'day' : days <= 92 ? 'week' : 'month';
}

/** Whole VND amounts as strings; `period` is the first day of the bucket (weeks start on Monday). */
export type TimeseriesPeriod = {
  period: string;
  inboundValue: string;
  outboundValue: string;
  inboundDocuments: number;
  outboundDocuments: number;
  purchaseCost: string;
  maintenanceLaborCost: string;
  maintenanceMaterialCost: string;
  maintenanceOtherCost: string;
};

type Amount = { quantity: string; value: string };

/** One item in one warehouse; quantities and values per kind are unsigned, VND whole. */
export type StockReportRow = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  trackingMode: string;
  unit: string;
  opening: Amount;
  closing: Amount;
  moves: Record<MoveKind, Amount>;
  /** Some stock or movement of this row had no price and counts as 0 VND. */
  unpriced: boolean;
};

type Ledger = (LedgerMove & { document: string; period: string | null })[];

const TZ = sql.raw(`'Asia/Ho_Chi_Minh'`);
const rangeStart = (dateFrom: string) =>
  sql`(${dateFrom}::date::timestamp AT TIME ZONE ${TZ})`;
const rangeEnd = (dateTo: string) =>
  sql`((${dateTo}::date + 1)::timestamp AT TIME ZONE ${TZ})`;
const round3 = (value: number) => String(Math.round(value * 1000) / 1000);

/** `AND column IN (...)` for a limited caller; empty for no limit. */
const scopeFilter = (column: string, scope: WarehouseScope) =>
  scope === null
    ? sql``
    : scope.length
      ? sql`AND ${sql.raw(column)} IN ${scope}`
      : sql`AND FALSE`;

/** One selected warehouse, else the caller's warehouses, else every warehouse. */
const inWarehouses =
  (warehouseId: string | undefined, scope: WarehouseScope) => (id: string) =>
    warehouseId ? id === warehouseId : scope === null || scope.includes(id);

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** `scope` limits stock figures to the caller's warehouses (null = whole farm). */
  async summary(
    farmId: string,
    roleCodes: string[],
    scope: WarehouseScope = null,
  ): Promise<DashboardSummary> {
    const today = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const result = await this.databaseService.db.execute<
      Record<keyof DashboardSummary, string | number>
    >(sql`
      WITH stock AS (
        SELECT item_id, SUM(quantity_on_hand) AS quantity
        FROM inventory_balances
        WHERE farm_id = ${farmId} ${scopeFilter('warehouse_id', scope)}
        GROUP BY item_id
      ), latest_receipt AS (
        -- Unit price 0 is the column default, so it means "not priced".
        SELECT DISTINCT ON (ri.item_id) ri.item_id, r.id AS receipt_id
        FROM stock_receipt_items ri
        JOIN stock_receipts r ON r.id = ri.stock_receipt_id
        WHERE r.farm_id = ${farmId}
          AND r.status = 'CONFIRMED'
          AND ri.unit_price > 0
        ORDER BY ri.item_id, r.confirmed_at DESC, r.id DESC
      ), latest_price AS (
        -- Several priced lines of one item on that receipt: quantity-weighted average.
        SELECT ri.item_id,
          SUM(ri.quantity * ri.unit_price) / SUM(ri.quantity) AS unit_price
        FROM stock_receipt_items ri
        JOIN latest_receipt lr
          ON lr.receipt_id = ri.stock_receipt_id AND lr.item_id = ri.item_id
        WHERE ri.unit_price > 0
        GROUP BY ri.item_id
      ), lot_stock AS (
        SELECT DISTINCT l.id, l.expiry_date
        FROM inventory_lots l
        JOIN inventory_balances b ON b.lot_id = l.id AND b.quantity_on_hand > 0
          ${scopeFilter('b.warehouse_id', scope)}
        WHERE l.farm_id = ${farmId} AND l.expiry_date IS NOT NULL
      )
      SELECT
        (SELECT COALESCE(ROUND(SUM(s.quantity * p.unit_price)), 0)::text
          FROM stock s JOIN latest_price p USING (item_id)) AS "stockValue",
        (SELECT count(*)::int FROM stock s
          LEFT JOIN latest_price p USING (item_id)
          WHERE s.quantity > 0 AND p.item_id IS NULL) AS "unpricedItems",
        (SELECT count(*)::int FROM items i
          LEFT JOIN stock s ON s.item_id = i.id
          WHERE i.farm_id = ${farmId} AND i.status = 'ACTIVE'
            AND i.min_stock_level > 0
            AND COALESCE(s.quantity, 0) < i.min_stock_level) AS "belowMinimum",
        (SELECT count(*)::int FROM lot_stock
          WHERE expiry_date >= ${today}
            AND expiry_date < ${today} + ${EXPIRY_WINDOW_DAYS}::int) AS "expiringLots",
        (SELECT count(*)::int FROM lot_stock
          WHERE expiry_date < ${today}) AS "expiredLots",
        (SELECT count(*)::int FROM assets
          WHERE farm_id = ${farmId} AND status = 'MAINTENANCE'
            ${scope === null ? sql`` : sql`AND ${assetInScope(sql.raw('assets.id'), scope)}`}) AS "assetsInMaintenance",
        (SELECT count(*)::int FROM inventory_adjustments
          WHERE farm_id = ${farmId} AND status = 'PENDING_APPROVAL'
            ${scopeFilter('warehouse_id', scope)}) AS "pendingAdjustments",
        (SELECT count(*)::int FROM store_orders
          WHERE farm_id = ${farmId}
            AND created_at >= (${today}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS "ordersToday",
        (SELECT count(*)::int FROM store_orders
          WHERE farm_id = ${farmId} AND status = 'PENDING') AS "ordersPending"
    `);
    const row = { ...result.rows[0] } as DashboardSummary;
    const canSeeFarm = hasAnyRole(roleCodes, STOCK_WRITE_ROLES);
    const canSeeStore = hasAnyRole(roleCodes, STORE_MANAGE_ROLES);
    for (const key of Object.keys(row) as (keyof DashboardSummary)[]) {
      const isStoreField = (STORE_FIELDS as readonly string[]).includes(key);
      if (isStoreField ? !canSeeStore : !canSeeFarm) row[key] = null;
    }
    return row;
  }

  /**
   * Stock in/out and costs per period, in Vietnam time.
   *
   * In = receipts and upward adjustments; out = issues (including materials issued
   * for maintenance) and downward adjustments. Transfers only count when one
   * warehouse is selected, since they do not change the farm total. Asset
   * assignment, return and trips to external maintenance are moves of farm-owned
   * equipment, not stock in/out, so they are left out.
   *
   * Values use the moving weighted average per warehouse (see valueMoves), the
   * same as the stock report. Maintenance costs are farm-wide and counted on the
   * completion date.
   */
  async timeseries(
    farmId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string,
    scope: WarehouseScope = null,
  ) {
    const granularity = granularityFor(dateFrom, dateTo);
    await this.assertWarehouse(farmId, warehouseId);

    const unit = sql.raw(`'${granularity}'`);
    const start = rangeStart(dateFrom);
    const end = rangeEnd(dateTo);
    const bucket = (column: string) =>
      sql`date_trunc(${unit}, ${sql.raw(column)} AT TIME ZONE ${TZ})::date`;
    const inWarehouse = (column: string) =>
      warehouseId
        ? sql`AND ${sql.raw(column)} = ${warehouseId}`
        : scopeFilter(column, scope);
    // A limited caller sees maintenance of their warehouses' assets only.
    const maintenanceInScope =
      scope === null || warehouseId
        ? sql``
        : sql`AND ${assetInScope(sql.raw('m.asset_id'), scope)}`;

    const [ledger, result] = await Promise.all([
      this.ledger(farmId, dateFrom, dateTo, granularity),
      this.databaseService.db.execute<
        Omit<
          TimeseriesPeriod,
          | 'inboundValue'
          | 'outboundValue'
          | 'inboundDocuments'
          | 'outboundDocuments'
        >
      >(sql`
        WITH periods AS (
          SELECT generate_series(
            date_trunc(${unit}, ${dateFrom}::date::timestamp),
            ${dateTo}::date::timestamp,
            ('1 ' || ${unit})::interval
          )::date AS period
        ), purchases AS (
          SELECT ${bucket('r.confirmed_at')} AS period,
            ROUND(SUM(ri.quantity * ri.unit_price)) AS cost
          FROM stock_receipts r
          JOIN stock_receipt_items ri ON ri.stock_receipt_id = r.id
          WHERE r.farm_id = ${farmId}
            AND r.status = 'CONFIRMED'
            AND r.confirmed_at >= ${start} AND r.confirmed_at < ${end}
            ${inWarehouse('r.warehouse_id')}
          GROUP BY 1
        ), maintenance AS (
          -- COMPLETED and FAILED are the finished states; both carry the final costs.
          SELECT ${bucket('m.completed_at')} AS period,
            ROUND(SUM(m.labor_cost)) AS labor,
            ROUND(SUM(m.material_cost)) AS material,
            ROUND(SUM(m.other_cost)) AS other
          FROM maintenance_records m
          WHERE m.farm_id = ${farmId}
            AND m.completed_at >= ${start} AND m.completed_at < ${end}
            ${maintenanceInScope}
          GROUP BY 1
        )
        SELECT to_char(p.period, 'YYYY-MM-DD') AS "period",
          COALESCE(pu.cost, 0)::text AS "purchaseCost",
          COALESCE(m.labor, 0)::text AS "maintenanceLaborCost",
          COALESCE(m.material, 0)::text AS "maintenanceMaterialCost",
          COALESCE(m.other, 0)::text AS "maintenanceOtherCost"
        FROM periods p
        LEFT JOIN purchases pu USING (period)
        LEFT JOIN maintenance m USING (period)
        ORDER BY p.period
      `),
    ]);

    const counted = inWarehouses(warehouseId, scope);
    // Transfers count when they cross the edge of the warehouses shown, so never for the whole farm.
    const transferEnds = new Map<string, string[]>();
    for (const move of ledger)
      if (move.transferKey)
        transferEnds.set(move.transferKey, [
          ...(transferEnds.get(move.transferKey) ?? []),
          move.warehouseId,
        ]);
    const crossesEdge = (move: Ledger[number]) =>
      (transferEnds.get(move.transferKey!) ?? []).some((id) => !counted(id));
    const directions: Partial<Record<MoveKind, 'in' | 'out'>> = {
      receipt: 'in',
      adjustmentIn: 'in',
      issue: 'out',
      adjustmentOut: 'out',
      transferIn: 'in',
      transferOut: 'out',
    };
    const stock = new Map<
      string,
      Record<'in' | 'out', { value: number; documents: Set<string> }>
    >();
    let unpricedMovements = 0;
    const valued = valueMoves(ledger);
    ledger.forEach((move, index) => {
      const direction = directions[move.kind];
      if (!move.period || !direction || !counted(move.warehouseId)) return;
      if (move.transferKey && !crossesEdge(move)) return;
      let period = stock.get(move.period);
      if (!period) {
        period = {
          in: { value: 0, documents: new Set() },
          out: { value: 0, documents: new Set() },
        };
        stock.set(move.period, period);
      }
      period[direction].value += Math.abs(valued[index].value);
      period[direction].documents.add(move.document);
      if (valued[index].unpriced) unpricedMovements += 1;
    });

    const periods: TimeseriesPeriod[] = result.rows.map((row) => {
      const moves = stock.get(row.period);
      return {
        period: row.period,
        inboundValue: String(moves?.in.value ?? 0),
        outboundValue: String(moves?.out.value ?? 0),
        inboundDocuments: moves?.in.documents.size ?? 0,
        outboundDocuments: moves?.out.documents.size ?? 0,
        purchaseCost: row.purchaseCost,
        maintenanceLaborCost: row.maintenanceLaborCost,
        maintenanceMaterialCost: row.maintenanceMaterialCost,
        maintenanceOtherCost: row.maintenanceOtherCost,
      };
    });
    return { granularity, periods, unpricedMovements };
  }

  /**
   * Opening stock, every movement kind and closing stock per item and warehouse
   * for `dateFrom`..`dateTo` in Vietnam time, valued with the moving weighted
   * average per warehouse. Rows with no stock and no movement are left out.
   */
  async stockReport(
    farmId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string,
    scope: WarehouseScope = null,
  ): Promise<{ rows: StockReportRow[] }> {
    granularityFor(dateFrom, dateTo);
    await this.assertWarehouse(farmId, warehouseId);
    const [ledger, names] = await Promise.all([
      this.ledger(farmId, dateFrom, dateTo, 'day'),
      this.databaseService.db.execute<{
        warehouseId: string;
        warehouseCode: string;
        warehouseName: string;
        itemId: string;
        itemCode: string;
        itemName: string;
        itemType: string;
        trackingMode: string;
        unit: string;
      }>(sql`
        SELECT DISTINCT t.warehouse_id AS "warehouseId", w.code AS "warehouseCode",
          w.name AS "warehouseName", i.id AS "itemId", i.code AS "itemCode",
          i.name AS "itemName", i.item_type AS "itemType",
          i.tracking_mode AS "trackingMode", COALESCE(u.symbol, u.name) AS "unit"
        FROM inventory_transactions t
        JOIN warehouses w ON w.id = t.warehouse_id
        JOIN items i ON i.id = t.item_id
        JOIN units u ON u.id = i.unit_id
        WHERE t.farm_id = ${farmId} AND t.created_at < ${rangeEnd(dateTo)}
      `),
    ]);

    const totals = new Map<
      string,
      {
        opening: { quantity: number; value: number };
        closing: { quantity: number; value: number };
        moves: Record<MoveKind, { quantity: number; value: number }>;
        moved: boolean;
        unpriced: boolean;
      }
    >();
    const valued = valueMoves(ledger);
    const shown = inWarehouses(warehouseId, scope);
    ledger.forEach((move, index) => {
      if (!shown(move.warehouseId)) return;
      const key = `${move.warehouseId}:${move.itemId}`;
      let row = totals.get(key);
      if (!row) {
        row = {
          opening: { quantity: 0, value: 0 },
          closing: { quantity: 0, value: 0 },
          moves: Object.fromEntries(
            MOVE_KINDS.map((kind) => [kind, { quantity: 0, value: 0 }]),
          ) as Record<MoveKind, { quantity: number; value: number }>,
          moved: false,
          unpriced: false,
        };
        totals.set(key, row);
      }
      const { value, unpriced } = valued[index];
      if (move.period) {
        row.moves[move.kind].quantity += Math.abs(move.quantity);
        row.moves[move.kind].value += Math.abs(value);
        row.moved = true;
        row.unpriced ||= unpriced;
      } else {
        row.opening.quantity += move.quantity;
        row.opening.value += value;
      }
      row.closing.quantity += move.quantity;
      row.closing.value += value;
    });

    const amount = ({
      quantity,
      value,
    }: {
      quantity: number;
      value: number;
    }) => ({
      quantity: round3(quantity),
      value: String(value),
    });
    const rows: StockReportRow[] = [];
    for (const name of names.rows) {
      const row = totals.get(`${name.warehouseId}:${name.itemId}`);
      if (!row) continue;
      const opening = amount(row.opening);
      const closing = amount(row.closing);
      if (!row.moved && opening.quantity === '0' && closing.quantity === '0')
        continue;
      const noValue = (stock: Amount) =>
        stock.quantity !== '0' && stock.value === '0';
      rows.push({
        ...name,
        opening,
        closing,
        moves: Object.fromEntries(
          MOVE_KINDS.map((kind) => [kind, amount(row.moves[kind])]),
        ) as Record<MoveKind, Amount>,
        unpriced: row.unpriced || noValue(opening) || noValue(closing),
      });
    }
    rows.sort(
      (a, b) =>
        a.warehouseCode.localeCompare(b.warehouseCode) ||
        a.itemCode.localeCompare(b.itemCode),
    );
    return { rows };
  }

  private async assertWarehouse(farmId: string, warehouseId?: string) {
    if (!warehouseId) return;
    const found = await this.databaseService.db.execute(sql`
      SELECT 1 FROM warehouses WHERE id = ${warehouseId} AND farm_id = ${farmId}
    `);
    if (found.rows.length === 0)
      throw new NotFoundException('Warehouse not found');
  }

  /**
   * The farm's ledger up to the end of `dateTo`, in the order valueMoves needs;
   * `period` is the bucket for rows on or after `dateFrom`, null before.
   * shortcut: reads the whole history on each call; add month-end snapshots if the ledger gets large.
   */
  private async ledger(
    farmId: string,
    dateFrom: string,
    dateTo: string,
    granularity: Granularity,
  ): Promise<Ledger> {
    const unit = sql.raw(`'${granularity}'`);
    const result = await this.databaseService.db.execute<{
      warehouseId: string;
      itemId: string;
      transactionType: string;
      sourceType: string;
      document: string;
      quantity: string;
      ownPrice: string | null;
      transferKey: string | null;
      period: string | null;
    }>(sql`
      SELECT t.warehouse_id AS "warehouseId", t.item_id AS "itemId",
        t.transaction_type AS "transactionType", t.source_type AS "sourceType",
        t.source_type || ':' || t.source_id AS "document",
        t.quantity_change::text AS "quantity",
        -- Unit price 0 is the column default, so it means "not priced".
        COALESCE(rp.unit_price, NULLIF(a.purchase_price, 0))::text AS "ownPrice",
        CASE WHEN t.transaction_type IN ('TRANSFER_IN', 'TRANSFER_OUT')
          THEN concat_ws(':', t.source_id, t.item_id, t.lot_id, t.asset_id)
        END AS "transferKey",
        CASE WHEN t.created_at >= ${rangeStart(dateFrom)} THEN
          to_char(date_trunc(${unit}, t.created_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD')
        END AS "period"
      FROM inventory_transactions t
      -- Several priced lines of the item on one receipt: quantity-weighted price.
      LEFT JOIN LATERAL (
        SELECT SUM(ri.quantity * ri.unit_price) / SUM(ri.quantity) AS unit_price
        FROM stock_receipt_items ri
        WHERE t.source_type = 'STOCK_RECEIPT'
          AND ri.stock_receipt_id = t.source_id
          AND ri.item_id = t.item_id
          AND ri.unit_price > 0
      ) rp ON TRUE
      LEFT JOIN assets a ON t.source_type = 'ASSET_CREATE' AND a.id = t.asset_id
      WHERE t.farm_id = ${farmId} AND t.created_at < ${rangeEnd(dateTo)}
      -- Both rows of a transfer share created_at: the outgoing one first.
      ORDER BY t.created_at, t.transaction_type = 'TRANSFER_IN', t.id
    `);
    return result.rows.map((row) => ({
      warehouseId: row.warehouseId,
      itemId: row.itemId,
      kind: moveKind(row.transactionType, row.sourceType),
      quantity: Number(row.quantity),
      ownPrice: row.ownPrice === null ? null : Number(row.ownPrice),
      transferKey: row.transferKey,
      document: row.document,
      period: row.period,
    }));
  }
}

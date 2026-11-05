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

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(
    farmId: string,
    roleCodes: string[],
  ): Promise<DashboardSummary> {
    const today = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const result = await this.databaseService.db.execute<
      Record<keyof DashboardSummary, string | number>
    >(sql`
      WITH stock AS (
        SELECT item_id, SUM(quantity_on_hand) AS quantity
        FROM inventory_balances
        WHERE farm_id = ${farmId}
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
          WHERE farm_id = ${farmId} AND status = 'MAINTENANCE') AS "assetsInMaintenance",
        (SELECT count(*)::int FROM inventory_adjustments
          WHERE farm_id = ${farmId} AND status = 'PENDING_APPROVAL') AS "pendingAdjustments",
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
   * Values use the receipt's own price for receipts, otherwise the latest priced
   * confirmed receipt of the item at the time of the movement. Maintenance costs
   * are farm-wide and counted on the completion date.
   */
  async timeseries(
    farmId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string,
  ) {
    const granularity = granularityFor(dateFrom, dateTo);
    if (warehouseId) {
      const found = await this.databaseService.db.execute(sql`
        SELECT 1 FROM warehouses WHERE id = ${warehouseId} AND farm_id = ${farmId}
      `);
      if (found.rows.length === 0)
        throw new NotFoundException('Warehouse not found');
    }

    const unit = sql.raw(`'${granularity}'`);
    const tz = sql.raw(`'Asia/Ho_Chi_Minh'`);
    const start = sql`(${dateFrom}::date::timestamp AT TIME ZONE ${tz})`;
    const end = sql`((${dateTo}::date + 1)::timestamp AT TIME ZONE ${tz})`;
    const bucket = (column: string) =>
      sql`date_trunc(${unit}, ${sql.raw(column)} AT TIME ZONE ${tz})::date`;
    const inWarehouse = (column: string) =>
      warehouseId ? sql`AND ${sql.raw(column)} = ${warehouseId}` : sql``;
    const transfers = warehouseId ? sql`TRUE` : sql`FALSE`;

    const result = await this.databaseService.db.execute<
      TimeseriesPeriod & { unpriced: number }
    >(sql`
      WITH periods AS (
        SELECT generate_series(
          date_trunc(${unit}, ${dateFrom}::date::timestamp),
          ${dateTo}::date::timestamp,
          ('1 ' || ${unit})::interval
        )::date AS period
      ), moves AS (
        SELECT ${bucket('t.created_at')} AS period,
          d.direction,
          t.source_type || ':' || t.source_id AS document,
          abs(t.quantity_change) * p.unit_price AS value,
          p.unit_price IS NULL AS unpriced
        FROM inventory_transactions t
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN t.transaction_type IN ('RECEIPT', 'ADJUSTMENT_IN') THEN 'IN'
            WHEN t.transaction_type IN ('ISSUE', 'ADJUSTMENT_OUT')
              OR t.source_type = 'STOCK_ISSUE' THEN 'OUT'
            WHEN ${transfers} AND t.transaction_type = 'TRANSFER_IN' THEN 'IN'
            WHEN ${transfers} AND t.transaction_type = 'TRANSFER_OUT' THEN 'OUT'
          END AS direction
        ) d
        -- The movement's own receipt first, else the latest priced receipt before it.
        LEFT JOIN LATERAL (
          SELECT r.id
          FROM stock_receipts r
          WHERE r.farm_id = t.farm_id
            AND r.status = 'CONFIRMED'
            AND (
              (t.source_type = 'STOCK_RECEIPT' AND r.id = t.source_id)
              OR r.confirmed_at <= t.created_at
            )
            AND EXISTS (
              SELECT 1 FROM stock_receipt_items ri
              WHERE ri.stock_receipt_id = r.id
                AND ri.item_id = t.item_id
                AND ri.unit_price > 0
            )
          ORDER BY (t.source_type = 'STOCK_RECEIPT' AND r.id = t.source_id) DESC,
            r.confirmed_at DESC, r.id DESC
          LIMIT 1
        ) pr ON TRUE
        LEFT JOIN LATERAL (
          SELECT SUM(ri.quantity * ri.unit_price) / SUM(ri.quantity) AS unit_price
          FROM stock_receipt_items ri
          WHERE ri.stock_receipt_id = pr.id
            AND ri.item_id = t.item_id
            AND ri.unit_price > 0
        ) p ON TRUE
        WHERE t.farm_id = ${farmId}
          AND t.created_at >= ${start} AND t.created_at < ${end}
          ${inWarehouse('t.warehouse_id')}
          AND d.direction IS NOT NULL
      ), stock AS (
        SELECT period,
          ROUND(SUM(value) FILTER (WHERE direction = 'IN')) AS inbound_value,
          ROUND(SUM(value) FILTER (WHERE direction = 'OUT')) AS outbound_value,
          COUNT(DISTINCT document) FILTER (WHERE direction = 'IN') AS inbound_documents,
          COUNT(DISTINCT document) FILTER (WHERE direction = 'OUT') AS outbound_documents,
          COUNT(*) FILTER (WHERE unpriced) AS unpriced
        FROM moves GROUP BY period
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
        GROUP BY 1
      )
      SELECT to_char(p.period, 'YYYY-MM-DD') AS "period",
        COALESCE(s.inbound_value, 0)::text AS "inboundValue",
        COALESCE(s.outbound_value, 0)::text AS "outboundValue",
        COALESCE(s.inbound_documents, 0)::int AS "inboundDocuments",
        COALESCE(s.outbound_documents, 0)::int AS "outboundDocuments",
        COALESCE(pu.cost, 0)::text AS "purchaseCost",
        COALESCE(m.labor, 0)::text AS "maintenanceLaborCost",
        COALESCE(m.material, 0)::text AS "maintenanceMaterialCost",
        COALESCE(m.other, 0)::text AS "maintenanceOtherCost",
        COALESCE(s.unpriced, 0)::int AS "unpriced"
      FROM periods p
      LEFT JOIN stock s USING (period)
      LEFT JOIN purchases pu USING (period)
      LEFT JOIN maintenance m USING (period)
      ORDER BY p.period
    `);

    let unpricedMovements = 0;
    const periods = result.rows.map(({ unpriced, ...period }) => {
      unpricedMovements += unpriced;
      return period;
    });
    return { granularity, periods, unpricedMovements };
  }
}

import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';

export type DashboardSummary = {
  /** Whole VND: on-hand quantity × the item's latest confirmed receipt price. */
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

const EXPIRY_WINDOW_DAYS = 30;

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(farmId: string): Promise<DashboardSummary> {
    const today = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const result = await this.databaseService.db.execute<
      Record<keyof DashboardSummary, string | number>
    >(sql`
      WITH stock AS (
        SELECT item_id, SUM(quantity_on_hand) AS quantity
        FROM inventory_balances
        WHERE farm_id = ${farmId}
        GROUP BY item_id
      ), latest_price AS (
        -- Unit price 0 is the column default, so it means "not priced".
        SELECT DISTINCT ON (ri.item_id) ri.item_id, ri.unit_price
        FROM stock_receipt_items ri
        JOIN stock_receipts r ON r.id = ri.stock_receipt_id
        WHERE r.farm_id = ${farmId}
          AND r.status = 'CONFIRMED'
          AND ri.unit_price > 0
        ORDER BY ri.item_id, r.confirmed_at DESC, r.id DESC
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
    return result.rows[0] as DashboardSummary;
  }
}

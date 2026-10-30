import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  sql,
  SQL,
} from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  farmMembers,
  inventoryBalances,
  inventoryLots,
  items,
  locations,
  stockIssueItems,
  stockIssues,
  storeOrderItems,
  storeOrders,
  storeProducts,
  storeProductVariants,
  storeSettings,
  units,
  users,
  warehouses,
} from '../../db/schema';
import { PaginationParams } from '../../common/query-params';
import { CommerceService } from '../commerce/commerce.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateStoreOrderDto } from './dto/store-order.dto';
import {
  checkedMoney,
  orderCode,
  quantityMillis,
  stockQuantity,
} from './store-order.rules';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type Order = typeof storeOrders.$inferSelect;
type OrderItem = typeof storeOrderItems.$inferSelect;
export interface OrderFilters extends PaginationParams {
  status?: Order['status'];
  paymentStatus?: Order['paymentStatus'];
  from?: string;
  to?: string;
  q?: string;
  customerId?: string;
}

@Injectable()
export class StoreOrdersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commerce: CommerceService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async create(userId: string, input: CreateStoreOrderDto) {
    const fingerprint = this.fingerprint(input);
    const replay = await this.findReplay(
      userId,
      input.idempotencyKey,
      fingerprint,
    );
    if (replay) return this.customerDetail(replay.id, userId);

    let id: string;
    try {
      id = await this.databaseService.db.transaction(async (tx) => {
        // Wait for an earlier request by this customer before deciding a retry is new.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        const existing = await this.findReplay(
          userId,
          input.idempotencyKey,
          fingerprint,
          tx,
        );
        if (existing) return existing.id;
        const [membership] = await tx
          .select({ id: farmMembers.id })
          .from(farmMembers)
          .where(eq(farmMembers.userId, userId))
          .limit(1);
        if (membership)
          throw new ForbiddenException(
            'Only customer accounts can place storefront orders',
          );
        const warehouse = await this.commerce.getStoreWarehouse(tx);
        const lines: Omit<typeof storeOrderItems.$inferInsert, 'orderId'>[] =
          [];
        const seen = new Set<string>();
        let subtotal = 0n;
        for (const line of input.items) {
          const variantId = line.variantId.toLowerCase();
          if (seen.has(variantId))
            throw new BadRequestException('Duplicate variant');
          seen.add(variantId);
          const [variant] = await tx
            .select({
              id: storeProductVariants.id,
              productId: storeProducts.id,
              itemId: items.id,
              productName: storeProducts.name,
              variantName: storeProductVariants.name,
              price: storeProductVariants.price,
              quantityStep: storeProductVariants.quantityStep,
              inStock: this.commerce
                .variantInStock(
                  warehouse,
                  sql`${storeProductVariants.quantityStep} * ${line.quantity}::numeric`,
                )
                .as('in_stock'),
            })
            .from(storeProductVariants)
            .innerJoin(
              storeProducts,
              eq(storeProducts.id, storeProductVariants.productId),
            )
            .innerJoin(items, eq(items.id, storeProductVariants.itemId))
            .innerJoin(units, eq(units.id, items.unitId))
            .where(
              and(
                eq(storeProductVariants.id, variantId),
                eq(storeProducts.status, 'PUBLISHED'),
                this.commerce.eligibleVariantConditions(warehouse.farmId),
              ),
            )
            .limit(1);
          if (!variant)
            throw new ConflictException({
              code: 'VARIANT_UNAVAILABLE',
              message: 'Sản phẩm hoặc quy cách không còn bán.',
              variantId,
            });
          if (
            line.expectedUnitPrice !== undefined &&
            line.expectedUnitPrice !== variant.price
          )
            throw new ConflictException({
              code: 'PRICE_CHANGED',
              message: 'Giá đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.',
              variantId,
              unitPrice: variant.price,
            });
          if (!variant.inStock)
            throw new ConflictException({
              code: 'INSUFFICIENT_STOCK',
              message: 'Không đủ tồn kho cho số lượng đã chọn.',
              variantId,
            });
          const lineTotal = checkedMoney(
            BigInt(variant.price) * BigInt(line.quantity),
          );
          subtotal += BigInt(lineTotal);
          lines.push({
            variantId,
            productId: variant.productId,
            itemId: variant.itemId,
            productName: variant.productName,
            variantName: variant.variantName,
            unitPrice: variant.price,
            quantity: line.quantity,
            stockQuantity: stockQuantity(
              quantityMillis(variant.quantityStep) * BigInt(line.quantity),
            ),
            lineTotal,
          });
        }
        const amount = checkedMoney(subtotal);
        const [order] = await tx
          .insert(storeOrders)
          .values({
            userId,
            farmId: warehouse.farmId,
            warehouseId: warehouse.warehouseId,
            recipientName: input.recipientName,
            phone: input.phone,
            address: input.address,
            note: input.note || null,
            paymentMethod: input.paymentMethod,
            subtotal: amount,
            total: amount,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
          })
          .returning({ id: storeOrders.id });
        await tx
          .insert(storeOrderItems)
          .values(lines.map((line) => ({ ...line, orderId: order.id })));
        return order.id;
      });
    } catch (error: unknown) {
      if (this.databaseConstraint(error) === 'uq_store_orders_idempotency') {
        const winner = await this.findReplay(
          userId,
          input.idempotencyKey,
          fingerprint,
        );
        if (winner) return this.customerDetail(winner.id, userId);
      }
      throw error;
    }
    return this.customerDetail(id, userId);
  }

  async customerList(userId: string, filters: OrderFilters) {
    const result = await this.list(eq(storeOrders.userId, userId), filters);
    return {
      ...result,
      data: result.data.map((order) => this.customerOrder(order)),
    };
  }

  customerGet(userId: string, id: string) {
    return this.customerDetail(id, userId);
  }

  async staffList(farmId: string, filters: OrderFilters) {
    await this.assertStoreFarm(farmId);
    return this.list(eq(storeOrders.farmId, farmId), filters);
  }

  async staffGet(farmId: string, id: string) {
    await this.assertStoreFarm(farmId);
    return this.detail(id, eq(storeOrders.farmId, farmId));
  }

  async customerProfile(farmId: string, userId: string) {
    await this.assertStoreFarm(farmId);
    const db = this.databaseService.db;
    const [customer] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          sql`(
        NOT EXISTS (SELECT 1 FROM ${farmMembers} WHERE ${farmMembers.userId} = ${users.id})
        OR EXISTS (SELECT 1 FROM ${storeOrders} WHERE ${storeOrders.userId} = ${users.id} AND ${storeOrders.farmId} = ${farmId})
      )`,
        ),
      )
      .limit(1);
    if (!customer) throw new NotFoundException('Customer not found');
    const scope = and(
      eq(storeOrders.farmId, farmId),
      eq(storeOrders.userId, userId),
    );
    const [[totals], products] = await Promise.all([
      db
        .select({
          orderCount: count(),
          completedCount: sql<number>`COUNT(*) FILTER (WHERE ${storeOrders.status} = 'COMPLETED')::int`,
          totalSpent: sql<string>`COALESCE(SUM(${storeOrders.total}) FILTER (WHERE ${storeOrders.status} = 'COMPLETED'), 0)::text`,
        })
        .from(storeOrders)
        .where(scope),
      db
        .select({
          variantId: storeOrderItems.variantId,
          productName: sql<string>`(array_agg(${storeOrderItems.productName} ORDER BY ${storeOrders.completedAt} DESC))[1]`,
          variantName: sql<string>`(array_agg(${storeOrderItems.variantName} ORDER BY ${storeOrders.completedAt} DESC))[1]`,
          quantity: sql<number>`SUM(${storeOrderItems.quantity})::int`,
          total: sql<string>`SUM(${storeOrderItems.lineTotal})::text`,
        })
        .from(storeOrderItems)
        .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
        .where(and(scope, eq(storeOrders.status, 'COMPLETED')))
        .groupBy(storeOrderItems.variantId)
        .orderBy(
          desc(sql`SUM(${storeOrderItems.lineTotal})`),
          asc(storeOrderItems.variantId),
        ),
    ]);
    return { customer, ...totals, products };
  }

  async stats(farmId: string, filters: { from?: string; to?: string }) {
    await this.assertStoreFarm(farmId);
    const db = this.databaseService.db;
    const completed = and(
      eq(storeOrders.farmId, farmId),
      eq(storeOrders.status, 'COMPLETED'),
      ...this.dateConditions(storeOrders.completedAt, filters),
    );
    const [statusRows, [summary], daily, topProducts, topCustomers] =
      await Promise.all([
        db
          .select({ status: storeOrders.status, value: count() })
          .from(storeOrders)
          .where(
            and(
              eq(storeOrders.farmId, farmId),
              ...this.dateConditions(storeOrders.createdAt, filters),
            ),
          )
          .groupBy(storeOrders.status),
        db
          .select({
            revenue: sql<string>`COALESCE(SUM(${storeOrders.subtotal}), 0)::text`,
            shippingFees: sql<string>`COALESCE(SUM(${storeOrders.shippingFee}), 0)::text`,
            completedOrders: count(),
            averageOrderValue: sql<string>`COALESCE(ROUND(AVG(${storeOrders.subtotal})), 0)::text`,
          })
          .from(storeOrders)
          .where(completed),
        db
          .select({
            date: sql<string>`to_char(${storeOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`,
            revenue: sql<string>`SUM(${storeOrders.subtotal})::text`,
          })
          .from(storeOrders)
          .where(completed)
          .groupBy(
            sql`to_char(${storeOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`,
          )
          .orderBy(
            asc(
              sql`to_char(${storeOrders.completedAt} AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`,
            ),
          ),
        db
          .select({
            productId: storeOrderItems.productId,
            name: sql<string>`(array_agg(${storeOrderItems.productName} ORDER BY ${storeOrders.completedAt} DESC))[1]`,
            quantity: sql<number>`SUM(${storeOrderItems.quantity})::int`,
            revenue: sql<string>`SUM(${storeOrderItems.lineTotal})::text`,
          })
          .from(storeOrderItems)
          .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
          .where(completed)
          .groupBy(storeOrderItems.productId)
          .orderBy(
            desc(sql`SUM(${storeOrderItems.lineTotal})`),
            asc(storeOrderItems.productId),
          )
          .limit(10),
        db
          .select({
            userId: users.id,
            name: users.fullName,
            email: users.email,
            orderCount: count(),
            revenue: sql<string>`SUM(${storeOrders.subtotal})::text`,
          })
          .from(storeOrders)
          .innerJoin(users, eq(users.id, storeOrders.userId))
          .where(completed)
          .groupBy(users.id, users.fullName, users.email)
          .orderBy(desc(sql`SUM(${storeOrders.subtotal})`), asc(users.id))
          .limit(10),
      ]);
    const counts = {
      PENDING: 0,
      CONFIRMED: 0,
      SHIPPING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const row of statusRows) counts[row.status] = row.value;
    return { counts, ...summary, daily, topProducts, topCustomers };
  }

  async shippingFee(
    farmId: string,
    clerkUserId: string,
    id: string,
    fee: string,
  ) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'PENDING' || order.paymentStatus !== 'UNPAID')
        throw new ConflictException(
          'Shipping fee can only change on PENDING, UNPAID orders',
        );
      await tx
        .update(storeOrders)
        .set({
          shippingFee: fee,
          total: checkedMoney(BigInt(order.subtotal) + BigInt(fee)),
          handledByMemberId: memberId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(storeOrders.id, id));
    });
    return this.staffGet(farmId, id);
  }

  async confirm(farmId: string, clerkUserId: string, id: string) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'PENDING')
        throw new ConflictException('Only PENDING orders can be confirmed');
      const [warehouse] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, order.warehouseId),
            eq(warehouses.farmId, farmId),
            eq(warehouses.status, 'ACTIVE'),
          ),
        )
        .limit(1);
      if (!warehouse)
        throw new ConflictException('Order warehouse is not active');
      const orderItems = await tx
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.orderId, id))
        .orderBy(asc(storeOrderItems.itemId));
      // Serialize confirmations of the same stock so each sees drafts committed by the other.
      await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.farmId, farmId),
            eq(inventoryBalances.warehouseId, order.warehouseId),
            inArray(
              inventoryBalances.itemId,
              orderItems.map((line) => line.itemId),
            ),
          ),
        )
        .orderBy(asc(inventoryBalances.id))
        .for('update');
      const allocations: Omit<
        typeof stockIssueItems.$inferInsert,
        'stockIssueId'
      >[] = [];
      for (const line of orderItems) {
        allocations.push(...(await this.allocate(tx, order, line)));
        if (allocations.length > 1000)
          throw new BadRequestException(
            'Order requires more than 1000 stock issue lines',
          );
      }
      const [issue] = await tx
        .insert(stockIssues)
        .values({
          farmId,
          warehouseId: order.warehouseId,
          issueType: 'SALE',
          createdByMemberId: memberId,
          reason: `Xuất bán đơn ${orderCode(order.orderNumber)}`,
        })
        .returning({ id: stockIssues.id });
      await tx
        .insert(stockIssueItems)
        .values(
          allocations.map((line) => ({ ...line, stockIssueId: issue.id })),
        );
      const now = new Date().toISOString();
      await tx
        .update(storeOrders)
        .set({
          status: 'CONFIRMED',
          stockIssueId: issue.id,
          confirmedAt: now,
          handledByMemberId: memberId,
          updatedAt: now,
        })
        .where(eq(storeOrders.id, id));
    });
    return this.staffGet(farmId, id);
  }

  async ship(farmId: string, clerkUserId: string, id: string) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'CONFIRMED' || !order.stockIssueId)
        throw new ConflictException('Only CONFIRMED orders can be shipped');
      const [issue] = await tx
        .select()
        .from(stockIssues)
        .where(
          and(
            eq(stockIssues.id, order.stockIssueId),
            eq(stockIssues.farmId, farmId),
          ),
        )
        .for('update');
      if (issue?.status !== 'CONFIRMED')
        throw new ConflictException(
          'The stock issue must be approved before shipping',
        );
      const now = new Date().toISOString();
      await tx
        .update(storeOrders)
        .set({
          status: 'SHIPPING',
          shippedAt: now,
          handledByMemberId: memberId,
          updatedAt: now,
        })
        .where(eq(storeOrders.id, id));
    });
    return this.staffGet(farmId, id);
  }

  async complete(farmId: string, clerkUserId: string, id: string) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'SHIPPING')
        throw new ConflictException('Only SHIPPING orders can be completed');
      if (
        order.paymentMethod === 'BANK_TRANSFER' &&
        order.paymentStatus !== 'PAID'
      )
        throw new ConflictException(
          'Record the bank transfer before completing the order',
        );
      const now = new Date().toISOString();
      await tx
        .update(storeOrders)
        .set({
          status: 'COMPLETED',
          completedAt: now,
          handledByMemberId: memberId,
          updatedAt: now,
          ...(order.paymentStatus === 'UNPAID'
            ? {
                paymentStatus: 'PAID' as const,
                paidAt: now,
                paidByMemberId: memberId,
              }
            : {}),
        })
        .where(eq(storeOrders.id, id));
    });
    return this.staffGet(farmId, id);
  }

  async markPaid(farmId: string, clerkUserId: string, id: string) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status === 'CANCELLED')
        throw new ConflictException('Cancelled orders cannot be paid');
      if (order.paymentStatus === 'PAID') return;
      const now = new Date().toISOString();
      await tx
        .update(storeOrders)
        .set({
          paymentStatus: 'PAID',
          paidAt: now,
          paidByMemberId: memberId,
          handledByMemberId: memberId,
          updatedAt: now,
        })
        .where(eq(storeOrders.id, id));
    });
    return this.staffGet(farmId, id);
  }

  async customerCancel(userId: string, id: string, reason: string) {
    await this.cancel(id, reason, eq(storeOrders.userId, userId));
    return this.customerGet(userId, id);
  }

  async staffCancel(
    farmId: string,
    clerkUserId: string,
    id: string,
    reason: string,
  ) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.cancel(id, reason, eq(storeOrders.farmId, farmId), memberId);
    return this.staffGet(farmId, id);
  }

  private async cancel(
    id: string,
    reason: string,
    scope: SQL,
    memberId?: string,
  ) {
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(tx, id, scope);
      if (
        order.status !== 'PENDING' &&
        !(memberId && order.status === 'CONFIRMED')
      )
        throw new ConflictException(
          'Order cannot be cancelled in its current state',
        );
      if (order.paymentStatus === 'PAID')
        throw new ConflictException(
          'Paid orders require a refund workflow before cancellation',
        );
      const now = new Date().toISOString();
      if (order.stockIssueId) {
        const [issue] = await tx
          .select()
          .from(stockIssues)
          .where(eq(stockIssues.id, order.stockIssueId))
          .for('update');
        // A submitted issue is still only a reservation until it is approved.
        if (issue?.status !== 'DRAFT' && issue?.status !== 'PENDING_APPROVAL')
          throw new ConflictException(
            'An approved stock issue cannot be cancelled with the order',
          );
        await tx
          .update(stockIssues)
          .set({ status: 'CANCELLED', cancelledAt: now, updatedAt: now })
          .where(eq(stockIssues.id, order.stockIssueId));
      }
      await tx
        .update(storeOrders)
        .set({
          status: 'CANCELLED',
          cancelReason: reason,
          cancelledAt: now,
          updatedAt: now,
          ...(memberId ? { handledByMemberId: memberId } : {}),
        })
        .where(eq(storeOrders.id, id));
    });
  }

  private async allocate(tx: Transaction, order: Order, line: OrderItem) {
    const [item] = await tx
      .select({ trackingMode: items.trackingMode })
      .from(items)
      .where(and(eq(items.id, line.itemId), eq(items.farmId, order.farmId)))
      .limit(1);
    if (!item)
      throw new ConflictException('Order item no longer exists in the farm');
    const base = and(
      eq(inventoryBalances.farmId, order.farmId),
      eq(inventoryBalances.warehouseId, order.warehouseId),
      eq(inventoryBalances.itemId, line.itemId),
    );
    // Stock already held by other unapproved issues; approval would fail if picked twice.
    const reserved = (lotId: SQL | null) => sql`COALESCE((
      SELECT SUM(${stockIssueItems.quantity})
      FROM ${stockIssueItems}
      JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
      WHERE ${stockIssues.warehouseId} = ${order.warehouseId}
        AND ${stockIssues.status} IN ('DRAFT', 'PENDING_APPROVAL')
        AND ${stockIssueItems.itemId} = ${line.itemId}
        AND ${lotId ? sql`${stockIssueItems.lotId} = ${lotId}` : sql`${stockIssueItems.lotId} IS NULL`}
    ), 0)`;
    const insufficient = () =>
      new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: `Không đủ hàng cho ${line.productName} — ${line.variantName}.`,
        variantId: line.variantId,
      });
    if (item.trackingMode !== 'LOT') {
      const [balance] = await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            base,
            isNull(inventoryBalances.lotId),
            sql`${inventoryBalances.quantityOnHand} - ${reserved(null)} >= ${line.stockQuantity}`,
          ),
        )
        .limit(1);
      if (!balance) throw insufficient();
      if (item.trackingMode === 'QUANTITY')
        return [{ itemId: line.itemId, quantity: line.stockQuantity }];
      const required = quantityMillis(line.stockQuantity);
      if (required % 1000n !== 0n || required / 1000n > 1000n)
        throw new ConflictException('Invalid asset order quantity');
      const choices = await tx
        .select({ id: assets.id })
        .from(assets)
        .innerJoin(locations, eq(locations.id, assets.currentLocationId))
        .where(
          and(
            eq(assets.itemId, line.itemId),
            this.commerce.saleableAssetConditions(order),
          ),
        )
        .orderBy(asc(assets.id))
        .limit(Number(required / 1000n));
      if (BigInt(choices.length) * 1000n !== required) throw insufficient();
      return choices.map((asset) => ({
        itemId: line.itemId,
        assetId: asset.id,
        quantity: '1',
      }));
    }
    const lots = await tx
      .select({
        lotId: inventoryLots.id,
        quantity: sql<string>`(${inventoryBalances.quantityOnHand} - ${reserved(sql`${inventoryLots.id}`)})::text`,
      })
      .from(inventoryBalances)
      .innerJoin(
        inventoryLots,
        and(
          eq(inventoryLots.id, inventoryBalances.lotId),
          eq(inventoryLots.farmId, inventoryBalances.farmId),
          eq(inventoryLots.itemId, inventoryBalances.itemId),
        ),
      )
      .where(
        and(
          base,
          sql`${inventoryBalances.quantityOnHand} - ${reserved(sql`${inventoryLots.id}`)} > 0`,
          sql`(${inventoryLots.expiryDate} IS NULL OR ${inventoryLots.expiryDate} >= ${new Date().toISOString().slice(0, 10)}::date)`,
        ),
      )
      .orderBy(
        sql`${inventoryLots.expiryDate} ASC NULLS LAST`,
        asc(inventoryLots.id),
      )
      .limit(1001);
    let remaining = quantityMillis(line.stockQuantity);
    const lines: Omit<typeof stockIssueItems.$inferInsert, 'stockIssueId'>[] =
      [];
    for (const lot of lots) {
      const available = quantityMillis(lot.quantity);
      const picked = available < remaining ? available : remaining;
      lines.push({
        itemId: line.itemId,
        lotId: lot.lotId,
        quantity: stockQuantity(picked),
      });
      remaining -= picked;
      if (remaining === 0n) break;
    }
    if (remaining > 0n) throw insufficient();
    return lines;
  }

  private async list(scope: SQL, filters: OrderFilters) {
    this.assertPagination(filters);
    const conditions: SQL[] = [
      scope,
      ...this.dateConditions(storeOrders.createdAt, filters),
    ];
    if (filters.status) conditions.push(eq(storeOrders.status, filters.status));
    if (filters.paymentStatus)
      conditions.push(eq(storeOrders.paymentStatus, filters.paymentStatus));
    if (filters.customerId)
      conditions.push(eq(storeOrders.userId, filters.customerId));
    if (filters.q !== undefined && typeof filters.q !== 'string')
      throw new BadRequestException('q must be a string');
    if (filters.q)
      conditions.push(sql`(
      strpos(lower('DH' || lpad(${storeOrders.orderNumber}::text, greatest(6, length(${storeOrders.orderNumber}::text)), '0')), lower(${filters.q})) > 0
      OR strpos(lower(${storeOrders.recipientName}), lower(${filters.q})) > 0
      OR strpos(${storeOrders.phone}, ${filters.q}) > 0
      OR strpos(lower(${users.email}), lower(${filters.q})) > 0
    )`);
    const where = and(...conditions);
    const db = this.databaseService.db;
    const [rows, [total]] = await Promise.all([
      db
        .select(getTableColumns(storeOrders))
        .from(storeOrders)
        .innerJoin(users, eq(users.id, storeOrders.userId))
        .where(where)
        .orderBy(desc(storeOrders.createdAt), desc(storeOrders.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      db
        .select({ value: count() })
        .from(storeOrders)
        .innerJoin(users, eq(users.id, storeOrders.userId))
        .where(where),
    ]);
    return {
      data: rows.map((order) => this.present(order)),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems: total.value,
        totalPages: Math.ceil(total.value / filters.pageSize),
      },
    };
  }

  private async detail(id: string, scope: SQL) {
    const db = this.databaseService.db;
    const [row] = await db
      .select({
        order: storeOrders,
        customer: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(storeOrders)
      .innerJoin(users, eq(users.id, storeOrders.userId))
      .where(and(eq(storeOrders.id, id), scope))
      .limit(1);
    if (!row) throw new NotFoundException('Order not found');
    const lines = await db
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, id))
      .orderBy(asc(storeOrderItems.id));
    const [issue] = row.order.stockIssueId
      ? await db
          .select({
            id: stockIssues.id,
            issueCode: stockIssues.issueCode,
            status: stockIssues.status,
          })
          .from(stockIssues)
          .where(eq(stockIssues.id, row.order.stockIssueId))
          .limit(1)
      : [];
    return {
      order: this.present(row.order),
      items: lines,
      customer: row.customer,
      stockIssue: issue ?? null,
    };
  }

  /** Customers never see warehouse, staff or stock-issue references. */
  private async customerDetail(id: string, userId: string) {
    const { order, items, customer } = await this.detail(
      id,
      eq(storeOrders.userId, userId),
    );
    return {
      order: this.customerOrder(order),
      items: items.map(({ itemId, ...line }) => {
        void itemId;
        return line;
      }),
      customer,
    };
  }

  private customerOrder(order: ReturnType<StoreOrdersService['present']>) {
    const {
      farmId,
      warehouseId,
      stockIssueId,
      paidByMemberId,
      handledByMemberId,
      ...data
    } = order;
    void [farmId, warehouseId, stockIssueId, paidByMemberId, handledByMemberId];
    return data;
  }

  private present(order: Order) {
    const { requestFingerprint, idempotencyKey, ...data } = order;
    void requestFingerprint;
    void idempotencyKey;
    return { ...data, code: orderCode(order.orderNumber) };
  }

  private async lockOrder(tx: Transaction, id: string, scope: SQL) {
    const [order] = await tx
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.id, id), scope))
      .for('update');
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private fingerprint(input: CreateStoreOrderDto) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          recipientName: input.recipientName,
          phone: input.phone,
          address: input.address,
          note: input.note || null,
          paymentMethod: input.paymentMethod,
          items: input.items
            .map((line) => ({
              variantId: line.variantId.toLowerCase(),
              quantity: line.quantity,
              expectedUnitPrice: line.expectedUnitPrice ?? null,
            }))
            .sort((a, b) => a.variantId.localeCompare(b.variantId)),
        }),
      )
      .digest('hex');
  }

  private async findReplay(
    userId: string,
    key: string,
    fingerprint: string,
    db: Db | Transaction = this.databaseService.db,
  ) {
    const [order] = await db
      .select()
      .from(storeOrders)
      .where(
        and(
          eq(storeOrders.userId, userId),
          eq(storeOrders.idempotencyKey, key),
        ),
      )
      .limit(1);
    if (order && order.requestFingerprint !== fingerprint)
      throw new ConflictException(
        'idempotencyKey was already used for a different order',
      );
    return order;
  }

  private databaseConstraint(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return;
    const dbError = error as { constraint?: string; cause?: unknown };
    return dbError.constraint ?? this.databaseConstraint(dbError.cause);
  }

  private async assertStoreFarm(farmId: string) {
    const db = this.databaseService.db;
    const [store] = await db
      .select({ farmId: warehouses.farmId })
      .from(storeSettings)
      .innerJoin(warehouses, eq(warehouses.id, storeSettings.warehouseId))
      .where(eq(storeSettings.id, 1))
      .limit(1);
    if (store?.farmId === farmId) return;
    // Existing orders retain their farm even after the selling warehouse changes.
    const [history] = await db
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(eq(storeOrders.farmId, farmId))
      .limit(1);
    if (!history) throw new ForbiddenException('Store belongs to another farm');
  }

  private async staffMember(farmId: string, clerkUserId: string) {
    await this.assertStoreFarm(farmId);
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (
      !roleCodes.some((role) =>
        ['ADMIN', 'FARM_OWNER', 'EMPLOYEE'].includes(role),
      )
    )
      throw new ForbiddenException('Order processing permission is required');
    return memberId;
  }

  private dateConditions(
    column: AnyPgColumn,
    filters: { from?: string; to?: string },
  ) {
    const conditions: SQL[] = [];
    if (filters.from)
      conditions.push(
        sql`${column} >= (${filters.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    if (filters.to)
      conditions.push(
        sql`${column} < ((${filters.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    return conditions;
  }

  private assertPagination(filters: PaginationParams) {
    if (!Number.isSafeInteger(filters.offset + filters.pageSize))
      throw new BadRequestException(
        'page exceeds the supported pagination range',
      );
  }
}

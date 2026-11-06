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
  auditLogs,
  farmMembers,
  inventoryBalances,
  inventoryLots,
  items,
  locations,
  paymentTransactions,
  stockIssueItems,
  stockIssues,
  stockTransferItems,
  stockTransfers,
  storeOrderReplenishments,
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
import { qrSvg } from '../../common/qr';
import { storeBankAccount } from '../payments/bank-account';
import { vietQrPayload } from '../payments/vietqr';
import { CommerceService } from '../commerce/commerce.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { auditStockDocument } from '../warehouses/stock-document-audit';
import {
  StockTransferHook,
  StockTransferHooks,
} from '../warehouses/stock-transfer-hooks';
import { CreateStoreOrderDto } from './dto/store-order.dto';
import {
  checkedMoney,
  orderCode,
  quantityMillis,
  stockQuantity,
} from './store-order.rules';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  STORE_DELIVERY_ROLES,
  STORE_MANAGE_ROLES,
  hasAnyRole,
} from '../auth/farm-access/farm-role-groups';

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
export class StoreOrdersService implements StockTransferHook {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commerce: CommerceService,
    private readonly warehousesService: WarehousesService,
    transferHooks?: StockTransferHooks,
  ) {
    transferHooks?.register(this);
  }

  async create(userId: string, input: CreateStoreOrderDto) {
    const fingerprint = this.fingerprint(input);
    const replay = await this.findReplay(
      userId,
      input.idempotencyKey,
      fingerprint,
    );
    if (replay) return this.customerDetail(replay.id, userId);
    if (input.paymentMethod === 'BANK_TRANSFER' && !storeBankAccount())
      throw new BadRequestException('Bank transfer is not available');

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
        const variants: {
          id: string;
          productId: string;
          productName: string;
          variantName: string;
          price: string;
          quantityStep: string;
          quantity: number;
        }[] = [];
        const seen = new Set<string>();
        for (const line of input.items) {
          const variantId = line.variantId.toLowerCase();
          if (seen.has(variantId))
            throw new BadRequestException('Duplicate variant');
          seen.add(variantId);
          const [variant] = await tx
            .select({
              id: storeProductVariants.id,
              productId: storeProducts.id,
              productName: storeProducts.name,
              variantName: storeProductVariants.name,
              price: storeProductVariants.price,
              quantityStep: storeProductVariants.quantityStep,
            })
            .from(storeProductVariants)
            .innerJoin(
              storeProducts,
              eq(storeProducts.id, storeProductVariants.productId),
            )
            .innerJoin(units, eq(units.id, storeProductVariants.unitId))
            .where(
              and(
                eq(storeProductVariants.id, variantId),
                this.commerce.orderableVariantConditions(),
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
          variants.push({ ...variant, quantity: line.quantity });
        }
        const { warehouse, itemIds } = await this.pickWarehouse(
          tx,
          input.region,
          variants,
        );
        let subtotal = 0n;
        const lines = variants.map((variant, index) => {
          const lineTotal = checkedMoney(
            BigInt(variant.price) * BigInt(variant.quantity),
          );
          subtotal += BigInt(lineTotal);
          return {
            variantId: variant.id,
            productId: variant.productId,
            itemId: itemIds[index],
            productName: variant.productName,
            variantName: variant.variantName,
            unitPrice: variant.price,
            quantity: variant.quantity,
            stockQuantity: stockQuantity(
              quantityMillis(variant.quantityStep) * BigInt(variant.quantity),
            ),
            lineTotal,
          };
        });
        const shippingFee = (await this.commerce.shippingFees(tx))[
          input.region
        ];
        if (shippingFee === undefined)
          throw new Error(`No shipping fee for region ${input.region}`);
        if (
          input.expectedShippingFee !== undefined &&
          input.expectedShippingFee !== shippingFee
        )
          throw new ConflictException({
            code: 'SHIPPING_FEE_CHANGED',
            message: 'Phí giao hàng đã thay đổi. Vui lòng kiểm tra lại.',
            shippingFee,
          });
        const [order] = await tx
          .insert(storeOrders)
          .values({
            userId,
            farmId: warehouse.farmId,
            warehouseId: warehouse.warehouseId,
            recipientName: input.recipientName,
            phone: input.phone,
            address: input.address,
            region: input.region,
            note: input.note || null,
            paymentMethod: input.paymentMethod,
            subtotal: checkedMoney(subtotal),
            shippingFee,
            total: checkedMoney(subtotal + BigInt(shippingFee)),
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
    const detail = await this.detail(id, eq(storeOrders.farmId, farmId));
    const payments = await this.databaseService.db
      .select({
        id: paymentTransactions.id,
        provider: paymentTransactions.provider,
        amount: paymentTransactions.amount,
        content: paymentTransactions.content,
        result: paymentTransactions.result,
        transactionAt: paymentTransactions.transactionAt,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, id))
      .orderBy(desc(paymentTransactions.createdAt));
    const replenishments = await this.databaseService.db
      .select({
        id: stockTransfers.id,
        transferCode: stockTransfers.transferCode,
        status: stockTransfers.status,
        fromWarehouseName: warehouses.name,
      })
      .from(storeOrderReplenishments)
      .innerJoin(
        stockTransfers,
        eq(stockTransfers.id, storeOrderReplenishments.stockTransferId),
      )
      .innerJoin(warehouses, eq(warehouses.id, stockTransfers.fromWarehouseId))
      .where(eq(storeOrderReplenishments.orderId, id))
      .orderBy(asc(storeOrderReplenishments.createdAt), asc(stockTransfers.id));
    const [shipper] = detail.order.shipperMemberId
      ? await this.databaseService.db
          .select({ memberId: farmMembers.id, fullName: users.fullName })
          .from(farmMembers)
          .innerJoin(users, eq(users.id, farmMembers.userId))
          .where(eq(farmMembers.id, detail.order.shipperMemberId))
          .limit(1)
      : [];
    const deliveryLog = await this.databaseService.db
      .select({
        action: auditLogs.action,
        actorName: users.fullName,
        data: auditLogs.newData,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(
        and(
          eq(auditLogs.entityType, 'STORE_ORDER'),
          eq(auditLogs.entityId, id),
        ),
      )
      .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
    return {
      ...detail,
      payments,
      replenishments,
      shipper: shipper ?? null,
      deliveryLog,
    };
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
      PREPARING: 0,
      CONFIRMED: 0,
      SHIPPING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const row of statusRows) counts[row.status] = row.value;
    return { counts, ...summary, daily, topProducts, topCustomers };
  }

  async confirm(farmId: string, clerkUserId: string, id: string) {
    const memberId = await this.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'PENDING' && order.status !== 'PREPARING')
        throw new ConflictException(
          'Only PENDING or PREPARING orders can be confirmed',
        );
      // A legacy PREPARING order still waits for its top-up transfers.
      if ((await this.pendingReplenishments(tx, id)).length > 0) return;
      await this.fulfil(tx, order, memberId, true);
    });
    return this.staffGet(farmId, id);
  }

  /** Called by StockTransferHooks before the transfer row is locked. */
  async lock(tx: Transaction, transferId: string) {
    const order = await this.replenishedOrder(tx, transferId);
    if (order?.status !== 'PREPARING') return;
    // Approving may confirm the order, which locks every balance it needs;
    // take them all now, in id order, before the transfer locks its own subset.
    const [transfer] = await tx
      .select({ fromWarehouseId: stockTransfers.fromWarehouseId })
      .from(stockTransfers)
      .where(eq(stockTransfers.id, transferId));
    await this.lockStock(tx, order, [transfer.fromWarehouseId]);
  }

  /**
   * Locks the order's balances in the sales warehouse (plus a legacy top-up
   * transfer's source) in id order, so confirmations of the same stock see
   * each other's drafts.
   */
  private async lockStock(
    tx: Transaction,
    order: Order,
    extraWarehouseIds: string[] = [],
  ) {
    const orderItems = await tx
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, order.id))
      .orderBy(asc(storeOrderItems.itemId));
    await tx
      .select({ id: inventoryBalances.id })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, order.farmId),
          inArray(inventoryBalances.warehouseId, [
            order.warehouseId,
            ...extraWarehouseIds,
          ]),
          inArray(
            inventoryBalances.itemId,
            orderItems.map((line) => line.itemId),
          ),
        ),
      )
      .orderBy(asc(inventoryBalances.id))
      .for('update');
    return orderItems;
  }

  /** A legacy order's last top-up transfer arrived: issue it from the sales warehouse. */
  async confirmed(tx: Transaction, transferId: string, memberId: string) {
    const order = await this.replenishedOrder(tx, transferId);
    if (order?.status !== 'PREPARING') return;
    if ((await this.pendingReplenishments(tx, order.id)).length > 0) return;
    // Stock taken meanwhile leaves the order PREPARING; staff confirm it again.
    await this.fulfil(tx, order, memberId, false);
  }

  /** A rejected top-up sends the order back to PENDING for staff to decide. */
  async rejected(tx: Transaction, transferId: string, memberId: string) {
    const order = await this.replenishedOrder(tx, transferId);
    if (order?.status !== 'PREPARING') return;
    await this.cancelReplenishments(tx, order.id, memberId);
    await tx
      .update(storeOrders)
      .set({
        status: 'PENDING',
        handledByMemberId: memberId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(storeOrders.id, order.id));
  }

  /** Order a top-up transfer was created for, locked FOR UPDATE. */
  private async replenishedOrder(tx: Transaction, transferId: string) {
    const [row] = await tx
      .select({ order: storeOrders })
      .from(storeOrderReplenishments)
      .innerJoin(
        storeOrders,
        eq(storeOrders.id, storeOrderReplenishments.orderId),
      )
      .where(eq(storeOrderReplenishments.stockTransferId, transferId))
      .for('update', { of: storeOrders });
    return row?.order;
  }

  private pendingReplenishments(tx: Transaction, orderId: string) {
    return tx
      .select({ transfer: stockTransfers })
      .from(storeOrderReplenishments)
      .innerJoin(
        stockTransfers,
        eq(stockTransfers.id, storeOrderReplenishments.stockTransferId),
      )
      .where(
        and(
          eq(storeOrderReplenishments.orderId, orderId),
          inArray(stockTransfers.status, ['DRAFT', 'PENDING_APPROVAL']),
        ),
      )
      .orderBy(asc(stockTransfers.id))
      .for('update', { of: stockTransfers });
  }

  private async cancelReplenishments(
    tx: Transaction,
    orderId: string,
    memberId: string | undefined,
  ) {
    const now = new Date().toISOString();
    for (const { transfer } of await this.pendingReplenishments(tx, orderId)) {
      await tx
        .update(stockTransfers)
        .set({ status: 'CANCELLED', cancelledAt: now, updatedAt: now })
        .where(eq(stockTransfers.id, transfer.id));
      await auditStockDocument(
        tx,
        // Customers cancel only PENDING orders; credit the transfer creator then.
        memberId ?? transfer.createdByMemberId,
        'STOCK_TRANSFER',
        'CANCEL',
        transfer,
        { ...transfer, status: 'CANCELLED' },
      );
    }
  }

  /**
   * Reserve the order in its sales warehouse with a DRAFT SALE issue and mark
   * it CONFIRMED. Only the sales warehouse counts (D03): when it is short,
   * `strict` fails with 409, otherwise the order is left as is.
   */
  private async fulfil(
    tx: Transaction,
    order: Order,
    memberId: string,
    strict: boolean,
  ) {
    const farmId = order.farmId;
    const id = order.id;
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
    const orderItems = await this.lockStock(tx, order);
    const allocations: Omit<
      typeof stockIssueItems.$inferInsert,
      'stockIssueId'
    >[] = [];
    for (const line of orderItems) {
      const picked = await this.pick(
        tx,
        order,
        line,
        order.warehouseId,
        quantityMillis(line.stockQuantity),
      );
      if (picked.remaining > 0n) {
        if (strict) throw this.insufficient(line);
        return;
      }
      allocations.push(...picked.lines);
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
      .values(allocations.map((line) => ({ ...line, stockIssueId: issue.id })));
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
  }

  /** The caller takes a confirmed order out for delivery and becomes its shipper. */
  async ship(farmId: string, clerkUserId: string, id: string) {
    const caller = await this.deliveryMember(farmId, clerkUserId);
    const { memberId } = caller;
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
          shipperMemberId: memberId,
          handledByMemberId: memberId,
          updatedAt: now,
        })
        .where(eq(storeOrders.id, id));
      await this.auditDelivery(tx, order, memberId, 'DELIVERY_CLAIM', {});
    });
    return this.deliveryResult(farmId, id, caller);
  }

  /** Delivered: the shipper (or a store manager) closes the order; COD cash counts as collected by them. */
  async complete(farmId: string, clerkUserId: string, id: string) {
    const caller = await this.deliveryMember(farmId, clerkUserId);
    const { memberId } = caller;
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'SHIPPING')
        throw new ConflictException('Only SHIPPING orders can be completed');
      this.assertShipper(order, caller);
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
      await this.auditDelivery(tx, order, memberId, 'DELIVERY_COMPLETE', {
        collectedCod:
          order.paymentMethod === 'COD' && order.paymentStatus === 'UNPAID',
      });
    });
    return this.deliveryResult(farmId, id, caller);
  }

  /** Delivery failed or was taken by mistake: back to CONFIRMED so anyone can take it again. */
  async returnDelivery(
    farmId: string,
    clerkUserId: string,
    id: string,
    reason: string,
  ) {
    const caller = await this.deliveryMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const order = await this.lockOrder(
        tx,
        id,
        eq(storeOrders.farmId, farmId),
      );
      if (order.status !== 'SHIPPING')
        throw new ConflictException('Only SHIPPING orders can be returned');
      this.assertShipper(order, caller);
      const now = new Date().toISOString();
      await tx
        .update(storeOrders)
        .set({
          status: 'CONFIRMED',
          shippedAt: null,
          shipperMemberId: null,
          handledByMemberId: caller.memberId,
          updatedAt: now,
        })
        .where(eq(storeOrders.id, id));
      await this.auditDelivery(tx, order, caller.memberId, 'DELIVERY_RETURN', {
        reason,
        shipperMemberId: order.shipperMemberId,
      });
    });
    return this.deliveryResult(farmId, id, caller);
  }

  /** Orders ready to take (`available`) or out with the caller (`mine`), with what to hand over. */
  async deliveries(
    farmId: string,
    clerkUserId: string,
    scope: 'available' | 'mine',
  ) {
    const { memberId } = await this.deliveryMember(farmId, clerkUserId);
    return this.deliveryRows(
      and(
        eq(storeOrders.farmId, farmId),
        scope === 'mine'
          ? and(
              eq(storeOrders.status, 'SHIPPING'),
              eq(storeOrders.shipperMemberId, memberId),
            )
          : and(
              eq(storeOrders.status, 'CONFIRMED'),
              eq(stockIssues.status, 'CONFIRMED'),
            ),
      )!,
    );
  }

  /**
   * After a delivery action: managers get the staff detail; other delivery
   * roles only the delivery view (no customer email, payments or warehouse data).
   */
  private async deliveryResult(
    farmId: string,
    id: string,
    caller: { manages: boolean },
  ) {
    if (caller.manages) return this.staffGet(farmId, id);
    const [order] = await this.deliveryRows(
      and(eq(storeOrders.farmId, farmId), eq(storeOrders.id, id))!,
    );
    return order;
  }

  private async deliveryRows(where: SQL) {
    const db = this.databaseService.db;
    const rows = await db
      .select({
        id: storeOrders.id,
        orderNumber: storeOrders.orderNumber,
        status: storeOrders.status,
        recipientName: storeOrders.recipientName,
        phone: storeOrders.phone,
        address: storeOrders.address,
        region: storeOrders.region,
        note: storeOrders.note,
        paymentMethod: storeOrders.paymentMethod,
        paymentStatus: storeOrders.paymentStatus,
        total: storeOrders.total,
        confirmedAt: storeOrders.confirmedAt,
        shippedAt: storeOrders.shippedAt,
      })
      .from(storeOrders)
      .innerJoin(stockIssues, eq(stockIssues.id, storeOrders.stockIssueId))
      .where(where)
      .orderBy(asc(storeOrders.confirmedAt), asc(storeOrders.id))
      // shortcut: oldest 100 only, no paging; add paging if a farm queues more.
      .limit(100);
    const lines = rows.length
      ? await db
          .select({
            orderId: storeOrderItems.orderId,
            productName: storeOrderItems.productName,
            variantName: storeOrderItems.variantName,
            quantity: storeOrderItems.quantity,
          })
          .from(storeOrderItems)
          .where(
            inArray(
              storeOrderItems.orderId,
              rows.map(({ id }) => id),
            ),
          )
          .orderBy(asc(storeOrderItems.id))
      : [];
    return rows.map(({ orderNumber, ...row }) => ({
      ...row,
      code: orderCode(orderNumber),
      items: lines
        .filter((line) => line.orderId === row.id)
        .map(({ orderId, ...line }) => {
          void orderId;
          return line;
        }),
    }));
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
        !(memberId && ['PREPARING', 'CONFIRMED'].includes(order.status))
      )
        throw new ConflictException(
          'Order cannot be cancelled in its current state',
        );
      if (order.paymentStatus === 'PAID')
        throw new ConflictException(
          'Paid orders require a refund workflow before cancellation',
        );
      await this.cancelReplenishments(tx, id, memberId);
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

  /**
   * First sales warehouse, in stable farm order, that alone holds every line:
   * an order is never split across warehouses.
   * shortcut: one stock query per warehouse and line, fine for a handful of
   * farms and small carts; batch per warehouse if farms grow into the dozens.
   */
  private async pickWarehouse(
    tx: Transaction,
    region: CreateStoreOrderDto['region'],
    lines: { id: string; quantity: number }[],
  ) {
    const coverage = await this.commerce.cartCoverage(
      tx,
      region,
      lines.map(({ id, quantity }) => ({ variantId: id, quantity })),
    );
    if (coverage.length === 0)
      throw new ConflictException({
        code: 'REGION_NOT_SUPPORTED',
        message: 'Chưa hỗ trợ giao hàng đến khu vực này.',
      });
    const full = coverage.find(({ items }) => items.size === lines.length);
    if (full)
      return {
        warehouse: full.warehouse,
        itemIds: lines.map((line) => full.items.get(line.id)!),
      };
    const covered = new Set(coverage.flatMap(({ items }) => [...items.keys()]));
    const missing = lines.find((line) => !covered.has(line.id));
    if (missing)
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Không đủ tồn kho cho số lượng đã chọn.',
        variantId: missing.id,
      });
    throw new ConflictException({
      code: 'CART_NOT_FULFILLABLE',
      message:
        'Chưa có kho nào đáp ứng đủ toàn bộ giỏ hàng. Vui lòng tách thành nhiều đơn.',
      groups: this.commerce.splitGroups(coverage),
    });
  }

  private insufficient(line: OrderItem) {
    return new ConflictException({
      code: 'INSUFFICIENT_STOCK',
      message: `Không đủ hàng cho ${line.productName} — ${line.variantName}.`,
      variantId: line.variantId,
    });
  }

  /**
   * Up to `required` (in thousandths) of `line` that `warehouseId` can still
   * give, net of unapproved issues and outgoing transfers already holding it.
   * Assets are only ever taken from the order's sales warehouse.
   */
  private async pick(
    tx: Transaction,
    order: Order,
    line: OrderItem,
    warehouseId: string,
    required: bigint,
  ) {
    type Pick = Omit<typeof stockIssueItems.$inferInsert, 'stockIssueId'>;
    const [item] = await tx
      .select({ trackingMode: items.trackingMode })
      .from(items)
      .where(and(eq(items.id, line.itemId), eq(items.farmId, order.farmId)))
      .limit(1);
    if (!item)
      throw new ConflictException('Order item no longer exists in the farm');
    const base = and(
      eq(inventoryBalances.farmId, order.farmId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.itemId, line.itemId),
    );
    const sameLot = (column: AnyPgColumn, lotId: SQL | null) =>
      lotId ? sql`${column} = ${lotId}` : sql`${column} IS NULL`;
    // Stock already held by other unapproved documents; approval would fail if picked twice.
    const reserved = (lotId: SQL | null) => sql`(COALESCE((
      SELECT SUM(${stockIssueItems.quantity})
      FROM ${stockIssueItems}
      JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
      WHERE ${stockIssues.warehouseId} = ${warehouseId}
        AND ${stockIssues.status} IN ('DRAFT', 'PENDING_APPROVAL')
        AND ${stockIssueItems.itemId} = ${line.itemId}
        AND ${sameLot(stockIssueItems.lotId, lotId)}
    ), 0) + COALESCE((
      SELECT SUM(${stockTransferItems.quantity})
      FROM ${stockTransferItems}
      JOIN ${stockTransfers} ON ${stockTransfers.id} = ${stockTransferItems.stockTransferId}
      WHERE ${stockTransfers.fromWarehouseId} = ${warehouseId}
        AND ${stockTransfers.status} IN ('DRAFT', 'PENDING_APPROVAL')
        AND ${stockTransferItems.itemId} = ${line.itemId}
        AND ${sameLot(stockTransferItems.lotId, lotId)}
    ), 0))`;
    if (item.trackingMode === 'ASSET') {
      if (warehouseId !== order.warehouseId)
        return { lines: [], remaining: required };
      if (required % 1000n !== 0n || required / 1000n > 1000n)
        throw new ConflictException('Invalid asset order quantity');
      const [balance] = await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            base,
            isNull(inventoryBalances.lotId),
            sql`${inventoryBalances.quantityOnHand} - ${reserved(null)} >= ${stockQuantity(required)}`,
          ),
        )
        .limit(1);
      if (!balance) return { lines: [], remaining: required };
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
      if (BigInt(choices.length) * 1000n !== required)
        return { lines: [], remaining: required };
      return {
        lines: choices.map((asset): Pick => ({
          itemId: line.itemId,
          assetId: asset.id,
          quantity: '1',
        })),
        remaining: 0n,
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    const stock =
      item.trackingMode === 'LOT'
        ? await tx
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
                sql`(${inventoryLots.expiryDate} IS NULL OR ${inventoryLots.expiryDate} >= ${today}::date)`,
              ),
            )
            .orderBy(
              sql`${inventoryLots.expiryDate} ASC NULLS LAST`,
              asc(inventoryLots.id),
            )
            .limit(1001)
        : await tx
            .select({
              lotId: sql<string | null>`NULL`,
              quantity: sql<string>`(${inventoryBalances.quantityOnHand} - ${reserved(null)})::text`,
            })
            .from(inventoryBalances)
            .where(
              and(
                base,
                isNull(inventoryBalances.lotId),
                sql`${inventoryBalances.quantityOnHand} - ${reserved(null)} > 0`,
              ),
            )
            .limit(1);
    let remaining = required;
    const lines: Pick[] = [];
    for (const row of stock) {
      if (remaining === 0n) break;
      const available = quantityMillis(row.quantity);
      const picked = available < remaining ? available : remaining;
      lines.push({
        itemId: line.itemId,
        ...(row.lotId ? { lotId: row.lotId } : {}),
        quantity: stockQuantity(picked),
      });
      remaining -= picked;
    }
    return { lines, remaining };
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
      payment: await this.transferInstructions(order),
    };
  }

  /** QR and account details while a bank-transfer order still awaits payment; the amount is always the stored total. */
  private async transferInstructions(order: {
    paymentMethod: Order['paymentMethod'];
    paymentStatus: Order['paymentStatus'];
    status: Order['status'];
    total: string;
    code: string;
  }) {
    const account = storeBankAccount();
    if (
      !account ||
      order.paymentMethod !== 'BANK_TRANSFER' ||
      order.paymentStatus !== 'UNPAID' ||
      order.status === 'CANCELLED'
    )
      return null;
    return {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      amount: order.total,
      content: order.code,
      qrSvg: await qrSvg(
        vietQrPayload({
          bin: account.bin,
          accountNumber: account.accountNumber,
          amount: order.total,
          content: order.code,
        }),
      ),
    };
  }

  private customerOrder(order: ReturnType<StoreOrdersService['present']>) {
    const {
      farmId,
      warehouseId,
      stockIssueId,
      paidByMemberId,
      handledByMemberId,
      shipperMemberId,
      paymentTransactionId,
      ...data
    } = order;
    void [
      farmId,
      warehouseId,
      stockIssueId,
      paidByMemberId,
      handledByMemberId,
      shipperMemberId,
      paymentTransactionId,
    ];
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
          region: input.region,
          note: input.note || null,
          paymentMethod: input.paymentMethod,
          expectedShippingFee: input.expectedShippingFee ?? null,
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
      .select({ farmId: storeSettings.farmId })
      .from(storeSettings)
      .where(eq(storeSettings.farmId, farmId))
      .limit(1);
    if (store) return;
    // Existing orders retain their farm even after the farm stops selling.
    const [history] = await db
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(eq(storeOrders.farmId, farmId))
      .limit(1);
    if (!history) throw new ForbiddenException('Farm does not sell online');
  }

  private async staffMember(farmId: string, clerkUserId: string) {
    await this.assertStoreFarm(farmId);
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (!hasAnyRole(roleCodes, STORE_MANAGE_ROLES))
      throw new ForbiddenException('Order processing permission is required');
    return memberId;
  }

  /** Delivery staff, employees and store managers; `manages` lets them act on others' deliveries. */
  private async deliveryMember(farmId: string, clerkUserId: string) {
    await this.assertStoreFarm(farmId);
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (!hasAnyRole(roleCodes, STORE_DELIVERY_ROLES))
      throw new ForbiddenException('Delivery permission is required');
    return { memberId, manages: hasAnyRole(roleCodes, STORE_MANAGE_ROLES) };
  }

  private assertShipper(
    order: Order,
    caller: { memberId: string; manages: boolean },
  ) {
    if (!caller.manages && order.shipperMemberId !== caller.memberId)
      throw new ForbiddenException(
        'Only the shipper of this order or a store manager can do this',
      );
  }

  private async auditDelivery(
    tx: Transaction,
    order: Order,
    memberId: string,
    action: 'DELIVERY_CLAIM' | 'DELIVERY_RETURN' | 'DELIVERY_COMPLETE',
    data: Record<string, unknown>,
  ) {
    await tx.insert(auditLogs).values({
      farmId: order.farmId,
      userId: sql`(SELECT user_id FROM farm_members WHERE id = ${memberId})`,
      action,
      entityType: 'STORE_ORDER',
      entityId: order.id,
      newData: { code: orderCode(order.orderNumber), ...data },
      // Real time, so steps inside one outer transaction still sort in order.
      createdAt: sql`clock_timestamp()`,
    });
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

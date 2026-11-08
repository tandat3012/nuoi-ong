import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { ClerkClient } from '@clerk/backend';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/modules/auth/accounts/auth.service';
import { StoreOrdersService } from '../src/modules/store-orders/store-orders.service';
import { StoreAdminService } from '../src/modules/store-admin/store-admin.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { parsePagination } from '../src/common/query-params';
import * as schema from '../src/db/schema';
import {
  cleanupOrders,
  OrderTestDb,
  seedOrders,
  testBankAccount,
  withEnv,
} from './store-orders.fixture';

describe('Store orders (migrated PostgreSQL)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  type Context = Awaited<ReturnType<typeof seedOrders>>;
  const inRollback = async (
    fn: (ctx: Context, tx: OrderTestDb) => Promise<void>,
  ) => {
    try {
      await db.transaction(async (tx) => {
        const scoped = tx as unknown as OrderTestDb;
        await fn(await seedOrders(scoped), scoped);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };
  let restoreEnv: () => void;
  beforeAll(() => {
    restoreEnv = withEnv(testBankAccount);
  });
  afterAll(async () => {
    restoreEnv();
    await pool.end();
  });

  it('keeps order tables behind the API rather than direct Supabase Data API access', async () => {
    const result = await pool.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE oid IN ('public.store_orders'::regclass, 'public.store_order_items'::regclass)
       ORDER BY relname`,
    );
    expect(result.rows).toEqual([
      { relname: 'store_order_items', relrowsecurity: true },
      { relname: 'store_orders', relrowsecurity: true },
    ]);
  });

  it('tells staff which of their farms sell online and nothing to customers', () =>
    inRollback(async ({ ids, database }) => {
      const auth = new AuthService(database, {} as ClerkClient);
      expect((await auth.getAuthContext(ids.staff)).storeFarmIds).toEqual([
        ids.farm,
      ]);
      expect((await auth.getAuthContext(ids.customer)).storeFarmIds).toEqual(
        [],
      );
    }));

  it('adds the fee of the delivery region and rejects a fee the customer did not see', () =>
    inRollback(async ({ ids, service, input, database }, tx) => {
      const admin = new StoreAdminService(
        database,
        {} as unknown as CloudinaryService,
      );
      await expect(
        service.create(ids.customer, {
          ...input(),
          expectedShippingFee: '20000',
        }),
      ).rejects.toMatchObject({
        response: { code: 'SHIPPING_FEE_CHANGED', shippingFee: '30000' },
      });
      const placed = await service.create(ids.customer, {
        ...input(),
        expectedShippingFee: '30000',
      });
      expect(placed.order).toMatchObject({
        shippingFee: '30000',
        total: '585000',
      });
      // A Clerk id unlike the user's UUID, so the audit must resolve the user.
      const editor = randomUUID();
      await tx.insert(schema.users).values({
        id: editor,
        authProvider: 'CLERK',
        authProviderUserId: `user_${editor}`,
        email: `${editor}@orders.test`,
        fullName: 'Fee editor',
      });
      expect(
        await admin.updateShippingFees(ids.farm, `user_${editor}`, {
          NORTH: '0',
          CENTRAL: '15000',
          SOUTH: '45000',
        }),
      ).toEqual({ NORTH: '0', CENTRAL: '15000', SOUTH: '45000' });
      // AC29: every fee change is audited with who changed what.
      expect(
        await tx
          .select({
            farmId: schema.auditLogs.farmId,
            userId: schema.auditLogs.userId,
            oldData: schema.auditLogs.oldData,
            newData: schema.auditLogs.newData,
          })
          .from(schema.auditLogs)
          .where(
            and(
              eq(schema.auditLogs.farmId, ids.farm),
              eq(schema.auditLogs.action, 'SHIPPING_FEES_UPDATED'),
            ),
          ),
      ).toEqual([
        {
          farmId: ids.farm,
          userId: editor,
          oldData: { NORTH: '40000', CENTRAL: '20000', SOUTH: '30000' },
          newData: { NORTH: '0', CENTRAL: '15000', SOUTH: '45000' },
        },
      ]);
      const next = await service.create(ids.customer, input());
      expect(next.order).toMatchObject({
        shippingFee: '45000',
        total: '600000',
      });
      // Orders already placed keep their fee.
      expect(
        (await service.customerGet(ids.customer, placed.order.id)).order.total,
      ).toBe('585000');
    }));

  it('lets delivery staff take an order, return it with a reason and mark it delivered', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      const [deliveryRole] = await tx
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.code, 'DELIVERY_STAFF'));
      const shippers = [randomUUID(), randomUUID()];
      const members = [randomUUID(), randomUUID()];
      await tx.insert(schema.users).values(
        shippers.map((id, index) => ({
          id,
          authProvider: 'CLERK',
          authProviderUserId: id,
          email: `${id}@orders.test`,
          fullName: `Shipper ${index + 1}`,
        })),
      );
      await tx.insert(schema.farmMembers).values(
        members.map((id, index) => ({
          id,
          farmId: ids.farm,
          userId: shippers[index],
        })),
      );
      await tx.insert(schema.farmMemberRoles).values(
        members.map((farmMemberId) => ({
          farmMemberId,
          roleId: deliveryRole.id,
        })),
      );
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      // Not ready to take until the stock issue is approved.
      expect(
        await service.deliveries(ids.farm, shippers[0], 'available'),
      ).toEqual([]);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      const [ready] = await service.deliveries(
        ids.farm,
        shippers[0],
        'available',
      );
      expect(ready).toMatchObject({
        id: order.id,
        total: '585000',
        phone: '0901234567',
        items: [{ quantity: 3 }],
      });
      await expect(
        service.confirm(ids.farm, shippers[0], order.id),
      ).rejects.toThrow('Order processing permission');

      const taken = await service.ship(ids.farm, shippers[0], order.id);
      // Non-managers get the delivery view only, never the staff detail.
      expect(taken).toMatchObject({ id: order.id, status: 'SHIPPING' });
      for (const key of ['order', 'customer', 'payments', 'replenishments'])
        expect(taken).not.toHaveProperty(key);
      const out = await service.staffGet(ids.farm, order.id);
      expect(out.order.shipperMemberId).toBe(members[0]);
      expect(out.shipper).toEqual({
        memberId: members[0],
        fullName: 'Shipper 1',
      });
      expect(
        await service.deliveries(ids.farm, shippers[0], 'mine'),
      ).toHaveLength(1);
      expect(await service.deliveries(ids.farm, shippers[1], 'mine')).toEqual(
        [],
      );
      await expect(
        service.complete(ids.farm, shippers[1], order.id),
      ).rejects.toThrow('Only the shipper');
      await expect(
        service.returnDelivery(ids.farm, shippers[1], order.id, 'Nhầm'),
      ).rejects.toThrow('Only the shipper');

      const returned = await service.returnDelivery(
        ids.farm,
        shippers[0],
        order.id,
        'Khách không nghe máy',
      );
      expect(returned).toMatchObject({ status: 'CONFIRMED', shippedAt: null });
      expect(returned).not.toHaveProperty('customer');
      expect(
        (await service.staffGet(ids.farm, order.id)).order.shipperMemberId,
      ).toBeNull();
      await service.ship(ids.farm, shippers[1], order.id);
      expect(
        await service.complete(ids.farm, shippers[1], order.id),
      ).toMatchObject({ status: 'COMPLETED', paymentStatus: 'PAID' });
      const done = await service.staffGet(ids.farm, order.id);
      expect(done.order).toMatchObject({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidByMemberId: members[1],
        shipperMemberId: members[1],
      });
      expect(
        done.deliveryLog.map(({ action, actorName }) => [action, actorName]),
      ).toEqual([
        ['DELIVERY_CLAIM', 'Shipper 1'],
        ['DELIVERY_RETURN', 'Shipper 1'],
        ['DELIVERY_CLAIM', 'Shipper 2'],
        ['DELIVERY_COMPLETE', 'Shipper 2'],
      ]);
      expect(done.deliveryLog[1].data).toMatchObject({
        reason: 'Khách không nghe máy',
        shipperMemberId: members[0],
      });
      expect(
        (await service.customerGet(ids.customer, order.id)).order,
      ).not.toHaveProperty('shipperMemberId');
    }));

  it('takes prices from the server and snapshots fractional stock steps', () =>
    inRollback(async ({ ids, service, input }) => {
      const detail = await service.create(ids.customer, input());
      expect(detail.order).toMatchObject({
        status: 'PENDING',
        subtotal: '555000',
        total: '585000',
        shippingFee: '30000',
      });
      expect(
        (await service.staffGet(ids.farm, detail.order.id)).order,
      ).toMatchObject({
        farmId: ids.farm,
        warehouseId: ids.warehouse,
      });
      // Customer responses hide warehouse, staff and stock-issue references.
      for (const key of [
        'farmId',
        'warehouseId',
        'stockIssueId',
        'handledByMemberId',
        'paidByMemberId',
      ])
        expect(detail.order).not.toHaveProperty(key);
      expect(detail.items[0]).not.toHaveProperty('itemId');
      expect(detail).not.toHaveProperty('stockIssue');
      expect(detail.items[0]).toMatchObject({
        productSlug: ids.product,
        quantity: 3,
        stockQuantity: '0.375',
        unitPrice: '185000',
        lineTotal: '555000',
        deliveredAssets: [],
      });
      expect(detail.order.code).toMatch(/^DH\d{6,}$/);
      expect(detail.order).not.toHaveProperty('requestFingerprint');
    }));

  it('replays before checking changed prices, stock, or membership, and rejects changed payloads', () =>
    inRollback(async ({ ids, service, input }, tx) => {
      const request = input();
      const first = await service.create(ids.customer, request);
      await tx
        .update(schema.storeProductVariants)
        .set({ price: '200000', active: false })
        .where(eq(schema.storeProductVariants.id, ids.variant));
      expect((await service.create(ids.customer, request)).order.id).toBe(
        first.order.id,
      );
      await expect(
        service.create(ids.customer, {
          ...request,
          address: 'A different address',
        }),
      ).rejects.toThrow('different order');
      expect(
        (
          await tx
            .select({ count: count() })
            .from(schema.storeOrders)
            .where(eq(schema.storeOrders.userId, ids.customer))
        )[0].count,
      ).toBe(1);
    }));

  it('rejects stale price consent, insufficient quantity and unpublished products', () =>
    inRollback(async ({ ids, service, input }, tx) => {
      const request = input();
      await expect(
        service.create(ids.customer, {
          ...request,
          items: [{ ...request.items[0], expectedUnitPrice: '1' }],
        }),
      ).rejects.toThrow('Giá đã thay đổi');
      await expect(service.create(ids.customer, input(100))).rejects.toThrow(
        'Không đủ tồn kho',
      );
      await tx
        .update(schema.storeProducts)
        .set({ status: 'ARCHIVED' })
        .where(eq(schema.storeProducts.id, ids.product));
      await expect(service.create(ids.customer, input())).rejects.toThrow(
        'không còn bán',
      );
    }));

  it('does not expose another customer order and does not allow staff checkout', () =>
    inRollback(async ({ ids, service, input }) => {
      const { order } = await service.create(ids.customer, input());
      await expect(
        service.customerGet(ids.otherCustomer, order.id),
      ).rejects.toThrow('Order not found');
      await expect(
        service.customerCancel(ids.otherCustomer, order.id, 'No'),
      ).rejects.toThrow('Order not found');
      await expect(service.create(ids.staff, input())).rejects.toThrow(
        'Only customer',
      );
      await expect(service.staffGet(ids.otherFarm, order.id)).rejects.toThrow(
        'does not sell online',
      );
    }));

  it('confirms into one draft without deducting stock; shipping waits for admin approval', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      expect(confirmed.stockIssue).toMatchObject({
        status: 'DRAFT',
        issueCode: null,
      });
      const issue = await issues.get(
        confirmed.stockIssue.id,
        ids.farm,
        ids.staff,
      );
      expect(issue.issue).toMatchObject({
        issueType: 'SALE',
        createdByMemberId: ids.member,
        orderId: order.id,
      });
      expect(issue.items).toHaveLength(1);
      expect(issue.items[0].quantity).toBe('0.375');
      expect(
        (
          await tx
            .select()
            .from(schema.inventoryBalances)
            .where(eq(schema.inventoryBalances.itemId, ids.item))
        )[0].quantityOnHand,
      ).toBe('10.000');
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toThrow('Only PENDING');
      await expect(service.ship(ids.farm, ids.staff, order.id)).rejects.toThrow(
        'approved',
      );
      await expect(
        issues.confirm(issue.issue.id, ids.farm, ids.staff),
      ).rejects.toThrow('write permission');
      const approved = await issues.confirm(
        issue.issue.id,
        ids.farm,
        ids.admin,
      );
      expect(approved.issue.issueCode).toMatch(/^PX-\d{4}-\d{6}$/);
      expect(
        (
          await tx
            .select()
            .from(schema.inventoryBalances)
            .where(eq(schema.inventoryBalances.itemId, ids.item))
        )[0].quantityOnHand,
      ).toBe('9.625');
      await service.ship(ids.farm, ids.staff, order.id);
      await service.complete(ids.farm, ids.staff, order.id);
      expect((await service.staffGet(ids.farm, order.id)).order).toMatchObject({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidByMemberId: ids.member,
      });
      // AC16: shipping and completing never deduct again.
      expect(
        (
          await tx
            .select()
            .from(schema.inventoryBalances)
            .where(eq(schema.inventoryBalances.itemId, ids.item))
        )[0].quantityOnHand,
      ).toBe('9.625');
      expect(
        await tx
          .select({ change: schema.inventoryTransactions.quantityChange })
          .from(schema.inventoryTransactions)
          .where(eq(schema.inventoryTransactions.itemId, ids.item)),
      ).toEqual([{ change: '-0.375' }]);
    }));

  it('uses saved stock quantity and warehouse when variant step or store settings change', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      const { order } = await service.create(ids.customer, input());
      await tx
        .update(schema.storeProductVariants)
        .set({ quantityStep: '2', price: '200000' })
        .where(eq(schema.storeProductVariants.id, ids.variant));
      await tx
        .update(schema.storeSettings)
        .set({ salesWarehouseId: ids.otherWarehouse })
        .where(eq(schema.storeSettings.farmId, ids.farm));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      const issue = await issues.get(
        confirmed.stockIssue.id,
        ids.farm,
        ids.admin,
      );
      expect(issue.issue.warehouseId).toBe(ids.warehouse);
      expect(issue.items[0].quantity).toBe('0.375');
      expect(confirmed.order.total).toBe('585000');
    }));

  it('keeps internal storefront tables behind row-level security', () =>
    inRollback(async (_ctx, tx) => {
      const { rows } = await tx.execute<{ relrowsecurity: boolean }>(
        sql`SELECT relrowsecurity FROM pg_class
            WHERE oid IN ('public.store_source_warehouses'::regclass,
                          'public.store_order_replenishments'::regclass)`,
      );
      expect(rows.map((row) => row.relrowsecurity)).toEqual([true, true]);
    }));

  const orderStatus = async (tx: OrderTestDb, id: string) =>
    (
      await tx
        .select({ status: schema.storeOrders.status })
        .from(schema.storeOrders)
        .where(eq(schema.storeOrders.id, id))
    )[0].status;

  const setSalesStock = (tx: OrderTestDb, { ids }: Context, quantity: string) =>
    tx
      .update(schema.inventoryBalances)
      .set({ quantityOnHand: quantity })
      .where(eq(schema.inventoryBalances.warehouseId, ids.warehouse));

  it('sells only what the sales warehouse holds, never from a source warehouse (AC14, AC17)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, commerce, input } = ctx;
      // A legacy source row with plenty of stock adds nothing.
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.farm,
        warehouseId: ids.otherWarehouse,
        itemId: ids.item,
        quantityOnHand: '100',
      });
      await tx
        .insert(schema.storeSourceWarehouses)
        .values({ warehouseId: ids.otherWarehouse, farmId: ids.farm });
      // 96 × 0.125 = 12 needed; the sales warehouse has 10.
      expect(
        (await commerce.getProduct(ids.product, 'SOUTH', 96)).variants[0]
          .availability,
      ).toBe('INSUFFICIENT_IN_REGION');
      await expect(
        service.create(ids.customer, input(96)),
      ).rejects.toMatchObject({
        response: { code: 'INSUFFICIENT_STOCK', variantId: ids.variant },
      });

      // Placed while 10 were there; only 9 are left at confirmation.
      const { order } = await service.create(ids.customer, input(80));
      await setSalesStock(tx, ctx, '9');
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'INSUFFICIENT_STOCK', variantId: ids.variant },
      });
      const after = await service.staffGet(ids.farm, order.id);
      expect(after.order.status).toBe('PENDING');
      expect(after.stockIssue).toBeNull();
      expect(after.replenishments).toEqual([]);
      expect(
        await tx
          .select({ id: schema.stockTransfers.id })
          .from(schema.stockTransfers)
          .where(eq(schema.stockTransfers.farmId, ids.farm)),
      ).toEqual([]);
    }));

  it('promises only sales stock not held by confirmed orders or outgoing transfers', () =>
    inRollback(async (ctx) => {
      const { ids, service, commerce, transfers, input } = ctx;
      const label = async (quantity: number) =>
        (await commerce.getProduct(ids.product, 'SOUTH', quantity)).variants[0]
          .availability;
      // 64 × 0.125 = 8 of the 10 held by a confirmed order; 2 are left.
      const { order } = await service.create(ids.customer, input(64));
      await service.confirm(ids.farm, ids.staff, order.id);
      expect(await label(16)).toBe('AVAILABLE');
      expect(await label(24)).toBe('INSUFFICIENT_IN_REGION');
      await expect(
        service.create(ids.customer, input(24)),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
      // A draft transfer of 1 out of the sales warehouse holds stock too.
      await transfers.create(ids.farm, ids.admin, {
        fromWarehouseId: ids.warehouse,
        toWarehouseId: ids.otherWarehouse,
        items: [{ itemId: ids.item, quantity: '1' }],
      });
      expect(await label(16)).toBe('INSUFFICIENT_IN_REGION');
      expect(await label(8)).toBe('AVAILABLE');
    }));

  /**
   * A PREPARING order from before T06: the sales warehouse holds 8 of the 10
   * it needs and submitted top-up transfers bring the rest from sources.
   */
  async function legacyPreparing(
    ctx: Context,
    tx: OrderTestDb,
    tops: string[],
  ) {
    const { ids, service, transfers, input } = ctx;
    const { order } = await service.create(ids.customer, input(80));
    await setSalesStock(tx, ctx, '8');
    const transferIds: string[] = [];
    for (const quantity of tops) {
      const fromWarehouseId = randomUUID();
      await tx.insert(schema.warehouses).values({
        id: fromWarehouseId,
        farmId: ids.farm,
        code: `SRC-${fromWarehouseId.slice(0, 8)}`,
        name: 'Source',
      });
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.farm,
        warehouseId: fromWarehouseId,
        itemId: ids.item,
        quantityOnHand: '100',
      });
      const { transfer } = await transfers.create(ids.farm, ids.admin, {
        fromWarehouseId,
        toWarehouseId: ids.warehouse,
        items: [{ itemId: ids.item, quantity }],
      });
      await transfers.submit(transfer.id, ids.farm, ids.admin);
      await tx
        .insert(schema.storeOrderReplenishments)
        .values({ stockTransferId: transfer.id, orderId: order.id });
      transferIds.push(transfer.id);
    }
    await tx
      .update(schema.storeOrders)
      .set({ status: 'PREPARING' })
      .where(eq(schema.storeOrders.id, order.id));
    return { order, transferIds };
  }

  it('confirms a legacy PREPARING order once its top-up transfer is approved (AC21)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, transfers } = ctx;
      const { order, transferIds } = await legacyPreparing(ctx, tx, ['2']);
      // Confirming while the transfer is pending is refused and changes nothing.
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'REPLENISHMENT_PENDING' },
      });
      const waiting = await service.staffGet(ids.farm, order.id);
      expect(waiting.order.status).toBe('PREPARING');
      expect(waiting.replenishments).toHaveLength(1);
      await expect(
        service.customerCancel(ids.customer, order.id, 'changed mind'),
      ).rejects.toThrow('current state');

      // Dispatched is not arrived: the order still waits.
      await transfers.confirm(transferIds[0], ids.farm, ids.admin);
      expect(await orderStatus(tx, order.id)).toBe('PREPARING');
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({ response: { code: 'REPLENISHMENT_PENDING' } });
      await transfers.receive(transferIds[0], ids.farm, ids.admin);
      const confirmed = await service.staffGet(ids.farm, order.id);
      expect(confirmed.order.status).toBe('CONFIRMED');
      const [issue] = await tx
        .select({ warehouseId: schema.stockIssues.warehouseId })
        .from(schema.stockIssues)
        .where(eq(schema.stockIssues.id, confirmed.stockIssue.id));
      expect(issue.warehouseId).toBe(ids.warehouse);
    }));

  it('sends a legacy order back to PENDING on rejection and never drafts a new top-up', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, transfers } = ctx;
      const { order, transferIds } = await legacyPreparing(ctx, tx, ['1', '1']);
      const [first, second] = transferIds;
      await transfers.confirm(first, ids.farm, ids.admin);
      await transfers.receive(first, ids.farm, ids.admin);
      expect(await orderStatus(tx, order.id)).toBe('PREPARING');
      await transfers.reject(second, ids.farm, ids.admin, 'Hết xe');
      expect(await orderStatus(tx, order.id)).toBe('PENDING');

      // 9 of 10 in the sales warehouse: confirming again fails instead.
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({ status: 409 });
      const after = await service.staffGet(ids.farm, order.id);
      expect(after.order.status).toBe('PENDING');
      expect(after.replenishments.map((row) => row.status).sort()).toEqual([
        'CONFIRMED',
        'REJECTED',
      ]);
    }));

  it('cancels a legacy order with its pending top-up transfers', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, transfers } = ctx;
      const { order, transferIds } = await legacyPreparing(ctx, tx, ['2']);
      const cancelled = await service.staffCancel(
        ids.farm,
        ids.staff,
        order.id,
        'Khách đổi ý',
      );
      expect(cancelled.order.status).toBe('CANCELLED');
      expect(cancelled.replenishments[0].status).toBe('CANCELLED');
      await expect(
        transfers.confirm(transferIds[0], ids.farm, ids.admin),
      ).rejects.toThrow('Only DRAFT or PENDING_APPROVAL');
    }));

  it('cancelling a legacy order leaves a dispatched top-up on its way to the sales warehouse', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, transfers } = ctx;
      const { order, transferIds } = await legacyPreparing(ctx, tx, ['2']);
      await transfers.confirm(transferIds[0], ids.farm, ids.admin);
      const cancelled = await service.staffCancel(
        ids.farm,
        ids.staff,
        order.id,
        'Khách đổi ý',
      );
      expect(cancelled.order.status).toBe('CANCELLED');
      // The goods already left the source: they must still be received.
      expect(cancelled.replenishments[0].status).toBe('IN_TRANSIT');
      await transfers.receive(transferIds[0], ids.farm, ids.admin);
      expect(await orderStatus(tx, order.id)).toBe('CANCELLED');
    }));

  it('keeps a legacy order PREPARING when stock is gone by the time the transfer arrives', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, transfers } = ctx;
      const { order, transferIds } = await legacyPreparing(ctx, tx, ['2']);
      await setSalesStock(tx, ctx, '0');
      await transfers.confirm(transferIds[0], ids.farm, ids.admin);
      await transfers.receive(transferIds[0], ids.farm, ids.admin);
      expect(await orderStatus(tx, order.id)).toBe('PREPARING');
      // Only 2 arrived: staff get a 409, not a new transfer.
      await expect(
        service.confirm(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (await service.staffGet(ids.farm, order.id)).replenishments,
      ).toHaveLength(1);
    }));

  /** A second farm selling the fixture variant from its own sales warehouse. */
  async function addSeller(
    { ids }: Context,
    tx: OrderTestDb,
    quantityOnHand: string,
  ) {
    const warehouseId = randomUUID();
    const itemId = randomUUID();
    await tx.insert(schema.warehouses).values({
      id: warehouseId,
      farmId: ids.otherFarm,
      code: 'SALE',
      name: 'Other sales',
    });
    await tx.insert(schema.items).values({
      id: itemId,
      farmId: ids.otherFarm,
      categoryId: ids.category,
      unitId: ids.unit,
      code: itemId,
      name: 'Honey elsewhere',
      itemType: 'MATERIAL',
      trackingMode: 'QUANTITY',
    });
    await tx.insert(schema.storeSettings).values({
      farmId: ids.otherFarm,
      salesWarehouseId: warehouseId,
      salesEnabled: true,
      regions: ['SOUTH'],
    });
    await tx
      .insert(schema.storeVariantItems)
      .values({ variantId: ids.variant, farmId: ids.otherFarm, itemId });
    await tx.insert(schema.inventoryBalances).values({
      farmId: ids.otherFarm,
      warehouseId,
      itemId,
      quantityOnHand,
    });
    return { warehouseId, itemId };
  }

  it('fills an order from one sales warehouse, never adding stock across farms or internal warehouses', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, commerce, input } = ctx;
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.farm,
        warehouseId: ids.otherWarehouse,
        itemId: ids.item,
        quantityOnHand: '100',
      });
      // Farms of the shared database stop selling inside this rolled-back transaction.
      await tx
        .update(schema.storeSettings)
        .set({ salesEnabled: false })
        .where(ne(schema.storeSettings.farmId, ids.farm));
      const other = await addSeller(ctx, tx, '10');
      // 96 × 0.125 = 12: each sales warehouse has 10, together 20.
      await expect(
        service.create(ids.customer, input(96)),
      ).rejects.toMatchObject({
        response: { code: 'INSUFFICIENT_STOCK', variantId: ids.variant },
      });
      await tx
        .update(schema.inventoryBalances)
        .set({ quantityOnHand: '12' })
        .where(eq(schema.inventoryBalances.itemId, other.itemId));
      // The other farm only serves the south.
      await expect(
        service.create(ids.customer, { ...input(96), region: 'NORTH' }),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
      await tx
        .update(schema.storeSettings)
        .set({ regions: ['NORTH'] })
        .where(eq(schema.storeSettings.farmId, ids.farm));
      await expect(
        service.create(ids.customer, { ...input(), region: 'CENTRAL' }),
      ).rejects.toMatchObject({ response: { code: 'REGION_NOT_SUPPORTED' } });
      const label = async (region?: 'NORTH' | 'CENTRAL' | 'SOUTH', qty = 1) =>
        (await commerce.getProduct(ids.product, region, qty)).variants[0]
          .availability;
      expect(await label()).toBe('REGION_REQUIRED');
      expect(await label('CENTRAL')).toBe('REGION_NOT_SUPPORTED');
      expect(await label('SOUTH', 96)).toBe('AVAILABLE');
      expect(await label('SOUTH', 97)).toBe('INSUFFICIENT_IN_REGION');
      // The product label follows the same quantity as its variants.
      expect(
        (await commerce.getProduct(ids.product, 'SOUTH', 97)).availability,
      ).toBe('INSUFFICIENT_IN_REGION');
      expect(
        (
          await commerce.listProducts(
            { page: 1, pageSize: 20, offset: 0 },
            {
              region: 'CENTRAL',
              category: undefined,
            },
          )
        ).data.find(({ id }) => id === ids.product)?.availability,
      ).toBe('REGION_NOT_SUPPORTED');
      await expect(
        commerce.cartAvailability('SOUTH', [
          { variantId: ids.variant, quantity: 96 },
        ]),
      ).resolves.toEqual({
        canOrder: true,
        lines: [{ variantId: ids.variant, availability: 'AVAILABLE' }],
        groups: [],
      });
      // A cart line the order would reject is never reported as orderable.
      await tx
        .update(schema.storeProducts)
        .set({ status: 'ARCHIVED' })
        .where(eq(schema.storeProducts.id, ids.product));
      await expect(
        commerce.cartAvailability('SOUTH', [
          { variantId: ids.variant, quantity: 96 },
        ]),
      ).resolves.toEqual({
        canOrder: false,
        lines: [{ variantId: ids.variant, availability: 'OUT_OF_STOCK' }],
        groups: [],
      });
      await tx
        .update(schema.storeProducts)
        .set({ status: 'PUBLISHED' })
        .where(eq(schema.storeProducts.id, ids.product));
      const { order } = await service.create(ids.customer, input(96));
      const [saved] = await tx
        .select()
        .from(schema.storeOrders)
        .where(eq(schema.storeOrders.id, order.id));
      expect(saved).toMatchObject({
        farmId: ids.otherFarm,
        warehouseId: other.warehouseId,
        region: 'SOUTH',
      });
      const [line] = await tx
        .select()
        .from(schema.storeOrderItems)
        .where(eq(schema.storeOrderItems.orderId, order.id));
      expect(line.itemId).toBe(other.itemId);
      // The north still has stock, but it is never shipped south.
      await tx
        .update(schema.inventoryBalances)
        .set({ quantityOnHand: '0' })
        .where(eq(schema.inventoryBalances.itemId, other.itemId));
      expect(await label('SOUTH')).toBe('OUT_IN_REGION');
    }));

  it('refuses a cart that no single sales warehouse can fill', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, input } = ctx;
      await addSeller(ctx, tx, '0');
      const secondVariant = randomUUID();
      const secondItem = randomUUID();
      await tx.insert(schema.storeProductVariants).values({
        id: secondVariant,
        productId: ids.product,
        unitId: ids.unit,
        name: 'Thùng',
        price: '50000',
      });
      await tx.insert(schema.items).values({
        id: secondItem,
        farmId: ids.otherFarm,
        categoryId: ids.category,
        unitId: ids.unit,
        code: secondItem,
        name: 'Hive',
        itemType: 'MATERIAL',
        trackingMode: 'QUANTITY',
      });
      await tx.insert(schema.storeVariantItems).values({
        variantId: secondVariant,
        farmId: ids.otherFarm,
        itemId: secondItem,
      });
      const [otherSettings] = await tx
        .select()
        .from(schema.storeSettings)
        .where(eq(schema.storeSettings.farmId, ids.otherFarm));
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.otherFarm,
        warehouseId: otherSettings.salesWarehouseId!,
        itemId: secondItem,
        quantityOnHand: '5',
      });
      const request = input(1);
      request.items.push({ variantId: secondVariant, quantity: 1 });
      await expect(service.create(ids.customer, request)).rejects.toMatchObject(
        { response: { code: 'CART_NOT_FULFILLABLE' } },
      );
      // The 409 says which lines could be ordered separately.
      const failure = await service
        .create(ids.customer, { ...request, idempotencyKey: randomUUID() })
        .catch((error: { response: { groups: string[][] } }) => error);
      const { groups } = (failure as { response: { groups: string[][] } })
        .response;
      expect(groups).toHaveLength(2);
      expect(groups.flat().sort()).toEqual([ids.variant, secondVariant].sort());
      const cart = await ctx.commerce.cartAvailability('SOUTH', request.items);
      expect(cart.canOrder).toBe(false);
      expect(cart.lines.map(({ availability }) => availability)).toEqual([
        'AVAILABLE',
        'AVAILABLE',
      ]);
      // Each line can still be its own order from a different warehouse.
      expect(cart.groups).toHaveLength(2);
      expect(cart.groups).toEqual(
        expect.arrayContaining([[ids.variant], [secondVariant]]),
      );
    }));

  it('confirms an order next to a legacy XB- issue code without reusing it', () =>
    inRollback(async ({ ids, service, input }, tx) => {
      const { order } = await service.create(ids.customer, input());
      await tx.insert(schema.stockIssues).values({
        farmId: ids.farm,
        warehouseId: ids.warehouse,
        issueCode: `XB-${order.code}`,
        createdByMemberId: ids.adminMember,
      });
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      expect(confirmed.order.status).toBe('CONFIRMED');
      expect(confirmed.stockIssue).toMatchObject({ issueCode: null });
    }));

  it('blocks linked issue cancellation and edits that differ from order items or quantities', () =>
    inRollback(async ({ ids, service, issues, input }) => {
      const { order } = await service.create(ids.customer, input());
      const detail = await service.confirm(ids.farm, ids.staff, order.id);
      const issueId = detail.stockIssue.id;
      await expect(issues.cancel(issueId, ids.farm, ids.admin)).rejects.toThrow(
        'linked order',
      );
      await expect(
        issues.update(issueId, ids.farm, ids.admin, {
          warehouseId: ids.otherWarehouse,
        }),
      ).rejects.toThrow('cannot change');
      await expect(
        issues.update(issueId, ids.farm, ids.admin, { issueType: 'DISPOSAL' }),
      ).rejects.toThrow('cannot change');
      await expect(
        issues.update(issueId, ids.farm, ids.admin, {
          items: [{ itemId: ids.item, quantity: '1' }],
        }),
      ).rejects.toThrow('must match');
      await expect(
        issues.update(issueId, ids.farm, ids.admin, {
          recipientMemberId: ids.adminMember,
        }),
      ).rejects.toThrow('no recipient');
    }));

  it('cancels the draft with the order, but cannot cancel an approved issue or confirmed customer order', () =>
    inRollback(async ({ ids, service, issues, input }) => {
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await expect(
        service.customerCancel(ids.customer, order.id, 'Không mua nữa'),
      ).rejects.toThrow('current state');
      const cancelled = await service.staffCancel(
        ids.farm,
        ids.staff,
        order.id,
        'Khách yêu cầu',
      );
      expect(cancelled.order.status).toBe('CANCELLED');
      expect(cancelled.stockIssue.status).toBe('CANCELLED');
      await expect(
        issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin),
      ).rejects.toThrow('linked order');
      const next = await service.create(ids.customer, input());
      const nextConfirmed = await service.confirm(
        ids.farm,
        ids.staff,
        next.order.id,
      );
      await issues.confirm(nextConfirmed.stockIssue.id, ids.farm, ids.admin);
      await expect(
        service.staffCancel(ids.farm, ids.staff, next.order.id, 'Không mua'),
      ).rejects.toThrow('approved');
    }));

  it('cancels a submitted order issue with the order and never rejects it on its own', () =>
    inRollback(async ({ ids, service, issues, input }) => {
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      // Warehouse staff submit the linked issue; store managers cannot.
      await issues.submit(confirmed.stockIssue.id, ids.farm, ids.admin);
      await expect(
        issues.reject(confirmed.stockIssue.id, ids.farm, ids.admin, 'Hết hàng'),
      ).rejects.toThrow('Cancel the linked order instead');
      const cancelled = await service.staffCancel(
        ids.farm,
        ids.staff,
        order.id,
        'Khách yêu cầu',
      );
      expect(cancelled.order.status).toBe('CANCELLED');
      expect(cancelled.stockIssue.status).toBe('CANCELLED');
    }));

  it('requires a verified bank transfer before shipping and reconciles it once (AC18)', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      const { order } = await service.create(ids.customer, {
        ...input(),
        paymentMethod: 'BANK_TRANSFER',
      });
      expect(order.total).toBe('585000');
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      // P1-06: the goods cannot leave the warehouse before the transfer is PAID.
      await expect(
        issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_NOT_VERIFIED' } });
      const ready = () => service.deliveries(ids.farm, ids.staff, 'available');
      expect((await ready()).map((row) => row.id)).not.toContain(order.id);
      await expect(
        service.ship(ids.farm, ids.staff, order.id),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_REQUIRED' } });

      const paid = await service.markPaid(ids.farm, ids.staff, order.id, {
        reference: 'FT2611060001',
        note: 'Đối chiếu sao kê',
      });
      expect(paid.order).toMatchObject({ paymentStatus: 'PAID' });
      expect(paid.payments).toEqual([
        expect.objectContaining({
          provider: 'MANUAL',
          amount: '585000',
          result: 'MATCHED',
        }),
      ]);
      expect(paid.deliveryLog).toMatchObject([
        {
          action: 'PAYMENT_RECONCILE',
          data: { reference: 'FT2611060001', amount: '585000' },
        },
      ]);
      // Retrying never pays twice; one bank reference settles one order.
      await expect(
        service.markPaid(ids.farm, ids.admin, order.id, { reference: 'X' }),
      ).rejects.toMatchObject({ response: { code: 'ALREADY_PAID' } });
      const other = await service.create(ids.customer, {
        ...input(),
        paymentMethod: 'BANK_TRANSFER',
      });
      await expect(
        service.markPaid(ids.farm, ids.staff, other.order.id, {
          reference: 'FT2611060001',
        }),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_REFERENCE_USED' } });
      expect(
        await tx
          .select({ id: schema.paymentTransactions.id })
          .from(schema.paymentTransactions)
          .where(eq(schema.paymentTransactions.farmId, ids.farm)),
      ).toHaveLength(1);

      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      expect((await ready()).map((row) => row.id)).toContain(order.id);
      await service.ship(ids.farm, ids.staff, order.id);
      await service.complete(ids.farm, ids.staff, order.id);
      // COD is collected on delivery, not reconciled by hand.
      const cod = await service.create(ids.customer, input());
      await expect(
        service.markPaid(ids.farm, ids.staff, cod.order.id, { reference: 'C' }),
      ).rejects.toThrow('COD is collected on delivery');
    }));

  it('records COD cash collected on delivery and handed over separately, once (AC19)', () =>
    inRollback(async ({ ids, service, issues, input }) => {
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      await expect(
        service.remitCod(ids.farm, ids.admin, order.id),
      ).rejects.toThrow('Only completed COD orders');
      await service.complete(ids.farm, ids.staff, order.id);
      const done = await service.staffGet(ids.farm, order.id);
      expect(done.order).toMatchObject({
        paymentStatus: 'PAID',
        codRemittedAt: null,
      });
      const pending = async () =>
        (
          await service.staffList(ids.farm, {
            ...parsePagination(),
            codPending: true,
          })
        ).data.map((row) => row.id);
      expect(await pending()).toEqual([order.id]);

      const remitted = await service.remitCod(ids.farm, ids.admin, order.id);
      expect(remitted.order.codRemittedAt).not.toBeNull();
      expect(remitted.deliveryLog.map((row) => row.action)).toContain(
        'COD_REMIT',
      );
      expect(await pending()).toEqual([]);
      await expect(
        service.remitCod(ids.farm, ids.admin, order.id),
      ).rejects.toMatchObject({ response: { code: 'COD_ALREADY_REMITTED' } });
    }));

  it('cancels a paid order only with a recorded manual refund (AC20)', () =>
    inRollback(async ({ ids, service, input }) => {
      const { order } = await service.create(ids.customer, {
        ...input(),
        paymentMethod: 'BANK_TRANSFER',
      });
      await service.markPaid(ids.farm, ids.staff, order.id, {
        reference: 'R1',
      });
      await expect(
        service.customerCancel(ids.customer, order.id, 'Không mua'),
      ).rejects.toThrow('refund');
      await expect(
        service.staffCancel(ids.farm, ids.staff, order.id, 'Hết hàng'),
      ).rejects.toThrow('refund');
      await expect(
        service.staffCancel(ids.farm, ids.staff, order.id, 'Hết hàng', {
          amount: '585001',
          reference: 'HT-1',
        }),
      ).rejects.toThrow('at most the order total');
      const cancelled = await service.staffCancel(
        ids.farm,
        ids.staff,
        order.id,
        'Hết hàng',
        { amount: '585000', reference: 'HT-1' },
      );
      expect(cancelled.order).toMatchObject({
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        refundAmount: '585000',
        refundReference: 'HT-1',
      });
      expect(cancelled.order.refundedAt).not.toBeNull();
      expect(cancelled.deliveryLog.map((row) => row.action)).toContain(
        'REFUND',
      );
      // An unpaid order has nothing to refund.
      const unpaid = await service.create(ids.customer, input());
      await expect(
        service.staffCancel(ids.farm, ids.staff, unpaid.order.id, 'x', {
          amount: '1',
          reference: 'y',
        }),
      ).rejects.toThrow('Only paid orders');
    }));

  const salesBalance = async (tx: OrderTestDb, { ids }: Context) =>
    (
      await tx
        .select({ quantity: schema.inventoryBalances.quantityOnHand })
        .from(schema.inventoryBalances)
        .where(
          and(
            eq(schema.inventoryBalances.warehouseId, ids.warehouse),
            eq(schema.inventoryBalances.itemId, ids.item),
          ),
        )
    )[0].quantity;

  /** A COD (or paid bank transfer) order of 3 × 0.125 out for delivery. */
  async function shipping(
    ctx: Context,
    paymentMethod: 'COD' | 'BANK_TRANSFER' = 'COD',
  ) {
    const { ids, service, issues, input } = ctx;
    const { order } = await service.create(ids.customer, {
      ...input(),
      paymentMethod,
    });
    if (paymentMethod === 'BANK_TRANSFER')
      await service.markPaid(ids.farm, ids.staff, order.id, {
        reference: `FT-${order.id}`,
      });
    const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
    await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
    await service.ship(ids.farm, ids.staff, order.id);
    return order;
  }

  it('retries a failed delivery without putting stock back (AC19)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service } = ctx;
      const order = await shipping(ctx);
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      await service.returnDelivery(ids.farm, ids.staff, order.id, 'Vắng nhà');
      expect(await orderStatus(tx, order.id)).toBe('CONFIRMED');
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      await service.ship(ids.farm, ids.staff, order.id);
      expect(await orderStatus(tx, order.id)).toBe('SHIPPING');
    }));

  it('raises stock only when the warehouse confirms the counted return, once, then records the refund (AC20)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, receipts } = ctx;
      const order = await shipping(ctx, 'BANK_TRANSFER');
      await service.returnToWarehouse(
        ids.farm,
        ids.staff,
        order.id,
        'Khách từ chối nhận',
      );
      const returning = await service.staffGet(ids.farm, order.id);
      expect(returning.order.status).toBe('RETURNING');
      const receiptId = returning.order.returnReceiptId!;
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      const draft = await receipts.getReceipt(receiptId, ids.farm, ids.admin);
      expect(draft).toMatchObject({
        receipt: { status: 'DRAFT', warehouseId: ids.warehouse },
        items: [
          expect.objectContaining({ itemId: ids.item, quantity: '0.375' }),
        ],
      });
      // Warehouse approvers are told a return waits to be counted.
      expect(
        (
          await tx
            .select({ userId: schema.notifications.userId })
            .from(schema.notifications)
            .where(eq(schema.notifications.entityId, receiptId))
        ).map((row) => row.userId),
      ).toContain(ids.admin);

      // Counted 0.25 in good condition; the rest stays out of stock.
      await tx
        .update(schema.stockReceiptItems)
        .set({ quantity: '0.25' })
        .where(eq(schema.stockReceiptItems.stockReceiptId, receiptId));
      await receipts.confirmReceipt(receiptId, ids.farm, ids.admin);
      await receipts.confirmReceipt(receiptId, ids.farm, ids.admin);
      expect(await salesBalance(tx, ctx)).toBe('9.875');
      const returned = await service.staffGet(ids.farm, order.id);
      expect(returned.order.status).toBe('RETURNED');
      expect(returned.deliveryLog.map((row) => row.action)).toEqual(
        expect.arrayContaining(['RETURN_TO_WAREHOUSE', 'RETURN_RECEIVED']),
      );

      await expect(
        service.refundReturned(ids.farm, ids.staff, order.id, {
          amount: '0',
          reference: 'HT-2',
        }),
      ).rejects.toThrow('positive');
      const refunded = await service.refundReturned(
        ids.farm,
        ids.staff,
        order.id,
        { amount: '585000', reference: 'HT-2' },
      );
      expect(refunded.order).toMatchObject({
        status: 'RETURNED',
        refundAmount: '585000',
      });
      await expect(
        service.refundReturned(ids.farm, ids.staff, order.id, {
          amount: '1',
          reference: 'HT-3',
        }),
      ).rejects.toThrow('already refunded');
    }));

  it('refuses a return receipt holding more than shipped, and a rejected one gives the goods back to the shipper', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, receipts } = ctx;
      const order = await shipping(ctx);
      await service.returnToWarehouse(
        ids.farm,
        ids.staff,
        order.id,
        'Sai địa chỉ',
      );
      const receiptId = (await service.staffGet(ids.farm, order.id)).order
        .returnReceiptId!;
      await tx
        .update(schema.stockReceiptItems)
        .set({ quantity: '0.5' })
        .where(eq(schema.stockReceiptItems.stockReceiptId, receiptId));
      // Goods go back to the sales warehouse only.
      await tx
        .update(schema.stockReceipts)
        .set({ warehouseId: ids.otherWarehouse })
        .where(eq(schema.stockReceipts.id, receiptId));
      await expect(
        receipts.confirmReceipt(receiptId, ids.farm, ids.admin),
      ).rejects.toThrow("order's sales warehouse");
      await tx
        .update(schema.stockReceipts)
        .set({ warehouseId: ids.warehouse })
        .where(eq(schema.stockReceipts.id, receiptId));
      // The service transaction is a savepoint here, so the failure rolls back alone.
      await expect(
        receipts.confirmReceipt(receiptId, ids.farm, ids.admin),
      ).rejects.toThrow('more than the order shipped');
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      expect(await orderStatus(tx, order.id)).toBe('RETURNING');

      await receipts.submitReceipt(receiptId, ids.farm, ids.admin);
      await receipts.rejectReceipt(receiptId, ids.farm, ids.admin, 'Chưa nhận');
      const back = await service.staffGet(ids.farm, order.id);
      expect(back.order).toMatchObject({
        status: 'SHIPPING',
        returnReceiptId: null,
      });
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      // The shipper can try again, which drafts a new receipt.
      await service.returnToWarehouse(ids.farm, ids.staff, order.id, 'Lần 2');
      expect(await orderStatus(tx, order.id)).toBe('RETURNING');
    }));

  it('takes back the very assets it shipped, each in its inspected condition (P1-08)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, issues, receipts, input } = ctx;
      await tx
        .update(schema.storeProductVariants)
        .set({ quantityStep: '1' })
        .where(eq(schema.storeProductVariants.id, ids.variant));
      await tx
        .update(schema.items)
        .set({ trackingMode: 'ASSET', itemType: 'EQUIPMENT' })
        .where(eq(schema.items.id, ids.item));
      const assetIds = [randomUUID(), randomUUID()];
      await tx.insert(schema.assets).values(
        assetIds.map((id) => ({
          id,
          farmId: ids.farm,
          itemId: ids.item,
          assetCode: id,
          currentLocationId: ids.location,
        })),
      );
      const { order } = await service.create(ids.customer, input(2));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      expect(await salesBalance(tx, ctx)).toBe('8.000');
      await service.returnToWarehouse(ids.farm, ids.staff, order.id, 'Từ chối');
      const receiptId = (await service.staffGet(ids.farm, order.id)).order
        .returnReceiptId!;
      const draft = await receipts.getReceipt(receiptId, ids.farm, ids.admin);
      expect(draft.items.map((line) => line.assetId).sort()).toEqual(
        [...assetIds].sort(),
      );
      const edit = (items: object[]) =>
        receipts.updateReceipt(receiptId, ids.farm, ids.admin, {
          items,
        } as never);
      const asLine = (
        line: (typeof draft.items)[number],
        extra: object = {},
      ) => ({
        lineId: line.id,
        itemId: line.itemId,
        quantity: '1',
        assetCode: line.assetCode,
        locationId: ids.location,
        ...extra,
      });
      // A line that is not one of the shipped assets would create a new asset.
      await edit([
        asLine(draft.items[0], { assetCondition: 'GOOD' }),
        {
          itemId: ids.item,
          quantity: '1',
          assetCode: 'NEW-ASSET',
          locationId: ids.location,
        },
      ]);
      await expect(
        receipts.confirmReceipt(receiptId, ids.farm, ids.admin),
      ).rejects.toThrow('more than the order shipped');
      await expect(
        edit([
          {
            ...asLine(draft.items[0]),
            lineId: undefined,
            assetCondition: 'GOOD',
          },
        ]),
      ).rejects.toThrow('only for assets returned');
      // Without an inspection result nothing is received.
      const current = await receipts.getReceipt(receiptId, ids.farm, ids.admin);
      await edit([asLine(current.items.find((line) => line.assetId)!)]);
      await expect(
        receipts.confirmReceipt(receiptId, ids.farm, ids.admin),
      ).rejects.toThrow('inspected condition');
      const [good] = (await receipts.getReceipt(receiptId, ids.farm, ids.admin))
        .items;
      const other = draft.items.find((line) => line.assetId !== good.assetId)!;
      // Restore the second shipped line, keeping its asset through lineId.
      await tx.insert(schema.stockReceiptItems).values({
        stockReceiptId: receiptId,
        itemId: ids.item,
        quantity: '1',
        assetId: other.assetId,
        assetCode: other.assetCode,
      });
      const both = (await receipts.getReceipt(receiptId, ids.farm, ids.admin))
        .items;
      await edit(
        both.map((line) =>
          asLine(line, {
            // Changing the code never turns it into another asset.
            assetCode: 'RENAMED',
            assetCondition: line.assetId === good.assetId ? 'GOOD' : 'DAMAGED',
          }),
        ),
      );
      // A retried save with the same line ids keeps the assets.
      await edit(
        both.map((line) =>
          asLine(line, {
            assetCondition: line.assetId === good.assetId ? 'GOOD' : 'DAMAGED',
          }),
        ),
      );
      await receipts.confirmReceipt(receiptId, ids.farm, ids.admin);
      await receipts.confirmReceipt(receiptId, ids.farm, ids.admin);
      const back = await tx
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.itemId, ids.item));
      expect(back).toHaveLength(2);
      expect(
        Object.fromEntries(back.map((row) => [row.id, row.status])),
      ).toEqual({
        [good.assetId!]: 'AVAILABLE',
        [other.assetId!]: 'DAMAGED',
      });
      expect(back.every((row) => row.currentLocationId === ids.location)).toBe(
        true,
      );
      // Both physically back, counted once; only the good one is sellable.
      expect(await salesBalance(tx, ctx)).toBe('10.000');
      expect(await orderStatus(tx, order.id)).toBe('RETURNED');
    }));

  it('closes a return with nothing usable to take back (E05)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, receipts } = ctx;
      const order = await shipping(ctx);
      await service.returnToWarehouse(ids.farm, ids.staff, order.id, 'Hỏng');
      const receiptId = (await service.staffGet(ids.farm, order.id)).order
        .returnReceiptId!;
      await receipts.updateReceipt(receiptId, ids.farm, ids.admin, {
        items: [],
      });
      await receipts.submitReceipt(receiptId, ids.farm, ids.admin);
      await receipts.confirmReceipt(receiptId, ids.farm, ids.admin);
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      expect(await orderStatus(tx, order.id)).toBe('RETURNED');
      // An ordinary receipt still needs a line.
      await expect(
        receipts.updateReceipt(
          (
            await receipts.createReceipt(ids.farm, ids.admin, {
              warehouseId: ids.warehouse,
              items: [{ itemId: ids.item, quantity: '1' }],
            })
          ).receipt.id,
          ids.farm,
          ids.admin,
          { items: [] },
        ),
      ).rejects.toThrow('at least one item');
    }));

  it('offers a VietQR of the stored total only while a bank transfer is unpaid', () =>
    inRollback(async ({ ids, service, input }) => {
      const cod = await service.create(ids.customer, input());
      expect(cod.payment).toBeNull();
      const { order, payment } = await service.create(ids.customer, {
        ...input(),
        paymentMethod: 'BANK_TRANSFER',
      });
      expect(payment).toMatchObject({
        accountNumber: testBankAccount.STORE_BANK_ACCOUNT_NUMBER,
        amount: '585000',
        content: order.code,
      });
      expect(payment?.qrSvg).toMatch(/^<svg/);
      expect(
        (await service.customerGet(ids.customer, order.id)).payment?.amount,
      ).toBe('585000');
      expect(order).not.toHaveProperty('paymentTransactionId');
      expect((await service.staffGet(ids.farm, order.id)).payments).toEqual([]);
      await service.markPaid(ids.farm, ids.staff, order.id, {
        reference: 'Q1',
      });
      expect(
        (await service.customerGet(ids.customer, order.id)).payment,
      ).toBeNull();
      const restore = withEnv({ STORE_BANK_ACCOUNT_NUMBER: undefined });
      try {
        await expect(
          service.create(ids.customer, {
            ...input(),
            paymentMethod: 'BANK_TRANSFER',
          }),
        ).rejects.toThrow('Bank transfer is not available');
      } finally {
        restore();
      }
    }));

  it('picks unexpired lots FEFO, permits equivalent lot reassignment and keeps shortages pending', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      await tx
        .delete(schema.inventoryBalances)
        .where(eq(schema.inventoryBalances.itemId, ids.item));
      await tx
        .update(schema.items)
        .set({ trackingMode: 'LOT' })
        .where(eq(schema.items.id, ids.item));
      const lots = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      const future = (days: number) =>
        new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      await tx.insert(schema.inventoryLots).values(
        lots.map((id, i) => ({
          id,
          farmId: ids.farm,
          itemId: ids.item,
          supplierLotNumber: id,
          initialQuantity: '99',
          expiryDate: i === 3 ? null : future(i === 0 ? -1 : i * 20),
        })),
      );
      await tx.insert(schema.inventoryBalances).values(
        lots.map((lotId, i) => ({
          farmId: ids.farm,
          warehouseId: ids.warehouse,
          itemId: ids.item,
          lotId,
          quantityOnHand: i === 0 ? '99' : '0.250',
        })),
      );
      const { order } = await service.create(ids.customer, input());
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      const issue = await issues.get(
        confirmed.stockIssue.id,
        ids.farm,
        ids.admin,
      );
      expect(issue.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ lotId: lots[1], quantity: '0.250' }),
          expect.objectContaining({ lotId: lots[2], quantity: '0.125' }),
        ]),
      );
      await issues.update(issue.issue.id, ids.farm, ids.admin, {
        items: [
          { itemId: ids.item, lotId: lots[2], quantity: '0.125' },
          { itemId: ids.item, lotId: lots[3], quantity: '0.250' },
        ],
      });
      await issues.confirm(issue.issue.id, ids.farm, ids.admin);
      const waiting = await service.create(ids.customer, input(1));
      await tx
        .update(schema.inventoryBalances)
        .set({ quantityOnHand: '0' })
        .where(eq(schema.inventoryBalances.itemId, ids.item));
      await expect(
        service.confirm(ids.farm, ids.staff, waiting.order.id),
      ).rejects.toThrow('Không đủ');
      expect(
        (await service.customerGet(ids.customer, waiting.order.id)).order
          .status,
      ).toBe('PENDING');
    }));

  it('counts sufficient saleable assets, excludes maintenance/inactive locations and retires sold assets', () =>
    inRollback(async ({ ids, service, issues, input, commerce }, tx) => {
      await tx
        .update(schema.storeProductVariants)
        .set({ quantityStep: '1' })
        .where(eq(schema.storeProductVariants.id, ids.variant));
      await tx
        .update(schema.items)
        .set({ trackingMode: 'ASSET', itemType: 'EQUIPMENT' })
        .where(eq(schema.items.id, ids.item));
      const assetIds = [randomUUID(), randomUUID(), randomUUID()];
      await tx.insert(schema.assets).values(
        assetIds.map((id) => ({
          id,
          farmId: ids.farm,
          itemId: ids.item,
          assetCode: id,
          currentLocationId: ids.location,
        })),
      );
      await tx.insert(schema.maintenanceRecords).values({
        farmId: ids.farm,
        assetId: assetIds[0],
        maintenanceType: 'INSPECTION',
        status: 'SCHEDULED',
      });
      await expect(service.create(ids.customer, input(3))).rejects.toThrow(
        'Không đủ',
      );
      const { order } = await service.create(ids.customer, input(2));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      const issue = await issues.get(
        confirmed.stockIssue.id,
        ids.farm,
        ids.admin,
      );
      expect(issue.items).toHaveLength(2);
      expect(
        issue.items.every(
          (line) => line.quantity === '1.000' && line.assetId !== assetIds[0],
        ),
      ).toBe(true);
      await issues.confirm(issue.issue.id, ids.farm, ids.admin);
      const sold = await tx
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.status, 'RETIRED'));
      expect(sold).toHaveLength(2);
      expect(sold.every((asset) => asset.currentLocationId === null)).toBe(
        true,
      );
      expect((await commerce.getProduct(ids.product)).inStock).toBe(false);
      await tx
        .update(schema.locations)
        .set({ status: 'INACTIVE' })
        .where(eq(schema.locations.id, ids.location));
      await expect(service.create(ids.customer, input(1))).rejects.toThrow(
        'Không đủ',
      );
    }));

  it('does not hand the same asset or lot quantity to two unapproved order drafts', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      await tx
        .update(schema.storeProductVariants)
        .set({ quantityStep: '1' })
        .where(eq(schema.storeProductVariants.id, ids.variant));
      await tx
        .update(schema.items)
        .set({ trackingMode: 'ASSET', itemType: 'EQUIPMENT' })
        .where(eq(schema.items.id, ids.item));
      await tx.insert(schema.assets).values(
        [randomUUID(), randomUUID()].map((id) => ({
          id,
          farmId: ids.farm,
          itemId: ids.item,
          assetCode: id,
          currentLocationId: ids.location,
        })),
      );
      const drafts: { id: string }[] = [];
      for (let i = 0; i < 2; i++) {
        const { order } = await service.create(ids.customer, input(1));
        drafts.push(
          (await service.confirm(ids.farm, ids.staff, order.id)).stockIssue,
        );
      }
      const picked = await Promise.all(
        drafts.map((d) => issues.get(d.id, ids.farm, ids.admin)),
      );
      expect(picked[0].items[0].assetId).not.toBe(picked[1].items[0].assetId);
      // Both drafted assets are no longer offered to new orders.
      await expect(service.create(ids.customer, input(1))).rejects.toThrow(
        'Không đủ',
      );
      for (const d of drafts) await issues.confirm(d.id, ids.farm, ids.admin);
    }));

  it('does not allocate lot quantity already held by another order draft', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      await tx
        .delete(schema.inventoryBalances)
        .where(eq(schema.inventoryBalances.itemId, ids.item));
      await tx
        .update(schema.items)
        .set({ trackingMode: 'LOT' })
        .where(eq(schema.items.id, ids.item));
      const lotId = randomUUID();
      await tx.insert(schema.inventoryLots).values({
        id: lotId,
        farmId: ids.farm,
        itemId: ids.item,
        supplierLotNumber: lotId,
        initialQuantity: '0.375',
      });
      await tx.insert(schema.inventoryBalances).values({
        farmId: ids.farm,
        warehouseId: ids.warehouse,
        itemId: ids.item,
        lotId,
        quantityOnHand: '0.375',
      });
      const first = await service.create(ids.customer, input(3));
      const second = await service.create(ids.customer, input(3));
      const { stockIssue } = await service.confirm(
        ids.farm,
        ids.staff,
        first.order.id,
      );
      await expect(
        service.confirm(ids.farm, ids.staff, second.order.id),
      ).rejects.toThrow('Không đủ');
      await issues.confirm(stockIssue.id, ids.farm, ids.admin);
    }));

  it('reports only completed merchandise revenue by completion date and preserves customer history', () =>
    inRollback(async ({ ids, service, issues, input }, tx) => {
      await service.create(ids.customer, input(1));
      const { order } = await service.create(ids.customer, input(2));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      await service.complete(ids.farm, ids.staff, order.id);
      await tx
        .update(schema.storeOrders)
        .set({ completedAt: '2026-01-31T17:30:00Z' })
        .where(eq(schema.storeOrders.id, order.id));
      const stats = await service.stats(ids.farm, {
        from: '2026-02-01',
        to: '2026-02-01',
      });
      expect(stats).toMatchObject({
        revenue: '370000',
        shippingFees: '30000',
        completedOrders: 1,
        averageOrderValue: '370000',
        daily: [{ date: '2026-02-01', revenue: '370000' }],
      });
      expect(stats.topProducts[0]).toMatchObject({
        productId: ids.product,
        revenue: '370000',
        quantity: 2,
      });
      expect(stats.topCustomers[0]).toMatchObject({
        userId: ids.customer,
        revenue: '370000',
      });
      await tx
        .insert(schema.farmMembers)
        .values({ farmId: ids.farm, userId: ids.customer });
      expect(
        await service.customerProfile(ids.farm, ids.customer),
      ).toMatchObject({
        completedCount: 1,
        totalSpent: '400000',
        products: [expect.objectContaining({ quantity: 2, total: '370000' })],
      });
      expect((await service.customerGet(ids.customer, order.id)).order.id).toBe(
        order.id,
      );
    }));
});

// Committed fixtures are necessary here: independent connections must see each other's locks.
describe('Store orders on concurrent PostgreSQL connections', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
    options: '-c statement_timeout=5000 -c lock_timeout=4000',
  });
  const db = drizzle(pool, { schema });
  let ctx: Awaited<ReturnType<typeof seedOrders>>;
  beforeEach(async () => {
    ctx = await seedOrders(db);
  });
  afterEach(async () => {
    if (ctx) await cleanupOrders(db, ctx.ids);
  });

  it('makes a sales warehouse switch wait for an order being placed in it', async () => {
    const admin = new StoreAdminService(
      ctx.database,
      {} as unknown as CloudinaryService,
    );
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    // Stands in for checkout between picking the warehouse and inserting the order.
    const checkout = db.transaction(async (tx) => {
      await ctx.commerce.salesWarehouses(tx, 'SOUTH');
      locked();
      await held;
      await tx.insert(schema.storeOrders).values({
        userId: ctx.ids.customer,
        farmId: ctx.ids.farm,
        warehouseId: ctx.ids.warehouse,
        recipientName: 'Khách',
        phone: '0900000000',
        address: 'Địa chỉ',
        region: 'SOUTH',
        paymentMethod: 'COD',
        subtotal: '0',
        total: '0',
        idempotencyKey: randomUUID(),
        requestFingerprint: 'x',
      });
    });
    await lockTaken;
    let settled = false;
    const switching = admin
      .updateSettings(ctx.ids.farm, {
        salesWarehouseId: ctx.ids.otherWarehouse,
        salesEnabled: true,
        regions: ['SOUTH'],
      })
      .finally(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);
    release();
    await checkout;
    await expect(switching).rejects.toMatchObject({ status: 409 });
  });
  afterAll(() => pool.end());

  it('creates only one order for simultaneous retries', async () => {
    const request = ctx.input();
    const results = await Promise.all([
      ctx.service.create(ctx.ids.customer, request),
      ctx.service.create(ctx.ids.customer, request),
    ]);
    expect(results[0].order.id).toBe(results[1].order.id);
    expect(
      (
        await db
          .select({ value: count() })
          .from(schema.storeOrders)
          .where(eq(schema.storeOrders.farmId, ctx.ids.farm))
      )[0].value,
    ).toBe(1);
  });

  it('waits for an in-flight order before validating a retry against changed catalog data', async () => {
    const input = ctx.input();
    let release!: () => void;
    let inserted!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      inserted = resolve;
    });
    const original = db.transaction(async (tx) => {
      const service = new StoreOrdersService(
        { db: tx } as unknown as DatabaseService,
        ctx.commerce,
        new WarehousesService(ctx.database),
      );
      const result = await service.create(ctx.ids.customer, input);
      inserted();
      await gate;
      return result;
    });
    await ready;
    let retry: ReturnType<StoreOrdersService['create']> | undefined;
    try {
      await db
        .update(schema.storeProductVariants)
        .set({ active: false })
        .where(eq(schema.storeProductVariants.id, ctx.ids.variant));
      retry = ctx.service.create(ctx.ids.customer, input);
      // Observe the second connection waiting, rather than relying on a sleep to order requests.
      let waiting = false;
      const deadline = Date.now() + 2000;
      while (!waiting && Date.now() < deadline) {
        const result = await pool.query<{ waiting: boolean }>(`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE '%"users"%for update%'
        ) AS waiting`);
        waiting = result.rows[0].waiting;
      }
      expect(waiting).toBe(true);
    } finally {
      release();
    }
    const [first, second] = await Promise.all([original, retry]);
    expect(second.order.id).toBe(first.order.id);
  });

  it('lets only one of two orders competing for the last stock reserve it (AC15, AC16)', async () => {
    // 50 × 0.125 = 6.25 each; the sales warehouse holds 10, so only one fits.
    const first = await ctx.service.create(ctx.ids.customer, ctx.input(50));
    const second = await ctx.service.create(ctx.ids.customer, ctx.input(50));
    // PENDING orders hold nothing: both were accepted against the same 10.
    expect([first.order.status, second.order.status]).toEqual([
      'PENDING',
      'PENDING',
    ]);
    // Hold the first confirmation open after it reserved, so the second must
    // wait on the balance lock instead of reading the uncommitted draft as free.
    let release!: () => void;
    let reserved!: (pid: number) => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const ready = new Promise<number>((resolve) => (reserved = resolve));
    const holding = db.transaction(async (tx) => {
      const service = new StoreOrdersService(
        { db: tx } as unknown as DatabaseService,
        ctx.commerce,
        new WarehousesService(ctx.database),
      );
      await service.confirm(ctx.ids.farm, ctx.ids.staff, first.order.id);
      const { rows } = await tx.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      reserved(rows[0].pid);
      await gate;
    });
    // A failed first confirmation must fail the test, not leave `ready` pending.
    const holder = await Promise.race([
      ready,
      holding.then(() => Promise.reject(new Error('holder ended early'))),
    ]);
    // Settled results so a failed probe still drains both connections before cleanup.
    const competing = ctx.service
      .confirm(ctx.ids.farm, ctx.ids.staff, second.order.id)
      .then(
        () => null,
        (error: unknown) => error,
      );
    let waiting = false;
    try {
      // Only a backend blocked by our holder counts; stay below lock_timeout (4 s).
      const deadline = Date.now() + 3000;
      while (!waiting && Date.now() < deadline) {
        const result = await pool.query<{ waiting: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
             WHERE $1 = ANY(pg_blocking_pids(pid))) AS waiting`,
          [holder],
        );
        waiting = result.rows[0].waiting;
      }
    } finally {
      release();
      await holding;
    }
    const rejection = await competing;
    expect(waiting).toBe(true);
    expect(rejection).toMatchObject({ status: 409 });
    const statuses = await Promise.all(
      [first, second].map(
        async ({ order }) =>
          (await ctx.service.staffGet(ctx.ids.farm, order.id)).order.status,
      ),
    );
    expect(statuses.sort()).toEqual(['CONFIRMED', 'PENDING']);
    // One draft reserves 6.25; nothing is deducted until the issue is confirmed.
    const drafts = await db
      .select({ quantity: schema.stockIssueItems.quantity })
      .from(schema.stockIssueItems)
      .innerJoin(
        schema.stockIssues,
        eq(schema.stockIssues.id, schema.stockIssueItems.stockIssueId),
      )
      .where(eq(schema.stockIssues.farmId, ctx.ids.farm));
    expect(drafts).toEqual([{ quantity: '6.250' }]);
    const [balance] = await db
      .select({ quantityOnHand: schema.inventoryBalances.quantityOnHand })
      .from(schema.inventoryBalances)
      .where(eq(schema.inventoryBalances.itemId, ctx.ids.item));
    expect(balance.quantityOnHand).toBe('10.000');
  });

  it('creates only one draft for simultaneous confirmations', async () => {
    const { order } = await ctx.service.create(ctx.ids.customer, ctx.input());
    const results = await Promise.allSettled([
      ctx.service.confirm(ctx.ids.farm, ctx.ids.staff, order.id),
      ctx.service.confirm(ctx.ids.farm, ctx.ids.staff, order.id),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (
        await db
          .select({ value: count() })
          .from(schema.stockIssues)
          .where(eq(schema.stockIssues.farmId, ctx.ids.farm))
      )[0].value,
    ).toBe(1);
  });

  it('serializes cancellation against inventory approval without a cancelled-but-deducted order', async () => {
    const { order } = await ctx.service.create(ctx.ids.customer, ctx.input());
    const confirmed = await ctx.service.confirm(
      ctx.ids.farm,
      ctx.ids.staff,
      order.id,
    );
    const results = await Promise.allSettled([
      ctx.service.staffCancel(
        ctx.ids.farm,
        ctx.ids.staff,
        order.id,
        'Khách yêu cầu',
      ),
      ctx.issues.confirm(confirmed.stockIssue.id, ctx.ids.farm, ctx.ids.admin),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const final = await ctx.service.staffGet(ctx.ids.farm, order.id);
    const [balance] = await db
      .select()
      .from(schema.inventoryBalances)
      .where(eq(schema.inventoryBalances.itemId, ctx.ids.item));
    if (final.order.status === 'CANCELLED') {
      expect(final.stockIssue.status).toBe('CANCELLED');
      expect(balance.quantityOnHand).toBe('10.000');
    } else {
      expect(final.order.status).toBe('CONFIRMED');
      expect(final.stockIssue.status).toBe('CONFIRMED');
      expect(balance.quantityOnHand).toBe('9.625');
    }
  });
});

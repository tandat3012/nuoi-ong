import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { ClerkClient } from '@clerk/backend';
import { DatabaseService } from '../src/db/database.service';
import { AuthService } from '../src/modules/auth/accounts/auth.service';
import { StoreOrdersService } from '../src/modules/store-orders/store-orders.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import * as schema from '../src/db/schema';
import { cleanupOrders, OrderTestDb, seedOrders } from './store-orders.fixture';

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
  afterAll(() => pool.end());

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

  it('tells staff which farm owns the store and omits it for customers', () =>
    inRollback(async ({ ids, database }) => {
      const auth = new AuthService(database, {} as ClerkClient);
      expect((await auth.getAuthContext(ids.staff)).storeFarm).toEqual({
        id: ids.farm,
        name: 'Order tests',
      });
      expect((await auth.getAuthContext(ids.customer)).storeFarm).toBeNull();
    }));

  it('takes prices from the server and snapshots fractional stock steps', () =>
    inRollback(async ({ ids, service, input }) => {
      const detail = await service.create(ids.customer, input());
      expect(detail.order).toMatchObject({
        status: 'PENDING',
        subtotal: '555000',
        total: '555000',
        shippingFee: '0',
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
        quantity: 3,
        stockQuantity: '0.375',
        unitPrice: '185000',
        lineTotal: '555000',
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
        'another farm',
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
      expect(
        (await service.complete(ids.farm, ids.staff, order.id)).order,
      ).toMatchObject({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidByMemberId: ids.member,
      });
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
        .set({ warehouseId: ids.otherWarehouse })
        .where(eq(schema.storeSettings.id, 1));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      const issue = await issues.get(
        confirmed.stockIssue.id,
        ids.farm,
        ids.admin,
      );
      expect(issue.issue.warehouseId).toBe(ids.warehouse);
      expect(issue.items[0].quantity).toBe('0.375');
      expect(confirmed.order.total).toBe('555000');
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

  it('locks paid totals and cancellation, keeps paid_at stable and requires transfer payment before completion', () =>
    inRollback(async ({ ids, service, issues, input }) => {
      const { order } = await service.create(ids.customer, {
        ...input(),
        paymentMethod: 'BANK_TRANSFER',
      });
      const updated = await service.shippingFee(
        ids.farm,
        ids.staff,
        order.id,
        '30000',
      );
      expect(updated.order.total).toBe('585000');
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      await expect(
        service.complete(ids.farm, ids.staff, order.id),
      ).rejects.toThrow('bank transfer');
      const paid = await service.markPaid(ids.farm, ids.staff, order.id);
      expect(
        (await service.markPaid(ids.farm, ids.admin, order.id)).order.paidAt,
      ).toBe(paid.order.paidAt);
      await service.complete(ids.farm, ids.staff, order.id);
      const pending = await service.create(ids.customer, input());
      await service.markPaid(ids.farm, ids.staff, pending.order.id);
      await expect(
        service.shippingFee(ids.farm, ids.staff, pending.order.id, '1'),
      ).rejects.toThrow('UNPAID');
      await expect(
        service.customerCancel(ids.customer, pending.order.id, 'Không mua'),
      ).rejects.toThrow('refund');
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
          lotNumber: id,
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
        lotNumber: lotId,
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
      await service.shippingFee(ids.farm, ids.staff, order.id, '30000');
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
  let originalSettings: typeof schema.storeSettings.$inferSelect | undefined;
  beforeEach(async () => {
    [originalSettings] = await db
      .select()
      .from(schema.storeSettings)
      .where(eq(schema.storeSettings.id, 1));
    ctx = await seedOrders(db);
  });
  afterEach(async () => {
    if (originalSettings)
      await db
        .update(schema.storeSettings)
        .set({ warehouseId: originalSettings.warehouseId })
        .where(eq(schema.storeSettings.id, 1));
    else
      await db
        .delete(schema.storeSettings)
        .where(eq(schema.storeSettings.id, 1));
    if (ctx) await cleanupOrders(db, ctx.ids);
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

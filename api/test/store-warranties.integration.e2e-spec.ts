import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { StoreWarrantiesService } from '../src/modules/store-orders/store-warranties.service';
import { OrderTestDb, seedOrders } from './store-orders.fixture';

describe('Store warranties NV06 (migrated PostgreSQL)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  type Context = Awaited<ReturnType<typeof seedOrders>> & {
    warranties: StoreWarrantiesService;
  };
  /** The fixture item becomes a 12-month-warranty tool before anything is ordered. */
  const inRollback = async (
    fn: (ctx: Context, tx: OrderTestDb) => Promise<void>,
  ) => {
    try {
      await db.transaction(async (tx) => {
        const scoped = tx as unknown as OrderTestDb;
        const seeded = await seedOrders(scoped);
        await scoped
          .update(schema.items)
          .set({ itemType: 'TOOL', warrantyMonths: 12 })
          .where(eq(schema.items.id, seeded.ids.item));
        await fn(
          {
            ...seeded,
            warranties: new StoreWarrantiesService(
              seeded.database,
              seeded.service,
            ),
          },
          scoped,
        );
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };
  afterAll(() => pool.end());

  /** A delivered COD order of 3 units (0.375 stock units out of 10). */
  async function delivered(ctx: Context) {
    const { ids, service, issues, input } = ctx;
    const { order } = await service.create(ids.customer, input(3));
    const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
    await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
    await service.ship(ids.farm, ids.staff, order.id);
    await service.complete(ids.farm, ids.staff, order.id);
    const detail = await service.staffGet(ids.farm, order.id);
    return { order, line: detail.items[0] };
  }
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
  const claim = (
    ctx: Context,
    orderId: string,
    orderItemId: string,
    patch: Partial<{ quantity: number; kind: 'WARRANTY' | 'PAID_REPAIR' }> = {},
  ) =>
    ctx.warranties.create(ctx.ids.farm, ctx.ids.staff, {
      orderId,
      orderItemId,
      quantity: 1,
      kind: 'WARRANTY',
      issueDescription: 'Không hoạt động',
      intakeNote: 'Khách mang đến cửa hàng',
      ...patch,
    });

  it('accepts only lines of a delivered order of this farm, within the bought quantity (AC22)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, input } = ctx;
      // Not delivered yet.
      const { order: pending } = await service.create(ids.customer, input(1));
      const [pendingLine] = (await service.staffGet(ids.farm, pending.id))
        .items;
      await expect(
        claim(ctx, pending.id, pendingLine.id),
      ).rejects.toMatchObject({
        response: { code: 'ORDER_NOT_DELIVERED' },
      });
      const { order, line } = await delivered(ctx);
      // An unknown order and a line of another order are refused.
      await expect(claim(ctx, randomUUID(), line.id)).rejects.toThrow(
        'Order not found',
      );
      await expect(claim(ctx, order.id, pendingLine.id)).rejects.toThrow(
        'Order line not found',
      );
      await claim(ctx, order.id, line.id, { quantity: 2 });
      await expect(
        claim(ctx, order.id, line.id, { quantity: 2 }),
      ).rejects.toMatchObject({
        response: { code: 'WARRANTY_QUANTITY_EXCEEDED' },
      });
      // Materials are never covered.
      await tx
        .update(schema.items)
        .set({ itemType: 'MATERIAL', warrantyMonths: null })
        .where(eq(schema.items.id, ids.item));
      await expect(claim(ctx, order.id, line.id)).rejects.toMatchObject({
        response: { code: 'WARRANTY_NOT_APPLICABLE' },
      });
    }));

  it('keeps the warranty sold with the order and allows only paid repair once it expired', () =>
    inRollback(async (ctx, tx) => {
      const { ids } = ctx;
      const { order, line } = await delivered(ctx);
      expect(line.warrantyMonths).toBe(12);
      // A later policy change does not touch the order.
      await tx
        .update(schema.items)
        .set({ warrantyMonths: 36 })
        .where(eq(schema.items.id, ids.item));
      await tx
        .update(schema.storeOrders)
        .set({ completedAt: '2024-01-01T00:00:00Z' })
        .where(eq(schema.storeOrders.id, order.id));
      await expect(claim(ctx, order.id, line.id)).rejects.toMatchObject({
        response: { code: 'WARRANTY_EXPIRED' },
      });
      const paid = await claim(ctx, order.id, line.id, { kind: 'PAID_REPAIR' });
      expect(paid).toMatchObject({ status: 'RECEIVED', kind: 'PAID_REPAIR' });
    }));

  it('never starts a paid repair before the customer agrees to the quote (AC23)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, warranties } = ctx;
      const { order, line } = await delivered(ctx);
      const { id } = await claim(ctx, order.id, line.id);
      const act = (body: Parameters<StoreWarrantiesService['act']>[3]) =>
        warranties.act(ids.farm, ids.staff, id, body);
      await act({ action: 'send', partnerName: 'Sửa chữa Minh Phát' });
      // The partner finds the fault not covered: it becomes a paid repair.
      await act({ action: 'quote', quoteAmount: '350000' });
      await expect(act({ action: 'start-repair' })).rejects.toMatchObject({
        response: { code: 'WARRANTY_STEP_NOT_ALLOWED' },
      });
      await act({ action: 'decide', approved: false, note: 'Khách thấy đắt' });
      await expect(act({ action: 'start-repair' })).rejects.toMatchObject({
        response: { code: 'CUSTOMER_CONSENT_REQUIRED' },
      });
      // The database refuses it too.
      await expect(
        tx
          .update(schema.storeWarrantyRequests)
          .set({ repairStartedAt: new Date().toISOString() })
          .where(eq(schema.storeWarrantyRequests.id, id)),
      ).rejects.toThrow();
    }));

  it('re-quotes and repairs again within the same request, asking consent each time (P1-10)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, warranties } = ctx;
      const { order, line } = await delivered(ctx);
      const { id } = await claim(ctx, order.id, line.id);
      const act = (body: Parameters<StoreWarrantiesService['act']>[3]) =>
        warranties.act(ids.farm, ids.staff, id, body);
      await act({ action: 'send', partnerName: 'Sửa chữa Minh Phát' });
      await act({ action: 'quote', quoteAmount: '350000' });
      // The partner revises the quote before the customer answers.
      await act({ action: 'quote', quoteAmount: '300000' });
      await act({ action: 'decide', approved: true });
      await act({ action: 'start-repair' });
      // A further fault mid-repair: new price, the old consent no longer holds.
      const requoted = await act({ action: 'quote', quoteAmount: '500000' });
      expect(requoted).toMatchObject({
        status: 'AWAITING_CUSTOMER',
        quoteAmount: '500000',
        customerApproved: null,
        repairStartedAt: null,
      });
      await act({ action: 'decide', approved: true, note: 'Đồng ý giá mới' });
      await act({ action: 'start-repair' });
      await act({ action: 'back', result: 'Vẫn chưa chạy', actualCost: '0' });
      // Back but not fixed: send it round again instead of closing.
      const again = await act({ action: 'send', partnerName: 'Điện máy An' });
      expect(again).toMatchObject({
        status: 'AT_PARTNER',
        partnerName: 'Điện máy An',
        result: null,
        customerApproved: null,
      });
      await expect(act({ action: 'start-repair' })).rejects.toMatchObject({
        response: { code: 'CUSTOMER_CONSENT_REQUIRED' },
      });
      await act({ action: 'quote', quoteAmount: '200000' });
      await act({ action: 'decide', approved: true });
      await act({ action: 'start-repair' });
      await act({ action: 'back', result: 'Đã chạy', actualCost: '200000' });
      expect(await act({ action: 'return' })).toMatchObject({
        status: 'CLOSED',
        actualCost: '200000',
      });
      // One request, every round in its history.
      const rounds = await tx
        .select({ action: schema.auditLogs.action })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.entityId, id));
      expect(rounds.length).toBeGreaterThanOrEqual(14);
      expect(
        await tx
          .select({ id: schema.storeWarrantyRequests.id })
          .from(schema.storeWarrantyRequests)
          .where(eq(schema.storeWarrantyRequests.orderId, order.id)),
      ).toHaveLength(1);
    }));

  it('records an agreed paid repair through to handing it back', () =>
    inRollback(async (ctx) => {
      const { ids, warranties } = ctx;
      const { order, line } = await delivered(ctx);
      const { id } = await claim(ctx, order.id, line.id);
      const act = (body: Parameters<StoreWarrantiesService['act']>[3]) =>
        warranties.act(ids.farm, ids.staff, id, body);
      await act({ action: 'send', partnerName: 'Sửa chữa Minh Phát' });
      await act({ action: 'quote', quoteAmount: '350000' });
      await act({ action: 'decide', approved: true });
      await act({ action: 'start-repair' });
      await act({
        action: 'back',
        result: 'Đã thay mô-tơ',
        actualCost: '320000',
      });
      const closed = await act({ action: 'return' });
      expect(closed).toMatchObject({
        status: 'CLOSED',
        resolution: 'RETURN',
        kind: 'PAID_REPAIR',
        customerApproved: true,
        actualCost: '320000',
        partnerName: 'Sửa chữa Minh Phát',
      });
      // The customer sees the outcome, without staff or stock references.
      const [mine] = await warranties.forCustomerOrder(order.id);
      expect(mine).toMatchObject({ status: 'CLOSED', result: 'Đã thay mô-tơ' });
      expect(mine).not.toHaveProperty('handledByMemberId');
    }));

  it('exchanges through one stock issue and closes only once it is confirmed (AC24)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, warranties, issues } = ctx;
      const { order, line } = await delivered(ctx);
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      const { id } = await claim(ctx, order.id, line.id);
      const act = (body: Parameters<StoreWarrantiesService['act']>[3]) =>
        warranties.act(ids.farm, ids.staff, id, body);
      const exchanging = await act({ action: 'exchange' });
      expect(exchanging.status).toBe('EXCHANGING');
      expect(exchanging.exchangeIssue).toMatchObject({ status: 'DRAFT' });
      // A second exchange while the first issue is open is refused.
      await expect(act({ action: 'exchange' })).rejects.toMatchObject({
        response: { code: 'EXCHANGE_PENDING' },
      });
      await expect(act({ action: 'close' })).rejects.toMatchObject({
        response: { code: 'EXCHANGE_NOT_ISSUED' },
      });
      // A draft holds nothing physical yet.
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      const issueId = exchanging.exchangeIssue!.id;
      await issues.confirm(issueId, ids.farm, ids.admin);
      await issues.confirm(issueId, ids.farm, ids.admin);
      // One unit of 0.125 left once; the faulty one is not put back.
      expect(await salesBalance(tx, ctx)).toBe('9.500');
      expect(await act({ action: 'close' })).toMatchObject({
        status: 'CLOSED',
        resolution: 'EXCHANGE',
      });
      expect(await salesBalance(tx, ctx)).toBe('9.500');
    }));

  it('hands an exchanged ASSET to the customer instead of leaving it in internal use (P1-07)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, issues, warranties, input } = ctx;
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
      const { order } = await service.create(ids.customer, input(1));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      await service.complete(ids.farm, ids.staff, order.id);
      const detail = await service.staffGet(ids.farm, order.id);
      const [line] = detail.items;
      // P1-09: an ASSET line is claimed by the delivered unit.
      const { id } = await ctx.warranties.create(ids.farm, ids.staff, {
        orderId: order.id,
        orderItemId: line.id,
        assetId: detail.deliveredAssets[0].id,
        quantity: 1,
        kind: 'WARRANTY',
        issueDescription: 'Không hoạt động',
        intakeNote: 'Khách mang đến cửa hàng',
      });
      const exchanging = await warranties.act(ids.farm, ids.staff, id, {
        action: 'exchange',
      });
      const issueId = exchanging.exchangeIssue!.id;
      const [picked] = (await issues.get(issueId, ids.farm, ids.admin)).items;
      expect(picked.assetId).toBeTruthy();
      await issues.confirm(issueId, ids.farm, ids.admin);
      await issues.confirm(issueId, ids.farm, ids.admin);
      const [given] = await tx
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, picked.assetId!));
      // Left the warehouse for the customer: not IN_USE at the farm, no location.
      expect(given).toMatchObject({
        status: 'RETIRED',
        currentLocationId: null,
      });
      // Both units left once: the sold one and the replacement.
      expect(await salesBalance(tx, ctx)).toBe('8.000');
      const moves = await tx
        .select()
        .from(schema.inventoryTransactions)
        .where(eq(schema.inventoryTransactions.assetId, picked.assetId!));
      expect(moves).toHaveLength(1);
      expect(
        await warranties.act(ids.farm, ids.staff, id, { action: 'close' }),
      ).toMatchObject({ status: 'CLOSED', resolution: 'EXCHANGE' });
    }));

  it('claims an ASSET by the delivered unit, one open claim per unit (P1-09)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, service, issues, input } = ctx;
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
        assetIds.map((id, index) => ({
          id,
          farmId: ids.farm,
          itemId: ids.item,
          assetCode: id,
          serialNumber: `SN-${index}`,
          currentLocationId: ids.location,
        })),
      );
      const { order } = await service.create(ids.customer, input(2));
      const confirmed = await service.confirm(ids.farm, ids.staff, order.id);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await service.ship(ids.farm, ids.staff, order.id);
      await service.complete(ids.farm, ids.staff, order.id);
      const detail = await service.staffGet(ids.farm, order.id);
      const sold = detail.deliveredAssets.map((asset) => asset.id);
      expect(sold).toHaveLength(2);
      const unsold = assetIds.find((id) => !sold.includes(id))!;
      const line = detail.items[0];
      const claimAsset = (assetId?: string, quantity = 1) =>
        ctx.warranties.create(ids.farm, ids.staff, {
          orderId: order.id,
          orderItemId: line.id,
          quantity,
          assetId,
          kind: 'WARRANTY',
          issueDescription: 'Không chạy',
        });
      await expect(claimAsset()).rejects.toMatchObject({
        response: { code: 'WARRANTY_ASSET_REQUIRED' },
      });
      await expect(claimAsset(sold[0], 2)).rejects.toMatchObject({
        response: { code: 'WARRANTY_ASSET_REQUIRED' },
      });
      // A unit still in the warehouse (or another order's) is not this sale.
      await expect(claimAsset(unsold)).rejects.toMatchObject({
        response: { code: 'WARRANTY_ASSET_NOT_DELIVERED' },
      });
      const first = await claimAsset(sold[0]);
      expect(first).toMatchObject({ assetId: sold[0], quantity: 1 });
      await expect(claimAsset(sold[0])).rejects.toMatchObject({
        response: { code: 'WARRANTY_ASSET_OPEN' },
      });
      // A different serial of the same line is its own claim.
      expect(await claimAsset(sold[1])).toMatchObject({ assetId: sold[1] });
      // The line is now full: the reason given is still the open claim, in any case.
      await expect(claimAsset(sold[1].toUpperCase())).rejects.toMatchObject({
        response: { code: 'WARRANTY_ASSET_OPEN' },
      });
    }));

  it('refuses an asset id on a quantity line (P1-09)', () =>
    inRollback(async (ctx) => {
      const { order, line } = await delivered(ctx);
      await expect(
        ctx.warranties.create(ctx.ids.farm, ctx.ids.staff, {
          orderId: order.id,
          orderItemId: line.id,
          quantity: 1,
          assetId: randomUUID(),
          kind: 'WARRANTY',
          issueDescription: 'Lỗi',
        }),
      ).rejects.toThrow('asset-tracked');
    }));

  it('keeps the exchange issue equal to the approved request until it is confirmed (P0-04)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, warranties, issues } = ctx;
      const { order, line } = await delivered(ctx);
      const { id } = await claim(ctx, order.id, line.id);
      const exchanging = await warranties.act(ids.farm, ids.staff, id, {
        action: 'exchange',
      });
      const issueId = exchanging.exchangeIssue!.id;
      const edit = (input: object) =>
        issues.update(issueId, ids.farm, ids.admin, input);
      // One unit of 0.125 was approved: another warehouse, type or amount is refused.
      await expect(edit({ warehouseId: ids.otherWarehouse })).rejects.toThrow(
        'cannot change',
      );
      await expect(edit({ issueType: 'SALE' })).rejects.toThrow(
        'cannot change',
      );
      await expect(
        edit({ items: [{ itemId: ids.item, quantity: '5' }] }),
      ).rejects.toThrow('must match');
      // Saving the same content still works.
      await edit({ items: [{ itemId: ids.item, quantity: '0.125' }] });
      // A change that bypasses update() is caught again at confirmation.
      await tx
        .update(schema.stockIssueItems)
        .set({ quantity: '5' })
        .where(eq(schema.stockIssueItems.stockIssueId, issueId));
      await expect(
        issues.confirm(issueId, ids.farm, ids.admin),
      ).rejects.toThrow('must match');
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      // A draft already switched to another type is refused at confirmation too.
      await tx
        .update(schema.stockIssueItems)
        .set({ quantity: '0.125' })
        .where(eq(schema.stockIssueItems.stockIssueId, issueId));
      await tx
        .update(schema.stockIssues)
        .set({ issueType: 'DISPOSAL' })
        .where(eq(schema.stockIssues.id, issueId));
      await expect(
        issues.confirm(issueId, ids.farm, ids.admin),
      ).rejects.toThrow('cannot change');
      expect(await salesBalance(tx, ctx)).toBe('9.625');
      await expect(
        warranties.act(ids.farm, ids.staff, id, { action: 'close' }),
      ).rejects.toMatchObject({ response: { code: 'EXCHANGE_NOT_ISSUED' } });
    }));
});

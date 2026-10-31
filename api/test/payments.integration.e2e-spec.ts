import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { DatabaseService } from '../src/db/database.service';
import { CommerceService } from '../src/modules/commerce/commerce.service';
import {
  isSepayAuthorized,
  PaymentWebhooksController,
} from '../src/modules/payments/payment-webhooks.controller';
import {
  orderNumberFromContent,
  PaymentsService,
} from '../src/modules/payments/payments.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import {
  cleanupOrders,
  OrderTestDb,
  seedOrders,
  testBankAccount,
  withEnv,
} from './store-orders.fixture';

const ACCOUNT = testBankAccount.STORE_BANK_ACCOUNT_NUMBER;
const API_KEY = 'test-sepay-key';

function paymentsFor(database: DatabaseService) {
  return new PaymentsService(
    database,
    new CommerceService(database),
    new WarehousesService(database),
  );
}

function sepayBody(content: string, amount: number, id = Date.now()) {
  return {
    id,
    gateway: 'Vietcombank',
    transactionDate: '2026-10-31 14:02:37',
    accountNumber: ACCOUNT,
    code: null,
    content,
    transferType: 'in' as const,
    transferAmount: amount,
    accumulated: 0,
    subAccount: null,
    referenceCode: 'FT123',
    description: content,
  };
}

describe('order code parsing', () => {
  it('reads the canonical DH code from bank notes', () => {
    expect(orderNumberFromContent('CT DEN:123 DH000042 chuyen tien')).toBe(42);
    expect(orderNumberFromContent('dh000042')).toBe(42);
    expect(orderNumberFromContent('DH1234567')).toBe(1234567);
    expect(orderNumberFromContent('DH0001234')).toBeNull();
    expect(orderNumberFromContent('DH42')).toBeNull();
    expect(orderNumberFromContent('thanh toan')).toBeNull();
  });

  it('accepts only the exact SePay API key header', () => {
    const restore = withEnv({ SEPAY_WEBHOOK_API_KEY: API_KEY });
    try {
      expect(isSepayAuthorized(`Apikey ${API_KEY}`)).toBe(true);
      expect(isSepayAuthorized(`Apikey ${API_KEY}x`)).toBe(false);
      expect(isSepayAuthorized('Bearer x')).toBe(false);
      expect(isSepayAuthorized(undefined)).toBe(false);
    } finally {
      restore();
    }
    const off = withEnv({ SEPAY_WEBHOOK_API_KEY: undefined });
    try {
      expect(isSepayAuthorized('Apikey ')).toBe(false);
    } finally {
      off();
    }
  });
});

describe('Payments (migrated PostgreSQL)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle(pool, { schema });
  const ROLLBACK = new Error('rollback');
  type Context = Awaited<ReturnType<typeof seedOrders>>;
  const inRollback = async (
    fn: (
      ctx: Context & { payments: PaymentsService },
      tx: OrderTestDb,
    ) => Promise<void>,
  ) => {
    try {
      await db.transaction(async (tx) => {
        const scoped = tx as unknown as OrderTestDb;
        const ctx = await seedOrders(scoped);
        await fn({ ...ctx, payments: paymentsFor(ctx.database) }, scoped);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  };
  let restoreEnv: () => void;
  beforeAll(() => {
    restoreEnv = withEnv({
      ...testBankAccount,
      SEPAY_WEBHOOK_API_KEY: API_KEY,
      PAYMENT_SIMULATOR_ENABLED: 'true',
    });
  });
  afterAll(async () => {
    restoreEnv();
    await pool.end();
  });

  const transferOrder = (ctx: Context) =>
    ctx.service.create(ctx.ids.customer, {
      ...ctx.input(),
      paymentMethod: 'BANK_TRANSFER',
    });

  it('keeps payment transactions behind the API', async () => {
    const result = await pool.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_transactions'::regclass`,
    );
    expect(result.rows[0].relrowsecurity).toBe(true);
  });

  it('pays an order from a verified SePay webhook and audits both rows', () =>
    inRollback(async (ctx, tx) => {
      const { order } = await transferOrder(ctx);
      const controller = new PaymentWebhooksController(ctx.payments);
      await expect(
        controller.sepay('Apikey wrong', sepayBody(order.code, 555000)),
      ).rejects.toThrow('Invalid webhook API key');
      expect(
        (
          await tx
            .select({ value: count() })
            .from(schema.paymentTransactions)
            .where(eq(schema.paymentTransactions.farmId, ctx.ids.farm))
        )[0].value,
      ).toBe(0);

      expect(
        await controller.sepay(
          `Apikey ${API_KEY}`,
          sepayBody(`CT ${order.code} mat ong`, 555000, 9001),
        ),
      ).toEqual({ success: true });
      const paid = await ctx.service.staffGet(ctx.ids.farm, order.id);
      expect(paid.order).toMatchObject({
        paymentStatus: 'PAID',
        paidAt: '2026-10-31 07:02:37+00',
        paidByMemberId: null,
      });
      expect(paid.order.paymentTransactionId).toBe(paid.payments[0].id);
      expect(paid.payments).toMatchObject([
        { provider: 'SEPAY', result: 'MATCHED', amount: '555000' },
      ]);
      const audits = await tx
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.farmId, ctx.ids.farm));
      expect(audits.map((a) => `${a.entityType}:${a.action}`).sort()).toEqual([
        'PAYMENT_TRANSACTION:RECEIVE',
        'STORE_ORDER:PAY',
      ]);
      expect(
        (await ctx.service.customerGet(ctx.ids.customer, order.id)).payment,
      ).toBeNull();
    }));

  it('ignores outgoing transfers', () =>
    inRollback(async (ctx, tx) => {
      const { order } = await transferOrder(ctx);
      await ctx.payments.sepay({
        ...sepayBody(order.code, 555000),
        transferType: 'out',
      });
      expect(
        (
          await tx
            .select({ value: count() })
            .from(schema.paymentTransactions)
            .where(eq(schema.paymentTransactions.farmId, ctx.ids.farm))
        )[0].value,
      ).toBe(0);
    }));

  it('records every mismatch for staff without paying the order', () =>
    inRollback(async (ctx) => {
      const { order } = await transferOrder(ctx);
      const cod = await ctx.service.create(ctx.ids.customer, ctx.input());
      const cancelled = await transferOrder(ctx);
      await ctx.service.customerCancel(
        ctx.ids.customer,
        cancelled.order.id,
        'Đổi ý',
      );
      const simulate = (
        content: string,
        amount: string,
        accountNumber?: string,
      ) =>
        ctx.payments.simulate(ctx.ids.farm, ctx.ids.staff, {
          content,
          amount,
          accountNumber,
        });
      const results = [
        await simulate(order.code, '555001'),
        await simulate(order.code, '554999'),
        await simulate('chuyen tien mat ong', '555000'),
        await simulate('DH999999', '555000'),
        await simulate(order.code, '555000', '999999999'),
        await simulate(cancelled.order.code, '555000'),
        await simulate(cod.order.code, '555000'),
      ];
      expect(results.map((r) => r.transaction.result)).toEqual([
        'AMOUNT_MISMATCH',
        'AMOUNT_MISMATCH',
        'ORDER_NOT_FOUND',
        'ORDER_NOT_FOUND',
        'WRONG_ACCOUNT',
        'ORDER_NOT_PAYABLE',
        'ORDER_NOT_PAYABLE',
      ]);
      expect(results[0].transaction).toMatchObject({
        orderId: order.id,
        orderCode: order.code,
        createdByMemberId: ctx.ids.member,
      });
      expect(results[0].transaction).not.toHaveProperty('rawPayload');
      for (const id of [order.id, cancelled.order.id, cod.order.id])
        expect(
          (await ctx.service.staffGet(ctx.ids.farm, id)).order.paymentStatus,
        ).toBe('UNPAID');
      const history = await ctx.payments.list(ctx.ids.farm, {
        page: 1,
        pageSize: 20,
        offset: 0,
      });
      expect(history.page.totalItems).toBe(7);
      const mismatches = await ctx.payments.list(ctx.ids.farm, {
        page: 1,
        pageSize: 20,
        offset: 0,
        result: 'AMOUNT_MISMATCH',
      });
      expect(mismatches.data).toHaveLength(2);
      expect(
        (
          await ctx.payments.list(ctx.ids.otherFarm, {
            page: 1,
            pageSize: 20,
            offset: 0,
          })
        ).page.totalItems,
      ).toBe(0);
    }));

  it('treats a redelivered transaction as a no-op and a second transfer as already paid', () =>
    inRollback(async (ctx, tx) => {
      const { order } = await transferOrder(ctx);
      const first = await ctx.payments.simulate(ctx.ids.farm, ctx.ids.staff, {
        content: order.code,
        amount: '555000',
      });
      expect(first).toMatchObject({
        duplicate: false,
        transaction: { result: 'MATCHED' },
      });
      const replay = await ctx.payments.simulate(ctx.ids.farm, ctx.ids.staff, {
        content: order.code,
        amount: '1',
        providerTxId: first.transaction.providerTxId,
      });
      expect(replay).toMatchObject({
        duplicate: true,
        transaction: { id: first.transaction.id, result: 'MATCHED' },
      });
      const second = await ctx.payments.simulate(ctx.ids.farm, ctx.ids.staff, {
        content: order.code,
        amount: '555000',
      });
      expect(second.transaction.result).toBe('ALREADY_PAID');
      const paid = await ctx.service.staffGet(ctx.ids.farm, order.id);
      expect(paid.order.paymentTransactionId).toBe(first.transaction.id);
      expect(
        (
          await tx
            .select({ value: count() })
            .from(schema.auditLogs)
            .where(
              and(
                eq(schema.auditLogs.farmId, ctx.ids.farm),
                eq(schema.auditLogs.action, 'PAY'),
              ),
            )
        )[0].value,
      ).toBe(1);
      // Manual flows still work on an auto-paid order.
      expect(
        (await ctx.service.markPaid(ctx.ids.farm, ctx.ids.staff, order.id))
          .order.paidAt,
      ).toBe(paid.order.paidAt);
      await expect(
        ctx.service.customerCancel(ctx.ids.customer, order.id, 'Không mua'),
      ).rejects.toThrow('refund');
    }));

  it('limits the simulator to enabled environments and store staff', () =>
    inRollback(async (ctx) => {
      const { order } = await transferOrder(ctx);
      const input = { content: order.code, amount: '555000' };
      await expect(
        ctx.payments.simulate(ctx.ids.otherFarm, ctx.ids.staff, input),
      ).rejects.toThrow('another farm');
      await expect(
        ctx.payments.simulate(ctx.ids.farm, ctx.ids.customer, input),
      ).rejects.toThrow();
      expect(await ctx.payments.simulator(ctx.ids.farm, ctx.ids.admin)).toEqual(
        { enabled: true, accountNumber: ACCOUNT },
      );
      const off = withEnv({ PAYMENT_SIMULATOR_ENABLED: 'false' });
      try {
        await expect(
          ctx.payments.simulate(ctx.ids.farm, ctx.ids.staff, input),
        ).rejects.toThrow('disabled');
      } finally {
        off();
      }
      expect(
        (await ctx.service.staffGet(ctx.ids.farm, order.id)).payments,
      ).toEqual([]);
    }));
});

// Committed fixtures: separate connections must contend for the same order lock.
describe('Payments on concurrent PostgreSQL connections', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
    options: '-c statement_timeout=5000 -c lock_timeout=4000',
  });
  const db = drizzle(pool, { schema });
  let ctx: Awaited<ReturnType<typeof seedOrders>>;
  let payments: PaymentsService;
  let originalSettings: typeof schema.storeSettings.$inferSelect | undefined;
  let restoreEnv: () => void;
  beforeAll(() => {
    restoreEnv = withEnv(testBankAccount);
  });
  beforeEach(async () => {
    [originalSettings] = await db
      .select()
      .from(schema.storeSettings)
      .where(eq(schema.storeSettings.id, 1));
    ctx = await seedOrders(db);
    payments = paymentsFor(ctx.database);
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
  afterAll(async () => {
    restoreEnv();
    await pool.end();
  });

  const transfer = (code: string, providerTxId: string) => ({
    providerTxId,
    accountNumber: ACCOUNT,
    amount: '555000',
    content: code,
    transactionAt: new Date().toISOString(),
    rawPayload: {},
  });

  it('matches only one of two different transfers for the same order', async () => {
    const { order } = await ctx.service.create(ctx.ids.customer, {
      ...ctx.input(),
      paymentMethod: 'BANK_TRANSFER',
    });
    const results = await Promise.all([
      payments.ingest('SEPAY', transfer(order.code, randomUUID())),
      payments.ingest('SEPAY', transfer(order.code, randomUUID())),
    ]);
    expect(results.map((r) => r.transaction.result).sort()).toEqual([
      'ALREADY_PAID',
      'MATCHED',
    ]);
    const paid = await ctx.service.staffGet(ctx.ids.farm, order.id);
    expect(paid.order.paymentStatus).toBe('PAID');
    expect(paid.payments).toHaveLength(2);
  });

  it('stores one row for simultaneous deliveries of the same transaction', async () => {
    const { order } = await ctx.service.create(ctx.ids.customer, {
      ...ctx.input(),
      paymentMethod: 'BANK_TRANSFER',
    });
    const id = randomUUID();
    const results = await Promise.all([
      payments.ingest('SEPAY', transfer(order.code, id)),
      payments.ingest('SEPAY', transfer(order.code, id)),
    ]);
    expect(results.map((r) => r.duplicate).sort()).toEqual([false, true]);
    expect(results[0].transaction.id).toBe(results[1].transaction.id);
    const unmatched = await Promise.all([
      payments.ingest('SEPAY', transfer('no code', id + '-x')),
      payments.ingest('SEPAY', transfer('no code', id + '-x')),
    ]);
    expect(unmatched.map((r) => r.duplicate).sort()).toEqual([false, true]);
    expect(
      (
        await db
          .select({ value: count() })
          .from(schema.paymentTransactions)
          .where(eq(schema.paymentTransactions.farmId, ctx.ids.farm))
      )[0].value,
    ).toBe(2);
  });
});

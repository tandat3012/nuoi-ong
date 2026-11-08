import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { OrderTestDb, seedOrders } from './store-orders.fixture';

describe('Stock held for customer orders (migrated PostgreSQL)', () => {
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

  /** Order of `units` bottles (0.125 stock unit each) confirmed, so its issue holds stock. */
  async function heldOrder(ctx: Context, units: number) {
    const { ids, service, input } = ctx;
    const { order } = await service.create(ids.customer, input(units));
    return service.confirm(ids.farm, ids.staff, order.id);
  }
  const otherIssue = async (ctx: Context, quantity: string) => {
    const { ids, issues } = ctx;
    const created = await issues.create(ids.farm, ids.admin, {
      warehouseId: ids.warehouse,
      issueType: 'OTHER',
      items: [{ itemId: ids.item, quantity }],
    } as never);
    return created.issue.id;
  };
  const otherTransfer = async (ctx: Context, quantity: string) => {
    const { ids, transfers } = ctx;
    const created = await transfers.create(ids.farm, ids.admin, {
      fromWarehouseId: ids.warehouse,
      toWarehouseId: ids.otherWarehouse,
      items: [{ itemId: ids.item, quantity }],
    });
    return created.transfer.id;
  };
  const onHand = async (tx: OrderTestDb, { ids }: Context) =>
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

  it('refuses an unrelated issue or transfer that would take stock held by an order (P0-02)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, issues, transfers } = ctx;
      // 80 bottles x 0.125 = all 10 units are held by the order.
      const confirmed = await heldOrder(ctx, 80);
      const issueId = await otherIssue(ctx, '1');
      await expect(
        issues.confirm(issueId, ids.farm, ids.admin),
      ).rejects.toThrow('held for customer orders');
      const transferId = await otherTransfer(ctx, '1');
      await expect(
        transfers.confirm(transferId, ids.farm, ids.admin),
      ).rejects.toThrow('held for customer orders');
      expect(await onHand(tx, ctx)).toBe('10.000');
      // The order uses its own hold, exactly once.
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      expect(await onHand(tx, ctx)).toBe('0.000');
    }));

  it('lets other documents use only the part that is not held (P0-02)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, issues } = ctx;
      // 3 bottles hold 0.375 of 10.
      await heldOrder(ctx, 3);
      const tooMuch = await otherIssue(ctx, '9.7');
      await expect(
        issues.confirm(tooMuch, ids.farm, ids.admin),
      ).rejects.toThrow('held for customer orders');
      const fits = await otherIssue(ctx, '9.625');
      await issues.confirm(fits, ids.farm, ids.admin);
      expect(await onHand(tx, ctx)).toBe('0.375');
    }));

  it('lets an order issue be re-saved with its own hold, then still confirm (P0-02)', () =>
    inRollback(async (ctx, tx) => {
      const { ids, issues } = ctx;
      const confirmed = await heldOrder(ctx, 80);
      await issues.update(confirmed.stockIssue.id, ids.farm, ids.admin, {
        items: [{ itemId: ids.item, quantity: '10' }],
      });
      await issues.confirm(confirmed.stockIssue.id, ids.farm, ids.admin);
      expect(await onHand(tx, ctx)).toBe('0.000');
    }));

  it('does not let manual drafts block each other', () =>
    inRollback(async (ctx, tx) => {
      const { ids, issues } = ctx;
      const first = await otherIssue(ctx, '10');
      const second = await otherIssue(ctx, '10');
      await issues.confirm(first, ids.farm, ids.admin);
      await expect(issues.confirm(second, ids.farm, ids.admin)).rejects.toThrow(
        'Insufficient inventory',
      );
      expect(await onHand(tx, ctx)).toBe('0.000');
    }));
});

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { StockCountsService } from '../src/modules/warehouses/stock-counts.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';
import { StockReceiptsService } from '../src/modules/warehouses/stock-receipts.service';
import { StockTransfersService } from '../src/modules/warehouses/stock-transfers.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { AuditLogsService } from '../src/modules/audit-logs/audit-logs.service';

// Approval rules for all four stock documents, with real farm authorization:
// approvers confirm drafts directly, employees submit their own drafts for review.
describe('Stock document approval rules', () => {
  jest.setTimeout(30_000);
  const tag = `doc-approval-${randomUUID().slice(0, 12)}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const database = { db } as unknown as DatabaseService;
  const authorization = new WarehousesService(database);
  const receipts = new StockReceiptsService(database, authorization);
  const issues = new StockIssuesService(database, authorization);
  const transfers = new StockTransfersService(database, authorization);
  const counts = new StockCountsService(database, authorization);
  const auditLogs = new AuditLogsService(database, authorization);
  const farm = randomUUID();
  const warehouse = randomUUID(),
    target = randomUUID();
  const category = randomUUID(),
    unit = randomUUID(),
    item = randomUUID();
  const actors = {
    owner: { id: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    creator: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    peer: { id: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    guest: { id: randomUUID(), member: randomUUID(), role: 'GUEST' },
  };
  type Actor = keyof typeof actors;
  const userIds = Object.values(actors).map((actor) => actor.id);
  const memberIds = Object.values(actors).map((actor) => actor.member);
  const clerk = (actor: Actor) => `${tag}-${actor}`;
  const line = { itemId: item, quantity: '1' };
  let fixturesCreated = false;
  const entityTypes: Record<string, string> = {
    receipt: 'STOCK_RECEIPT',
    issue: 'STOCK_ISSUE',
    transfer: 'STOCK_TRANSFER',
    count: 'STOCK_COUNT',
  };

  const cases = [
    {
      type: 'receipt',
      table: 'stock_receipts',
      create: async (actor: Actor) =>
        (
          await receipts.createReceipt(farm, clerk(actor), {
            warehouseId: warehouse,
            receiptCode: randomUUID(),
            items: [line],
          })
        ).receipt.id,
      update: (id: string, actor: Actor) =>
        receipts.updateReceipt(id, farm, clerk(actor), { note: tag }),
      cancel: (id: string, actor: Actor) =>
        receipts.cancelReceipt(id, farm, clerk(actor)),
      submit: (id: string, actor: Actor) =>
        receipts.submitReceipt(id, farm, clerk(actor)),
      confirm: (id: string, actor: Actor) =>
        receipts.confirmReceipt(id, farm, clerk(actor)),
      reject: (id: string, actor: Actor, reason = 'Sai số lượng') =>
        receipts.rejectReceipt(id, farm, clerk(actor), reason),
      sourceAfterConfirm: '21.000',
    },
    {
      type: 'issue',
      table: 'stock_issues',
      create: async (actor: Actor) =>
        (
          await issues.create(farm, clerk(actor), {
            warehouseId: warehouse,
            issueCode: randomUUID(),
            items: [line],
          })
        ).issue.id,
      update: (id: string, actor: Actor) =>
        issues.update(id, farm, clerk(actor), { note: tag }),
      cancel: (id: string, actor: Actor) =>
        issues.cancel(id, farm, clerk(actor)),
      submit: (id: string, actor: Actor) =>
        issues.submit(id, farm, clerk(actor)),
      confirm: (id: string, actor: Actor) =>
        issues.confirm(id, farm, clerk(actor)),
      reject: (id: string, actor: Actor, reason = 'Sai số lượng') =>
        issues.reject(id, farm, clerk(actor), reason),
      sourceAfterConfirm: '19.000',
    },
    {
      type: 'transfer',
      table: 'stock_transfers',
      create: async (actor: Actor) =>
        (
          await transfers.create(farm, clerk(actor), {
            fromWarehouseId: warehouse,
            toWarehouseId: target,
            transferCode: randomUUID(),
            items: [line],
          })
        ).transfer.id,
      update: (id: string, actor: Actor) =>
        transfers.update(id, farm, clerk(actor), { note: tag }),
      cancel: (id: string, actor: Actor) =>
        transfers.cancel(id, farm, clerk(actor)),
      submit: (id: string, actor: Actor) =>
        transfers.submit(id, farm, clerk(actor)),
      confirm: (id: string, actor: Actor) =>
        transfers.confirm(id, farm, clerk(actor)),
      reject: (id: string, actor: Actor, reason = 'Sai số lượng') =>
        transfers.reject(id, farm, clerk(actor), reason),
      sourceAfterConfirm: '19.000',
    },
    {
      type: 'count',
      table: 'stock_counts',
      create: async (actor: Actor) =>
        (
          await counts.create(farm, clerk(actor), {
            warehouseId: warehouse,
            countCode: randomUUID(),
            items: [{ itemId: item, actualQuantity: '22' }],
          })
        ).count.id,
      update: (id: string, actor: Actor) =>
        counts.update(id, farm, clerk(actor), { note: tag }),
      cancel: (id: string, actor: Actor) =>
        counts.cancel(id, farm, clerk(actor)),
      submit: (id: string, actor: Actor) =>
        counts.submit(id, farm, clerk(actor)),
      confirm: (id: string, actor: Actor) =>
        counts.confirm(id, farm, clerk(actor)),
      reject: (id: string, actor: Actor, reason = 'Sai số lượng') =>
        counts.reject(id, farm, clerk(actor), reason),
      sourceAfterConfirm: '22.000',
    },
  ];

  const statusOf = async (table: string, id: string) =>
    (
      await pool.query<{
        status: string;
        rejection_reason: string | null;
        rejected_by_member_id: string | null;
      }>(
        `SELECT status, rejection_reason, rejected_by_member_id FROM ${table} WHERE id=$1`,
        [id],
      )
    ).rows[0];
  const sourceQuantity = async () =>
    (
      await pool.query<{ quantity_on_hand: string }>(
        'SELECT quantity_on_hand FROM inventory_balances WHERE warehouse_id=$1 AND item_id=$2',
        [warehouse, item],
      )
    ).rows[0].quantity_on_hand;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values({ id: farm, code: tag, name: tag });
      await tx.insert(schema.users).values(
        Object.entries(actors).map(([name, actor]) => ({
          id: actor.id,
          authProviderUserId: clerk(name as Actor),
          email: `${clerk(name as Actor)}@example.local`,
        })),
      );
      await tx.insert(schema.farmMembers).values(
        Object.values(actors).map((actor) => ({
          id: actor.member,
          userId: actor.id,
          farmId: farm,
        })),
      );
      for (const actor of Object.values(actors)) {
        await tx
          .insert(schema.roles)
          .values({ code: actor.role, name: actor.role, scope: 'FARM' })
          .onConflictDoNothing();
        const [role] = await tx
          .select({ id: schema.roles.id })
          .from(schema.roles)
          .where(eq(schema.roles.code, actor.role));
        await tx
          .insert(schema.farmMemberRoles)
          .values({ farmMemberId: actor.member, roleId: role.id });
      }
      await tx
        .insert(schema.categories)
        .values({ id: category, code: tag, name: tag });
      await tx.insert(schema.units).values({ id: unit, code: tag, name: tag });
      await tx.insert(schema.items).values({
        id: item,
        farmId: farm,
        categoryId: category,
        unitId: unit,
        code: tag,
        name: tag,
        itemType: 'MATERIAL',
        trackingMode: 'QUANTITY',
      });
      await tx.insert(schema.warehouses).values([
        { id: warehouse, farmId: farm, code: 'SOURCE', name: tag },
        { id: target, farmId: farm, code: 'TARGET', name: tag },
      ]);
    });
    fixturesCreated = true;
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM notifications WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farm]);
    await pool.query('DELETE FROM inventory_transactions WHERE farm_id=$1', [
      farm,
    ]);
    for (const { table } of cases)
      await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
    await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [farm]);
    await db.insert(schema.inventoryBalances).values({
      farmId: farm,
      warehouseId: warehouse,
      itemId: item,
      quantityOnHand: '20',
    });
  });

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await pool.query('DELETE FROM notifications WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM audit_logs WHERE farm_id=$1', [farm]);
        await pool.query(
          'DELETE FROM inventory_transactions WHERE farm_id=$1',
          [farm],
        );
        for (const { table } of cases)
          await pool.query(`DELETE FROM ${table} WHERE farm_id=$1`, [farm]);
        await pool.query('DELETE FROM inventory_balances WHERE farm_id=$1', [
          farm,
        ]);
        await pool.query('DELETE FROM items WHERE id=$1', [item]);
        await pool.query('DELETE FROM warehouses WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM categories WHERE id=$1', [category]);
        await pool.query('DELETE FROM units WHERE id=$1', [unit]);
        await pool.query(
          'DELETE FROM farm_member_roles WHERE farm_member_id=ANY($1::uuid[])',
          [memberIds],
        );
        await pool.query('DELETE FROM farm_members WHERE farm_id=$1', [farm]);
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
          userIds,
        ]);
        await pool.query('DELETE FROM farms WHERE id=$1', [farm]);
      }
    } finally {
      await pool.end();
    }
  });

  describe.each(cases)('$type', (document) => {
    it('lets an approver confirm a draft directly', async () => {
      const id = await document.create('owner');
      await document.confirm(id, 'owner');
      expect((await statusOf(document.table, id)).status).toBe('CONFIRMED');
      expect(await sourceQuantity()).toBe(document.sourceAfterConfirm);
    });

    it('makes an employee submit their own draft before an approver confirms it', async () => {
      const id = await document.create('creator');
      await document.update(id, 'creator');
      await expect(document.confirm(id, 'creator')).rejects.toThrow(
        'Warehouse write permission is required',
      );
      await document.submit(id, 'creator');
      expect((await statusOf(document.table, id)).status).toBe(
        'PENDING_APPROVAL',
      );
      // A submitted document can be neither edited, withdrawn nor resubmitted.
      await expect(document.update(id, 'creator')).rejects.toThrow(/edited/);
      await expect(document.cancel(id, 'creator')).rejects.toThrow(/cancelled/);
      await expect(document.submit(id, 'creator')).rejects.toThrow(/submitted/);
      expect(await sourceQuantity()).toBe('20.000');
      await document.confirm(id, 'owner');
      expect((await statusOf(document.table, id)).status).toBe('CONFIRMED');
      expect(await sourceQuantity()).toBe(document.sourceAfterConfirm);
    });

    it("keeps employees away from another member's draft, but not approvers", async () => {
      const id = await document.create('creator');
      const own = 'Only your own documents can be changed';
      await expect(document.update(id, 'peer')).rejects.toThrow(own);
      await expect(document.submit(id, 'peer')).rejects.toThrow(own);
      await expect(document.cancel(id, 'peer')).rejects.toThrow(own);
      await document.cancel(id, 'owner');
      expect((await statusOf(document.table, id)).status).toBe('CANCELLED');
    });

    it('does not let a guest create documents', async () => {
      await expect(document.create('guest')).rejects.toThrow(
        'Stock document permission is required',
      );
    });

    it('rejects only pending documents, with a reason, and keeps REJECTED final', async () => {
      const id = await document.create('creator');
      await expect(document.reject(id, 'owner')).rejects.toThrow(
        /PENDING_APPROVAL/,
      );
      await document.submit(id, 'creator');
      await expect(document.reject(id, 'creator')).rejects.toThrow(
        'Warehouse write permission is required',
      );
      await expect(document.reject(id, 'owner', '   ')).rejects.toThrow(
        'Rejection reason is required',
      );
      await document.reject(id, 'owner', '  Sai số lượng  ');
      expect(await statusOf(document.table, id)).toEqual({
        status: 'REJECTED',
        rejection_reason: 'Sai số lượng',
        rejected_by_member_id: actors.owner.member,
      });
      await expect(document.confirm(id, 'owner')).rejects.toThrow(/confirmed/);
      await expect(document.submit(id, 'creator')).rejects.toThrow(/submitted/);
      await expect(document.cancel(id, 'owner')).rejects.toThrow(/cancelled/);
      expect(await sourceQuantity()).toBe('20.000');
    });

    it('notifies approvers on submit and the creator on review, but never the actor', async () => {
      const notified = async (id: string) =>
        (
          await pool.query<{ user_id: string; type: string }>(
            'SELECT user_id, type FROM notifications WHERE entity_id=$1 ORDER BY created_at',
            [id],
          )
        ).rows.map((row) => [row.user_id, row.type.split('_').pop()]);
      const submitted = await document.create('creator');
      await document.submit(submitted, 'creator');
      await document.confirm(submitted, 'owner');
      expect(await notified(submitted)).toEqual([
        [actors.owner.id, 'APPROVAL'],
        [actors.creator.id, 'CONFIRMED'],
      ]);
      const direct = await document.create('owner');
      await document.confirm(direct, 'owner');
      expect(await notified(direct)).toEqual([]);
    });

    it('audits every change with its actor, states and lines, inside the same transaction', async () => {
      const id = await document.create('creator');
      await document.update(id, 'creator');
      await expect(document.update(id, 'peer')).rejects.toThrow();
      await document.submit(id, 'creator');
      await document.reject(id, 'owner');
      const { rows } = await pool.query<{
        action: string;
        entity_type: string;
        user_id: string;
        old_data: Record<string, unknown> | null;
        new_data: Record<string, unknown>;
      }>(
        'SELECT action, entity_type, user_id, old_data, new_data FROM audit_logs WHERE entity_id=$1 ORDER BY created_at, action',
        [id],
      );
      expect(rows.map((row) => [row.action, row.user_id])).toEqual([
        ['CREATE', actors.creator.id],
        ['UPDATE', actors.creator.id],
        ['SUBMIT', actors.creator.id],
        ['REJECT', actors.owner.id],
      ]);
      expect(new Set(rows.map((row) => row.entity_type))).toEqual(
        new Set([entityTypes[document.type]]),
      );
      const [created, updated, submitted, rejected] = rows;
      expect(created.old_data).toBeNull();
      expect(created.new_data).toMatchObject({
        status: 'DRAFT',
        createdByMemberId: actors.creator.member,
        items: [expect.objectContaining({ itemId: item })],
      });
      expect(updated.new_data).toMatchObject({ note: tag });
      expect(submitted.old_data).toMatchObject({
        status: document.type === 'count' ? 'COUNTING' : 'DRAFT',
      });
      expect(submitted.new_data).toMatchObject({ status: 'PENDING_APPROVAL' });
      expect(rejected.new_data).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Sai số lượng',
        createdByMemberId: actors.creator.member,
      });
    });

    it('audits a direct confirmation once', async () => {
      const id = await document.create('owner');
      await document.confirm(id, 'owner');
      await document.confirm(id, 'owner').catch(() => undefined);
      const { rows } = await pool.query<{ action: string }>(
        'SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY created_at',
        [id],
      );
      expect(rows.map((row) => row.action)).toEqual(['CREATE', 'CONFIRM']);
    });
  });

  describe('audit history access', () => {
    it('shows approvers the whole farm and employees only their own documents', async () => {
      const own = await cases[0].create('creator');
      const others = await cases[1].create('peer');
      await db.insert(schema.auditLogs).values({
        farmId: farm,
        userId: actors.owner.id,
        action: 'UPDATE',
        entityType: 'PERSONNEL',
        entityId: actors.peer.member,
        newData: { note: tag },
      });
      const page = { page: 1, pageSize: 50, offset: 0 };
      const ownerView = await auditLogs.list({
        ...page,
        farmId: farm,
        clerkUserId: clerk('owner'),
      });
      expect(ownerView.data.map((row) => row.entityId).sort()).toEqual(
        [own, others, actors.peer.member].sort(),
      );
      expect(ownerView.data[0]).toHaveProperty('actor');
      // Ids in the page come back as readable codes and names.
      expect(ownerView.references).toMatchObject({
        [warehouse]: `SOURCE — ${tag}`,
        [item]: `${tag} — ${tag}`,
        [actors.creator.member]: `${clerk('creator')}@example.local`,
        [actors.peer.member]: `${clerk('peer')}@example.local`,
      });
      expect(ownerView.references[own]).toEqual(expect.any(String));
      const creatorView = await auditLogs.list({
        ...page,
        farmId: farm,
        clerkUserId: clerk('creator'),
      });
      expect(creatorView.data.map((row) => row.entityId)).toEqual([own]);
      expect(creatorView.data[0].actor).toMatchObject({
        email: `${clerk('creator')}@example.local`,
      });
      const filtered = await auditLogs.list({
        ...page,
        farmId: farm,
        clerkUserId: clerk('owner'),
        entityType: 'STOCK_ISSUE',
        action: 'CREATE',
      });
      expect(filtered.data.map((row) => row.entityId)).toEqual([others]);
      const [peerLog] = (
        await auditLogs.list({
          ...page,
          farmId: farm,
          clerkUserId: clerk('peer'),
        })
      ).data;
      await expect(
        auditLogs.get(peerLog.id, farm, clerk('creator')),
      ).rejects.toThrow('Audit log not found');
      await expect(
        auditLogs.get(peerLog.id, farm, clerk('owner')),
      ).resolves.toMatchObject({ entityId: others });
      await expect(
        auditLogs.list({ ...page, farmId: farm, clerkUserId: clerk('guest') }),
      ).rejects.toThrow('Audit history permission is required');
    });
  });
});

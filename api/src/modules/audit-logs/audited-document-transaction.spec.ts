import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { DatabaseService } from '../../db/database.service';
import { auditLogs } from '../../db/schema';
import { auditedDocumentTransaction } from './audited-document-transaction';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
describe('auditedDocumentTransaction', () => {
  const metadata = {
    farmId: 'farm-id',
    clerkUserId: 'clerk-user',
    entityId: 'document-id',
    entityType: 'STOCK_ISSUE' as const,
    action: 'REJECT' as const,
  };
  const execute = jest.fn<Promise<{ rows: unknown[] }>, [SQL]>();
  const values = jest.fn<Promise<void>, [typeof auditLogs.$inferInsert]>();
  const insert = jest.fn<unknown, [typeof auditLogs]>(() => ({ values }));
  const select = jest.fn(() => ({
    from: () => ({
      where: () => ({ limit: () => Promise.resolve([{ id: 'user-id' }]) }),
    }),
  }));
  const tx = { execute, insert, select } as unknown as Transaction;
  const db = {
    transaction: (callback: (transaction: Transaction) => Promise<unknown>) =>
      callback(tx),
  } as unknown as Db;
  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockReset();
    values.mockReset();
    values.mockResolvedValue(undefined);
  });
  function snapshots(
    before = { status: 'PENDING_APPROVAL' },
    after = { status: 'REJECTED' },
  ) {
    execute
      .mockResolvedValueOnce({ rows: [{ document: before }] })
      .mockResolvedValueOnce({
        rows: [{ line: { item_id: 'item-1', quantity: '2.000' } }],
      })
      .mockResolvedValueOnce({ rows: [{ document: after }] })
      .mockResolvedValueOnce({
        rows: [{ line: { item_id: 'item-1', quantity: '2.000' } }],
      });
  }
  it('stores snapshots and the Clerk actor inside the business transaction', async () => {
    snapshots();
    const operation = jest.fn((transaction: Transaction) => {
      expect(transaction).toBe(tx);
      return Promise.resolve('result');
    });
    await expect(
      auditedDocumentTransaction(db, metadata, operation),
    ).resolves.toBe('result');
    expect(insert).toHaveBeenCalledWith(auditLogs);
    expect(values).toHaveBeenCalledWith({
      farmId: 'farm-id',
      userId: 'user-id',
      entityId: 'document-id',
      entityType: 'STOCK_ISSUE',
      action: 'REJECT',
      oldData: {
        status: 'PENDING_APPROVAL',
        items: [{ item_id: 'item-1', quantity: '2.000' }],
      },
      newData: {
        status: 'REJECTED',
        items: [{ item_id: 'item-1', quantity: '2.000' }],
      },
    });
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain('for update');
    expect(query.params).toEqual(['document-id', 'farm-id']);
  });
  it('does not log a failed operation', async () => {
    snapshots();
    await expect(
      auditedDocumentTransaction(db, metadata, () =>
        Promise.reject(new Error('Insufficient inventory')),
      ),
    ).rejects.toThrow('Insufficient inventory');
    expect(insert).not.toHaveBeenCalled();
  });
  it('does not log an idempotent repeat confirmation', async () => {
    snapshots({ status: 'CONFIRMED' }, { status: 'CONFIRMED' });
    await auditedDocumentTransaction(
      db,
      { ...metadata, action: 'CONFIRM' },
      () => Promise.resolve(undefined),
    );
    expect(insert).not.toHaveBeenCalled();
  });
  it('propagates an audit write failure so the transaction cannot commit', async () => {
    snapshots();
    values.mockRejectedValueOnce(new Error('Audit unavailable'));
    await expect(
      auditedDocumentTransaction(db, metadata, () =>
        Promise.resolve(undefined),
      ),
    ).rejects.toThrow('Audit unavailable');
  });
  it('captures a newly created document by the ID returned from the operation', async () => {
    execute
      .mockResolvedValueOnce({ rows: [{ document: { status: 'DRAFT' } }] })
      .mockResolvedValueOnce({ rows: [] });
    await auditedDocumentTransaction(
      db,
      { ...metadata, entityId: undefined, action: 'CREATE' },
      () => Promise.resolve('new-id'),
    );
    expect(values.mock.calls[0][0]).toMatchObject({
      entityId: 'new-id',
      action: 'CREATE',
      oldData: null,
    });
  });
});

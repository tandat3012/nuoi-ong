import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const id = 'c796d96d-7260-4763-a9fe-8fe08a444165';
  const select = jest.fn();
  const access = { assertFarmAccess: jest.fn() };
  let service: AuditLogsService;
  function queryReturning<T>(rows: T[]) {
    const query = {
      from: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn<unknown, [SQL]>(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      then: (resolve: (value: T[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    for (const method of [
      'from',
      'leftJoin',
      'where',
      'orderBy',
      'limit',
      'offset',
    ] as const) {
      query[method].mockReturnValue(query);
    }
    return query;
  }
  beforeEach(() => {
    jest.resetAllMocks();
    access.assertFarmAccess.mockResolvedValue('member-id');
    service = new AuditLogsService(
      { db: { select } } as unknown as DatabaseService,
      access as never,
    );
  });
  it('requires farm access before querying the detail', async () => {
    access.assertFarmAccess.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.get(id, farmId, 'clerk-user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(select).not.toHaveBeenCalled();
  });
  it('scopes detail by both log ID and farm ID and returns stored snapshots', async () => {
    const audit = {
      id,
      farmId,
      oldData: { status: 'PENDING_APPROVAL' },
      newData: { status: 'REJECTED', rejectionReason: 'Kho đóng cửa' },
    };
    const query = queryReturning([
      { audit, actorName: 'Owner', actorEmail: 'owner@example.test' },
    ]);
    select
      .mockReturnValueOnce(queryReturning([{ roleCode: 'FARM_OWNER' }]))
      .mockReturnValueOnce(query);
    await expect(service.get(id, farmId, 'clerk-user')).resolves.toEqual({
      ...audit,
      actor: { name: 'Owner', email: 'owner@example.test' },
    });
    expect(access.assertFarmAccess).toHaveBeenCalledWith(
      farmId,
      'clerk-user',
      false,
    );
    const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(sql.sql).toContain('"audit_logs"."id"');
    expect(sql.sql).toContain('"audit_logs"."farm_id"');
    expect(sql.params).toEqual([id, farmId]);
  });
  it('returns not-found when the log is missing or belongs to another farm', async () => {
    select
      .mockReturnValueOnce(queryReturning([{ roleCode: 'FARM_OWNER' }]))
      .mockReturnValueOnce(queryReturning([]));
    await expect(service.get(id, farmId, 'clerk-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('allows historical logs with missing actor information', async () => {
    select
      .mockReturnValueOnce(queryReturning([{ roleCode: 'FARM_OWNER' }]))
      .mockReturnValueOnce(
        queryReturning([{ audit: { id }, actorName: null, actorEmail: null }]),
      );
    await expect(service.get(id, farmId, 'clerk-user')).resolves.toEqual({
      id,
      actor: null,
    });
  });
  it('applies filters, pagination and a stable ordering to the list', async () => {
    const query = queryReturning([
      { audit: { id }, actorName: null, actorEmail: null },
    ]);
    select
      .mockReturnValueOnce(queryReturning([{ roleCode: 'FARM_OWNER' }]))
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(queryReturning([{ value: '41' }]));
    const result = await service.list({
      farmId,
      clerkUserId: 'clerk-user',
      page: 2,
      pageSize: 20,
      offset: 20,
      action: 'reject',
      entityType: 'stock_issue',
    });
    expect(result.page).toEqual({
      number: 2,
      size: 20,
      totalItems: 41,
      totalPages: 3,
    });
    expect(query.offset).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(query.orderBy.mock.calls[0]).toHaveLength(2);
    const sql = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(sql.params).toEqual([farmId, 'STOCK_ISSUE', 'REJECT']);
    expect(sql.sql).toContain('upper(');
  });
});

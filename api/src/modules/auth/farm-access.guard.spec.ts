import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { DatabaseService } from '../../db/database.service';
import { FarmAccessGuard } from './farm-access.guard';

describe('FarmAccessGuard', () => {
  const getAllAndOverride = jest.fn();
  const select = jest.fn();
  const databaseService = {
    db: { select },
  } as unknown as DatabaseService;
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const request = {
    query: { farmId: '6a8ac800-8daa-4e25-9ef8-57af547f8784' },
    auth: { clerkUserId: 'user_123', sessionId: 'sess_123' },
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  let guard: FarmAccessGuard;

  function mockMembershipRows(rows: unknown[]) {
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn().mockResolvedValue(rows),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    select.mockReturnValue(query);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    request.query = { farmId: '6a8ac800-8daa-4e25-9ef8-57af547f8784' };
    guard = new FarmAccessGuard(databaseService, reflector);
  });

  it('allows an active farm member to read farm data', async () => {
    getAllAndOverride.mockReturnValue(undefined);
    mockMembershipRows([
      { userStatus: 'ACTIVE', memberStatus: 'ACTIVE', roleCode: 'EMPLOYEE' },
    ]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a user without an active farm membership', async () => {
    getAllAndOverride.mockReturnValue(undefined);
    mockMembershipRows([]);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects inactive users and inactive memberships', async () => {
    getAllAndOverride.mockReturnValue(undefined);
    mockMembershipRows([
      { userStatus: 'INACTIVE', memberStatus: 'ACTIVE', roleCode: 'ADMIN' },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    mockMembershipRows([
      { userStatus: 'ACTIVE', memberStatus: 'INACTIVE', roleCode: 'ADMIN' },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects malformed farm IDs before querying the database', async () => {
    request.query = { farmId: 'not-a-uuid' };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(select).not.toHaveBeenCalled();
  });

  it('propagates unexpected database failures', async () => {
    getAllAndOverride.mockReturnValue(undefined);
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    select.mockReturnValue(query);

    await expect(guard.canActivate(context)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('rejects an active member without a required write role', async () => {
    getAllAndOverride.mockReturnValue(['ADMIN', 'FARM_OWNER']);
    mockMembershipRows([
      { userStatus: 'ACTIVE', memberStatus: 'ACTIVE', roleCode: 'EMPLOYEE' },
    ]);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires a farm id', async () => {
    request.query = {};

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import type { DatabaseService } from '../../db/database.service';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService', () => {
  const select = jest.fn();
  const returning = jest.fn();
  const mutation = {
    values: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    returning,
  };
  const insert = jest.fn(() => mutation);
  const update = jest.fn(() => mutation);
  const service = new WarehousesService({
    db: { select, insert, update },
  } as unknown as DatabaseService);
  const member = {
    memberId: 'member',
    userStatus: 'ACTIVE',
    memberStatus: 'ACTIVE',
    roleCode: 'FARM_OWNER',
  };

  function rows(data: unknown[]) {
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      orderBy: jest.fn(),
      offset: jest.fn(),
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(data).then(resolve),
    };
    for (const key of [
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'limit',
      'orderBy',
      'offset',
    ] as const)
      query[key].mockReturnValue(query);
    return query;
  }
  beforeEach(() => {
    jest.resetAllMocks();
    insert.mockReturnValue(mutation);
    update.mockReturnValue(mutation);
    mutation.values.mockReturnValue(mutation);
    mutation.set.mockReturnValue(mutation);
    mutation.where.mockReturnValue(mutation);
    returning.mockResolvedValue([{ id: 'warehouse', status: 'INACTIVE' }]);
    select.mockReturnValueOnce(rows([member]));
  });

  it.each(['ADMIN', 'FARM_OWNER'])('allows %s to write', async (roleCode) => {
    select.mockReset().mockReturnValue(rows([{ ...member, roleCode }]));
    await expect(
      service.assertFarmAccess('farm', 'identity', true),
    ).resolves.toBe('member');
  });
  it('permits guest reads, denies writes and inactive membership', async () => {
    select
      .mockReset()
      .mockReturnValue(rows([{ ...member, roleCode: 'GUEST' }]));
    await expect(
      service.assertFarmAccess('farm', 'identity', false),
    ).resolves.toBe('member');
    await expect(
      service.assertFarmAccess('farm', 'identity', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    select.mockReturnValue(rows([{ ...member, memberStatus: 'INACTIVE' }]));
    await expect(
      service.assertFarmAccess('farm', 'identity', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    select.mockReturnValue(rows([]));
    await expect(
      service.assertFarmAccess('farm', 'identity', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects a warehouse absent from the requested farm', async () => {
    select.mockReturnValueOnce(rows([]));
    await expect(
      service.getWarehouse('warehouse', 'other-farm', 'identity'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects empty updates', async () => {
    await expect(
      service.updateWarehouse('warehouse', 'farm', 'identity', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it.each(['delete', 'patch'])(
    'blocks %s when stock remains',
    async (method) => {
      select
        .mockReturnValueOnce(rows([{ id: 'warehouse' }]))
        .mockReturnValueOnce(rows([{ quantity: '0.001' }]));
      const result =
        method === 'delete'
          ? service.deleteWarehouse('warehouse', 'farm', 'identity')
          : service.updateWarehouse('warehouse', 'farm', 'identity', {
              status: 'INACTIVE',
            });
      await expect(result).rejects.toThrow('WAREHOUSE_NOT_EMPTY');
      expect(update).not.toHaveBeenCalled();
    },
  );
  it('blocks deactivation with asset custody even without stock', async () => {
    select
      .mockReturnValueOnce(rows([{ id: 'warehouse' }]))
      .mockReturnValueOnce(rows([{ quantity: '0' }]))
      .mockReturnValueOnce(rows([{ value: 1 }]));
    await expect(
      service.deleteWarehouse('warehouse', 'farm', 'identity'),
    ).rejects.toThrow('WAREHOUSE_NOT_EMPTY');
    expect(update).not.toHaveBeenCalled();
  });
  it('soft-deactivates an eligible warehouse', async () => {
    select
      .mockReturnValueOnce(rows([{ id: 'warehouse' }]))
      .mockReturnValueOnce(rows([{ quantity: '0' }]))
      .mockReturnValueOnce(rows([{ value: 0 }]));
    await expect(
      service.deleteWarehouse('warehouse', 'farm', 'identity'),
    ).resolves.toMatchObject({ status: 'INACTIVE' });
    expect(mutation.set).toHaveBeenCalledWith({
      status: 'INACTIVE',
      updatedAt: expect.any(String) as string,
    });
  });
  it.each(['create', 'update'])(
    'maps real Drizzle duplicate errors for %s to 409',
    async (operation) => {
      const cause = Object.assign(new Error('duplicate'), { code: '23505' });
      returning.mockRejectedValue(new DrizzleQueryError('query', [], cause));
      select.mockReturnValueOnce(rows([{ id: 'warehouse' }]));
      const result =
        operation === 'create'
          ? service.createWarehouse('farm', 'identity', {
              code: 'CODE',
              name: 'Name',
            })
          : service.updateWarehouse('warehouse', 'farm', 'identity', {
              code: 'CODE',
            });
      await expect(result).rejects.toBeInstanceOf(ConflictException);
    },
  );
  it('does not turn unrelated database failures into duplicate-code errors', async () => {
    const failure = new Error('database unavailable');
    returning.mockRejectedValue(failure);
    await expect(
      service.createWarehouse('farm', 'identity', {
        code: 'CODE',
        name: 'Name',
      }),
    ).rejects.toBe(failure);
  });
});

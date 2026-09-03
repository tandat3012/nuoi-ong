import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DatabaseService } from '../../db/database.service';
import { MaterialsService } from './materials.service';

describe('MaterialsService', () => {
  const select = jest.fn();
  const transaction = jest.fn();
  const databaseService = {
    db: {
      select,
      transaction,
    },
  } as unknown as DatabaseService;
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const categoryId = '055de72f-1f5d-4ab5-b108-49fa3a734f8f';
  const unitId = '3f159455-6f88-4d5e-8849-6107f17709a2';
  let service: MaterialsService;

  function queryReturning<T>(rows: T[]) {
    const query = {
      from: jest.fn(),
      leftJoin: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      groupBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      then: (resolve: (value: T[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    query.from.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    query.groupBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.offset.mockReturnValue(query);
    return query;
  }

  function mockGetMaterial(material: unknown[]) {
    select.mockReturnValue(queryReturning(material));
  }

  const validInput = {
    categoryId,
    unitId,
    code: 'MAT-TEST',
    name: 'Vật tư kiểm thử',
    trackingMode: 'LOT' as const,
    kind: 'FEED' as const,
    requiresExpiryTracking: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialsService(databaseService);
  });

  it('rejects expiry tracking unless LOT mode is used', async () => {
    await expect(
      service.createMaterial(farmId, {
        ...validInput,
        trackingMode: 'QUANTITY',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates a material and returns the created record', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          queryReturning([{ id: categoryId, status: 'ACTIVE' }]),
        )
        .mockReturnValueOnce(
          queryReturning([{ id: unitId, status: 'ACTIVE' }]),
        ),
      insert: jest.fn(),
    };
    const itemInsert = {
      values: jest.fn(),
      returning: jest.fn().mockResolvedValue([{ id: 'item-1' }]),
    };
    const profileInsert = { values: jest.fn() };
    itemInsert.values.mockReturnValue(itemInsert);
    profileInsert.values.mockReturnValue(profileInsert);
    tx.insert
      .mockReturnValueOnce(itemInsert)
      .mockReturnValueOnce(profileInsert);
    transaction.mockImplementation(
      (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const material = { item: { id: 'item-1', code: validInput.code } };
    mockGetMaterial([material]);

    await expect(service.createMaterial(farmId, validInput)).resolves.toBe(
      material,
    );
    expect(itemInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId,
        itemType: 'MATERIAL',
        trackingMode: 'LOT',
      }),
    );
    expect(profileInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ farmId, itemId: 'item-1', kind: 'FEED' }),
    );
  });

  it('rejects creation when a referenced category is missing', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(queryReturning([]))
        .mockReturnValueOnce(
          queryReturning([{ id: unitId, status: 'ACTIVE' }]),
        ),
    };
    transaction.mockImplementation(
      (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(service.createMaterial(farmId, validInput)).rejects.toEqual(
      expect.any(BadRequestException),
    );
  });

  it('maps duplicate database errors to ConflictException', async () => {
    transaction.mockRejectedValue({
      code: '23505',
      constraint: 'uq_item_code_per_farm',
    });

    await expect(service.createMaterial(farmId, validInput)).rejects.toEqual(
      expect.any(ConflictException),
    );
  });

  it('rejects an empty update', async () => {
    await expect(service.updateMaterial('item-1', farmId, {})).rejects.toEqual(
      expect.any(BadRequestException),
    );
  });

  it('rejects updates for a missing material', async () => {
    mockGetMaterial([]);

    await expect(
      service.updateMaterial('item-1', farmId, { name: 'Tên mới' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates an existing material and returns the updated record', async () => {
    const current = {
      item: {
        id: 'item-1',
        farmId,
        categoryId,
        unitId,
        trackingMode: 'LOT',
      },
      profile: { requiresExpiryTracking: true },
    };
    const updated = { ...current, item: { ...current.item, name: 'Tên mới' } };
    select
      .mockReturnValueOnce(queryReturning([current]))
      .mockReturnValueOnce(queryReturning([updated]));

    const tx = {
      update: jest.fn(),
    };
    const itemUpdate = { set: jest.fn(), where: jest.fn() };
    itemUpdate.set.mockReturnValue(itemUpdate);
    itemUpdate.where.mockResolvedValue([]);
    tx.update.mockReturnValue(itemUpdate);
    transaction.mockImplementation(
      (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service.updateMaterial('item-1', farmId, { name: 'Tên mới' }),
    ).resolves.toBe(updated);
    expect(itemUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tên mới',
      }),
    );
  });

  it('returns a paginated material list and quantity', async () => {
    const rows = [{ item: { code: 'MAT-TEST' }, quantityOnHand: '12' }];
    select
      .mockReturnValueOnce(queryReturning(rows))
      .mockReturnValueOnce(queryReturning([{ value: '1' }]));

    await expect(
      service.listMaterials({
        farmId,
        page: 1,
        pageSize: 20,
        offset: 0,
        trackingMode: 'LOT',
      }),
    ).resolves.toEqual({
      data: rows,
      page: { number: 1, size: 20, totalItems: 1, totalPages: 1 },
    });
  });

  it('returns no materials when the filtered result is empty', async () => {
    select
      .mockReturnValueOnce(queryReturning([]))
      .mockReturnValueOnce(queryReturning([]));

    await expect(
      service.listMaterials({ farmId, page: 1, pageSize: 20, offset: 0 }),
    ).resolves.toEqual({
      data: [],
      page: { number: 1, size: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('returns expiring materials with the requested window', async () => {
    const rows = [
      { itemCode: 'MAT-EXPIRING', lot: { expiryDate: '2026-09-01' } },
    ];
    select.mockReturnValue(queryReturning(rows));

    await expect(service.listExpiringMaterials(farmId, 30)).resolves.toEqual({
      data: rows,
      days: 30,
    });
  });
});

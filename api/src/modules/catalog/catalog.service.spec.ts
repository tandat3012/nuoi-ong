import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../../db/database.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const databaseService = {
    db: { select: jest.fn() },
  } as unknown as DatabaseService;
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  let service: CatalogService;

  function queryReturning<T>(rows: T[]) {
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      then: (resolve: (value: T[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.offset.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    return query;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogService(databaseService);
  });

  it('lists categories and units successfully', async () => {
    const categories = [{ id: 'category-1', name: 'Thiết bị' }];
    const units = [{ id: 'unit-1', name: 'Cái' }];
    const categoryQuery = queryReturning(categories);
    const unitQuery = queryReturning(units);
    (databaseService.db.select as jest.Mock)
      .mockReturnValueOnce(categoryQuery)
      .mockReturnValueOnce(unitQuery);

    await expect(service.listCategories()).resolves.toBe(categories);
    await expect(service.listUnits()).resolves.toBe(units);
  });

  it('returns paginated items and total count', async () => {
    const rows = [{ item: { code: 'EQ-SMOKER' } }];
    const itemQuery = queryReturning(rows);
    const countQuery = queryReturning([{ value: '3' }]);
    (databaseService.db.select as jest.Mock)
      .mockReturnValueOnce(itemQuery)
      .mockReturnValueOnce(countQuery);

    await expect(
      service.listItems({
        farmId,
        page: 2,
        pageSize: 1,
        offset: 1,
        search: 'smoker',
        itemType: 'TOOL',
        trackingMode: 'ASSET',
        status: 'ACTIVE',
      }),
    ).resolves.toEqual({
      data: rows,
      page: { number: 2, size: 1, totalItems: 3, totalPages: 3 },
    });
  });

  it('returns an empty page when no items match', async () => {
    const itemQuery = queryReturning([]);
    const countQuery = queryReturning([{ value: '0' }]);
    (databaseService.db.select as jest.Mock)
      .mockReturnValueOnce(itemQuery)
      .mockReturnValueOnce(countQuery);

    await expect(
      service.listItems({
        farmId,
        page: 1,
        pageSize: 20,
        offset: 0,
      }),
    ).resolves.toEqual({
      data: [],
      page: { number: 1, size: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('returns an item scoped to the requested farm', async () => {
    const item = { item: { id: 'item-1', farmId } };
    const query = queryReturning([item]);
    (databaseService.db.select as jest.Mock).mockReturnValue(query);

    await expect(service.getItem('item-1', farmId)).resolves.toBe(item);
  });

  it('throws when the item does not exist in the farm', async () => {
    const query = queryReturning([]);
    (databaseService.db.select as jest.Mock).mockReturnValue(query);

    await expect(service.getItem('item-1', farmId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

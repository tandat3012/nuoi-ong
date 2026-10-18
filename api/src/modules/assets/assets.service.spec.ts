import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../../db/database.service';
import { AssetsService } from './assets.service';

describe('AssetsService', () => {
  const select = jest.fn();
  const databaseService = {
    db: { select },
  } as unknown as DatabaseService;
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const assetId = 'c796d96d-7260-4763-a9fe-8fe08a444165';
  let service: AssetsService;

  function queryReturning<T>(rows: T[]) {
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      then: (resolve: (value: T[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };

    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.offset.mockReturnValue(query);
    return query;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssetsService(databaseService);
  });

  it('lists assets with pagination and total count', async () => {
    const rows = [{ asset: { id: assetId, assetCode: 'ASSET-001' } }];
    select
      .mockReturnValueOnce(queryReturning(rows))
      .mockReturnValueOnce(queryReturning([{ value: '1' }]));

    await expect(
      service.listAssets({
        farmId,
        page: 1,
        pageSize: 20,
        offset: 0,
        search: 'asset',
        status: 'AVAILABLE',
      }),
    ).resolves.toEqual({
      data: rows,
      page: { number: 1, size: 20, totalItems: 1, totalPages: 1 },
    });
  });

  it.each([
    ['getAsset', () => service.getAsset(assetId, farmId)],
    ['getAssetByCode', () => service.getAssetByCode('ASSET-001', farmId)],
    ['getAssetByQr', () => service.getAssetByQr(assetId, farmId)],
  ])('%s returns an asset scoped to the farm', async (_name, operation) => {
    const asset = { asset: { id: assetId, farmId } };
    select.mockReturnValue(queryReturning([asset]));

    await expect(operation()).resolves.toBe(asset);
  });

  it('returns not found when an asset is outside the farm or missing', async () => {
    select.mockReturnValue(queryReturning([]));

    await expect(service.getAsset(assetId, farmId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

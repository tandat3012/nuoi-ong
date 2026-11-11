import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../../db/database.service';
import type { WarehousesService } from '../warehouses/warehouses.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const farmId = '11111111-1111-4111-8111-111111111111';
  const warehouseId = '22222222-2222-4222-8222-222222222222';
  const otherWarehouseId = '33333333-3333-4333-8333-333333333333';
  const clerkUserId = 'clerk-user';

  const warehousesService = {
    warehouseScope: jest.fn(),
    assertFarmAccess: jest.fn(),
  } as unknown as WarehousesService;

  const databaseService = {
    db: {
      select: jest.fn(),
      execute: jest.fn(),
    },
  } as unknown as DatabaseService;

  let service: InventoryService;

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
    service = new InventoryService(databaseService, warehousesService);
  });

  it('short-circuits getItemsSummary when requested warehouse is out of scope', async () => {
    (warehousesService.warehouseScope as jest.Mock).mockResolvedValueOnce([
      otherWarehouseId,
    ]);

    const result = await service.getItemsSummary({
      clerkUserId,
      farmId,
      warehouseId,
      page: 1,
      pageSize: 8,
      offset: 0,
      lowStockOnly: true,
    });

    expect(result).toEqual({
      data: [],
      summary: {
        stockedItemCount: 0,
        lotItemCount: 0,
        totalQuantity: '0',
        belowMinimumCount: 0,
      },
      page: {
        number: 1,
        size: 8,
        totalItems: 0,
        totalPages: 0,
      },
    });
    expect(databaseService.db.execute).not.toHaveBeenCalled();
  });

  it('returns grouped items summary and totals from database queries', async () => {
    (warehousesService.warehouseScope as jest.Mock).mockResolvedValueOnce(null);
    (databaseService.db.execute as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            itemId: 'item-1',
            itemCode: 'MAT-001',
            itemName: 'Đường',
            itemType: 'MATERIAL',
            trackingMode: 'QUANTITY',
            itemImageUrl: null,
            minStockLevel: '10.000',
            categoryId: 'cat-1',
            categoryName: 'Thức ăn',
            unitId: 'unit-1',
            unitName: 'Kilogram',
            unitSymbol: 'kg',
            quantityOnHand: '5.000',
            lotCount: 0,
            singleLotId: null,
            singleLotCode: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            stockedItemCount: 1,
            lotItemCount: 0,
            totalQuantity: '5.000',
            belowMinimumCount: 2,
            totalItems: 1,
          },
        ],
      });

    const result = await service.getItemsSummary({
      clerkUserId,
      farmId,
      warehouseId,
      page: 1,
      pageSize: 8,
      offset: 0,
    });

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          itemId: 'item-1',
          itemCode: 'MAT-001',
          quantityOnHand: '5.000',
          lotCount: 0,
        }),
      ],
      summary: {
        stockedItemCount: 1,
        lotItemCount: 0,
        totalQuantity: '5.000',
        belowMinimumCount: 2,
      },
      page: {
        number: 1,
        size: 8,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });

  it('short-circuits getForecast when warehouse is outside scope and parses forecast rows', async () => {
    (warehousesService.warehouseScope as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      service.getForecast({
        clerkUserId,
        farmId,
        warehouseId,
        page: 1,
        pageSize: 10,
        offset: 0,
      }),
    ).resolves.toEqual({
      data: [],
      page: { number: 1, size: 10, totalItems: 0, totalPages: 0 },
    });

    (warehousesService.warehouseScope as jest.Mock).mockResolvedValueOnce(null);
    (databaseService.db.execute as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            itemId: 'item-1',
            code: 'MAT-001',
            name: 'Đường',
            unit: 'kg',
            quantityOnHand: '20',
            averageDailyOutflow: '2.5',
            estimatedDaysRemaining: '8',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ value: 1 }] });

    await expect(
      service.getForecast({
        clerkUserId,
        farmId,
        warehouseId,
        page: 1,
        pageSize: 10,
        offset: 0,
      }),
    ).resolves.toEqual({
      data: [
        {
          itemId: 'item-1',
          code: 'MAT-001',
          name: 'Đường',
          unit: 'kg',
          quantityOnHand: 20,
          averageDailyOutflow: 2.5,
          estimatedDaysRemaining: 8,
        },
      ],
      page: { number: 1, size: 10, totalItems: 1, totalPages: 1 },
    });
  });

  it('gets a lot scoped to the farm or throws NotFoundException', async () => {
    (warehousesService.assertFarmAccess as jest.Mock).mockResolvedValue(
      undefined,
    );
    const lotRow = { id: 'lot-1', lotCode: 'LOT-0001', itemName: 'Thuốc' };
    (databaseService.db.select as jest.Mock)
      .mockReturnValueOnce(queryReturning([lotRow]))
      .mockReturnValueOnce(queryReturning([]));

    await expect(
      service.getLot('lot-1', farmId, clerkUserId),
    ).resolves.toBe(lotRow);
    await expect(
      service.getLot('missing-lot', farmId, clerkUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

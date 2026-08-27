import { BadRequestException } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const catalogService = {
    listCategories: jest.fn(),
    listUnits: jest.fn(),
    listItems: jest.fn(),
    getItem: jest.fn(),
  };
  const controller = new CatalogController(
    catalogService as unknown as CatalogService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('passes validated item filters to the service', async () => {
    const response = {
      data: [],
      page: { number: 2, size: 10, totalItems: 0, totalPages: 0 },
    };
    catalogService.listItems.mockResolvedValueOnce(response);

    await expect(
      controller.listItems(
        farmId,
        '2',
        '10',
        'máy quay',
        'EQUIPMENT',
        'ASSET',
        'ACTIVE',
      ),
    ).resolves.toBe(response);
    expect(catalogService.listItems).toHaveBeenCalledWith({
      farmId,
      page: 2,
      pageSize: 10,
      offset: 10,
      search: 'máy quay',
      itemType: 'EQUIPMENT',
      trackingMode: 'ASSET',
      status: 'ACTIVE',
    });
  });

  it('requires a valid farm ID for item lists', async () => {
    await expect(controller.listItems('invalid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(catalogService.listItems).not.toHaveBeenCalled();
  });
});

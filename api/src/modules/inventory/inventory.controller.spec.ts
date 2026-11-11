import { BadRequestException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController transactions query', () => {
  const service = {
    listTransactions: jest.fn(),
    listBalances: jest.fn(),
    getItemsSummary: jest.fn(),
    getForecast: jest.fn(),
    listLots: jest.fn(),
    getLot: jest.fn(),
  };
  const controller = new InventoryController(
    service as unknown as InventoryService,
  );
  const auth = { clerkUserId: 'clerk-user' };
  const farmId = '11111111-1111-4111-8111-111111111111';
  const warehouseId = '22222222-2222-4222-8222-222222222222';
  const itemId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => service.listTransactions.mockReset());

  it('uses default pagination and passes authenticated farm filters', async () => {
    await controller.listTransactions(auth, farmId);

    expect(service.listTransactions).toHaveBeenCalledWith({
      clerkUserId: auth.clerkUserId,
      farmId,
      warehouseId: undefined,
      itemId: undefined,
      transactionType: undefined,
      page: 1,
      pageSize: 20,
      offset: 0,
    });
  });

  it('parses explicit filters and caps page size at 100', async () => {
    await controller.listTransactions(
      auth,
      farmId,
      warehouseId,
      itemId,
      'MAINTENANCE_ISSUE',
      undefined,
      undefined,
      '3',
      '200',
    );

    expect(service.listTransactions).toHaveBeenCalledWith({
      clerkUserId: auth.clerkUserId,
      farmId,
      warehouseId,
      itemId,
      transactionType: 'MAINTENANCE_ISSUE',
      page: 3,
      pageSize: 100,
      offset: 200,
    });
  });

  it('passes a valid date range and rejects an inverted or invalid one', async () => {
    await controller.listTransactions(
      auth,
      farmId,
      undefined,
      undefined,
      undefined,
      '2026-10-01',
      '2026-10-31',
    );
    expect(service.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }),
    );
    service.listTransactions.mockReset();
    for (const [from, to] of [
      ['2026-10-31', '2026-10-01'],
      ['2026-02-30', undefined],
      ['01/10/2026', undefined],
    ])
      expect(() =>
        controller.listTransactions(
          auth,
          farmId,
          undefined,
          undefined,
          undefined,
          from,
          to,
        ),
      ).toThrow(BadRequestException);
    expect(service.listTransactions).not.toHaveBeenCalled();
  });

  it('rejects an invalid UUID, transaction type, or page', () => {
    expect(() => controller.listTransactions(auth, 'bad-farm')).toThrow(
      BadRequestException,
    );
    expect(() =>
      controller.listTransactions(
        auth,
        farmId,
        undefined,
        undefined,
        'RECEIVE',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.listTransactions(
        auth,
        farmId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '0',
      ),
    ).toThrow(BadRequestException);
    expect(service.listTransactions).not.toHaveBeenCalled();
  });
  it('validates the asset filter UUID before reading balances', async () => {
    service.listBalances.mockReset();
    expect(() =>
      controller.listBalances(
        auth,
        farmId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'bad-asset',
      ),
    ).toThrow(BadRequestException);
    expect(service.listBalances).not.toHaveBeenCalled();
    await controller.listBalances(
      auth,
      farmId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      itemId,
    );
    expect(service.listBalances).toHaveBeenCalledWith(
      expect.objectContaining({ farmId, assetId: itemId }),
    );
  });

  it('validates search, tracking filters and itemIds on listBalances', async () => {
    service.listBalances.mockReset();
    const categoryId = '44444444-4444-4444-8444-444444444444';
    await controller.listBalances(
      auth,
      farmId,
      warehouseId,
      undefined,
      undefined,
      '1',
      '20',
      undefined,
      '  mật ong  ',
      categoryId,
      'LOT',
      'ASSET',
      `${itemId},${categoryId}`,
    );
    expect(service.listBalances).toHaveBeenCalledWith({
      clerkUserId: auth.clerkUserId,
      farmId,
      warehouseId,
      itemId: undefined,
      lotId: undefined,
      assetId: undefined,
      page: 1,
      pageSize: 20,
      offset: 0,
      search: 'mật ong',
      categoryId,
      trackingMode: 'LOT',
      excludeTrackingMode: 'ASSET',
      itemIds: [itemId, categoryId],
    });

    expect(() =>
      controller.listBalances(
        auth,
        farmId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        `${itemId},bad-uuid`,
      ),
    ).toThrow(BadRequestException);
  });

  it('validates items-summary, forecast, listLots search and getLot', async () => {
    await controller.getItemsSummary(
      auth,
      farmId,
      warehouseId,
      '1',
      '8',
      'đường',
      undefined,
      'LOT',
      'ASSET',
      'true',
    );
    expect(service.getItemsSummary).toHaveBeenCalledWith({
      clerkUserId: auth.clerkUserId,
      farmId,
      warehouseId,
      page: 1,
      pageSize: 8,
      offset: 0,
      search: 'đường',
      categoryId: undefined,
      trackingMode: 'LOT',
      excludeTrackingMode: 'ASSET',
      lowStockOnly: true,
    });

    expect(() =>
      controller.getItemsSummary(
        auth,
        farmId,
        warehouseId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'invalid-bool',
      ),
    ).toThrow(BadRequestException);

    await controller.getForecast(auth, farmId, warehouseId, '1', '10');
    expect(service.getForecast).toHaveBeenCalledWith({
      clerkUserId: auth.clerkUserId,
      farmId,
      warehouseId,
      page: 1,
      pageSize: 10,
      offset: 0,
    });
    expect(() => controller.getForecast(auth, farmId)).toThrow(
      BadRequestException,
    );

    await controller.listLots(auth, farmId, itemId, undefined, '1', '20', 'LOT-001');
    expect(service.listLots).toHaveBeenCalledWith(
      expect.objectContaining({ farmId, itemId, search: 'LOT-001' }),
    );

    const lotId = '55555555-5555-4555-8555-555555555555';
    service.getLot.mockResolvedValueOnce({ id: lotId });
    await expect(controller.getLot(auth, lotId, farmId)).resolves.toEqual({
      data: { id: lotId },
    });
    expect(service.getLot).toHaveBeenCalledWith(lotId, farmId, auth.clerkUserId);
  });
});

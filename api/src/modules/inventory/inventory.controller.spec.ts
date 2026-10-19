import { BadRequestException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController transactions query', () => {
  const service = {
    listTransactions: jest.fn(),
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
        '0',
      ),
    ).toThrow(BadRequestException);
    expect(service.listTransactions).not.toHaveBeenCalled();
  });
});

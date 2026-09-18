import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

describe('WarehousesController', () => {
  const farmId = randomUUID();
  const id = randomUUID();
  const auth = { clerkUserId: 'test-subject' };
  const service = {
    listWarehouses: jest.fn(),
    getWarehouse: jest.fn(),
    createWarehouse: jest.fn(),
    updateWarehouse: jest.fn(),
    deleteWarehouse: jest.fn(),
  };
  const controller = new WarehousesController(
    service as unknown as WarehousesService,
  );
  beforeEach(() => jest.clearAllMocks());
  it('passes selected farm, authenticated subject and normalized server filters', async () => {
    await controller.listWarehouses(auth, farmId, '2', '20', ' kho ', 'ACTIVE');
    expect(service.listWarehouses).toHaveBeenCalledWith({
      farmId,
      clerkUserId: auth.clerkUserId,
      page: 2,
      pageSize: 20,
      offset: 20,
      search: 'kho',
      status: 'ACTIVE',
    });
  });
  it('rejects invalid IDs and query parameters before accessing the service', async () => {
    expect(() => controller.listWarehouses(auth)).toThrow(BadRequestException);
    expect(() => controller.listWarehouses(auth, farmId, '0')).toThrow(
      BadRequestException,
    );
    expect(() =>
      controller.listWarehouses(auth, farmId, '1', '20', '', 'INVALID'),
    ).toThrow(BadRequestException);
    await expect(
      controller.getWarehouse(auth, 'invalid', farmId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.listWarehouses).not.toHaveBeenCalled();
    expect(service.getWarehouse).not.toHaveBeenCalled();
  });
  it('wraps read/create/update/deactivate responses and forwards farm scope', async () => {
    const warehouse = { id, farmId, status: 'ACTIVE' };
    for (const fn of Object.values(service)) fn.mockResolvedValue(warehouse);
    await expect(controller.getWarehouse(auth, id, farmId)).resolves.toEqual({
      data: warehouse,
    });
    await expect(
      controller.createWarehouse(auth, farmId, { code: 'WH', name: 'Kho' }),
    ).resolves.toEqual({ data: warehouse });
    await expect(
      controller.updateWarehouse(auth, id, farmId, { name: 'Kho mới' }),
    ).resolves.toEqual({ data: warehouse });
    service.deleteWarehouse.mockResolvedValue({
      ...warehouse,
      status: 'INACTIVE',
    });
    await expect(controller.deleteWarehouse(auth, id, farmId)).resolves.toEqual(
      { data: { ...warehouse, status: 'INACTIVE' } },
    );
    expect(service.deleteWarehouse).toHaveBeenCalledWith(
      id,
      farmId,
      auth.clerkUserId,
    );
    expect(service.updateWarehouse).toHaveBeenCalledWith(
      id,
      farmId,
      auth.clerkUserId,
      { name: 'Kho mới' },
    );
  });
});

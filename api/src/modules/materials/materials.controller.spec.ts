import { BadRequestException } from '@nestjs/common';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

describe('MaterialsController', () => {
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const materialsService = {
    createMaterial: jest.fn(),
    updateMaterial: jest.fn(),
    listMaterials: jest.fn(),
    listExpiringMaterials: jest.fn(),
    listMaterialLots: jest.fn(),
    getMaterial: jest.fn(),
  };
  const controller = new MaterialsController(
    materialsService as unknown as MaterialsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a material in the requested farm', async () => {
    const input = {
      categoryId: '055de72f-1f5d-4ab5-b108-49fa3a734f8f',
      unitId: '3f159455-6f88-4d5e-8849-6107f17709a2',
      code: 'MAT-TEST',
      name: 'Vật tư kiểm thử',
      trackingMode: 'QUANTITY' as const,
      kind: 'CONSUMABLE' as const,
    };
    const material = { item: { code: input.code } };
    materialsService.createMaterial.mockResolvedValueOnce(material);

    await expect(controller.createMaterial(farmId, input)).resolves.toEqual({
      data: material,
    });
    expect(materialsService.createMaterial).toHaveBeenCalledWith(farmId, input);
  });

  it('updates a material scoped to its farm', async () => {
    const id = 'ed1229bb-4271-4605-8126-1047a74dc798';
    const input = { status: 'INACTIVE' as const };
    const material = { item: { id, status: 'INACTIVE' } };
    materialsService.updateMaterial.mockResolvedValueOnce(material);

    await expect(controller.updateMaterial(id, farmId, input)).resolves.toEqual(
      { data: material },
    );
    expect(materialsService.updateMaterial).toHaveBeenCalledWith(
      id,
      farmId,
      input,
    );
  });

  it('passes validated filters to the material service', async () => {
    const response = {
      data: [],
      page: { number: 1, size: 20, totalItems: 0, totalPages: 0 },
    };
    materialsService.listMaterials.mockResolvedValueOnce(response);

    await expect(
      controller.listMaterials(
        farmId,
        undefined,
        undefined,
        'đường',
        'FEED',
        'LOT',
        'ACTIVE',
      ),
    ).resolves.toBe(response);
    expect(materialsService.listMaterials).toHaveBeenCalledWith({
      farmId,
      page: 1,
      pageSize: 20,
      offset: 0,
      search: 'đường',
      kind: 'FEED',
      trackingMode: 'LOT',
      status: 'ACTIVE',
      categoryId: undefined,
    });
  });

  it('rejects ASSET as a material tracking mode', () => {
    expect(() =>
      controller.listMaterials(
        farmId,
        undefined,
        undefined,
        undefined,
        undefined,
        'ASSET',
      ),
    ).toThrow(BadRequestException);
  });

  it('caps the expiry window at one year', async () => {
    materialsService.listExpiringMaterials.mockResolvedValueOnce({
      data: [],
      days: 365,
    });

    await controller.listExpiringMaterials(farmId, '500');

    expect(materialsService.listExpiringMaterials).toHaveBeenCalledWith(
      farmId,
      365,
    );
  });
});

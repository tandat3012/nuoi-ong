import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMaterialDto } from './create-material.dto';
import { UpdateMaterialDto } from './update-material.dto';

describe('Material DTO validation', () => {
  const validCreate = {
    categoryId: '055de72f-1f5d-4ab5-b108-49fa3a734f8f',
    unitId: '3f159455-6f88-4d5e-8849-6107f17709a2',
    code: ' mat-feed-test ',
    name: ' Vật tư kiểm thử ',
    trackingMode: 'LOT',
    minStockLevel: '10.500',
    kind: 'FEED',
    requiresExpiryTracking: true,
    expiryWarningDays: 30,
  };

  it('accepts and normalizes a valid create payload', async () => {
    const input = plainToInstance(CreateMaterialDto, validCreate);

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.code).toBe('MAT-FEED-TEST');
    expect(input.name).toBe('Vật tư kiểm thử');
  });

  it('rejects invalid tracking, decimal, and unknown material kind', async () => {
    const input = plainToInstance(CreateMaterialDto, {
      ...validCreate,
      trackingMode: 'ASSET',
      minStockLevel: '-1',
      kind: 'UNKNOWN',
    });
    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['trackingMode', 'minStockLevel', 'kind']),
    );
  });

  it('accepts null values for clearable update fields', async () => {
    const input = plainToInstance(UpdateMaterialDto, {
      description: null,
      barcode: null,
      defaultShelfLifeDays: null,
      storageInstructions: null,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });
});

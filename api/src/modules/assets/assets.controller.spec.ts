import { BadRequestException } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

describe('AssetsController', () => {
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const qrToken = 'c796d96d-7260-4763-a9fe-8fe08a444165';
  const assetsService = {
    listAssets: jest.fn(),
    getAsset: jest.fn(),
    getAssetByCode: jest.fn(),
    getAssetByQr: jest.fn(),
  };
  const controller = new AssetsController(
    assetsService as unknown as AssetsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('scopes QR lookup to the requested farm', async () => {
    const asset = { asset: { assetCode: 'SMOKER-001' } };
    assetsService.getAssetByQr.mockResolvedValueOnce(asset);

    await expect(controller.getAssetByQr(qrToken, farmId)).resolves.toEqual({
      data: asset,
    });
    expect(assetsService.getAssetByQr).toHaveBeenCalledWith(qrToken, farmId);
  });

  it('rejects an unsupported asset status', () => {
    expect(() =>
      controller.listAssets(farmId, undefined, undefined, undefined, 'BROKEN'),
    ).toThrow(BadRequestException);
    expect(assetsService.listAssets).not.toHaveBeenCalled();
  });
});

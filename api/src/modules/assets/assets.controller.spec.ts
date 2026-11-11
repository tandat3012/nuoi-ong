import { BadRequestException } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import type { AssetLifecycleService } from './asset-lifecycle.service';
import type { AssetHistoryService } from './asset-history.service';

describe('AssetsController', () => {
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const qrToken = 'c796d96d-7260-4763-a9fe-8fe08a444165';
  const assetsService = {
    listAssets: jest.fn(),
    getAsset: jest.fn(),
    getAssetByCode: jest.fn(),
    getAssetByQr: jest.fn(),
  };
  const historyService = {
    holder: jest.fn(),
    history: jest.fn(),
    label: jest.fn(),
  };
  const controller = new AssetsController(
    assetsService as unknown as AssetsService,
    {} as AssetLifecycleService,
    historyService as unknown as AssetHistoryService,
  );

  const auth = { clerkUserId: 'user' };
  beforeEach(() => jest.clearAllMocks());

  it('scopes QR lookup to the requested farm', async () => {
    const asset = { asset: { assetCode: 'SMOKER-001' } };
    assetsService.getAssetByQr.mockResolvedValueOnce(asset);

    await expect(
      controller.getAssetByQr(auth, qrToken, farmId),
    ).resolves.toEqual({
      data: asset,
    });
    expect(assetsService.getAssetByQr).toHaveBeenCalledWith(
      qrToken,
      farmId,
      'user',
    );
  });

  it('lists assets with validated filters', async () => {
    assetsService.listAssets.mockResolvedValueOnce({ data: [], page: {} });

    await expect(
      controller.listAssets(auth, farmId, '2', '10', 'smoker', 'AVAILABLE'),
    ).resolves.toEqual({ data: [], page: {} });
    expect(assetsService.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId,
        clerkUserId: 'user',
        page: 2,
        pageSize: 10,
        offset: 10,
        search: 'smoker',
        status: 'AVAILABLE',
      }),
    );
  });

  it('gets an asset by ID', async () => {
    const assetId = 'c796d96d-7260-4763-a9fe-8fe08a444165';
    const asset = { asset: { id: assetId } };
    assetsService.getAsset.mockResolvedValueOnce(asset);

    await expect(controller.getAsset(auth, assetId, farmId)).resolves.toEqual({
      data: asset,
    });
    expect(assetsService.getAsset).toHaveBeenCalledWith(
      assetId,
      farmId,
      'user',
    );
  });

  it('rejects an unsupported asset status', () => {
    expect(() =>
      controller.listAssets(
        auth,
        farmId,
        undefined,
        undefined,
        undefined,
        'BROKEN',
      ),
    ).toThrow(BadRequestException);
    expect(assetsService.listAssets).not.toHaveBeenCalled();
  });

  it('checks the asset is visible before history, holder and label', async () => {
    const assetId = 'c796d96d-7260-4763-a9fe-8fe08a444165';
    assetsService.getAsset.mockRejectedValue(new Error('Asset not found'));
    await expect(controller.getHolder(auth, assetId, farmId)).rejects.toThrow(
      'Asset not found',
    );
    await expect(controller.getHistory(auth, assetId, farmId)).rejects.toThrow(
      'Asset not found',
    );
    await expect(controller.getLabel(auth, assetId, farmId)).rejects.toThrow(
      'Asset not found',
    );
    expect(assetsService.getAsset).toHaveBeenCalledWith(
      assetId,
      farmId,
      'user',
    );
    expect(historyService.holder).not.toHaveBeenCalled();
    expect(historyService.history).not.toHaveBeenCalled();
    expect(historyService.label).not.toHaveBeenCalled();
  });

  it('parses excludeStatuses filter and rejects unknown statuses', async () => {
    assetsService.listAssets.mockResolvedValueOnce({ data: [], page: {} });
    await controller.listAssets(
      auth,
      farmId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'LOST,RETIRED,MAINTENANCE',
    );
    expect(assetsService.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId,
        excludeStatuses: ['LOST', 'RETIRED', 'MAINTENANCE'],
      }),
    );

    expect(() =>
      controller.listAssets(
        auth,
        farmId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'LOST,UNKNOWN',
      ),
    ).toThrow(BadRequestException);
  });
});

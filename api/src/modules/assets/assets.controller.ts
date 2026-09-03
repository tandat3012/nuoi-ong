import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { assetStatus } from '../../db/schema';
import { AssetsService } from './assets.service';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { ReturnAssetDto } from './dto/return-asset.dto';

@Controller('api/v1/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  listAssets(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('status') statusValue?: string,
    @Query('itemId') itemIdValue?: string,
    @Query('locationId') locationIdValue?: string,
  ) {
    return this.assetsService.listAssets({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      status: parseOptionalEnum(statusValue, assetStatus.enumValues, 'status'),
      itemId: itemIdValue ? requireUuid(itemIdValue, 'itemId') : undefined,
      locationId: locationIdValue
        ? requireUuid(locationIdValue, 'locationId')
        : undefined,
    });
  }

  @Get('by-code/:assetCode')
  async getAssetByCode(
    @Param('assetCode') assetCode: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.assetsService.getAssetByCode(
        assetCode,
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get('by-qr/:qrToken')
  async getAssetByQr(
    @Param('qrToken') qrTokenValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.assetsService.getAssetByQr(
        requireUuid(qrTokenValue, 'qrToken'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get(':id')
  async getAsset(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.assetsService.getAsset(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Post(':id/return')
  async returnAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: ReturnAssetDto,
  ) {
    return {
      data: await this.assetsService.returnAsset(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }
}

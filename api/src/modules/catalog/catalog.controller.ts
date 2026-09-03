import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { itemType, recordStatus, trackingMode } from '../../db/schema';
import { CatalogService } from './catalog.service';
import { FarmAccessGuard } from '../auth/farm-access.guard';

@Controller('api/v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async listCategories() {
    return { data: await this.catalogService.listCategories() };
  }

  @Get('units')
  async listUnits() {
    return { data: await this.catalogService.listUnits() };
  }

  @Get('items')
  @UseGuards(FarmAccessGuard)
  async listItems(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('itemType') itemTypeValue?: string,
    @Query('trackingMode') trackingModeValue?: string,
    @Query('status') statusValue?: string,
  ) {
    return this.catalogService.listItems({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      itemType: parseOptionalEnum(
        itemTypeValue,
        itemType.enumValues,
        'itemType',
      ),
      trackingMode: parseOptionalEnum(
        trackingModeValue,
        trackingMode.enumValues,
        'trackingMode',
      ),
      status: parseOptionalEnum(statusValue, recordStatus.enumValues, 'status'),
    });
  }

  @Get('items/:id')
  @UseGuards(FarmAccessGuard)
  async getItem(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    const data = await this.catalogService.getItem(
      requireUuid(idValue, 'id'),
      requireUuid(farmIdValue, 'farmId'),
    );

    return { data };
  }
}

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  parseOptionalEnum,
  parsePagination,
  normalizeSearch,
  requireUuid,
} from '../../common/query-params';
import { itemType, recordStatus, trackingMode } from '../../db/schema';
import { CatalogService } from './catalog.service';
import { FarmAccessGuard } from '../auth/farm-access.guard';

@Controller()
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

  @Get('suppliers')
  @UseGuards(FarmAccessGuard)
  async listSuppliers(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('status') statusValue?: string,
  ) {
    return this.catalogService.listSuppliers({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      status: parseOptionalEnum(statusValue, recordStatus.enumValues, 'status'),
    });
  }

  @Get('suppliers/:id')
  @UseGuards(FarmAccessGuard)
  async getSupplier(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.catalogService.getSupplier(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get('locations')
  @UseGuards(FarmAccessGuard)
  async listLocations(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('status') statusValue?: string,
    @Query('warehouseId') warehouseIdValue?: string,
  ) {
    return this.catalogService.listLocations({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      status: parseOptionalEnum(statusValue, recordStatus.enumValues, 'status'),
      warehouseId: warehouseIdValue
        ? requireUuid(warehouseIdValue, 'warehouseId')
        : undefined,
    });
  }

  @Get('locations/:id')
  @UseGuards(FarmAccessGuard)
  async getLocation(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.catalogService.getLocation(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }
}

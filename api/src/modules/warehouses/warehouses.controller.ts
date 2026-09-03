import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';
import { recordStatus } from '../../db/schema';

@Controller('api/v1/warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  listWarehouses(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('status') statusValue?: string,
  ) {
    return this.warehousesService.listWarehouses({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      status: parseOptionalEnum(
        statusValue,
        recordStatus.enumValues,
        'status',
      ),
    });
  }

  @Post()
  async createWarehouse(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: CreateWarehouseDto,
  ) {
    return {
      data: await this.warehousesService.createWarehouse(
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':id')
  async getWarehouse(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.warehousesService.getWarehouse(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Patch(':id')
  async updateWarehouse(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: UpdateWarehouseDto,
  ) {
    return {
      data: await this.warehousesService.updateWarehouse(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Delete(':id')
  async deleteWarehouse(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.warehousesService.deleteWarehouse(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }
}

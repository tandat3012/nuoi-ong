import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  normalizeSearch,
  parseBoundedPositiveInteger,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { materialKind, recordStatus } from '../../db/schema';
import { CreateMaterialDto } from './dto/create-material.dto';
import { materialTrackingModes } from './dto/material-validation';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialsService } from './materials.service';
import { FarmAccessGuard } from '../auth/farm-access.guard';
import { FarmRoles } from '../auth/farm-access.decorator';

@Controller('api/v1/materials')
@UseGuards(FarmAccessGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  @FarmRoles('ADMIN', 'FARM_OWNER')
  async createMaterial(
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: CreateMaterialDto,
  ) {
    return {
      data: await this.materialsService.createMaterial(
        requireUuid(farmIdValue, 'farmId'),
        input,
      ),
    };
  }

  @Get()
  listMaterials(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('kind') kindValue?: string,
    @Query('trackingMode') trackingModeValue?: string,
    @Query('status') statusValue?: string,
    @Query('categoryId') categoryIdValue?: string,
  ) {
    return this.materialsService.listMaterials({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      kind: parseOptionalEnum(kindValue, materialKind.enumValues, 'kind'),
      trackingMode: parseOptionalEnum(
        trackingModeValue,
        materialTrackingModes,
        'trackingMode',
      ),
      status: parseOptionalEnum(statusValue, recordStatus.enumValues, 'status'),
      categoryId: categoryIdValue
        ? requireUuid(categoryIdValue, 'categoryId')
        : undefined,
    });
  }

  @Get('expiring')
  listExpiringMaterials(
    @Query('farmId') farmIdValue?: string,
    @Query('days') daysValue?: string,
  ) {
    return this.materialsService.listExpiringMaterials(
      requireUuid(farmIdValue, 'farmId'),
      parseBoundedPositiveInteger(daysValue, 30, 365, 'days'),
    );
  }

  @Get(':id/lots')
  listMaterialLots(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return this.materialsService.listMaterialLots(
      requireUuid(idValue, 'id'),
      requireUuid(farmIdValue, 'farmId'),
    );
  }

  @Get(':id')
  async getMaterial(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.materialsService.getMaterial(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Patch(':id')
  @FarmRoles('ADMIN', 'FARM_OWNER')
  async updateMaterial(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: UpdateMaterialDto,
  ) {
    return {
      data: await this.materialsService.updateMaterial(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        input,
      ),
    };
  }
}

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
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiSearchQuery,
  ApiUuidParam,
  ApiUuidQuery,
  OPENAPI_DECIMAL_STRING,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

const materialItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    categoryId: { type: 'string', format: 'uuid' },
    unitId: { type: 'string', format: 'uuid' },
    code: { type: 'string', example: 'ONG-001' },
    name: { type: 'string', example: 'Đường ăn ong' },
    description: { type: 'string', nullable: true },
    itemType: { type: 'string', enum: ['MATERIAL'] },
    trackingMode: { type: 'string', enum: [...materialTrackingModes] },
    minStockLevel: OPENAPI_DECIMAL_STRING,
    maintenanceIntervalDays: { type: 'integer', nullable: true },
    barcode: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    sourceUrl: { type: 'string', nullable: true },
    surveyedAt: { type: 'string', format: 'date-time', nullable: true },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const materialProfileSchema = {
  type: 'object',
  nullable: true,
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    kind: { type: 'string', enum: [...materialKind.enumValues] },
    requiresExpiryTracking: { type: 'boolean' },
    expiryWarningDays: { type: 'integer', example: 30 },
    defaultShelfLifeDays: { type: 'integer', nullable: true },
    storageInstructions: { type: 'string', nullable: true },
    safetyNotes: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const materialSchema = {
  type: 'object',
  properties: {
    item: materialItemSchema,
    profile: materialProfileSchema,
    categoryName: { type: 'string', example: 'Thức ăn' },
    unitName: { type: 'string', example: 'Kilogram' },
    unitSymbol: { type: 'string', nullable: true, example: 'kg' },
  },
};

@Controller('materials')
@UseGuards(FarmAccessGuard)
@ApiTags('Vật tư')
@ApiBearerAuth('clerk-jwt')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  @FarmRoles('ADMIN', 'FARM_OWNER')
  @ApiOperation({ summary: 'Tạo vật tư' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateMaterialDto,
    examples: {
      material: {
        summary: 'Vật tư theo dõi theo lô',
        value: {
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          unitId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          code: 'ONG-001',
          name: 'Đường ăn ong',
          trackingMode: 'LOT',
          kind: 'CONSUMABLE',
          requiresExpiryTracking: true,
          expiryWarningDays: 30,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Vật tư và hồ sơ vật tư vừa tạo.',
    schema: { type: 'object', properties: { data: materialSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc dữ liệu vật tư không hợp lệ.',
  })
  @ApiConflictResponse({ description: 'Mã hoặc barcode vật tư đã tồn tại.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo vật tư.',
  })
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
  @ApiOperation({ summary: 'Danh sách vật tư' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('kind', materialKind.enumValues, 'Phân loại vật tư.')
  @ApiEnumQuery('trackingMode', materialTrackingModes, 'Cách theo dõi tồn kho.')
  @ApiEnumQuery('status', recordStatus.enumValues, 'Trạng thái vật tư.')
  @ApiUuidQuery('categoryId', 'Lọc theo danh mục.')
  @ApiOkResponse({
    description:
      'Trang vật tư kèm thông tin danh mục, đơn vị, hồ sơ và tồn hiện tại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...materialSchema.properties,
              quantityOnHand: OPENAPI_DECIMAL_STRING,
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, page, UUID hoặc filter enum không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({
    summary: 'Danh sách lô vật tư sắp hết hạn',
    description:
      'Chỉ trả về lô LOT của vật tư có hạn sử dụng trong khoảng từ hôm nay đến số ngày được chọn.',
  })
  @ApiFarmIdQuery()
  @ApiQuery({
    name: 'days',
    required: false,
    type: 'integer',
    minimum: 1,
    default: 30,
    description:
      'Số ngày tính từ hôm nay; giá trị lớn hơn 365 được giới hạn ở 365.',
    example: 30,
  })
  @ApiOkResponse({
    description:
      'Danh sách lô sắp hết hạn và số tồn hiện tại, kèm số ngày đã yêu cầu.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string', format: 'uuid' },
              itemCode: { type: 'string', example: 'ONG-001' },
              itemName: { type: 'string', example: 'Đường ăn ong' },
              expiryWarningDays: {
                type: 'integer',
                nullable: true,
                example: 30,
              },
              lot: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  farmId: { type: 'string', format: 'uuid' },
                  itemId: { type: 'string', format: 'uuid' },
                  sourceReceiptItemId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                  },
                  lotNumber: { type: 'string' },
                  manufacturedDate: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                  },
                  expiryDate: { type: 'string', format: 'date' },
                  initialQuantity: OPENAPI_DECIMAL_STRING,
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
              quantityOnHand: OPENAPI_DECIMAL_STRING,
            },
          },
        },
        days: { type: 'integer', example: 30 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'farmId hoặc days không hợp lệ.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Danh sách các lô của vật tư' })
  @ApiUuidParam('id', 'ID vật tư.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Các lô gồm cả lô đã hết hạn hoặc không còn tồn.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lot: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  farmId: { type: 'string', format: 'uuid' },
                  itemId: { type: 'string', format: 'uuid' },
                  sourceReceiptItemId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                  },
                  lotNumber: { type: 'string' },
                  manufacturedDate: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                  },
                  expiryDate: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                  },
                  initialQuantity: OPENAPI_DECIMAL_STRING,
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
              quantityOnHand: OPENAPI_DECIMAL_STRING,
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'ID vật tư hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy vật tư trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Chi tiết vật tư' })
  @ApiUuidParam('id', 'ID vật tư.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Vật tư cùng hồ sơ, danh mục và đơn vị tính.',
    schema: { type: 'object', properties: { data: materialSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID vật tư hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy vật tư trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Cập nhật vật tư' })
  @ApiUuidParam('id', 'ID vật tư.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateMaterialDto,
    examples: {
      update: {
        summary: 'Cập nhật ngưỡng tồn',
        value: { minStockLevel: '10.000', expiryWarningDays: 45 },
      },
    },
  })
  @ApiOkResponse({
    description: 'Vật tư sau khi cập nhật.',
    schema: { type: 'object', properties: { data: materialSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc dữ liệu cập nhật không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy vật tư trong trang trại.',
  })
  @ApiConflictResponse({
    description:
      'Không thể đổi chế độ theo dõi sau khi đã phát sinh dữ liệu tồn kho.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được cập nhật vật tư.',
  })
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

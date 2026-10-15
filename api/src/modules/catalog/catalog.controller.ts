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
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
} from '../../common/swagger-docs';

const catalogItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    categoryId: { type: 'string', format: 'uuid' },
    unitId: { type: 'string', format: 'uuid' },
    code: { type: 'string', example: 'ONG-001' },
    name: { type: 'string', example: 'Đường ăn ong' },
    description: { type: 'string', nullable: true },
    itemType: { type: 'string', enum: [...itemType.enumValues] },
    trackingMode: { type: 'string', enum: [...trackingMode.enumValues] },
    minStockLevel: { type: 'string', example: '5.000' },
    maintenanceIntervalDays: { type: 'integer', nullable: true },
    barcode: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true },
    sourceUrl: { type: 'string', nullable: true },
    surveyedAt: { type: 'string', format: 'date-time', nullable: true },
    status: { type: 'string', enum: [...recordStatus.enumValues] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

@Controller()
@ApiTags('Danh mục')
@ApiBearerAuth('clerk-jwt')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục vật tư' })
  @ApiOkResponse({
    description: 'Danh sách danh mục, bọc trong thuộc tính data.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              code: { type: 'string', example: 'FEED' },
              name: { type: 'string', example: 'Thức ăn' },
              description: { type: 'string', nullable: true },
              status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  async listCategories() {
    return { data: await this.catalogService.listCategories() };
  }

  @Get('units')
  @ApiOperation({ summary: 'Danh sách đơn vị tính' })
  @ApiOkResponse({
    description: 'Danh sách đơn vị tính, bọc trong thuộc tính data.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              code: { type: 'string', example: 'KG' },
              name: { type: 'string', example: 'Kilogram' },
              symbol: { type: 'string', nullable: true, example: 'kg' },
              status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  async listUnits() {
    return { data: await this.catalogService.listUnits() };
  }

  @Get('items')
  @UseGuards(FarmAccessGuard)
  @ApiOperation({
    summary: 'Danh sách vật tư, dụng cụ và thiết bị',
    description:
      'Trả về vật tư của trang trại theo trang; có thể lọc theo loại, chế độ theo dõi và trạng thái.',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('itemType', itemType.enumValues, 'Loại mặt hàng.')
  @ApiEnumQuery(
    'trackingMode',
    trackingMode.enumValues,
    'Cách theo dõi tồn kho.',
  )
  @ApiEnumQuery('status', recordStatus.enumValues, 'Trạng thái mặt hàng.')
  @ApiOkResponse({
    description: 'Trang kết quả; ngưỡng minStockLevel là chuỗi thập phân.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: catalogItemSchema,
              categoryName: { type: 'string', example: 'Thức ăn' },
              unitName: { type: 'string', example: 'Kilogram' },
              unitSymbol: { type: 'string', nullable: true, example: 'kg' },
            },
          },
        },
        page: {
          type: 'object',
          properties: {
            number: { type: 'integer', example: 1 },
            size: { type: 'integer', example: 20 },
            totalItems: { type: 'integer', example: 42 },
            totalPages: { type: 'integer', example: 3 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, page hoặc enum filter không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Chi tiết mặt hàng' })
  @ApiUuidParam('id', 'ID mặt hàng.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Mặt hàng cùng tên danh mục và thông tin đơn vị tính.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            item: catalogItemSchema,
            categoryName: { type: 'string', example: 'Thức ăn' },
            unitName: { type: 'string', example: 'Kilogram' },
            unitSymbol: { type: 'string', nullable: true, example: 'kg' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'ID mặt hàng hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy mặt hàng trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('status', recordStatus.enumValues, 'Trạng thái nhà cung cấp.')
  @ApiOkResponse({
    description: 'Trang nhà cung cấp với metadata phân trang.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              farmId: { type: 'string', format: 'uuid' },
              code: { type: 'string', example: 'SUP-001' },
              name: { type: 'string', example: 'Công ty Nông nghiệp Việt' },
              phone: { type: 'string', nullable: true },
              email: { type: 'string', format: 'email', nullable: true },
              address: { type: 'string', nullable: true },
              note: { type: 'string', nullable: true },
              status: { type: 'string', enum: [...recordStatus.enumValues] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        page: {
          type: 'object',
          properties: {
            number: { type: 'integer', example: 1 },
            size: { type: 'integer', example: 20 },
            totalItems: { type: 'integer', example: 1 },
            totalPages: { type: 'integer', example: 1 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'farmId hoặc status không hợp lệ.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp' })
  @ApiUuidParam('id', 'ID nhà cung cấp.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Thông tin nhà cung cấp.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            farmId: { type: 'string', format: 'uuid' },
            code: { type: 'string', example: 'SUP-001' },
            name: { type: 'string', example: 'Công ty Nông nghiệp Việt' },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
            address: { type: 'string', nullable: true },
            note: { type: 'string', nullable: true },
            status: { type: 'string', enum: [...recordStatus.enumValues] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'ID nhà cung cấp hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy nhà cung cấp trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Danh sách vị trí' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('status', recordStatus.enumValues, 'Trạng thái vị trí.')
  @ApiUuidQuery('warehouseId', 'Lọc theo kho.')
  @ApiOkResponse({
    description: 'Trang vị trí thuộc trang trại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              farmId: { type: 'string', format: 'uuid' },
              warehouseId: { type: 'string', format: 'uuid', nullable: true },
              code: { type: 'string', example: 'ZONE-01' },
              name: { type: 'string', example: 'Khu lưu trữ A' },
              type: {
                type: 'string',
                enum: [
                  'WAREHOUSE',
                  'WAREHOUSE_ZONE',
                  'APIARY',
                  'SITE',
                  'IN_USE',
                  'MAINTENANCE',
                  'OTHER',
                ],
              },
              description: { type: 'string', nullable: true },
              status: { type: 'string', enum: [...recordStatus.enumValues] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        page: {
          type: 'object',
          properties: {
            number: { type: 'integer', example: 1 },
            size: { type: 'integer', example: 20 },
            totalItems: { type: 'integer', example: 1 },
            totalPages: { type: 'integer', example: 1 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'UUID, page hoặc status filter không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Chi tiết vị trí' })
  @ApiUuidParam('id', 'ID vị trí.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Thông tin vị trí trong trang trại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            farmId: { type: 'string', format: 'uuid' },
            warehouseId: { type: 'string', format: 'uuid', nullable: true },
            code: { type: 'string', example: 'ZONE-01' },
            name: { type: 'string', example: 'Khu lưu trữ A' },
            type: {
              type: 'string',
              enum: [
                'WAREHOUSE',
                'WAREHOUSE_ZONE',
                'APIARY',
                'SITE',
                'IN_USE',
                'MAINTENANCE',
                'OTHER',
              ],
            },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: [...recordStatus.enumValues] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'ID vị trí hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy vị trí trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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

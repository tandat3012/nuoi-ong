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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiSearchQuery,
  ApiUuidParam,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

const warehouseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    code: { type: 'string', example: 'MAIN' },
    name: { type: 'string', example: 'Kho chính' },
    address: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: [...recordStatus.enumValues] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

@Controller('warehouses')
@ApiTags('Kho')
@ApiBearerAuth('clerk-jwt')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách kho theo trang' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('status', recordStatus.enumValues, 'Trạng thái kho.')
  @ApiOkResponse({
    description: 'Danh sách kho và metadata phân trang.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: warehouseSchema,
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, page hoặc status filter không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
      status: parseOptionalEnum(statusValue, recordStatus.enumValues, 'status'),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Tạo kho' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateWarehouseDto,
    examples: {
      warehouse: {
        summary: 'Kho chính',
        value: {
          code: 'MAIN',
          name: 'Kho chính',
          address: 'Ấp 1, xã An Bình',
          description: 'Kho vật tư tổng hợp',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Kho vừa tạo.',
    schema: { type: 'object', properties: { data: warehouseSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc thông tin kho không hợp lệ.',
  })
  @ApiConflictResponse({ description: 'Mã kho đã tồn tại trong trang trại.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo kho.',
  })
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
  @ApiOperation({ summary: 'Chi tiết kho' })
  @ApiUuidParam('id', 'ID kho.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Thông tin kho.',
    schema: { type: 'object', properties: { data: warehouseSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID kho hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy kho trong trang trại.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
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
  @ApiOperation({ summary: 'Cập nhật kho' })
  @ApiUuidParam('id', 'ID kho.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateWarehouseDto,
    examples: {
      update: {
        summary: 'Đổi tên kho',
        value: { name: 'Kho vật tư và thiết bị' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Kho sau khi cập nhật.',
    schema: { type: 'object', properties: { data: warehouseSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc thông tin cập nhật không hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy kho trong trang trại.' })
  @ApiConflictResponse({ description: 'Mã kho đã tồn tại trong trang trại.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được cập nhật kho.',
  })
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
  @ApiOperation({ summary: 'Ngừng sử dụng kho' })
  @ApiUuidParam('id', 'ID kho.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Kho đã chuyển sang trạng thái INACTIVE.',
    schema: { type: 'object', properties: { data: warehouseSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID kho hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy kho trong trang trại.' })
  @ApiConflictResponse({
    description: 'Kho còn dữ liệu phụ thuộc nên chưa thể ngừng sử dụng.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description:
      'Chỉ quản trị viên hoặc chủ trang trại được ngừng sử dụng kho.',
  })
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

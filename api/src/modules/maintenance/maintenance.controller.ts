import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  ApiUuidParam,
  ApiUuidQuery,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { maintenanceStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import {
  CreateMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

const recordSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    assetId: { type: 'string', format: 'uuid' },
    incidentId: { type: 'string', format: 'uuid', nullable: true },
    maintenanceType: {
      type: 'string',
      enum: ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'],
    },
    scheduledAt: { type: 'string', format: 'date-time', nullable: true },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    status: { type: 'string', enum: [...maintenanceStatus.enumValues] },
    description: { type: 'string', nullable: true },
    resultNote: { type: 'string', nullable: true },
    performedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    supplierId: { type: 'string', format: 'uuid', nullable: true },
    laborCost: { type: 'string', example: '500000.00' },
    materialCost: { type: 'string', example: '125000.00' },
    otherCost: { type: 'string', example: '0.00' },
    totalCost: { type: 'string', nullable: true, example: '625000.00' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const recordWithAssetSchema = {
  ...recordSchema,
  properties: {
    ...recordSchema.properties,
    assetCode: { type: 'string', nullable: true, example: 'ASSET-001' },
    serialNumber: { type: 'string', nullable: true },
  },
};

@Controller('maintenance-records')
@ApiTags('Bảo trì')
@ApiBearerAuth('clerk-jwt')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ bảo trì' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('assetId', 'Lọc theo tài sản.')
  @ApiEnumQuery('status', maintenanceStatus.enumValues, 'Trạng thái bảo trì.')
  @ApiOkResponse({
    description:
      'Trang hồ sơ kèm mã tài sản và số sê-ri nếu tài sản còn tồn tại.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: recordWithAssetSchema },
        page: OPENAPI_PAGE,
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
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('assetId') assetId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      assetId: assetId ? requireUuid(assetId, 'assetId') : undefined,
      status: parseOptionalEnum(status, maintenanceStatus.enumValues, 'status'),
      ...parsePagination(page, pageSize),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hồ sơ bảo trì' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateMaintenanceRecordDto,
    examples: {
      scheduled: {
        summary: 'Bảo trì định kỳ',
        value: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
          maintenanceType: 'PREVENTIVE',
          scheduledAt: '2026-10-10T09:00:00.000Z',
          description: 'Kiểm tra máy bơm',
          laborCost: '500000.00',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Hồ sơ bảo trì vừa tạo.',
    schema: { type: 'object', properties: { data: recordSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc dữ liệu bảo trì không hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tài sản được chỉ định.' })
  @ApiConflictResponse({
    description: 'Tài sản đã có hồ sơ bảo trì đang hoạt động.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo hồ sơ.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateMaintenanceRecordDto,
  ) {
    return {
      data: await this.service.create(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ bảo trì' })
  @ApiUuidParam('id', 'ID hồ sơ bảo trì.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Hồ sơ bảo trì kèm mã tài sản và số sê-ri.',
    schema: { type: 'object', properties: { data: recordWithAssetSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID hồ sơ hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy hồ sơ bảo trì trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
  async get(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.get(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ bảo trì' })
  @ApiUuidParam('id', 'ID hồ sơ bảo trì.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateMaintenanceRecordDto,
    examples: {
      update: {
        summary: 'Cập nhật kết quả',
        value: { resultNote: 'Đã thay vòng bi', laborCost: '350000.00' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Hồ sơ sau khi cập nhật.',
    schema: { type: 'object', properties: { data: recordSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc dữ liệu cập nhật không hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hồ sơ bảo trì.' })
  @ApiConflictResponse({
    description: 'Hồ sơ đã hoàn tất hoặc đã hủy nên không thể sửa.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được cập nhật hồ sơ.',
  })
  async update(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: UpdateMaintenanceRecordDto,
  ) {
    return {
      data: await this.service.update(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Bắt đầu bảo trì' })
  @ApiUuidParam('id', 'ID hồ sơ cần bắt đầu.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Hồ sơ raw sau khi chuyển sang IN_PROGRESS.',
    schema: { type: 'object', properties: { data: recordSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID hồ sơ hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hồ sơ bảo trì.' })
  @ApiConflictResponse({ description: 'Chỉ hồ sơ SCHEDULED mới bắt đầu được.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được bắt đầu hồ sơ.',
  })
  async start(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.start(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Hoàn tất bảo trì' })
  @ApiUuidParam('id', 'ID hồ sơ cần hoàn tất.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Hồ sơ raw sau khi chuyển sang COMPLETED.',
    schema: { type: 'object', properties: { data: recordSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID hồ sơ hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hồ sơ bảo trì.' })
  @ApiConflictResponse({
    description: 'Chỉ hồ sơ IN_PROGRESS mới hoàn tất được.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được hoàn tất hồ sơ.',
  })
  async complete(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.complete(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy hồ sơ bảo trì' })
  @ApiUuidParam('id', 'ID hồ sơ cần hủy.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Hồ sơ raw sau khi chuyển sang CANCELLED.',
    schema: { type: 'object', properties: { data: recordSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID hồ sơ hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy hồ sơ bảo trì.' })
  @ApiConflictResponse({
    description: 'Chỉ hồ sơ SCHEDULED hoặc IN_PROGRESS mới hủy được.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được hủy hồ sơ.',
  })
  async cancel(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.cancel(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }
}

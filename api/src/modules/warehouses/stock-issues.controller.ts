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
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateStockIssueDto } from './dto/create-stock-issue.dto';
import { UpdateStockIssueDto } from './dto/update-stock-issue.dto';
import { StockIssuesService } from './stock-issues.service';
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
  OPENAPI_DECIMAL_STRING,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

const issueSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    warehouseId: { type: 'string', format: 'uuid' },
    issueCode: { type: 'string', example: 'ISS-2026-001' },
    issueDate: { type: 'string', format: 'date' },
    issueType: {
      type: 'string',
      enum: ['CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER', 'MAINTENANCE'],
    },
    maintenanceRecordId: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'] },
    reason: { type: 'string', nullable: true },
    note: { type: 'string', nullable: true },
    createdByMemberId: { type: 'string', format: 'uuid' },
    confirmedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    confirmedAt: { type: 'string', format: 'date-time', nullable: true },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const issueItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    stockIssueId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    lotId: { type: 'string', format: 'uuid', nullable: true },
    assetId: { type: 'string', format: 'uuid', nullable: true },
    quantity: OPENAPI_DECIMAL_STRING,
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const issueDetailSchema = {
  type: 'object',
  properties: {
    issue: issueSchema,
    items: { type: 'array', items: issueItemSchema },
  },
};

@Controller('stock-issues')
@ApiTags('Phiếu xuất kho')
@ApiBearerAuth('clerk-jwt')
export class StockIssuesController {
  constructor(private readonly service: StockIssuesService) {}
  @ApiOperation({ summary: 'Danh sách phiếu xuất kho' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery('status', documentStatus.enumValues, 'Trạng thái phiếu xuất.')
  @ApiOkResponse({
    description: 'Trang phiếu xuất kèm mã và tên kho nếu kho còn tồn tại.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...issueSchema.properties,
              warehouseCode: { type: 'string', nullable: true },
              warehouseName: { type: 'string', nullable: true },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, page hoặc status không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc phiếu của trang trại.',
  })
  @Get()
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      ...parsePagination(page, pageSize),
      status: parseOptionalEnum(status, documentStatus.enumValues, 'status'),
    });
  }
  @ApiOperation({ summary: 'Tạo phiếu xuất kho nháp' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateStockIssueDto,
    examples: {
      issue: {
        summary: 'Xuất vật tư tiêu hao',
        value: {
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          issueCode: 'ISS-2026-001',
          issueType: 'CONSUMPTION',
          reason: 'Sử dụng tại vườn ong',
          items: [
            {
              itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
              quantity: '2.500',
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Phiếu xuất ở trạng thái DRAFT cùng các dòng hàng.',
    schema: { type: 'object', properties: { data: issueDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc dữ liệu phiếu/dòng hàng không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy mặt hàng, lô hoặc tài sản được tham chiếu.',
  })
  @ApiConflictResponse({
    description: 'Mã phiếu đã tồn tại hoặc tham chiếu kho không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo phiếu xuất.',
  })
  @Post()
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateStockIssueDto,
  ) {
    return {
      data: await this.service.create(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }
  @ApiOperation({ summary: 'Chi tiết phiếu xuất kho' })
  @ApiUuidParam('id', 'ID phiếu xuất.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Phiếu xuất và các dòng hàng.',
    schema: { type: 'object', properties: { data: issueDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu xuất trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc phiếu của trang trại.',
  })
  @Get(':id')
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
  @ApiOperation({ summary: 'Cập nhật phiếu xuất nháp' })
  @ApiUuidParam('id', 'ID phiếu xuất.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateStockIssueDto,
    examples: {
      update: {
        summary: 'Cập nhật lý do',
        value: { reason: 'Sử dụng cho đợt chăm sóc tháng 10' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Phiếu xuất sau khi cập nhật và các dòng hàng.',
    schema: { type: 'object', properties: { data: issueDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc dữ liệu cập nhật không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu hoặc mặt hàng được tham chiếu.',
  })
  @ApiConflictResponse({
    description: 'Chỉ phiếu DRAFT mới sửa được hoặc mã phiếu đã bị trùng.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được sửa phiếu.',
  })
  @Patch(':id')
  async update(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: UpdateStockIssueDto,
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
  @ApiOperation({ summary: 'Hủy phiếu xuất nháp' })
  @ApiUuidParam('id', 'ID phiếu xuất.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Phiếu xuất chuyển sang CANCELLED.',
    schema: { type: 'object', properties: { data: issueDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu xuất.' })
  @ApiConflictResponse({ description: 'Chỉ phiếu DRAFT mới hủy được.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được hủy phiếu.',
  })
  @Post(':id/cancel')
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
  @ApiOperation({ summary: 'Xác nhận phiếu xuất và trừ tồn kho' })
  @ApiUuidParam('id', 'ID phiếu xuất.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description:
      'Phiếu xuất được xác nhận và các giao dịch xuất được ghi nhận.',
    schema: { type: 'object', properties: { data: issueDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'Phiếu phải có ít nhất một dòng hoặc loại xuất không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu hoặc mặt hàng được tham chiếu.',
  })
  @ApiConflictResponse({
    description:
      'Kho không hoạt động, phiếu không còn DRAFT hoặc tồn kho không đủ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được xác nhận phiếu.',
  })
  @Post(':id/confirm')
  async confirm(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.confirm(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }
}

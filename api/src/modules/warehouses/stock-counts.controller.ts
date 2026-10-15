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
  OPENAPI_DECIMAL_STRING,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { stockCountStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import {
  CreateStockCountDto,
  UpdateStockCountDto,
} from './dto/stock-count.dto';
import { StockCountsService } from './stock-counts.service';

const countSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    warehouseId: { type: 'string', format: 'uuid' },
    countCode: { type: 'string', example: 'CNT-2026-001' },
    countDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: [...stockCountStatus.enumValues] },
    createdByMemberId: { type: 'string', format: 'uuid' },
    confirmedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    confirmedAt: { type: 'string', format: 'date-time', nullable: true },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const countItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    stockCountId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    lotId: { type: 'string', format: 'uuid', nullable: true },
    assetId: { type: 'string', format: 'uuid', nullable: true },
    systemQuantity: OPENAPI_DECIMAL_STRING,
    actualQuantity: OPENAPI_DECIMAL_STRING,
    difference: { ...OPENAPI_DECIMAL_STRING, nullable: true },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const countDetailSchema = {
  type: 'object',
  properties: {
    count: countSchema,
    items: { type: 'array', items: countItemSchema },
  },
};

@Controller('stock-counts')
@ApiTags('Kiểm kê')
@ApiBearerAuth('clerk-jwt')
export class StockCountsController {
  constructor(private readonly service: StockCountsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu kiểm kê' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery(
    'status',
    stockCountStatus.enumValues,
    'Trạng thái phiếu kiểm kê.',
  )
  @ApiOkResponse({
    description: 'Trang phiếu kiểm kê.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: countSchema },
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
      status: parseOptionalEnum(status, stockCountStatus.enumValues, 'status'),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Tạo phiếu kiểm kê nháp' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateStockCountDto,
    examples: {
      count: {
        summary: 'Kiểm kê kho chính',
        value: {
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          countCode: 'CNT-2026-001',
          items: [
            {
              itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
              actualQuantity: '12.500',
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Phiếu kiểm kê cùng các dòng số liệu thực tế và hệ thống.',
    schema: { type: 'object', properties: { data: countDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc phiếu phải có ít nhất một dòng hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy mặt hàng được kiểm kê.' })
  @ApiConflictResponse({
    description: 'Kho không tồn tại hoặc không hoạt động.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo phiếu.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateStockCountDto,
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
  @ApiOperation({ summary: 'Chi tiết phiếu kiểm kê' })
  @ApiUuidParam('id', 'ID phiếu kiểm kê.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Phiếu kiểm kê cùng các dòng kiểm kê.',
    schema: { type: 'object', properties: { data: countDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu kiểm kê trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền đọc phiếu của trang trại.',
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
  @ApiOperation({ summary: 'Cập nhật phiếu kiểm kê đang mở' })
  @ApiUuidParam('id', 'ID phiếu kiểm kê.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateStockCountDto,
    examples: {
      update: {
        summary: 'Cập nhật số đếm',
        value: {
          items: [
            {
              itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
              actualQuantity: '11.000',
              note: 'Đếm lại lần hai',
            },
          ],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Phiếu sau khi cập nhật, trạng thái chuyển sang COUNTING.',
    schema: { type: 'object', properties: { data: countDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc dòng kiểm kê không hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu hoặc mặt hàng.' })
  @ApiConflictResponse({ description: 'Phiếu đã xác nhận hoặc đã hủy.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được sửa phiếu.',
  })
  async update(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: UpdateStockCountDto,
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

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Xác nhận kiểm kê và cập nhật tồn kho' })
  @ApiUuidParam('id', 'ID phiếu kiểm kê.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description:
      'Phiếu xác nhận; chênh lệch tồn kho được ghi thành giao dịch điều chỉnh.',
    schema: { type: 'object', properties: { data: countDetailSchema } },
  })
  @ApiBadRequestResponse({ description: 'Phiếu phải có ít nhất một dòng.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu hoặc mặt hàng.' })
  @ApiConflictResponse({
    description:
      'Tồn hiện tại đã thay đổi kể từ lúc lập phiếu hoặc phiếu không còn hoạt động.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được xác nhận phiếu.',
  })
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

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy phiếu kiểm kê' })
  @ApiUuidParam('id', 'ID phiếu kiểm kê.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Phiếu chuyển sang CANCELLED.',
    schema: { type: 'object', properties: { data: countDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu kiểm kê.' })
  @ApiConflictResponse({
    description: 'Chỉ phiếu DRAFT hoặc COUNTING mới hủy được.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được hủy phiếu.',
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

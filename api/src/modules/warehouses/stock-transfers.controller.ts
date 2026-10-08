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
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import {
  CreateStockTransferDto,
  UpdateStockTransferDto,
} from './dto/stock-transfer.dto';
import { StockTransfersService } from './stock-transfers.service';

const transferSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    fromWarehouseId: { type: 'string', format: 'uuid' },
    toWarehouseId: { type: 'string', format: 'uuid' },
    transferCode: { type: 'string', example: 'TRF-2026-001' },
    transferDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: [...documentStatus.enumValues] },
    note: { type: 'string', nullable: true },
    createdByMemberId: { type: 'string', format: 'uuid' },
    confirmedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    confirmedAt: { type: 'string', format: 'date-time', nullable: true },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const transferItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    stockTransferId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    lotId: { type: 'string', format: 'uuid', nullable: true },
    assetId: { type: 'string', format: 'uuid', nullable: true },
    quantity: OPENAPI_DECIMAL_STRING,
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const transferDetailSchema = {
  type: 'object',
  properties: {
    transfer: transferSchema,
    items: { type: 'array', items: transferItemSchema },
  },
};

@Controller('stock-transfers')
@ApiTags('Điều chuyển kho')
@ApiBearerAuth('clerk-jwt')
export class StockTransfersController {
  constructor(private readonly service: StockTransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu điều chuyển' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery(
    'status',
    documentStatus.enumValues,
    'Trạng thái phiếu điều chuyển.',
  )
  @ApiOkResponse({
    description: 'Trang các phiếu điều chuyển.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: transferSchema },
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
      status: parseOptionalEnum(status, documentStatus.enumValues, 'status'),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Tạo phiếu điều chuyển nháp' })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateStockTransferDto,
    examples: {
      transfer: {
        summary: 'Điều chuyển vật tư giữa hai kho',
        value: {
          fromWarehouseId: '550e8400-e29b-41d4-a716-446655440000',
          toWarehouseId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          transferCode: 'TRF-2026-001',
          transferDate: '2026-10-08',
          items: [
            {
              itemId: '7ba7b810-9dad-41d1-80b4-00c04fd430c8',
              quantity: '5.000',
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Phiếu điều chuyển DRAFT cùng các dòng hàng.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({
    description:
      'farmId, body không hợp lệ hoặc kho nguồn và kho đích giống nhau.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy mặt hàng, lô hoặc tài sản được tham chiếu.',
  })
  @ApiConflictResponse({
    description: 'Một trong hai kho không hoạt động trong trang trại.',
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
    @Body() input: CreateStockTransferDto,
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
  @ApiOperation({ summary: 'Chi tiết phiếu điều chuyển' })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Phiếu điều chuyển cùng các dòng hàng.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu điều chuyển trong trang trại.',
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
  @ApiOperation({ summary: 'Cập nhật phiếu điều chuyển nháp' })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateStockTransferDto,
    examples: {
      update: {
        summary: 'Cập nhật ghi chú',
        value: { note: 'Chuyển sang kho khu vực phía bắc' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Phiếu sau khi cập nhật và các dòng hàng.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID, farmId hoặc dữ liệu cập nhật không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu hoặc mặt hàng được tham chiếu.',
  })
  @ApiConflictResponse({
    description: 'Chỉ phiếu DRAFT mới sửa được hoặc kho không hoạt động.',
  })
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
    @Body() input: UpdateStockTransferDto,
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
  @ApiOperation({ summary: 'Xác nhận điều chuyển và chuyển tồn giữa các kho' })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Phiếu được xác nhận và tạo các giao dịch ra/vào kho.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({ description: 'Phiếu phải có ít nhất một dòng.' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu hoặc tham chiếu mặt hàng.',
  })
  @ApiConflictResponse({
    description:
      'Tồn kho nguồn không đủ, kho không hoạt động hoặc phiếu không còn DRAFT.',
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
  @ApiOperation({ summary: 'Hủy phiếu điều chuyển nháp' })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Phiếu chuyển sang CANCELLED.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu điều chuyển.' })
  @ApiConflictResponse({ description: 'Chỉ phiếu DRAFT mới hủy được.' })
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

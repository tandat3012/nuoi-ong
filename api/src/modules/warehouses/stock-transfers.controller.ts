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
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { RejectStockDocumentDto } from './dto/reject-stock-document.dto';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  ResolveStockTransferDto,
  UpdateStockTransferDto,
} from './dto/stock-transfer.dto';
import { StockTransfersService } from './stock-transfers.service';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { RESTOCK_ROLES } from '../auth/farm-access/farm-role-groups';

const transferSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    fromWarehouseId: { type: 'string', format: 'uuid' },
    toWarehouseId: { type: 'string', format: 'uuid' },
    transferCode: {
      type: 'string',
      nullable: true,
      example: 'CK-2026-000001',
      description: 'Null on drafts; assigned when the source dispatches.',
    },
    transferDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: [...documentStatus.enumValues] },
    rejectionReason: { type: 'string', nullable: true },
    rejectedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    rejectedAt: { type: 'string', format: 'date-time', nullable: true },
    note: { type: 'string', nullable: true },
    createdByMemberId: { type: 'string', format: 'uuid' },
    dispatchedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    dispatchedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Source dispatch; null on transfers confirmed in one step.',
    },
    confirmedByMemberId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Who received it at the destination.',
    },
    confirmedAt: { type: 'string', format: 'date-time', nullable: true },
    resolution: {
      type: 'string',
      enum: ['RETURN_TO_SOURCE', 'WRITE_OFF'],
      nullable: true,
      description: 'How a short receipt was settled; null until then.',
    },
    resolutionNote: { type: 'string', nullable: true },
    resolvedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    resolvedAt: { type: 'string', format: 'date-time', nullable: true },
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
    receivedQuantity: {
      ...OPENAPI_DECIMAL_STRING,
      nullable: true,
      description: 'Counted in by the destination; null until received.',
    },
    discrepancyReason: { type: 'string', nullable: true },
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
@UseGuards(FarmAccessGuard)
// Store-only managers have no access to warehouse, asset or maintenance modules.
@FarmRoles(...RESTOCK_ROLES)
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
    @Query('search') search?: string,
  ) {
    const normalizedSearch = normalizeSearch(search);
    return this.service.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      ...parsePagination(page, pageSize),
      status: parseOptionalEnum(status, documentStatus.enumValues, 'status'),
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
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
  @ApiOperation({
    summary: 'Kho nguồn duyệt và xuất hàng; phiếu sang IN_TRANSIT',
  })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description:
      'Trừ tồn kho nguồn (TRANSFER_OUT); kho đích chưa được cộng. Gọi lại khi đã xuất không trừ lần nữa.',
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

  @Post(':id/receive')
  @ApiOperation({
    summary:
      'Kho đích xác nhận số thực nhận; nhận đủ sang CONFIRMED, nhận thiếu sang DISCREPANCY',
  })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ReceiveStockTransferDto, required: false })
  @ApiCreatedResponse({
    description:
      'Cộng tồn kho đích theo số thực nhận (TRANSFER_IN). Có dòng nhận thiếu thì phiếu sang DISCREPANCY và chờ /resolve. Gọi lại khi đã nhận không cộng lần nữa.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({
    description:
      'Số nhận vượt số đã xuất, nhận thiếu không có lý do, hoặc dòng không thuộc phiếu.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu.' })
  @ApiConflictResponse({ description: 'Phiếu không ở trạng thái IN_TRANSIT.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản lý của kho đích được xác nhận nhận hàng.',
  })
  async receive(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: ReceiveStockTransferDto,
  ) {
    return {
      data: await this.service.receive(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input?.items,
      ),
    };
  }

  @Post(':id/resolve')
  @ApiOperation({
    summary:
      'Chủ trại/quản trị xử lý phần thiếu của phiếu DISCREPANCY; phiếu sang CONFIRMED',
  })
  @ApiUuidParam('id', 'ID phiếu điều chuyển.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ResolveStockTransferDto })
  @ApiCreatedResponse({
    description:
      'RETURN_TO_SOURCE cộng phần thiếu về kho nguồn (RETURN_IN); WRITE_OFF chỉ ghi nhận. Gọi lại khi đã xử lý không cộng lần nữa.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({ description: 'Thiếu căn cứ xử lý.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu.' })
  @ApiConflictResponse({ description: 'Phiếu không ở trạng thái DISCREPANCY.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được xử lý chênh lệch.',
  })
  async resolve(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: ResolveStockTransferDto,
  ) {
    return {
      data: await this.service.resolve(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
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

  @Post(':id/submit')
  @ApiOperation({ summary: 'Gửi phiếu chuyển kho nháp để chờ duyệt' })
  @ApiUuidParam('id', 'ID phiếu chuyển kho.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description:
      'Phiếu chuyển sang PENDING_APPROVAL; người duyệt nhận thông báo.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({ description: 'Phiếu chưa có dòng nào.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu.' })
  @ApiConflictResponse({ description: 'Phiếu không còn ở trạng thái nháp.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Nhân viên chỉ được gửi phiếu do chính mình tạo.',
  })
  async submit(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.submit(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối phiếu chuyển kho đang chờ duyệt' })
  @ApiUuidParam('id', 'ID phiếu chuyển kho.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RejectStockDocumentDto })
  @ApiCreatedResponse({
    description: 'Phiếu chuyển sang REJECTED; người tạo nhận thông báo.',
    schema: { type: 'object', properties: { data: transferDetailSchema } },
  })
  @ApiBadRequestResponse({ description: 'Thiếu lý do từ chối.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu.' })
  @ApiConflictResponse({ description: 'Phiếu không ở trạng thái chờ duyệt.' })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được từ chối phiếu.',
  })
  async reject(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: RejectStockDocumentDto,
  ) {
    return {
      data: await this.service.reject(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input.rejectionReason,
      ),
    };
  }
}

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
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { StockReceiptsService } from './stock-receipts.service';
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
  OPENAPI_DECIMAL_STRING,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

const receiptSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    warehouseId: { type: 'string', format: 'uuid' },
    supplierId: { type: 'string', format: 'uuid', nullable: true },
    receiptCode: { type: 'string', example: 'RCV-2026-001' },
    receiptDate: { type: 'string', format: 'date' },
    status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'] },
    note: { type: 'string', nullable: true },
    createdByMemberId: { type: 'string', format: 'uuid' },
    confirmedByMemberId: { type: 'string', format: 'uuid', nullable: true },
    confirmedAt: { type: 'string', format: 'date-time', nullable: true },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const receiptItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    stockReceiptId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    quantity: OPENAPI_DECIMAL_STRING,
    unitPrice: { type: 'string', example: '25000.00' },
    lotId: { type: 'string', format: 'uuid', nullable: true },
    lotNumber: { type: 'string', nullable: true },
    manufacturedDate: { type: 'string', format: 'date', nullable: true },
    expiryDate: { type: 'string', format: 'date', nullable: true },
    locationId: { type: 'string', format: 'uuid', nullable: true },
    assetId: { type: 'string', format: 'uuid', nullable: true },
    assetCode: { type: 'string', nullable: true },
    serialNumber: { type: 'string', nullable: true },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const receiptDetailSchema = {
  type: 'object',
  properties: {
    receipt: receiptSchema,
    items: { type: 'array', items: receiptItemSchema },
  },
};

@Controller('stock-receipts')
@ApiTags('Phiếu nhập kho')
@ApiBearerAuth('clerk-jwt')
export class StockReceiptsController {
  constructor(private readonly stockReceiptsService: StockReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu nhập kho' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery('status', documentStatus.enumValues, 'Trạng thái phiếu nhập.')
  @ApiUuidQuery('warehouseId', 'Lọc theo kho nhận.')
  @ApiOkResponse({
    description:
      'Trang phiếu nhập, kèm mã/tên kho và mã/tên nhà cung cấp nếu có.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...receiptSchema.properties,
              warehouseCode: { type: 'string', example: 'MAIN' },
              warehouseName: { type: 'string', example: 'Kho chính' },
              supplierCode: { type: 'string', nullable: true },
              supplierName: { type: 'string', nullable: true },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId, page, warehouseId hoặc status không hợp lệ.',
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
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.stockReceiptsService.listReceipts({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      ...parsePagination(page, pageSize),
      status: parseOptionalEnum(status, documentStatus.enumValues, 'status'),
      warehouseId: warehouseId
        ? requireUuid(warehouseId, 'warehouseId')
        : undefined,
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo phiếu nhập kho nháp',
    description:
      'Khi xác nhận, dòng LOT cần lotNumber; dòng ASSET cần assetCode và quantity bằng 1. Dòng QUANTITY không dùng metadata LOT/ASSET.',
  })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateStockReceiptDto,
    examples: {
      receipt: {
        summary: 'Nhập vật tư theo lô',
        value: {
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          receiptCode: 'RCV-2026-001',
          receiptDate: '2026-10-08',
          items: [
            {
              itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
              quantity: '10.000',
              unitPrice: '25000.00',
              lotNumber: 'LOT-2026-001',
              expiryDate: '2027-10-08',
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Phiếu nhập vừa tạo ở trạng thái DRAFT và các dòng hàng.',
    schema: { type: 'object', properties: { data: receiptDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'farmId hoặc dữ liệu phiếu/dòng hàng không hợp lệ.',
  })
  @ApiConflictResponse({
    description: 'Mã phiếu nhập đã tồn tại trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được tạo phiếu nhập.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateStockReceiptDto,
  ) {
    return {
      data: await this.stockReceiptsService.createReceipt(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phiếu nhập kho' })
  @ApiUuidParam('id', 'ID phiếu nhập.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Phiếu nhập và các dòng hàng.',
    schema: { type: 'object', properties: { data: receiptDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu nhập trong trang trại.',
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
      data: await this.stockReceiptsService.getReceipt(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật phiếu nhập nháp' })
  @ApiUuidParam('id', 'ID phiếu nhập.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: UpdateStockReceiptDto,
    examples: {
      update: {
        summary: 'Cập nhật ghi chú',
        value: { note: 'Hàng giao đợt 1' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Phiếu nhập sau khi cập nhật và các dòng hàng.',
    schema: { type: 'object', properties: { data: receiptDetailSchema } },
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
  async update(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: UpdateStockReceiptDto,
  ) {
    return {
      data: await this.stockReceiptsService.updateReceipt(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy phiếu nhập nháp' })
  @ApiUuidParam('id', 'ID phiếu nhập.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description: 'Phiếu nhập chuyển sang CANCELLED.',
    schema: { type: 'object', properties: { data: receiptDetailSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID phiếu hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy phiếu nhập.' })
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
      data: await this.stockReceiptsService.cancelReceipt(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Xác nhận phiếu nhập và cộng tồn kho' })
  @ApiUuidParam('id', 'ID phiếu nhập.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({
    description:
      'Phiếu nhập được xác nhận; các giao dịch nhập và số dư được ghi nhận.',
    schema: { type: 'object', properties: { data: receiptDetailSchema } },
  })
  @ApiBadRequestResponse({
    description:
      'Phiếu phải có ít nhất một dòng; dòng LOT/ASSET hoặc ngày tháng không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy phiếu hoặc mặt hàng được tham chiếu.',
  })
  @ApiConflictResponse({
    description:
      'Phiếu/kho không còn ở trạng thái có thể xác nhận hoặc mã tài sản đã tồn tại.',
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
      data: await this.stockReceiptsService.confirmReceipt(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import {
  CreateInventoryAdjustmentDto,
  RejectInventoryAdjustmentDto,
} from './dto/create-adjustment.dto';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
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
} from '../../common/swagger-docs';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FARM_AREA_ROLES } from '../auth/farm-access/farm-role-groups';

const ADJUSTMENT_STATUSES = [
  'PENDING_APPROVAL',
  'CONFIRMED',
  'REJECTED',
] as const;

const adjustmentResultSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        adjustment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: [...ADJUSTMENT_STATUSES] },
            quantityChange: { type: 'string', example: '-2.500' },
            reasonCode: { type: 'string', example: 'SHRINKAGE' },
            note: { type: 'string', nullable: true },
            requestedByMemberId: { type: 'string', format: 'uuid' },
            reviewedByMemberId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            rejectionReason: { type: 'string', nullable: true },
          },
        },
        transaction: {
          type: 'object',
          nullable: true,
          description:
            'Giao dịch kho đã ghi; null khi điều chỉnh còn chờ duyệt hoặc bị từ chối.',
          properties: {
            id: { type: 'string', format: 'uuid' },
            transactionType: {
              type: 'string',
              enum: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
            },
            quantityChange: { type: 'string', example: '-2.500' },
            reason: { type: 'string', example: 'Hao hụt: kiểm kê cuối ngày' },
            sourceType: { type: 'string', example: 'INVENTORY_ADJUSTMENT' },
            sourceId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  },
};

@Controller('inventory/adjustments')
@UseGuards(FarmAccessGuard)
// Store-only managers have no access to warehouse, asset or maintenance modules.
@FarmRoles(...FARM_AREA_ROLES)
@ApiTags('Tồn kho')
@ApiBearerAuth('clerk-jwt')
@ApiUnauthorizedResponse({
  description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
})
export class InventoryAdjustmentsController {
  constructor(private readonly service: InventoryAdjustmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách điều chỉnh tồn kho',
    description:
      'Nhân viên chỉ xem báo cáo của mình. Quản lý kho xem các báo cáo trong kho được phân công; chủ trại và quản trị viên xem trong trại. Mới nhất trước.',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery('status', ADJUSTMENT_STATUSES, 'Lọc theo trạng thái duyệt.')
  @ApiUuidQuery('warehouseId', 'Lọc theo kho.')
  @ApiUuidQuery('itemId', 'Lọc theo mặt hàng.')
  @ApiEnumQuery(
    'mine',
    ['true', 'false'],
    'true: chỉ các đề xuất do người gọi tạo.',
  )
  @ApiOkResponse({ description: 'Danh sách điều chỉnh theo trang.' })
  @ApiBadRequestResponse({
    description: 'farmId, bộ lọc hoặc trang không hợp lệ.',
  })
  @ApiForbiddenResponse({ description: 'Không phải thành viên trang trại.' })
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('mine') mine?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      status: parseOptionalEnum(status, ADJUSTMENT_STATUSES, 'status'),
      warehouseId: warehouseId
        ? requireUuid(warehouseId, 'warehouseId')
        : undefined,
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      mine: parseOptionalEnum(mine, ['true', 'false'], 'mine') === 'true',
      ...parsePagination(page, pageSize),
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Báo chênh lệch tồn kho để xét duyệt',
    description:
      'Mọi báo cáo đều ở trạng thái PENDING_APPROVAL, tồn chưa đổi. Quản lý kho trong phạm vi được phân công, chủ trại hoặc quản trị viên duyệt; không được tự duyệt báo cáo của mình. Gửi lại cùng idempotencyKey trả về kết quả cũ, không điều chỉnh thêm. Vật tư ngừng hoạt động và lô hết hạn chỉ được giảm.',
  })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateInventoryAdjustmentDto,
    examples: {
      decrease: {
        summary: 'Giảm do hao hụt',
        value: {
          idempotencyKey: '0b6c1f1e-3a52-4c1f-9b2a-6f1d2e3c4b5a',
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          quantityChange: '-2.500',
          reasonCode: 'SHRINKAGE',
          note: 'Hao hụt khi kiểm kê cuối ngày',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Báo cáo đã gửi chờ duyệt; tồn kho chưa thay đổi.',
    schema: adjustmentResultSchema,
  })
  @ApiBadRequestResponse({
    description:
      'UUID, signed decimal, reasonCode, ghi chú (bắt buộc với OTHER) hoặc dữ liệu đầu vào không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy mặt hàng hoặc lô trong trang trại.',
  })
  @ApiConflictResponse({
    description:
      'Kho không hoạt động, mặt hàng không hỗ trợ điều chỉnh, tăng tồn vật tư ngừng hoạt động/lô hết hạn, số dư không đủ/vượt giới hạn, hoặc idempotencyKey đã dùng cho điều chỉnh khác.',
  })
  @ApiForbiddenResponse({
    description:
      'Chỉ quản trị viên, chủ trang trại, quản lý kho hoặc nhân viên được báo chênh lệch tồn kho.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateInventoryAdjustmentDto,
  ) {
    return {
      data: await this.service.create(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Duyệt đề xuất điều chỉnh tồn kho',
    description:
      'Quản lý kho trong phạm vi được phân công, chủ trại hoặc quản trị viên; không tự duyệt báo cáo của mình. Kiểm tra lại kho, vật tư, lô và số dư tại thời điểm duyệt rồi ghi tồn.',
  })
  @ApiFarmIdQuery()
  @ApiUuidParam('id', 'Mã điều chỉnh.')
  @ApiCreatedResponse({
    description: 'Đề xuất đã duyệt và tồn kho đã cập nhật.',
    schema: adjustmentResultSchema,
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy điều chỉnh.' })
  @ApiConflictResponse({
    description:
      'Đề xuất đã được duyệt/từ chối, hoặc không còn hợp lệ (kho, vật tư, lô, số dư).',
  })
  @ApiForbiddenResponse({
    description:
      'Cần quyền quản lý kho, chủ trại hoặc quản trị viên; không được tự duyệt.',
  })
  async approve(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Param('id') id: string,
  ) {
    return {
      data: await this.service.approve(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Từ chối đề xuất điều chỉnh tồn kho',
    description:
      'Quản lý kho trong phạm vi được phân công, chủ trại hoặc quản trị viên. Tồn kho không thay đổi.',
  })
  @ApiFarmIdQuery()
  @ApiUuidParam('id', 'Mã điều chỉnh.')
  @ApiBody({ type: RejectInventoryAdjustmentDto })
  @ApiCreatedResponse({
    description: 'Đề xuất đã bị từ chối.',
    schema: adjustmentResultSchema,
  })
  @ApiBadRequestResponse({ description: 'Lý do từ chối không hợp lệ.' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy điều chỉnh.' })
  @ApiConflictResponse({ description: 'Đề xuất đã được duyệt/từ chối.' })
  @ApiForbiddenResponse({
    description: 'Cần quyền quản lý kho, chủ trại hoặc quản trị viên.',
  })
  async reject(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Param('id') id: string,
    @Body() input: RejectInventoryAdjustmentDto,
  ) {
    return {
      data: await this.service.reject(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
        input.reason,
      ),
    };
  }
}

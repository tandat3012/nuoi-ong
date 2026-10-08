import { Body, Controller, Post, Query } from '@nestjs/common';
import { requireUuid } from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateInventoryAdjustmentDto } from './dto/create-adjustment.dto';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiFarmIdQuery } from '../../common/swagger-docs';

@Controller('inventory/adjustments')
@ApiTags('Tồn kho')
@ApiBearerAuth('clerk-jwt')
export class InventoryAdjustmentsController {
  constructor(private readonly service: InventoryAdjustmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Điều chỉnh tăng hoặc giảm tồn kho',
    description:
      'Chỉ quản trị viên hoặc chủ trang trại được điều chỉnh. quantityChange là chuỗi thập phân có dấu và reason bắt buộc.',
  })
  @ApiFarmIdQuery()
  @ApiBody({
    type: CreateInventoryAdjustmentDto,
    examples: {
      decrease: {
        summary: 'Giảm theo kết quả kiểm kê',
        value: {
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          itemId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          quantityChange: '-2.500',
          reason: 'Hao hụt khi kiểm kê cuối ngày',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Một giao dịch điều chỉnh được ghi nhận cùng số dư đã cập nhật.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            transaction: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                farmId: { type: 'string', format: 'uuid' },
                warehouseId: { type: 'string', format: 'uuid' },
                itemId: { type: 'string', format: 'uuid' },
                lotId: { type: 'string', format: 'uuid', nullable: true },
                assetId: { type: 'string', format: 'uuid', nullable: true },
                transactionType: {
                  type: 'string',
                  enum: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
                },
                quantityChange: { type: 'string', example: '-2.500' },
                reason: {
                  type: 'string',
                  example: 'Hao hụt khi kiểm kê cuối ngày',
                },
                sourceType: { type: 'string', example: 'INVENTORY_ADJUSTMENT' },
                sourceId: { type: 'string', format: 'uuid' },
                movementGroupId: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                },
                performedByMemberId: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'UUID, signed decimal, lý do hoặc dữ liệu đầu vào không hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy mặt hàng hoặc lô trong trang trại.',
  })
  @ApiConflictResponse({
    description:
      'Kho không hoạt động, mặt hàng không hỗ trợ điều chỉnh hoặc số dư không đủ/đạt giới hạn.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description:
      'Chỉ quản trị viên hoặc chủ trang trại được điều chỉnh tồn kho.',
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
}

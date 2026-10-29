import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parsePagination, requireUuid } from '../../common/query-params';
import {
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiUuidParam,
  ApiUuidQuery,
} from '../../common/swagger-docs';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { AuditLogsService } from './audit-logs.service';

const optionalCode = (value?: string) =>
  value?.trim().toUpperCase() || undefined;

@Controller('audit-logs')
@ApiTags('Lịch sử thao tác')
@ApiBearerAuth('clerk-jwt')
@ApiForbiddenResponse({
  description:
    'Không phải thành viên đang hoạt động, hoặc là khách (GUEST) của trang trại.',
})
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lịch sử thao tác của trang trại; nhân viên chỉ thấy phiếu do mình tạo',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiQuery({
    name: 'entityType',
    required: false,
    example: 'STOCK_RECEIPT',
    description:
      'STOCK_RECEIPT, STOCK_ISSUE, STOCK_TRANSFER, STOCK_COUNT, ASSET, PERSONNEL…',
  })
  @ApiUuidQuery('entityId', 'Chỉ lấy lịch sử của một đối tượng.')
  @ApiQuery({
    name: 'action',
    required: false,
    example: 'CONFIRM',
  })
  @ApiOkResponse({
    description:
      'Bản ghi mới nhất trước, kèm người thao tác. `references` đổi các id trong trang (đối tượng, kho, mặt hàng, lô, vị trí, nhà cung cấp, tài sản, thành viên, phiếu) thành mã hoặc tên để hiển thị.',
  })
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditLogsService.list({
      farmId: requireUuid(farmId, 'farmId'),
      clerkUserId: auth.clerkUserId,
      entityType: optionalCode(entityType),
      entityId: entityId ? requireUuid(entityId, 'entityId') : undefined,
      action: optionalCode(action),
      ...parsePagination(page, pageSize),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một bản ghi lịch sử thao tác' })
  @ApiUuidParam('id', 'ID bản ghi lịch sử.')
  @ApiFarmIdQuery()
  @ApiOkResponse({ description: 'Dữ liệu trước/sau và người thao tác.' })
  @ApiNotFoundResponse({
    description: 'Không có bản ghi, hoặc ngoài phạm vi được xem.',
  })
  async get(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.auditLogsService.get(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }
}

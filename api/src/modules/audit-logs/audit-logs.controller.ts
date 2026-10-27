import { Controller, Get, Param, Query } from '@nestjs/common';
import { parsePagination, requireUuid } from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { AuditLogsService } from './audit-logs.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('audit-logs')
@ApiTags('Lịch sử thao tác')
@ApiBearerAuth('clerk-jwt')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một bản ghi lịch sử trong farm hiện tại' })
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

  @Get()
  @ApiOperation({ summary: 'Danh sách lịch sử theo farm và quyền tài khoản' })
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
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      entityType: entityType?.trim() || undefined,
      entityId: entityId ? requireUuid(entityId, 'entityId') : undefined,
      action: action?.trim() || undefined,
      ...parsePagination(page, pageSize),
    });
  }
}

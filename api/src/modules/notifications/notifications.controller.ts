import { BadRequestException, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { parsePagination, requireUuid } from '../../common/query-params';
import { ApiFarmIdQuery, ApiPageQueries } from '../../common/swagger-docs';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@ApiTags('Thông báo')
@ApiBearerAuth('clerk-jwt')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tài khoản trong farm đang chọn' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiQuery({ name: 'unreadOnly', required: false, enum: ['true', 'false'] })
  @ApiOkResponse({ description: 'Thông báo theo trang và tổng số chưa đọc.' })
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (unreadOnly && !['true', 'false'].includes(unreadOnly)) {
      throw new BadRequestException('unreadOnly must be true or false');
    }
    return this.notifications.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      unreadOnly: unreadOnly === 'true',
      ...parsePagination(page, pageSize),
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ thông báo trong farm đang chọn' })
  markAllRead(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
  ) {
    return this.notifications.markAllRead(requireUuid(farmId, 'farmId'), auth.clerkUserId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu một thông báo của tài khoản đã đọc' })
  markRead(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return this.notifications.markRead(
      requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId,
    );
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { parseOptionalEnum, parsePagination, requireUuid } from '../../common/query-params';
import { ApiFarmIdQuery, ApiUuidParam } from '../../common/swagger-docs';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { ApproveMaintenanceRequestDto, CreateMaintenanceRequestDto, RejectMaintenanceRequestDto } from './dto/maintenance-request.dto';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Controller('maintenance-requests')
@ApiTags('Bảo trì')
@ApiBearerAuth('clerk-jwt')
export class MaintenanceRequestsController {
  constructor(private readonly service: MaintenanceRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu bảo trì theo farm' })
  @ApiFarmIdQuery()
  list(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId?: string, @Query('status') status?: string, @Query('assetId') assetId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const pagination = parsePagination(page, pageSize);
    return this.service.list(requireUuid(farmId, 'farmId'), auth.clerkUserId, pagination.page, pagination.pageSize, parseOptionalEnum(status, documentStatus.enumValues, 'status'), assetId ? requireUuid(assetId, 'assetId') : undefined);
  }

  @Post()
  @ApiOperation({ summary: 'Nhân viên gửi yêu cầu bảo trì đột xuất để duyệt' })
  @ApiFarmIdQuery()
  @ApiBody({ type: CreateMaintenanceRequestDto })
  @ApiCreatedResponse({ description: 'Tạo yêu cầu PENDING_APPROVAL và thông báo admin/chủ farm.' })
  @ApiBadRequestResponse({ description: 'farmId hoặc dữ liệu không hợp lệ.' })
  @ApiForbiddenResponse({ description: 'Yêu cầu membership ACTIVE trong đúng farm.' })
  @ApiConflictResponse({ description: 'Asset đang bảo trì hoặc đã có yêu cầu chờ duyệt.' })
  create(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId: string | undefined, @Body() input: CreateMaintenanceRequestDto) {
    return this.service.create(requireUuid(farmId, 'farmId'), auth.clerkUserId, input).then((data) => ({ data }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết yêu cầu bảo trì' })
  @ApiUuidParam('id', 'UUID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  async get(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) {
    return { data: await this.service.get(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt yêu cầu và lập lịch bảo trì' })
  @ApiUuidParam('id', 'UUID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ApproveMaintenanceRequestDto })
  @ApiConflictResponse({ description: 'Yêu cầu không còn chờ duyệt hoặc tài sản đã có lịch bảo trì đang hoạt động.' })
  async approve(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId: string | undefined, @Body() input: ApproveMaintenanceRequestDto) {
    return { data: await this.service.approve(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId, input.scheduledAt) };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối yêu cầu bảo trì với lý do' })
  @ApiUuidParam('id', 'UUID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RejectMaintenanceRequestDto })
  async reject(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId: string | undefined, @Body() input: RejectMaintenanceRequestDto) {
    return { data: await this.service.reject(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId, input.rejectionReason) };
  }
}

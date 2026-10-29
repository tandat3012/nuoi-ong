import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiUuidParam,
  ApiUuidQuery,
} from '../../common/swagger-docs';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import {
  ApproveMaintenanceRequestDto,
  CreateMaintenanceRequestDto,
  RejectMaintenanceRequestDto,
} from './dto/maintenance-request.dto';
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Controller('maintenance-requests')
@ApiTags('Bảo trì')
@ApiBearerAuth('clerk-jwt')
export class MaintenanceRequestsController {
  constructor(private readonly service: MaintenanceRequestsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách yêu cầu bảo trì (quản trị viên/chủ trang trại xem tất cả, người khác chỉ xem yêu cầu của mình)',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('assetId', 'Lọc theo tài sản.')
  @ApiEnumQuery('status', documentStatus.enumValues, 'Trạng thái yêu cầu.')
  @ApiOkResponse({ description: 'Trang yêu cầu kèm mã tài sản và tên vật tư.' })
  @ApiForbiddenResponse({
    description: 'Cần membership ACTIVE của trang trại.',
  })
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('assetId') assetId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      assetId: assetId ? requireUuid(assetId, 'assetId') : undefined,
      status: parseOptionalEnum(status, documentStatus.enumValues, 'status'),
      ...parsePagination(page, pageSize),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Nhân viên gửi yêu cầu sửa chữa/kiểm tra tài sản' })
  @ApiFarmIdQuery()
  @ApiBody({ type: CreateMaintenanceRequestDto })
  @ApiCreatedResponse({
    description:
      'Yêu cầu PENDING_APPROVAL; quản trị viên và chủ trang trại được thông báo.',
  })
  @ApiBadRequestResponse({ description: 'farmId hoặc dữ liệu không hợp lệ.' })
  @ApiForbiddenResponse({ description: 'Chỉ nhân viên (EMPLOYEE) được gửi.' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy tài sản trong trang trại.',
  })
  @ApiConflictResponse({
    description:
      'Tài sản đã mất, thanh lý, đang bảo trì, có lịch bảo trì hoặc đã có yêu cầu chờ duyệt.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateMaintenanceRequestDto,
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
  @ApiOperation({ summary: 'Chi tiết yêu cầu bảo trì' })
  @ApiUuidParam('id', 'ID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  @ApiNotFoundResponse({
    description: 'Không tìm thấy, hoặc là yêu cầu của người khác.',
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

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt yêu cầu và lập lịch bảo trì SCHEDULED' })
  @ApiUuidParam('id', 'ID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ApproveMaintenanceRequestDto })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được duyệt.',
  })
  @ApiConflictResponse({
    description:
      'Yêu cầu không còn chờ duyệt hoặc tài sản đã có lịch bảo trì đang hoạt động.',
  })
  async approve(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: ApproveMaintenanceRequestDto,
  ) {
    return {
      data: await this.service.approve(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input.scheduledAt,
      ),
    };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối yêu cầu bảo trì kèm lý do' })
  @ApiUuidParam('id', 'ID yêu cầu bảo trì.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RejectMaintenanceRequestDto })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được từ chối.',
  })
  @ApiConflictResponse({ description: 'Yêu cầu không còn chờ duyệt.' })
  async reject(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: RejectMaintenanceRequestDto,
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

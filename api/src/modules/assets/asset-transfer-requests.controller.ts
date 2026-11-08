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
import { AssetTransferRequestsService } from './asset-transfer-requests.service';
import {
  CreateAssetTransferRequestDto,
  ReceiveAssetTransferDto,
  ResolveAssetTransferDto,
  RejectAssetTransferRequestDto,
} from './dto/asset-lifecycle.dto';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FARM_AREA_ROLES } from '../auth/farm-access/farm-role-groups';

@Controller('asset-transfer-requests')
@UseGuards(FarmAccessGuard)
// Store-only managers have no access to warehouse, asset or maintenance modules.
@FarmRoles(...FARM_AREA_ROLES)
@ApiTags('Tài sản')
@ApiBearerAuth('clerk-jwt')
export class AssetTransferRequestsController {
  constructor(private readonly service: AssetTransferRequestsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách yêu cầu chuyển tài sản (quản trị viên/chủ trang trại xem tất cả, người khác chỉ xem yêu cầu của mình)',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiUuidQuery('assetId', 'Lọc theo tài sản.')
  @ApiEnumQuery('status', documentStatus.enumValues, 'Trạng thái yêu cầu.')
  @ApiOkResponse({
    description: 'Trang yêu cầu kèm mã tài sản, vị trí nguồn và đích.',
  })
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
  @ApiOperation({
    summary: 'Nhân viên yêu cầu chuyển tài sản AVAILABLE sang vị trí khác',
  })
  @ApiFarmIdQuery()
  @ApiBody({ type: CreateAssetTransferRequestDto })
  @ApiCreatedResponse({
    description:
      'Yêu cầu PENDING_APPROVAL; tài sản chuyển sang TRANSFER_PENDING, quản trị viên và chủ trang trại được thông báo.',
  })
  @ApiBadRequestResponse({ description: 'farmId hoặc dữ liệu không hợp lệ.' })
  @ApiForbiddenResponse({ description: 'Chỉ nhân viên (EMPLOYEE) được gửi.' })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy tài sản trong trang trại.',
  })
  @ApiConflictResponse({
    description:
      'Tài sản không AVAILABLE, đã ở vị trí đích, đang có bảo trì, vị trí đích không hợp lệ hoặc đã có yêu cầu chờ duyệt.',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string | undefined,
    @Body() input: CreateAssetTransferRequestDto,
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
  @ApiOperation({ summary: 'Chi tiết yêu cầu chuyển tài sản' })
  @ApiUuidParam('id', 'ID yêu cầu chuyển tài sản.')
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
  @ApiOperation({
    summary:
      'Duyệt yêu cầu: cùng kho thì chuyển ngay; khác kho thì kho nguồn xuất (IN_TRANSIT), kho đích nhận sau',
  })
  @ApiUuidParam('id', 'ID yêu cầu chuyển tài sản.')
  @ApiFarmIdQuery()
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được duyệt.',
  })
  @ApiConflictResponse({
    description:
      'Yêu cầu không còn chờ duyệt, hoặc không thể chuyển (kho/vị trí không còn hoạt động, thiếu tồn kho).',
  })
  async approve(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId?: string,
  ) {
    return {
      data: await this.service.approve(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Từ chối yêu cầu kèm lý do; tài sản trở lại AVAILABLE',
  })
  @ApiUuidParam('id', 'ID yêu cầu chuyển tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RejectAssetTransferRequestDto })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên hoặc chủ trang trại được từ chối.',
  })
  @ApiConflictResponse({ description: 'Yêu cầu không còn chờ duyệt.' })
  async reject(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: RejectAssetTransferRequestDto,
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

  @Post(':id/resolve')
  @ApiOperation({
    summary:
      'Chủ trại/quản trị ghi nhận đã xử lý tài sản nhận hỏng (DISCREPANCY → CONFIRMED)',
    description:
      'Không đổi tồn hay trạng thái tài sản (đã DAMAGED tại kho đích khi nhận). Gọi lại khi đã xử lý trả về yêu cầu hiện tại.',
  })
  @ApiUuidParam('id', 'ID yêu cầu chuyển tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ResolveAssetTransferDto })
  @ApiBadRequestResponse({ description: 'Thiếu ghi chú xử lý.' })
  @ApiForbiddenResponse({ description: 'Chỉ ADMIN/FARM_OWNER.' })
  @ApiConflictResponse({ description: 'Yêu cầu không ở DISCREPANCY.' })
  async resolve(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: ResolveAssetTransferDto,
  ) {
    return {
      data: await this.service.resolve(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input.note,
      ),
    };
  }

  @Post(':id/receive')
  @ApiOperation({
    summary:
      'Kho đích xác nhận nhận tài sản đang chuyển: cộng tồn, đặt vị trí, AVAILABLE hoặc DAMAGED',
  })
  @ApiUuidParam('id', 'ID yêu cầu chuyển tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ReceiveAssetTransferDto })
  @ApiBadRequestResponse({ description: 'DAMAGED thiếu ghi chú.' })
  @ApiForbiddenResponse({
    description: 'Chỉ quản lý kho của kho đích được nhận.',
  })
  @ApiConflictResponse({
    description:
      'Yêu cầu không ở IN_TRANSIT, mã tài sản không khớp (ASSET_MISMATCH) hoặc vị trí nhận không còn hoạt động.',
  })
  async receive(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Query('farmId') farmId: string | undefined,
    @Body() input: ReceiveAssetTransferDto,
  ) {
    return {
      data: await this.service.receive(
        requireUuid(id, 'id'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }
}

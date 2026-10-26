import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { assetStatus } from '../../db/schema';
import { AssetsService } from './assets.service';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { ReturnAssetDto } from './dto/return-asset.dto';
import {
  AssignAssetDto,
  CreateAssetDto,
  RecoverAssetDto,
  ReportAssetIncidentDto,
  RetireAssetDto,
  TransferAssetDto,
  UpdateAssetDto,
  UpdateAssetIncidentStatusDto,
} from './dto/asset-lifecycle.dto';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { AssetLifecycleService } from './asset-lifecycle.service';
import {
  AssetHistoryService,
  assetHistoryKinds,
} from './asset-history.service';
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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiEnumQuery,
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiSearchQuery,
  ApiUuidParam,
  ApiUuidQuery,
  OPENAPI_PAGE,
} from '../../common/swagger-docs';

const assetSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    farmId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
    sourceReceiptItemId: { type: 'string', format: 'uuid', nullable: true },
    currentLocationId: { type: 'string', format: 'uuid', nullable: true },
    assetCode: { type: 'string', example: 'ASSET-001' },
    serialNumber: { type: 'string', nullable: true },
    qrToken: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: [...assetStatus.enumValues] },
    purchaseDate: { type: 'string', format: 'date', nullable: true },
    purchasePrice: { type: 'string', nullable: true, example: '1250000.00' },
    warrantyExpiryDate: { type: 'string', format: 'date', nullable: true },
    lastMaintenanceDate: { type: 'string', format: 'date', nullable: true },
    nextMaintenanceDate: { type: 'string', format: 'date', nullable: true },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const assetWithLocationSchema = {
  type: 'object',
  properties: {
    asset: assetSchema,
    itemCode: { type: 'string', example: 'PUMP-01' },
    itemName: { type: 'string', example: 'Máy bơm nước' },
    locationCode: { type: 'string', nullable: true },
    locationName: { type: 'string', nullable: true },
    locationWarehouseId: { type: 'string', format: 'uuid', nullable: true },
  },
};

@Controller('/assets')
@UseGuards(FarmAccessGuard)
@ApiTags('Tài sản')
@ApiBearerAuth('clerk-jwt')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly lifecycleService: AssetLifecycleService,
    private readonly historyService: AssetHistoryService,
  ) {}

  @Get('members')
  @ApiOperation({
    summary: 'Danh sách thành viên đang hoạt động trong trang trại',
  })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiOkResponse({ description: 'Thành viên có thể nhận tài sản.' })
  async listMembers(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
  ) {
    return this.historyService.listMembers({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo tài sản thủ công',
    description:
      'Tạo tài sản, tăng tồn kho và ghi sổ giao dịch trong cùng transaction.',
  })
  @ApiFarmIdQuery()
  @ApiBody({ type: CreateAssetDto })
  @ApiCreatedResponse({ description: 'Tài sản được tạo và nhập kho.' })
  @ApiBadRequestResponse({
    description: 'farmId hoặc dữ liệu tài sản không hợp lệ.',
  })
  @ApiConflictResponse({
    description:
      'Mặt hàng, kho hoặc vị trí không hoạt động; mã hoặc sê-ri đã tồn tại.',
  })
  async createAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: CreateAssetDto,
  ) {
    return {
      data: await this.lifecycleService.create(
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách tài sản theo trang' })
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiSearchQuery()
  @ApiEnumQuery('status', assetStatus.enumValues, 'Trạng thái tài sản.')
  @ApiUuidQuery('itemId', 'Lọc theo mặt hàng.')
  @ApiUuidQuery('locationId', 'Lọc theo vị trí hiện tại.')
  @ApiUuidQuery('warehouseId', 'Lọc theo kho của vị trí hiện tại.')
  @ApiOkResponse({
    description: 'Tài sản kèm mặt hàng và vị trí nếu có.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              asset: assetSchema,
              itemCode: { type: 'string', example: 'PUMP-01' },
              itemName: { type: 'string', example: 'Máy bơm nước' },
              locationCode: { type: 'string', nullable: true },
              locationName: { type: 'string', nullable: true },
              locationWarehouseId: {
                type: 'string',
                format: 'uuid',
                nullable: true,
              },
            },
          },
        },
        page: OPENAPI_PAGE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'UUID, page hoặc status filter không hợp lệ.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
  listAssets(
    @Query('farmId') farmIdValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
    @Query('search') searchValue?: string,
    @Query('status') statusValue?: string,
    @Query('itemId') itemIdValue?: string,
    @Query('locationId') locationIdValue?: string,
    @Query('warehouseId') warehouseIdValue?: string,
  ) {
    return this.assetsService.listAssets({
      farmId: requireUuid(farmIdValue, 'farmId'),
      ...parsePagination(pageValue, pageSizeValue),
      search: normalizeSearch(searchValue),
      status: parseOptionalEnum(statusValue, assetStatus.enumValues, 'status'),
      itemId: itemIdValue ? requireUuid(itemIdValue, 'itemId') : undefined,
      locationId: locationIdValue
        ? requireUuid(locationIdValue, 'locationId')
        : undefined,
      warehouseId: warehouseIdValue
        ? requireUuid(warehouseIdValue, 'warehouseId')
        : undefined,
    });
  }

  @Get('by-code/:assetCode')
  @ApiOperation({ summary: 'Tìm tài sản theo mã' })
  @ApiParam({
    name: 'assetCode',
    required: true,
    type: String,
    description: 'Mã tài sản.',
    example: 'ASSET-001',
  })
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Tài sản đầy đủ cùng thông tin vị trí và mặt hàng.',
    schema: { type: 'object', properties: { data: assetWithLocationSchema } },
  })
  @ApiBadRequestResponse({
    description:
      'Asset code phải dài 1-100 ký tự và farmId phải là UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy tài sản trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
  async getAssetByCode(
    @Param('assetCode') assetCode: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    if (!assetCode.trim() || [...assetCode].length > 100)
      throw new BadRequestException(
        'Asset code must contain 1 to 100 characters',
      );
    return {
      data: await this.assetsService.getAssetByCode(
        assetCode,
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get('by-qr/:qrToken')
  @ApiOperation({ summary: 'Tìm tài sản theo mã QR' })
  @ApiUuidParam('qrToken', 'Token UUID được mã hóa trong QR tài sản.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Tài sản đầy đủ cùng thông tin vị trí và mặt hàng.',
    schema: { type: 'object', properties: { data: assetWithLocationSchema } },
  })
  @ApiBadRequestResponse({
    description: 'QR token hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy tài sản trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
  async getAssetByQr(
    @Param('qrToken') qrTokenValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.assetsService.getAssetByQr(
        requireUuid(qrTokenValue, 'qrToken'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get(':id/holder')
  @ApiOperation({ summary: 'Người đang giữ tài sản' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Thông tin bàn giao đang hoạt động hoặc null.',
  })
  async getHolder(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.historyService.holder(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Lịch sử tài sản theo loại' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiPageQueries()
  @ApiEnumQuery('kind', assetHistoryKinds, 'Loại lịch sử; mặc định movements.')
  @ApiOkResponse({ description: 'Lịch sử tài sản đã chuẩn hóa theo trang.' })
  async getHistory(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
    @Query('kind') kindValue?: string,
    @Query('page') pageValue?: string,
    @Query('pageSize') pageSizeValue?: string,
  ) {
    return this.historyService.history({
      assetId: requireUuid(idValue, 'id'),
      farmId: requireUuid(farmIdValue, 'farmId'),
      kind:
        parseOptionalEnum(kindValue, assetHistoryKinds, 'kind') ?? 'movements',
      ...parsePagination(pageValue, pageSizeValue),
    });
  }

  @Get(':id/label')
  @ApiOperation({ summary: 'Tạo nhãn QR SVG cho tài sản' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Mã tài sản và QR SVG, payload là mã tài sản.',
  })
  async getLabel(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.historyService.label(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật metadata tài sản với kiểm tra phiên bản' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: UpdateAssetDto })
  @ApiOkResponse({ description: 'Metadata đã cập nhật.' })
  @ApiConflictResponse({
    description: 'Tài sản đã thay đổi hoặc sê-ri đã tồn tại.',
  })
  async updateAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: UpdateAssetDto,
  ) {
    return {
      data: await this.lifecycleService.update(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/assign')
  @ApiOperation({
    summary: 'Cấp phát hoặc chuyển người nhận tài sản',
    description:
      'Cấp phát từ kho trừ tồn một đơn vị; đổi người nhận không làm thay đổi tồn kho.',
  })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: AssignAssetDto })
  @ApiCreatedResponse({ description: 'Tài sản đã được bàn giao.' })
  @ApiConflictResponse({
    description: 'Tài sản không thể cấp phát hoặc tham chiếu không hoạt động.',
  })
  async assignAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: AssignAssetDto,
  ) {
    return {
      data: await this.lifecycleService.assign(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/start-use')
  @ApiOperation({ summary: 'Bắt đầu sử dụng tài sản đã bàn giao' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiCreatedResponse({ description: 'Trạng thái tài sản thành IN_USE.' })
  @ApiConflictResponse({
    description:
      'Tài sản chưa được bàn giao hoặc không có bàn giao đang hoạt động.',
  })
  async startUse(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
  ) {
    return {
      data: await this.lifecycleService.startUse(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post(':id/transfer')
  @ApiOperation({
    summary: 'Chuyển tài sản AVAILABLE sang kho hoặc vị trí khác',
  })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: TransferAssetDto })
  @ApiCreatedResponse({
    description: 'Vị trí tài sản và tồn kho đã được cập nhật.',
  })
  @ApiConflictResponse({ description: 'Tài sản hoặc đích nhận không hợp lệ.' })
  async transferAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: TransferAssetDto,
  ) {
    return {
      data: await this.lifecycleService.transfer(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/retire')
  @ApiOperation({ summary: 'Ngừng sử dụng tài sản đang có trong kho' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RetireAssetDto })
  @ApiCreatedResponse({
    description: 'Tài sản được đánh dấu RETIRED và giảm tồn kho.',
  })
  @ApiConflictResponse({
    description:
      'Chỉ tài sản AVAILABLE không có bảo trì đang mở mới có thể ngừng.',
  })
  async retireAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: RetireAssetDto,
  ) {
    return {
      data: await this.lifecycleService.retire(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/incidents')
  @ApiOperation({ summary: 'Ghi nhận sự cố hoặc thất lạc tài sản' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: ReportAssetIncidentDto })
  @ApiCreatedResponse({ description: 'Báo cáo sự cố được ghi nhận.' })
  @ApiConflictResponse({
    description: 'Tài sản đã kết thúc vòng đời hoặc mất không phù hợp.',
  })
  async reportIncident(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: ReportAssetIncidentDto,
  ) {
    return {
      data: await this.lifecycleService.reportIncident(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/incidents/:incidentId/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái xử lý sự cố' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiUuidParam('incidentId', 'ID sự cố.')
  @ApiFarmIdQuery()
  @ApiBody({ type: UpdateAssetIncidentStatusDto })
  @ApiOkResponse({ description: 'Sự cố đã chuyển trạng thái.' })
  @ApiConflictResponse({
    description: 'Chuyển trạng thái không hợp lệ hoặc sự cố đã kết thúc.',
  })
  async updateIncidentStatus(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Param('incidentId') incidentIdValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: UpdateAssetIncidentStatusDto,
  ) {
    return {
      data: await this.lifecycleService.updateIncidentStatus(
        requireUuid(idValue, 'id'),
        requireUuid(incidentIdValue, 'incidentId'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/recover')
  @ApiOperation({
    summary: 'Khôi phục tài sản LOST vào kho và vị trí chỉ định',
  })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiBody({ type: RecoverAssetDto })
  @ApiCreatedResponse({
    description: 'Tài sản trở lại AVAILABLE và tăng tồn kho.',
  })
  @ApiConflictResponse({ description: 'Chỉ tài sản LOST có thể khôi phục.' })
  async recoverAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: RecoverAssetDto,
  ) {
    return {
      data: await this.lifecycleService.recover(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tài sản' })
  @ApiUuidParam('id', 'ID tài sản.')
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description: 'Tài sản đầy đủ cùng thông tin vị trí và mặt hàng.',
    schema: { type: 'object', properties: { data: assetWithLocationSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID tài sản hoặc farmId không phải UUID hợp lệ.',
  })
  @ApiNotFoundResponse({
    description: 'Không tìm thấy tài sản trong trang trại.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Người dùng không có quyền truy cập trang trại.',
  })
  async getAsset(
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue?: string,
  ) {
    return {
      data: await this.assetsService.getAsset(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }

  @Post(':id/return')
  @ApiOperation({
    summary: 'Ghi nhận trả tài sản về kho',
    description:
      'Chỉ tài sản đang được giao hoặc đang sử dụng mới được trả. Kho và vị trí nhận phải đang hoạt động trong trang trại. locationId có thể bỏ qua chỉ khi vị trí hiện tại của tài sản đang hoạt động trong kho nhận; yêu cầu cũ chỉ có warehouseId sẽ bị từ chối nếu không có vị trí phù hợp.',
  })
  @ApiUuidParam('id', 'ID tài sản cần trả.')
  @ApiFarmIdQuery()
  @ApiBody({
    type: ReturnAssetDto,
    examples: {
      return: {
        summary: 'Trả về kho chính',
        value: {
          warehouseId: '550e8400-e29b-41d4-a716-446655440000',
          locationId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          note: 'Hoàn tất công việc tại vườn.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Tài sản vừa trả; đây là raw asset row, không bọc transaction.',
    schema: { type: 'object', properties: { data: assetSchema } },
  })
  @ApiBadRequestResponse({
    description: 'ID tài sản, farmId hoặc body không hợp lệ.',
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tài sản.' })
  @ApiConflictResponse({
    description:
      'Tài sản không ở trạng thái có thể trả, kho không hoạt động, hoặc không có vị trí nhận đang hoạt động thuộc kho và trang trại đã chọn.',
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description:
      'Chỉ quản trị viên hoặc chủ trang trại được ghi nhận trả tài sản.',
  })
  async returnAsset(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') idValue: string,
    @Query('farmId') farmIdValue: string | undefined,
    @Body() input: ReturnAssetDto,
  ) {
    return {
      data: await this.assetsService.returnAsset(
        requireUuid(idValue, 'id'),
        requireUuid(farmIdValue, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }
}

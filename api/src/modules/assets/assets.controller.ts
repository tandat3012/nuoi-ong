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
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { assetStatus } from '../../db/schema';
import { AssetsService } from './assets.service';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { FarmAccessGuard } from '../auth/farm-access.guard';
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
  constructor(private readonly assetsService: AssetsService) {}

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
  @ApiBadRequestResponse({ description: 'farmId không phải UUID hợp lệ.' })
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
      'Chỉ tài sản đang được giao hoặc đang sử dụng mới được trả; thao tác thêm tồn và giao dịch trả tài sản.',
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
      'Tài sản không ở trạng thái có thể trả hoặc kho không hoạt động trong trang trại.',
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

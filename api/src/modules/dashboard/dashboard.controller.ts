import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseDateRange } from '../../common/date-range';
import { requireUuid } from '../../common/query-params';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import {
  STOCK_WRITE_ROLES,
  STORE_MANAGE_ROLES,
  WAREHOUSE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';
import type { AuthRequest } from '../auth/clerk/types/auth-request.type';
import { assertInScope } from '../warehouses/warehouse-scope';
import { WarehousesService } from '../warehouses/warehouses.service';
import { DashboardService, TIMESERIES_MAX_DAYS } from './dashboard.service';
import { MOVE_KINDS } from './stock-valuation';

function requiredRange(dateFrom?: string, dateTo?: string) {
  const range = parseDateRange(dateFrom, dateTo);
  if (!range.dateFrom || !range.dateTo)
    throw new BadRequestException('dateFrom and dateTo are required');
  return { dateFrom: range.dateFrom, dateTo: range.dateTo };
}

const amount = {
  type: 'object',
  properties: {
    quantity: { type: 'string', example: '2.5' },
    value: { type: 'string', example: '56250' },
  },
};

// Null when the caller's roles do not cover that area (farm operations or store).
const count = { type: 'integer', example: 0, nullable: true };

@Controller('dashboard')
@ApiTags('Tổng quan')
@ApiBearerAuth('clerk-jwt')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /** The caller's warehouses; a selected warehouse outside them is 403. */
  private async scope(
    farmId: string,
    clerkUserId: string,
    warehouseId?: string,
  ) {
    const scope = await this.warehousesService.warehouseScope(
      farmId,
      clerkUserId,
    );
    if (warehouseId) assertInScope(scope, warehouseId);
    return scope;
  }

  @Get('summary')
  @UseGuards(FarmAccessGuard)
  // Staff data; GUEST members only get the hub links. Fields outside the caller's area come back null.
  @FarmRoles(...new Set([...STOCK_WRITE_ROLES, ...STORE_MANAGE_ROLES]))
  @ApiOperation({ summary: 'Chỉ số tổng quan của trang trại' })
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description:
      'Giá trị tồn (VND) = giá trị cuối kỳ hôm nay theo bình quân gia quyền di động của từng kho, cùng cách tính với báo cáo nhập–xuất–tồn; stockValue chỉ gồm phần tồn đã định giá; unpricedItems = số mặt hàng còn tồn chưa có giá ở ít nhất một kho — phần đó không tính (không phải 0 đ), nên khi unpricedItems > 0 stockValue chưa phải tổng giá trị đầy đủ. Đơn giá 0 trên phiếu nhập nghĩa là chưa có giá. Chỉ tính các kho người gọi được xem; số lô hết hạn trong 30 ngày tới; đơn hôm nay tính theo giờ Việt Nam.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            stockValue: { type: 'string', example: '12500000', nullable: true },
            unpricedItems: count,
            belowMinimum: count,
            expiringLots: count,
            expiredLots: count,
            assetsInMaintenance: count,
            pendingAdjustments: count,
            ordersToday: count,
            ordersPending: count,
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'farmId không hợp lệ.' })
  @ApiForbiddenResponse({
    description:
      'Chỉ quản trị viên, chủ trang trại, quản lý kho, quản lý cửa hàng hoặc nhân viên.',
  })
  async summary(
    @Req() request: AuthRequest,
    @Query('farmId') farmIdValue?: string,
  ) {
    const farmId = requireUuid(farmIdValue, 'farmId');
    return {
      data: await this.dashboardService.summary(
        farmId,
        request.farmRoleCodes ?? [],
        await this.scope(farmId, request.auth.clerkUserId),
      ),
    };
  }

  @Get('timeseries')
  @UseGuards(FarmAccessGuard)
  @FarmRoles(...WAREHOUSE_MANAGE_ROLES)
  @ApiOperation({ summary: 'Nhập – xuất và chi phí theo thời gian' })
  @ApiFarmIdQuery()
  @ApiQuery({ name: 'dateFrom', required: true, example: '2026-08-01' })
  @ApiQuery({ name: 'dateTo', required: true, example: '2026-10-31' })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Một kho; bỏ trống = toàn trang trại.',
  })
  @ApiOkResponse({
    description: `Gom theo ngày (≤31 ngày), tuần (≤92 ngày, bắt đầu thứ Hai) hoặc tháng; tối đa ${TIMESERIES_MAX_DAYS} ngày, giờ Việt Nam. Nhập = phiếu nhập + điều chỉnh tăng; xuất = phiếu xuất + điều chỉnh giảm; chuyển kho chỉ tính khi chọn một kho; cấp phát/hoàn trả tài sản không tính. Giá trị (VND) theo giá bình quân gia quyền di động của từng kho. Chi phí bảo trì tính toàn trang trại theo ngày hoàn thành.`,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            granularity: { type: 'string', enum: ['day', 'week', 'month'] },
            unpricedMovements: { type: 'integer', example: 0 },
            periods: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string', example: '2026-10-01' },
                  inboundValue: { type: 'string', example: '1500000' },
                  outboundValue: { type: 'string', example: '800000' },
                  inboundDocuments: { type: 'integer', example: 3 },
                  outboundDocuments: { type: 'integer', example: 2 },
                  purchaseCost: { type: 'string', example: '1500000' },
                  maintenanceLaborCost: { type: 'string', example: '200000' },
                  maintenanceMaterialCost: { type: 'string', example: '0' },
                  maintenanceOtherCost: { type: 'string', example: '0' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId/warehouseId/ngày không hợp lệ hoặc quá 366 ngày.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên, chủ trang trại hoặc quản lý kho.',
  })
  @ApiNotFoundResponse({ description: 'Kho không thuộc trang trại.' })
  async timeseries(
    @Req() request: AuthRequest,
    @Query('farmId') farmIdValue?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const range = requiredRange(dateFrom, dateTo);
    const farmId = requireUuid(farmIdValue, 'farmId');
    const warehouse = warehouseId
      ? requireUuid(warehouseId, 'warehouseId')
      : undefined;
    return {
      data: await this.dashboardService.timeseries(
        farmId,
        range.dateFrom,
        range.dateTo,
        warehouse,
        await this.scope(farmId, request.auth.clerkUserId, warehouse),
      ),
    };
  }

  @Get('stock-report')
  @UseGuards(FarmAccessGuard)
  @FarmRoles(...WAREHOUSE_MANAGE_ROLES)
  @ApiOperation({ summary: 'Báo cáo nhập – xuất – tồn theo kỳ' })
  @ApiFarmIdQuery()
  @ApiQuery({ name: 'dateFrom', required: true, example: '2026-08-01' })
  @ApiQuery({ name: 'dateTo', required: true, example: '2026-10-31' })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Một kho; bỏ trống = mọi kho của trang trại.',
  })
  @ApiOkResponse({
    description: `Mỗi dòng là một vật tư trong một kho (gộp các lô): tồn đầu kỳ, từng loại biến động trong kỳ và tồn cuối kỳ, số lượng và VND. Tối đa ${TIMESERIES_MAX_DAYS} ngày, giờ Việt Nam. Giá trị theo giá bình quân gia quyền di động của từng kho; unpriced = có hàng chưa có giá: giá trị của dòng chỉ gồm phần đã định giá, phần chưa có giá không tính (không phải 0 đ). Bỏ các dòng không có tồn và không phát sinh.`,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  warehouseId: { type: 'string', format: 'uuid' },
                  warehouseCode: { type: 'string' },
                  warehouseName: { type: 'string' },
                  itemId: { type: 'string', format: 'uuid' },
                  itemCode: { type: 'string' },
                  itemName: { type: 'string' },
                  itemType: {
                    type: 'string',
                    enum: ['EQUIPMENT', 'TOOL', 'MATERIAL'],
                  },
                  trackingMode: {
                    type: 'string',
                    enum: ['QUANTITY', 'LOT', 'ASSET'],
                  },
                  unit: { type: 'string', example: 'kg' },
                  opening: amount,
                  closing: amount,
                  moves: {
                    type: 'object',
                    properties: Object.fromEntries(
                      MOVE_KINDS.map((kind) => [kind, amount]),
                    ),
                  },
                  unpriced: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'farmId/warehouseId/ngày không hợp lệ hoặc quá 366 ngày.',
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên, chủ trang trại hoặc quản lý kho.',
  })
  @ApiNotFoundResponse({ description: 'Kho không thuộc trang trại.' })
  async stockReport(
    @Req() request: AuthRequest,
    @Query('farmId') farmIdValue?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const range = requiredRange(dateFrom, dateTo);
    const farmId = requireUuid(farmIdValue, 'farmId');
    const warehouse = warehouseId
      ? requireUuid(warehouseId, 'warehouseId')
      : undefined;
    return {
      data: await this.dashboardService.stockReport(
        farmId,
        range.dateFrom,
        range.dateTo,
        warehouse,
        await this.scope(farmId, request.auth.clerkUserId, warehouse),
      ),
    };
  }
}

import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { requireUuid } from '../../common/query-params';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import {
  STOCK_WRITE_ROLES,
  STORE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';
import type { AuthRequest } from '../auth/clerk/types/auth-request.type';
import { DashboardService } from './dashboard.service';

// Null when the caller's roles do not cover that area (farm operations or store).
const count = { type: 'integer', example: 0, nullable: true };

@Controller('dashboard')
@ApiTags('Tổng quan')
@ApiBearerAuth('clerk-jwt')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseGuards(FarmAccessGuard)
  // Staff data; GUEST members only get the hub links. Fields outside the caller's area come back null.
  @FarmRoles(...new Set([...STOCK_WRITE_ROLES, ...STORE_MANAGE_ROLES]))
  @ApiOperation({ summary: 'Chỉ số tổng quan của trang trại' })
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description:
      'Giá trị tồn = số lượng tồn × giá nhập gần nhất (VND); số lô hết hạn trong 30 ngày tới; đơn hôm nay tính theo giờ Việt Nam.',
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
    return {
      data: await this.dashboardService.summary(
        requireUuid(farmIdValue, 'farmId'),
        request.farmRoleCodes ?? [],
      ),
    };
  }
}

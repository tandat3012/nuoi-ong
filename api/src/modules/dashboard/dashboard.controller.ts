import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { DashboardService } from './dashboard.service';

const count = { type: 'integer', example: 0 };

@Controller('dashboard')
@ApiTags('Tổng quan')
@ApiBearerAuth('clerk-jwt')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseGuards(FarmAccessGuard)
  // Stock value and order counts are staff data; GUEST members only get the hub links.
  @FarmRoles('ADMIN', 'FARM_OWNER', 'EMPLOYEE')
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
            stockValue: { type: 'string', example: '12500000' },
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
    description: 'Chỉ quản trị viên, chủ trang trại hoặc nhân viên.',
  })
  async summary(@Query('farmId') farmIdValue?: string) {
    return {
      data: await this.dashboardService.summary(
        requireUuid(farmIdValue, 'farmId'),
      ),
    };
  }
}

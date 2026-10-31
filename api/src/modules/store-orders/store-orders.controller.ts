import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { storeOrderStatus, storePaymentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import {
  CancelStoreOrderDto,
  StoreOrderShippingFeeDto,
} from './dto/store-order.dto';
import { orderDateRange } from './store-order.query';
import { StoreOrdersService } from './store-orders.service';
import { STORE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';

@Controller('store-orders')
@UseGuards(FarmAccessGuard)
@FarmRoles(...STORE_MANAGE_ROLES)
@ApiTags('Quản lý đơn hàng')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
export class StoreOrdersController {
  constructor(private readonly orders: StoreOrdersService) {}

  @Get()
  list(
    @Query('farmId') farmId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('customerId') customerId?: string,
  ) {
    if (q !== undefined && typeof q !== 'string')
      throw new BadRequestException('q must be a string');
    return this.orders.staffList(requireUuid(farmId, 'farmId'), {
      ...parsePagination(page, pageSize),
      ...orderDateRange(from, to),
      status: parseOptionalEnum(status, storeOrderStatus.enumValues, 'status'),
      paymentStatus: parseOptionalEnum(
        paymentStatus,
        storePaymentStatus.enumValues,
        'paymentStatus',
      ),
      q: normalizeSearch(q),
      customerId: customerId
        ? requireUuid(customerId, 'customerId')
        : undefined,
    });
  }

  @Get('stats')
  async stats(
    @Query('farmId') farmId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return {
      data: await this.orders.stats(
        requireUuid(farmId, 'farmId'),
        orderDateRange(from, to),
      ),
    };
  }

  @Get('customers/:userId')
  async customer(
    @Query('farmId') farmId: string,
    @Param('userId') userId: string,
  ) {
    return {
      data: await this.orders.customerProfile(
        requireUuid(farmId, 'farmId'),
        requireUuid(userId, 'userId'),
      ),
    };
  }

  @Get(':id')
  async get(@Query('farmId') farmId: string, @Param('id') id: string) {
    return {
      data: await this.orders.staffGet(
        requireUuid(farmId, 'farmId'),
        requireUuid(id, 'id'),
      ),
    };
  }

  @Patch(':id/shipping-fee')
  async shippingFee(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: StoreOrderShippingFeeDto,
  ) {
    return {
      data: await this.orders.shippingFee(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
        input.shippingFee,
      ),
    };
  }

  @Post(':id/confirm')
  async confirm(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return {
      data: await this.orders.confirm(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }

  @Post(':id/ship')
  async ship(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return {
      data: await this.orders.ship(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }

  @Post(':id/complete')
  async complete(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return {
      data: await this.orders.complete(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: CancelStoreOrderDto,
  ) {
    return {
      data: await this.orders.staffCancel(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
        input.reason,
      ),
    };
  }

  @Post(':id/mark-paid')
  async markPaid(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return {
      data: await this.orders.markPaid(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }
}

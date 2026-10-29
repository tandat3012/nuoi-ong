import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { parsePagination, requireUuid } from '../../common/query-params';
import { AuthService } from '../auth/accounts/auth.service';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import {
  CancelStoreOrderDto,
  CreateStoreOrderDto,
} from './dto/store-order.dto';
import { StoreOrdersService } from './store-orders.service';

@Controller('store/orders')
@ApiTags('Đơn hàng của tôi')
@ApiBearerAuth('clerk-jwt')
export class CustomerOrdersController {
  constructor(
    private readonly orders: StoreOrdersService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Body() input: CreateStoreOrderDto,
  ) {
    const user = await this.auth.getOrCreateUser(auth.clerkUserId);
    return { data: await this.orders.create(user.id, input) };
  }

  @Get()
  async list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = await this.auth.getOrCreateUser(auth.clerkUserId);
    return this.orders.customerList(user.id, parsePagination(page, pageSize));
  }

  @Get(':id')
  async get(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
  ) {
    const user = await this.auth.getOrCreateUser(auth.clerkUserId);
    return {
      data: await this.orders.customerGet(user.id, requireUuid(id, 'id')),
    };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('id') id: string,
    @Body() input: CancelStoreOrderDto,
  ) {
    const user = await this.auth.getOrCreateUser(auth.clerkUserId);
    return {
      data: await this.orders.customerCancel(
        user.id,
        requireUuid(id, 'id'),
        input.reason,
      ),
    };
  }
}

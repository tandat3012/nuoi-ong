import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { storeWarrantyStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { STORE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';
import {
  CreateStoreWarrantyDto,
  StoreWarrantyActionDto,
} from './dto/store-warranty.dto';
import { StoreWarrantiesService } from './store-warranties.service';

@Controller('store-warranties')
@UseGuards(FarmAccessGuard)
@FarmRoles(...STORE_MANAGE_ROLES)
@ApiTags('Bảo hành sau bán')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
export class StoreWarrantiesController {
  constructor(private readonly warranties: StoreWarrantiesService) {}

  @Get()
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
  ) {
    return this.warranties.list(
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      {
        ...parsePagination(page, pageSize),
        status: parseOptionalEnum(
          status,
          storeWarrantyStatus.enumValues,
          'status',
        ),
        orderId: orderId ? requireUuid(orderId, 'orderId') : undefined,
      },
    );
  }

  @Get(':id')
  async get(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
  ) {
    return {
      data: await this.warranties.get(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
      ),
    };
  }

  @Post()
  @ApiOperation({
    summary:
      'Tiếp nhận yêu cầu bảo hành/sửa có phí cho dòng thiết bị của đơn đã giao',
  })
  async create(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Body() input: CreateStoreWarrantyDto,
  ) {
    return {
      data: await this.warranties.create(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Post(':id/actions')
  @ApiOperation({
    summary:
      'Bước tiếp theo: send, quote, decide, start-repair, back, return, exchange, close, cancel',
  })
  async act(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('id') id: string,
    @Body() input: StoreWarrantyActionDto,
  ) {
    return {
      data: await this.warranties.act(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        requireUuid(id, 'id'),
        input,
      ),
    };
  }
}

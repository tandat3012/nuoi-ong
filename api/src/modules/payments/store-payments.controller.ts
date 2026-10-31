import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { paymentTransactionResult } from '../../db/schema';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { STORE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';
import { SimulatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('store-payments')
@UseGuards(FarmAccessGuard)
@FarmRoles(...STORE_MANAGE_ROLES)
@ApiTags('Thanh toán')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
export class StorePaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(
    @Query('farmId') farmId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('result') result?: string,
  ) {
    return this.payments.list(requireUuid(farmId, 'farmId'), {
      ...parsePagination(page, pageSize),
      result: parseOptionalEnum(
        result,
        paymentTransactionResult.enumValues,
        'result',
      ),
    });
  }

  @Get('simulator')
  async simulator(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
  ) {
    return {
      data: await this.payments.simulator(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Post('simulate')
  async simulate(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Body() input: SimulatePaymentDto,
  ) {
    return {
      data: await this.payments.simulate(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }
}

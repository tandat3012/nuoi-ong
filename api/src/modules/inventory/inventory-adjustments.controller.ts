import { Body, Controller, Post, Query } from '@nestjs/common';
import { requireUuid } from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateInventoryAdjustmentDto } from './dto/create-adjustment.dto';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@Controller('api/v1/inventory/adjustments')
export class InventoryAdjustmentsController {
  constructor(private readonly service: InventoryAdjustmentsService) {}

  @Post()
  async create(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId: string | undefined, @Body() input: CreateInventoryAdjustmentDto) {
    return { data: await this.service.create(requireUuid(farmId, 'farmId'), auth.clerkUserId, input) };
  }
}

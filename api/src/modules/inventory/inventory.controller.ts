import { Controller, Get, Query } from '@nestjs/common';
import { parsePagination, requireUuid } from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { InventoryService } from './inventory.service';

@Controller('api/v1')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory')
  listBalances(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('lotId') lotId?: string,
  ) {
    return this.inventoryService.listBalances({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      warehouseId: warehouseId ? requireUuid(warehouseId, 'warehouseId') : undefined,
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      lotId: lotId ? requireUuid(lotId, 'lotId') : undefined,
    });
  }

  @Get('inventory/transactions')
  listTransactions(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listTransactions({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      warehouseId: warehouseId ? requireUuid(warehouseId, 'warehouseId') : undefined,
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      ...parsePagination(page, pageSize),
    });
  }

  @Get('lots/suggestions')
  lotSuggestions(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.lotSuggestions({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      warehouseId: warehouseId ? requireUuid(warehouseId, 'warehouseId') : undefined,
    });
  }

  @Get('lots')
  listLots(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listLots({
      clerkUserId: auth.clerkUserId,
      farmId: requireUuid(farmId, 'farmId'),
      itemId: itemId ? requireUuid(itemId, 'itemId') : undefined,
      ...parsePagination(page, pageSize),
    });
  }
}

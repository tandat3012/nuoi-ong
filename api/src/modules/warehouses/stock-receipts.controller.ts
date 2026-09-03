import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { parseOptionalEnum, parsePagination, requireUuid } from '../../common/query-params';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { StockReceiptsService } from './stock-receipts.service';

@Controller('api/v1/stock-receipts')
export class StockReceiptsController {
  constructor(private readonly stockReceiptsService: StockReceiptsService) {}

  @Get()
  list(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.stockReceiptsService.listReceipts({ clerkUserId: auth.clerkUserId, farmId: requireUuid(farmId, 'farmId'), ...parsePagination(page, pageSize), status: parseOptionalEnum(status, documentStatus.enumValues, 'status') });
  }

  @Post()
  async create(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId: string | undefined, @Body() input: CreateStockReceiptDto) {
    return { data: await this.stockReceiptsService.createReceipt(requireUuid(farmId, 'farmId'), auth.clerkUserId, input) };
  }

  @Get(':id')
  async get(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) {
    return { data: await this.stockReceiptsService.getReceipt(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) };
  }

  @Patch(':id')
  async update(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId: string | undefined, @Body() input: UpdateStockReceiptDto) {
    return { data: await this.stockReceiptsService.updateReceipt(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId, input) };
  }

  @Post(':id/cancel')
  async cancel(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) {
    return { data: await this.stockReceiptsService.cancelReceipt(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) };
  }

  @Post(':id/confirm')
  async confirm(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) {
    return { data: await this.stockReceiptsService.confirmReceipt(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) };
  }
}

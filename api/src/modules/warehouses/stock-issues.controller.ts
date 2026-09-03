import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { parseOptionalEnum, parsePagination, requireUuid } from '../../common/query-params';
import { documentStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateStockIssueDto } from './dto/create-stock-issue.dto';
import { UpdateStockIssueDto } from './dto/update-stock-issue.dto';
import { StockIssuesService } from './stock-issues.service';

@Controller('api/v1/stock-issues')
export class StockIssuesController {
  constructor(private readonly service: StockIssuesService) {}
  @Get() list(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) { return this.service.list({ clerkUserId: auth.clerkUserId, farmId: requireUuid(farmId, 'farmId'), ...parsePagination(page, pageSize), status: parseOptionalEnum(status, documentStatus.enumValues, 'status') }); }
  @Post() async create(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId: string | undefined, @Body() input: CreateStockIssueDto) { return { data: await this.service.create(requireUuid(farmId, 'farmId'), auth.clerkUserId, input) }; }
  @Get(':id') async get(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.get(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
  @Patch(':id') async update(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId: string | undefined, @Body() input: UpdateStockIssueDto) { return { data: await this.service.update(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId, input) }; }
  @Post(':id/cancel') async cancel(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.cancel(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
  @Post(':id/confirm') async confirm(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.confirm(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { parseOptionalEnum, parsePagination, requireUuid } from '../../common/query-params';
import { maintenanceStatus } from '../../db/schema';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { CreateMaintenanceRecordDto, UpdateMaintenanceRecordDto } from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('api/v1/maintenance-records')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}
  @Get() list(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId?: string, @Query('assetId') assetId?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.service.list({ clerkUserId: auth.clerkUserId, farmId: requireUuid(farmId, 'farmId'), assetId: assetId ? requireUuid(assetId, 'assetId') : undefined, status: parseOptionalEnum(status, maintenanceStatus.enumValues, 'status'), ...parsePagination(page, pageSize) }); }
  @Post() async create(@CurrentAuth() auth: { clerkUserId: string }, @Query('farmId') farmId: string | undefined, @Body() input: CreateMaintenanceRecordDto) { return { data: await this.service.create(requireUuid(farmId, 'farmId'), auth.clerkUserId, input) }; }
  @Get(':id') async get(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.get(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
  @Patch(':id') async update(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId: string | undefined, @Body() input: UpdateMaintenanceRecordDto) { return { data: await this.service.update(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId, input) }; }
  @Post(':id/start') async start(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.start(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
  @Post(':id/complete') async complete(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.complete(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
  @Post(':id/cancel') async cancel(@CurrentAuth() auth: { clerkUserId: string }, @Param('id') id: string, @Query('farmId') farmId?: string) { return { data: await this.service.cancel(requireUuid(id, 'id'), requireUuid(farmId, 'farmId'), auth.clerkUserId) }; }
}

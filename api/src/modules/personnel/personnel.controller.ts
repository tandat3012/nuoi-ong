import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  normalizeSearch,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from '../../common/query-params';
import {
  ApiFarmIdQuery,
  ApiPageQueries,
  ApiSearchQuery,
} from '../../common/swagger-docs';
import { CurrentAuth } from '../auth/clerk/current-auth.decorator';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { AccountProvisioningService } from './account-provisioning.service';
import {
  AddExistingAccountDto,
  CreatePersonnelAccountDto,
  PersonnelRolesDto,
  PersonnelStatusDto,
  PersonnelWarehousesDto,
  WorkProfileDto,
  personnelRoleCodes,
} from './dto/personnel.dto';
import { PersonnelService } from './personnel.service';

@Controller('personnel')
@UseGuards(FarmAccessGuard)
@FarmRoles('ADMIN', 'FARM_OWNER')
@ApiTags('Personnel')
@ApiBearerAuth('clerk-jwt')
@ApiFarmIdQuery()
export class PersonnelController {
  constructor(
    private readonly personnel: PersonnelService,
    private readonly accounts: AccountProvisioningService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List personnel within the managed farm' })
  @ApiPageQueries()
  @ApiSearchQuery()
  list(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.personnel.list(
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      {
        ...parsePagination(page, pageSize),
        search: normalizeSearch(search),
        status: parseOptionalEnum(
          status,
          ['ACTIVE', 'INACTIVE'] as const,
          'status',
        ),
        role: parseOptionalEnum(role, ['ADMIN', ...personnelRoleCodes], 'role'),
        warehouseId: warehouseId
          ? requireUuid(warehouseId, 'warehouseId')
          : undefined,
      },
    );
  }

  @Get('customers')
  @ApiOperation({ summary: 'List signed-in accounts that belong to no farm' })
  @ApiPageQueries()
  @ApiSearchQuery()
  customers(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.personnel.customers(
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      { ...parsePagination(page, pageSize), search: normalizeSearch(search) },
    );
  }

  @Post('accounts')
  @ApiOperation({
    summary: 'Create or resume an employee account with an initial password',
  })
  async createAccount(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Body() input: CreatePersonnelAccountDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { httpStatus, ...result } = await this.accounts.create(
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      input,
    );
    response.status(httpStatus);
    return result;
  }

  @Post('existing-accounts')
  @ApiOperation({
    summary: 'Add an existing account without changing its credentials',
  })
  async addExisting(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Body() input: AddExistingAccountDto,
  ) {
    return {
      data: await this.accounts.addExisting(
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':memberId')
  async detail(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
  ) {
    return {
      data: await this.personnel.detail(
        requireUuid(memberId, 'memberId'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
      ),
    };
  }

  @Patch(':memberId')
  async update(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Body() input: WorkProfileDto,
  ) {
    return {
      data: await this.personnel.updateProfile(
        requireUuid(memberId, 'memberId'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Put(':memberId/roles')
  async roles(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Body() input: PersonnelRolesDto,
  ) {
    return {
      data: await this.personnel.updateRoles(
        requireUuid(memberId, 'memberId'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input.roleCodes,
      ),
    };
  }

  @Put(':memberId/warehouses')
  async workplaces(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Body() input: PersonnelWarehousesDto,
  ) {
    return {
      data: await this.personnel.updateWarehouses(
        requireUuid(memberId, 'memberId'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input.warehouseIds,
      ),
    };
  }

  @Patch(':memberId/status')
  async status(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Body() input: PersonnelStatusDto,
  ) {
    return {
      data: await this.personnel.updateStatus(
        requireUuid(memberId, 'memberId'),
        requireUuid(farmId, 'farmId'),
        auth.clerkUserId,
        input,
      ),
    };
  }

  @Get(':memberId/assets')
  @ApiPageQueries()
  assets(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.personnel.heldAssets(
      requireUuid(memberId, 'memberId'),
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      parsePagination(page, pageSize),
    );
  }

  @Get(':memberId/history')
  @ApiPageQueries()
  history(
    @CurrentAuth() auth: { clerkUserId: string },
    @Query('farmId') farmId: string,
    @Param('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.personnel.history(
      requireUuid(memberId, 'memberId'),
      requireUuid(farmId, 'farmId'),
      auth.clerkUserId,
      parsePagination(page, pageSize),
    );
  }
}

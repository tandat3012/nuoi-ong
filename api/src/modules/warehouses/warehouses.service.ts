import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  farmMemberRoles,
  farmMembers,
  farms,
  inventoryBalances,
  locations,
  recordStatus,
  roles,
  users,
  warehouses,
} from '../../db/schema';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

type WarehouseStatus = (typeof recordStatus.enumValues)[number];

export interface WarehouseListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  search?: string;
  status?: WarehouseStatus;
}

export interface DocumentWriter {
  memberId: string;
  canApprove: boolean;
  /** Only an active FARM_OWNER may set document numbering options. */
  isOwner: boolean;
}

/** Employees may only change or submit stock documents they created. */
export function assertOwnDocument(
  writer: DocumentWriter,
  createdByMemberId: string | null,
) {
  if (!writer.canApprove && createdByMemberId !== writer.memberId) {
    throw new ForbiddenException('Only your own documents can be changed');
  }
}

@Injectable()
export class WarehousesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listWarehouses(filters: WarehouseListFilters) {
    await this.assertFarmAccess(filters.farmId, filters.clerkUserId, false);

    const conditions = [eq(warehouses.farmId, filters.farmId)];
    if (filters.status) conditions.push(eq(warehouses.status, filters.status));
    if (filters.search) {
      const pattern = `%${this.escapeLike(filters.search)}%`;
      conditions.push(
        or(ilike(warehouses.code, pattern), ilike(warehouses.name, pattern))!,
      );
    }

    const [rows, total] = await Promise.all([
      this.databaseService.db
        .select()
        .from(warehouses)
        .where(and(...conditions))
        .orderBy(desc(warehouses.createdAt), warehouses.id)
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(warehouses)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(total[0]?.value ?? 0);
    return {
      data: rows,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async getWarehouse(id: string, farmId: string, clerkUserId: string) {
    await this.assertFarmAccess(farmId, clerkUserId, false);
    const warehouse = await this.findWarehouse(id, farmId);
    return warehouse;
  }

  async createWarehouse(
    farmId: string,
    clerkUserId: string,
    input: CreateWarehouseDto,
  ) {
    await this.assertFarmAccess(farmId, clerkUserId, true);
    try {
      const [warehouse] = await this.databaseService.db
        .insert(warehouses)
        .values({
          farmId,
          code: input.code,
          name: input.name,
          address: input.address,
          description: input.description,
          status: 'ACTIVE',
        })
        .returning();
      return warehouse;
    } catch (error: unknown) {
      this.throwMappedDatabaseError(error);
    }
  }

  async updateWarehouse(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateWarehouseDto,
  ) {
    await this.assertFarmAccess(farmId, clerkUserId, true);
    if (!this.hasDefinedValue(input)) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.findWarehouse(id, farmId);
    if (input.status === 'INACTIVE') {
      await this.assertCanDeactivate(id, farmId);
    }

    const changes: Partial<typeof warehouses.$inferInsert> = {};
    this.assignDefined(changes, 'code', input.code);
    this.assignDefined(changes, 'name', input.name);
    this.assignDefined(changes, 'address', input.address);
    this.assignDefined(changes, 'description', input.description);
    this.assignDefined(changes, 'status', input.status);
    changes.updatedAt = new Date().toISOString();

    try {
      const [warehouse] = await this.databaseService.db
        .update(warehouses)
        .set(changes)
        .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
        .returning();
      return warehouse;
    } catch (error: unknown) {
      this.throwMappedDatabaseError(error);
    }
  }

  async deleteWarehouse(id: string, farmId: string, clerkUserId: string) {
    await this.assertFarmAccess(farmId, clerkUserId, true);
    await this.findWarehouse(id, farmId);
    await this.assertCanDeactivate(id, farmId);

    const [warehouse] = await this.databaseService.db
      .update(warehouses)
      .set({ status: 'INACTIVE', updatedAt: new Date().toISOString() })
      .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
      .returning();
    return warehouse;
  }

  async assertFarmAccess(farmId: string, clerkUserId: string, write: boolean) {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    if (
      write &&
      !roleCodes.some((code) => ['ADMIN', 'FARM_OWNER'].includes(code))
    ) {
      throw new ForbiddenException('Warehouse write permission is required');
    }
    return memberId;
  }

  /** Stock documents: approvers act on any document, employees create and submit their own drafts. */
  async assertDocumentWriter(
    farmId: string,
    clerkUserId: string,
  ): Promise<DocumentWriter> {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    const canApprove = roleCodes.some((code) =>
      ['ADMIN', 'FARM_OWNER'].includes(code),
    );
    if (!canApprove && !roleCodes.includes('EMPLOYEE')) {
      throw new ForbiddenException('Stock document permission is required');
    }
    return { memberId, canApprove, isOwner: roleCodes.includes('FARM_OWNER') };
  }

  /** Active member id plus every role code it holds; throws 403 when not an active member. */
  async getActiveMembership(farmId: string, clerkUserId: string) {
    const memberships = await this.databaseService.db
      .select({
        memberId: farmMembers.id,
        userStatus: users.status,
        memberStatus: farmMembers.status,
        farmStatus: farms.status,
        roleCode: roles.code,
      })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .innerJoin(farms, eq(farms.id, farmMembers.farmId))
      .leftJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(
        and(
          eq(farmMembers.farmId, farmId),
          eq(users.authProviderUserId, clerkUserId),
        ),
      );

    const activeMemberships = memberships.filter(
      (membership) =>
        membership.userStatus === 'ACTIVE' &&
        membership.memberStatus === 'ACTIVE' &&
        membership.farmStatus === 'ACTIVE',
    );
    if (activeMemberships.length === 0) {
      throw new ForbiddenException('Active farm membership is required');
    }
    return {
      memberId: activeMemberships[0].memberId,
      roleCodes: activeMemberships.flatMap(({ roleCode }) =>
        roleCode ? [roleCode] : [],
      ),
    };
  }

  private async findWarehouse(id: string, farmId: string) {
    const [warehouse] = await this.databaseService.db
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
      .limit(1);
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  private async assertCanDeactivate(id: string, farmId: string) {
    const [inventory] = await this.databaseService.db
      .select({
        quantity: sql<string>`COALESCE(SUM(${inventoryBalances.quantityOnHand}), 0)`,
      })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, farmId),
          eq(inventoryBalances.warehouseId, id),
        ),
      );
    if (Number(inventory?.quantity ?? 0) > 0) {
      throw new ConflictException('WAREHOUSE_NOT_EMPTY');
    }

    const [assetCustody] = await this.databaseService.db
      .select({ value: count() })
      .from(assets)
      .innerJoin(locations, eq(locations.id, assets.currentLocationId))
      .where(and(eq(assets.farmId, farmId), eq(locations.warehouseId, id)));
    if (Number(assetCustody?.value ?? 0) > 0) {
      throw new ConflictException('WAREHOUSE_NOT_EMPTY');
    }
  }

  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private hasDefinedValue(input: UpdateWarehouseDto) {
    return Object.values(input).some((value) => value !== undefined);
  }

  private assignDefined<T extends keyof typeof warehouses.$inferInsert>(
    target: Partial<typeof warehouses.$inferInsert>,
    key: T,
    value: (typeof warehouses.$inferInsert)[T] | undefined,
  ) {
    if (value !== undefined) target[key] = value;
  }

  private throwMappedDatabaseError(error: unknown): never {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    const code = databaseError?.code ?? databaseError?.cause?.code;
    if (code === '23505')
      throw new ConflictException('Warehouse code already exists');
    throw error;
  }
}

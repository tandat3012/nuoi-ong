import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  auditLogs,
  assets,
  farmMemberRoles,
  farmMemberWarehouses,
  farmMembers,
  farms,
  inventoryBalances,
  locations,
  recordStatus,
  roles,
  storeSettings,
  storeSourceWarehouses,
  users,
  warehouses,
} from '../../db/schema';
import {
  FARM_ADMIN_ROLES,
  FARM_AREA_ROLES,
  STOCK_WRITE_ROLES,
  WAREHOUSE_MANAGE_ROLES,
  WAREHOUSE_SCOPED_ROLES,
  hasAnyRole,
} from '../auth/farm-access/farm-role-groups';
import {
  assertInScope,
  inScope,
  scopeCondition,
  type WarehouseScope,
} from './warehouse-scope';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

type WarehouseStatus = (typeof recordStatus.enumValues)[number];
type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

export interface WarehouseListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  search?: string;
  status?: WarehouseStatus;
  /** Transfer destinations: every warehouse of the farm, also for members limited to theirs. */
  destination?: boolean;
  /** The farm's store source warehouses, for a store manager choosing where to restock from. */
  source?: boolean;
}

export interface DocumentWriter {
  memberId: string;
  canApprove: boolean;
  /** Warehouses the writer works in; null = all. */
  scope: WarehouseScope;
  /** Only an active FARM_OWNER may set document numbering options. */
  isOwner: boolean;
  /** A store manager without a stock role: documents of the sales warehouse only. */
  salesOnly: boolean;
}

/**
 * Employees may only change or submit stock documents they created, and
 * everyone limited to assigned warehouses only documents of those warehouses.
 */
export function assertOwnDocument(
  writer: DocumentWriter,
  createdByMemberId: string | null,
  ...warehouseIds: (string | null | undefined)[]
) {
  if (!writer.canApprove && createdByMemberId !== writer.memberId) {
    throw new ForbiddenException('Only your own documents can be changed');
  }
  assertInScope(writer.scope, ...warehouseIds);
}

@Injectable()
export class WarehousesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listWarehouses(filters: WarehouseListFilters) {
    const { memberId, roleCodes } = await this.getActiveMembership(
      filters.farmId,
      filters.clerkUserId,
    );
    const memberScope = await this.scopeFor(
      filters.farmId,
      memberId,
      roleCodes,
    );
    const storeOnly =
      (await this.storeOnlyScope(
        filters.farmId,
        roleCodes,
        FARM_AREA_ROLES,
      )) !== undefined;
    // Stock and assets may be sent to any warehouse of the farm; only the source is limited.
    // A store manager only ever sends into the sales warehouse, and picks sources among the marked ones.
    const scope =
      (filters.destination && !storeOnly) || filters.source
        ? null
        : memberScope;

    const conditions = [eq(warehouses.farmId, filters.farmId)];
    const inScope = scopeCondition(warehouses.id, scope);
    if (inScope) conditions.push(inScope);
    if (filters.source)
      conditions.push(
        inArray(
          warehouses.id,
          this.databaseService.db
            .select({ id: storeSourceWarehouses.warehouseId })
            .from(storeSourceWarehouses)
            .where(eq(storeSourceWarehouses.farmId, filters.farmId)),
        ),
      );
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
    const scope = await this.warehouseScope(farmId, clerkUserId);
    const warehouse = await this.findWarehouse(id, farmId);
    if (scope && !scope.includes(id))
      throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async createWarehouse(
    farmId: string,
    clerkUserId: string,
    input: CreateWarehouseDto,
  ) {
    await this.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const [warehouse] = await tx
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
        await this.auditWarehouse(
          tx,
          clerkUserId,
          'WAREHOUSE_CREATED',
          null,
          warehouse,
        );
        return warehouse;
      });
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
    const { scope } = await this.assertScopedAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    if (!this.hasDefinedValue(input)) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.findWarehouse(id, farmId);
    assertInScope(scope, id);

    const changes: Partial<typeof warehouses.$inferInsert> = {};
    this.assignDefined(changes, 'code', input.code);
    this.assignDefined(changes, 'name', input.name);
    this.assignDefined(changes, 'address', input.address);
    this.assignDefined(changes, 'description', input.description);
    this.assignDefined(changes, 'status', input.status);
    changes.updatedAt = new Date().toISOString();

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const before = await this.lockWarehouse(tx, id, farmId);
        if (input.status === 'INACTIVE' && before.status !== 'INACTIVE')
          await this.assertCanDeactivate(id, farmId, tx);
        const [warehouse] = await tx
          .update(warehouses)
          .set(changes)
          .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
          .returning();
        await this.auditWarehouse(
          tx,
          clerkUserId,
          before.status === 'ACTIVE' && warehouse.status === 'INACTIVE'
            ? 'WAREHOUSE_DEACTIVATED'
            : 'WAREHOUSE_UPDATED',
          before,
          warehouse,
        );
        return warehouse;
      });
    } catch (error: unknown) {
      this.throwMappedDatabaseError(error);
    }
  }

  async deleteWarehouse(id: string, farmId: string, clerkUserId: string) {
    const { scope } = await this.assertScopedAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    await this.findWarehouse(id, farmId);
    assertInScope(scope, id);

    return this.databaseService.db.transaction(async (tx) => {
      const before = await this.lockWarehouse(tx, id, farmId);
      await this.assertCanDeactivate(id, farmId, tx);
      const [warehouse] = await tx
        .update(warehouses)
        .set({ status: 'INACTIVE', updatedAt: new Date().toISOString() })
        .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
        .returning();
      // A retried deactivation changes nothing and logs nothing.
      if (before.status !== 'INACTIVE')
        await this.auditWarehouse(
          tx,
          clerkUserId,
          'WAREHOUSE_DEACTIVATED',
          before,
          warehouse,
        );
      return warehouse;
    });
  }

  /** NV08: who created, changed or deactivated a warehouse, in the same transaction. */
  private async auditWarehouse(
    tx: Transaction,
    clerkUserId: string,
    action: 'WAREHOUSE_CREATED' | 'WAREHOUSE_UPDATED' | 'WAREHOUSE_DEACTIVATED',
    before: typeof warehouses.$inferSelect | null,
    after: typeof warehouses.$inferSelect,
  ) {
    await tx.insert(auditLogs).values({
      farmId: after.farmId,
      userId: sql`(SELECT id FROM users WHERE auth_provider_user_id = ${clerkUserId})`,
      action,
      entityType: 'WAREHOUSE',
      entityId: after.id,
      oldData: before,
      newData: after,
    });
  }

  private async lockWarehouse(tx: Transaction, id: string, farmId: string) {
    const [warehouse] = await tx
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId)))
      .for('update');
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  /** Management callers pass WAREHOUSE_MANAGE_ROLES; the default stays owner/admin only. */
  async assertFarmAccess(
    farmId: string,
    clerkUserId: string,
    write: boolean,
    writeRoles = FARM_ADMIN_ROLES,
  ) {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    if (write && !hasAnyRole(roleCodes, writeRoles)) {
      throw new ForbiddenException('Warehouse write permission is required');
    }
    return memberId;
  }

  /**
   * Who may read which stock documents: approvers read every document of their
   * warehouses (`memberId` null), others only their own; `scope` limits warehouses.
   */
  async documentReadScope(
    farmId: string,
    clerkUserId: string,
  ): Promise<{
    memberId: string | null;
    viewerId: string;
    scope: WarehouseScope;
  }> {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );

    return {
      memberId: hasAnyRole(roleCodes, WAREHOUSE_MANAGE_ROLES) ? null : memberId,
      viewerId: memberId,
      scope: await this.scopeFor(farmId, memberId, roleCodes),
    };
  }

  /**
   * Warehouses the caller works in; null = every warehouse of the farm.
   * `sourceId`: a store manager may also read stock of that store source warehouse.
   */
  async warehouseScope(
    farmId: string,
    clerkUserId: string,
    sourceId?: string,
  ): Promise<WarehouseScope> {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    const scope = await this.scopeFor(farmId, memberId, roleCodes);
    if (
      scope &&
      sourceId &&
      (await this.storeOnlyScope(farmId, roleCodes, FARM_AREA_ROLES)) &&
      (await this.isSourceWarehouse(farmId, sourceId))
    )
      return [...scope, sourceId];
    return scope;
  }

  async isSourceWarehouse(farmId: string, warehouseId: string) {
    const [row] = await this.databaseService.db
      .select({ id: storeSourceWarehouses.warehouseId })
      .from(storeSourceWarehouses)
      .where(
        and(
          eq(storeSourceWarehouses.farmId, farmId),
          eq(storeSourceWarehouses.warehouseId, warehouseId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** A store manager restocks the sales warehouse only, from store source warehouses. */
  async assertSalesRestock(
    writer: DocumentWriter,
    farmId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
  ) {
    if (
      !inScope(writer.scope, toWarehouseId) ||
      !(await this.isSourceWarehouse(farmId, fromWarehouseId))
    )
      throw new ForbiddenException(
        'Store managers can only transfer from a source warehouse into the sales warehouse',
      );
  }

  /** assertFarmAccess plus the caller's warehouse scope. */
  async assertScopedAccess(
    farmId: string,
    clerkUserId: string,
    write: boolean,
    writeRoles = FARM_ADMIN_ROLES,
  ) {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    if (write && !hasAnyRole(roleCodes, writeRoles)) {
      throw new ForbiddenException('Warehouse write permission is required');
    }
    return {
      memberId,
      scope: await this.scopeFor(farmId, memberId, roleCodes),
    };
  }

  /** 403 unless one of the warehouses is assigned to the caller (or the caller is not limited). */
  async assertWarehouseInScope(
    farmId: string,
    clerkUserId: string,
    ...warehouseIds: (string | null | undefined)[]
  ) {
    assertInScope(
      await this.warehouseScope(farmId, clerkUserId),
      ...warehouseIds,
    );
  }

  /**
   * ADMIN/FARM_OWNER and roles outside warehouse work are not limited; managers and employees
   * get their assigned warehouses; a store manager with no farm-area role gets the sales warehouse.
   */
  private async scopeFor(
    farmId: string,
    memberId: string,
    roleCodes: string[],
  ): Promise<WarehouseScope> {
    if (hasAnyRole(roleCodes, FARM_ADMIN_ROLES)) return null;
    const storeScope = await this.storeOnlyScope(
      farmId,
      roleCodes,
      FARM_AREA_ROLES,
    );
    if (storeScope) return storeScope;
    if (!hasAnyRole(roleCodes, WAREHOUSE_SCOPED_ROLES)) return null;
    const rows = await this.databaseService.db
      .select({ id: farmMemberWarehouses.warehouseId })
      .from(farmMemberWarehouses)
      .where(eq(farmMemberWarehouses.farmMemberId, memberId));
    return rows.map((row) => row.id);
  }

  /** Store managers holding none of `otherRoles` work only in the sales warehouse; undefined for everyone else. */
  private async storeOnlyScope(
    farmId: string,
    roleCodes: string[],
    otherRoles = STOCK_WRITE_ROLES,
  ): Promise<string[] | undefined> {
    if (
      !roleCodes.includes('STORE_MANAGER') ||
      hasAnyRole(roleCodes, otherRoles)
    )
      return undefined;
    const [settings] = await this.databaseService.db
      .select({ id: storeSettings.salesWarehouseId })
      .from(storeSettings)
      .where(eq(storeSettings.farmId, farmId))
      .limit(1);
    return settings?.id ? [settings.id] : [];
  }

  /**
   * Stock documents: approvers act on any document, employees create and submit their own drafts.
   * `allowStoreSales` lets a store manager write documents of the sales warehouse (receipts only).
   */
  async assertDocumentWriter(
    farmId: string,
    clerkUserId: string,
    allowStoreSales = false,
  ): Promise<DocumentWriter> {
    const { memberId, roleCodes } = await this.getActiveMembership(
      farmId,
      clerkUserId,
    );
    const canApprove = hasAnyRole(roleCodes, WAREHOUSE_MANAGE_ROLES);
    const storeScope = allowStoreSales
      ? await this.storeOnlyScope(farmId, roleCodes)
      : undefined;
    if (!storeScope && !hasAnyRole(roleCodes, STOCK_WRITE_ROLES)) {
      throw new ForbiddenException('Stock document permission is required');
    }
    return {
      memberId,
      canApprove,
      scope: storeScope ?? (await this.scopeFor(farmId, memberId, roleCodes)),
      isOwner: roleCodes.includes('FARM_OWNER'),
      salesOnly: Boolean(storeScope),
    };
  }

  /** Active member id plus every role code it holds; throws 403 when not an active member. */
  async getActiveMembership(farmId: string, clerkUserId: string) {
    const memberships = await this.databaseService.db
      .select({
        memberId: farmMembers.id,
        userId: users.id,
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
      userId: activeMemberships[0].userId,
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

  private async assertCanDeactivate(
    id: string,
    farmId: string,
    db: Pick<DatabaseService['db'], 'select'> = this.databaseService.db,
  ) {
    const [inventory] = await db
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

    const [assetCustody] = await db
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

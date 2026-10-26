import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assetAssignments,
  assets,
  auditLogs,
  farmMemberRoles,
  farmMembers,
  farmMemberWarehouses,
  farms,
  items,
  personnelAccountProvisions,
  roles,
  users,
  warehouses,
} from '../../db/schema';
import {
  AddExistingAccountDto,
  PersonnelStatusDto,
  WorkProfileDto,
  personnelRoleCodes,
} from './dto/personnel.dto';

type Db = DatabaseService['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;
export type PersonnelIdentity = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};
type Manager = { userId: string; memberId: string; roleCodes: string[] };
const profileColumns = {
  memberId: farmMembers.id,
  fullName: users.fullName,
  email: users.email,
  employeeCode: farmMembers.employeeCode,
  jobTitle: farmMembers.jobTitle,
  membershipStatus: farmMembers.status,
  accountStatus: users.status,
  phone: farmMembers.phone,
  note: farmMembers.note,
  joinedAt: farmMembers.joinedAt,
};

@Injectable()
export class PersonnelService {
  constructor(private readonly database: DatabaseService) {}

  async assertManager(
    farmId: string,
    clerkUserId: string,
    db: Executor = this.database.db,
  ): Promise<Manager> {
    const rows = await db
      .select({
        userId: users.id,
        memberId: farmMembers.id,
        roleCode: roles.code,
      })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .innerJoin(farms, eq(farms.id, farmMembers.farmId))
      .innerJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(
        and(
          eq(farms.id, farmId),
          eq(farms.status, 'ACTIVE'),
          eq(farmMembers.status, 'ACTIVE'),
          eq(users.status, 'ACTIVE'),
          eq(users.authProviderUserId, clerkUserId),
        ),
      );
    if (
      !rows.some(
        (row) => row.roleCode === 'ADMIN' || row.roleCode === 'FARM_OWNER',
      )
    )
      throw new ForbiddenException({
        code: 'PERSONNEL_FORBIDDEN',
        message: 'Farm management permission is required.',
      });
    return {
      userId: rows[0].userId,
      memberId: rows[0].memberId,
      roleCodes: rows.map((row) => row.roleCode),
    };
  }

  async list(
    farmId: string,
    clerkUserId: string,
    filters: PaginationParams & {
      search?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      role?: string;
      warehouseId?: string;
    },
  ) {
    await this.assertManager(farmId, clerkUserId);
    const conditions = [eq(farmMembers.farmId, farmId)];
    if (filters.status) conditions.push(eq(farmMembers.status, filters.status));
    if (filters.search) {
      const pattern = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        or(
          ilike(users.fullName, pattern),
          ilike(users.email, pattern),
          ilike(farmMembers.employeeCode, pattern),
        )!,
      );
    }
    if (filters.role)
      conditions.push(
        exists(
          this.database.db
            .select({ id: farmMemberRoles.roleId })
            .from(farmMemberRoles)
            .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId))
            .where(
              and(
                eq(farmMemberRoles.farmMemberId, farmMembers.id),
                eq(roles.code, filters.role),
              ),
            ),
        ),
      );
    if (filters.warehouseId)
      conditions.push(
        exists(
          this.database.db
            .select({ id: farmMemberWarehouses.warehouseId })
            .from(farmMemberWarehouses)
            .where(
              and(
                eq(farmMemberWarehouses.farmMemberId, farmMembers.id),
                eq(farmMemberWarehouses.warehouseId, filters.warehouseId),
              ),
            ),
        ),
      );
    const [rows, totals] = await Promise.all([
      this.database.db
        .select(profileColumns)
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(and(...conditions))
        .orderBy(asc(users.fullName), asc(farmMembers.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.database.db
        .select({ value: count() })
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(and(...conditions)),
    ]);
    const hydrated = await this.hydrate(this.database.db, rows);
    const totalItems = Number(totals[0]?.value ?? 0);
    return {
      data: hydrated.map((row) => ({
        memberId: row.memberId,
        fullName: row.fullName,
        email: row.email,
        employeeCode: row.employeeCode,
        jobTitle: row.jobTitle,
        membershipStatus: row.membershipStatus,
        accountStatus: row.accountStatus,
        roleCodes: row.roleCodes,
        warehouses: row.warehouses,
      })),
      page: this.page(filters, totalItems),
    };
  }

  // Signed-in accounts that belong to no farm are storefront customers.
  async customers(
    farmId: string,
    clerkUserId: string,
    filters: PaginationParams & { search?: string },
  ) {
    await this.assertManager(farmId, clerkUserId);
    const conditions = [
      sql`not exists (select 1 from ${farmMembers} where ${farmMembers.userId} = ${users.id})`,
    ];
    if (filters.search) {
      const pattern = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        or(ilike(users.fullName, pattern), ilike(users.email, pattern))!,
      );
    }
    const [data, totals] = await Promise.all([
      this.database.db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          accountStatus: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(desc(users.createdAt), asc(users.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.database.db
        .select({ value: count() })
        .from(users)
        .where(and(...conditions)),
    ]);
    return {
      data,
      page: this.page(filters, Number(totals[0]?.value ?? 0)),
    };
  }

  async detail(memberId: string, farmId: string, clerkUserId: string) {
    await this.assertManager(farmId, clerkUserId);
    return this.readDetail(this.database.db, memberId, farmId);
  }

  private async hydrate<T extends { memberId: string }>(
    db: Executor,
    rows: T[],
  ) {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.memberId);
    const [roleRows, workplaceRows] = await Promise.all([
      db
        .select({ memberId: farmMemberRoles.farmMemberId, code: roles.code })
        .from(farmMemberRoles)
        .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId))
        .where(inArray(farmMemberRoles.farmMemberId, ids))
        .orderBy(roles.code),
      db
        .select({
          memberId: farmMemberWarehouses.farmMemberId,
          id: warehouses.id,
          code: warehouses.code,
          name: warehouses.name,
          status: warehouses.status,
        })
        .from(farmMemberWarehouses)
        .innerJoin(
          warehouses,
          eq(warehouses.id, farmMemberWarehouses.warehouseId),
        )
        .where(inArray(farmMemberWarehouses.farmMemberId, ids))
        .orderBy(warehouses.name, warehouses.id),
    ]);
    return rows.map((row) => ({
      ...row,
      roleCodes: roleRows
        .filter((r) => r.memberId === row.memberId)
        .map((r) => r.code),
      warehouses: workplaceRows
        .filter((w) => w.memberId === row.memberId)
        .map(({ id, code, name, status }) => ({ id, code, name, status })),
    }));
  }

  private async readDetail(db: Executor, memberId: string, farmId: string) {
    const rows = await db
      .select(profileColumns)
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(and(eq(farmMembers.id, memberId), eq(farmMembers.farmId, farmId)));
    if (!rows.length)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this farm.',
      });
    const [detail] = await this.hydrate(db, rows);
    const [held] = await db
      .select({ value: count() })
      .from(assetAssignments)
      .where(
        and(
          eq(assetAssignments.farmId, farmId),
          eq(assetAssignments.assignedToMemberId, memberId),
          eq(assetAssignments.status, 'ACTIVE'),
        ),
      );
    return { ...detail, heldAssetCount: Number(held.value) };
  }

  async validateCreation(
    farmId: string,
    clerkUserId: string,
    input: AddExistingAccountDto,
  ) {
    const actor = await this.assertManager(farmId, clerkUserId);
    await this.validateAssignments(
      this.database.db,
      farmId,
      actor,
      input.roleCodes,
      input.warehouseIds,
    );
    if (input.employeeCode) {
      const [duplicate] = await this.database.db
        .select({ id: farmMembers.id })
        .from(farmMembers)
        .where(
          and(
            eq(farmMembers.farmId, farmId),
            sql`lower(${farmMembers.employeeCode}) = ${input.employeeCode.toLowerCase()}`,
          ),
        );
      if (duplicate)
        throw new ConflictException({
          code: 'EMPLOYEE_CODE_EXISTS',
          message: 'Employee code already exists in this farm.',
        });
    }
    return actor;
  }

  async createMembership(
    farmId: string,
    clerkUserId: string,
    input: AddExistingAccountDto,
    identity: PersonnelIdentity,
    provisionId?: string,
  ) {
    try {
      return await this.database.db.transaction(async (tx) => {
        await this.lockFarm(tx, farmId);
        const actor = await this.assertManager(farmId, clerkUserId, tx);
        if (provisionId) {
          const [provision] = await tx
            .select()
            .from(personnelAccountProvisions)
            .where(eq(personnelAccountProvisions.id, provisionId))
            .for('update');
          if (
            !provision ||
            provision.farmId !== farmId ||
            provision.actorUserId !== actor.userId ||
            provision.clerkUserId !== identity.id
          )
            throw new ConflictException({
              code: 'IDENTITY_CONFLICT',
              message: 'The account provision does not match this membership.',
            });
          if (provision.memberId)
            return this.readDetail(tx, provision.memberId, farmId);
        }
        await this.validateAssignments(
          tx,
          farmId,
          actor,
          input.roleCodes,
          input.warehouseIds,
        );
        const [known] = await tx
          .select()
          .from(users)
          .where(eq(users.authProviderUserId, identity.id));
        let user = known;
        if (!user) {
          const [created] = await tx
            .insert(users)
            .values({
              authProviderUserId: identity.id,
              email: identity.email,
              fullName: identity.fullName,
              avatarUrl: identity.avatarUrl,
              mustChangePassword: !!provisionId,
            })
            .onConflictDoNothing()
            .returning();
          if (created) user = created;
          else
            [user] = await tx
              .select()
              .from(users)
              .where(eq(users.authProviderUserId, identity.id));
        }
        if (!user || user.authProvider !== 'CLERK')
          throw new ConflictException({
            code: 'ACCOUNT_CONFLICT',
            message: 'The identity cannot be linked safely.',
          });
        if (user.status !== 'ACTIVE')
          throw new ConflictException({
            code: 'ACCOUNT_INACTIVE',
            message: 'The account is inactive.',
          });
        const [existing] = await tx
          .select()
          .from(farmMembers)
          .where(
            and(
              eq(farmMembers.farmId, farmId),
              eq(farmMembers.userId, user.id),
            ),
          );
        if (existing)
          throw new ConflictException({
            code:
              existing.status === 'ACTIVE'
                ? 'MEMBER_ALREADY_EXISTS'
                : 'MEMBER_INACTIVE',
            message:
              existing.status === 'ACTIVE'
                ? 'This person is already a member.'
                : 'Reactivate the existing membership instead.',
          });
        if (provisionId)
          await tx
            .update(users)
            .set({ mustChangePassword: true })
            .where(eq(users.id, user.id));
        const [member] = await tx
          .insert(farmMembers)
          .values({ farmId, userId: user.id, ...this.workProfile(input) })
          .returning();
        await this.replaceRoles(tx, member.id, input.roleCodes);
        await this.replaceWarehouses(tx, member.id, input.warehouseIds);
        const detail = await this.readDetail(tx, member.id, farmId);
        await this.audit(
          tx,
          farmId,
          actor.userId,
          member.id,
          'PERSONNEL_ADDED',
          null,
          this.auditProfile(detail),
        );
        if (provisionId)
          await tx
            .update(personnelAccountProvisions)
            .set({
              memberId: member.id,
              status: 'MEMBERSHIP_CREATED',
              errorCode: null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(personnelAccountProvisions.id, provisionId));
        return detail;
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  updateProfile(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    input: WorkProfileDto,
  ) {
    const changes = this.workProfile(input, true);
    if (!Object.keys(changes).length)
      throw new BadRequestException('Provide at least one work profile field.');
    return this.mutate(
      memberId,
      farmId,
      clerkUserId,
      'PERSONNEL_PROFILE_CHANGED',
      async (tx) => {
        await tx
          .update(farmMembers)
          .set({ ...changes, updatedAt: new Date().toISOString() })
          .where(eq(farmMembers.id, memberId));
      },
    );
  }

  updateRoles(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    roleCodes: string[],
  ) {
    return this.mutate(
      memberId,
      farmId,
      clerkUserId,
      'PERSONNEL_ROLES_CHANGED',
      async (tx, actor, target) => {
        this.assertNotSelf(actor, memberId);
        await this.validateAssignments(tx, farmId, actor, roleCodes);
        await this.protectLastOwner(
          tx,
          farmId,
          target,
          roleCodes,
          target.membershipStatus,
        );
        await this.replaceRoles(tx, memberId, roleCodes);
      },
    );
  }

  updateWarehouses(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    warehouseIds: string[],
  ) {
    return this.mutate(
      memberId,
      farmId,
      clerkUserId,
      'PERSONNEL_WORKPLACES_CHANGED',
      async (tx, actor) => {
        await this.validateAssignments(
          tx,
          farmId,
          actor,
          undefined,
          warehouseIds,
        );
        await this.replaceWarehouses(tx, memberId, warehouseIds);
      },
    );
  }

  updateStatus(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    input: PersonnelStatusDto,
  ) {
    return this.mutate(
      memberId,
      farmId,
      clerkUserId,
      'PERSONNEL_STATUS_CHANGED',
      async (tx, actor, target) => {
        this.assertNotSelf(actor, memberId);
        if (target.membershipStatus === input.status)
          throw new ConflictException({
            code: 'STATUS_UNCHANGED',
            message: 'The member already has this status.',
          });
        if (input.status === 'ACTIVE') {
          if (!input.roleCodes || !input.warehouseIds)
            throw new BadRequestException(
              'Confirm roleCodes and warehouseIds before reactivating.',
            );
          if (target.accountStatus !== 'ACTIVE')
            throw new ConflictException({
              code: 'ACCOUNT_INACTIVE',
              message: 'The global account is inactive.',
            });
          await this.validateAssignments(
            tx,
            farmId,
            actor,
            input.roleCodes,
            input.warehouseIds,
          );
          await this.replaceRoles(tx, memberId, input.roleCodes);
          await this.replaceWarehouses(tx, memberId, input.warehouseIds);
        } else {
          if (input.roleCodes || input.warehouseIds)
            throw new BadRequestException(
              'Role and workplace changes require their own operation.',
            );
          await this.protectLastOwner(
            tx,
            farmId,
            target,
            target.roleCodes,
            'INACTIVE',
          );
        }
        await tx
          .update(farmMembers)
          .set({ status: input.status, updatedAt: new Date().toISOString() })
          .where(eq(farmMembers.id, memberId));
      },
      input.reason,
    );
  }

  private async mutate(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    action: string,
    change: (
      tx: Tx,
      actor: Manager,
      target: Awaited<ReturnType<PersonnelService['readDetail']>>,
    ) => Promise<void>,
    reason?: string | null,
  ) {
    try {
      return await this.database.db.transaction(async (tx) => {
        await this.lockFarm(tx, farmId);
        const actor = await this.assertManager(farmId, clerkUserId, tx);
        const before = await this.readDetail(tx, memberId, farmId);
        if (
          !actor.roleCodes.includes('ADMIN') &&
          before.roleCodes.some((r) => r === 'ADMIN' || r === 'FARM_OWNER')
        )
          throw new ForbiddenException({
            code: 'TARGET_ROLE_PROTECTED',
            message: 'Only a farm admin may manage this membership.',
          });
        await change(tx, actor, before);
        const after = await this.readDetail(tx, memberId, farmId);
        await this.audit(
          tx,
          farmId,
          actor.userId,
          memberId,
          action,
          this.auditProfile(before),
          { ...this.auditProfile(after), ...(reason ? { reason } : {}) },
        );
        return after;
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  private assertNotSelf(actor: Manager, memberId: string) {
    if (actor.memberId === memberId)
      throw new ForbiddenException({
        code: 'SELF_CHANGE_FORBIDDEN',
        message: 'You cannot change your own roles or membership status.',
      });
  }

  private async protectLastOwner(
    tx: Tx,
    farmId: string,
    target: {
      roleCodes: string[];
      membershipStatus: string;
      accountStatus: string;
    },
    nextRoles: string[],
    nextStatus: string,
  ) {
    if (
      !target.roleCodes.includes('FARM_OWNER') ||
      target.membershipStatus !== 'ACTIVE' ||
      target.accountStatus !== 'ACTIVE' ||
      (nextRoles.includes('FARM_OWNER') && nextStatus === 'ACTIVE')
    )
      return;
    const [owners] = await tx
      .select({ value: count() })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(
        and(
          eq(farmMembers.farmId, farmId),
          eq(farmMembers.status, 'ACTIVE'),
          eq(users.status, 'ACTIVE'),
          exists(
            tx
              .select({ id: farmMemberRoles.roleId })
              .from(farmMemberRoles)
              .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId))
              .where(
                and(
                  eq(farmMemberRoles.farmMemberId, farmMembers.id),
                  eq(roles.code, 'FARM_OWNER'),
                ),
              ),
          ),
        ),
      );
    if (Number(owners.value) <= 1)
      throw new ConflictException({
        code: 'LAST_FARM_OWNER',
        message: 'The farm must retain an active owner.',
      });
  }

  private async lockFarm(tx: Tx, farmId: string) {
    await tx
      .select({ id: farms.id })
      .from(farms)
      .where(eq(farms.id, farmId))
      .for('update');
  }

  private async validateAssignments(
    db: Executor,
    farmId: string,
    actor: Manager,
    roleCodes?: string[],
    warehouseIds?: string[],
  ) {
    if (roleCodes) {
      if (
        !roleCodes.length ||
        new Set(roleCodes).size !== roleCodes.length ||
        roleCodes.some(
          (r) =>
            !personnelRoleCodes.includes(
              r as (typeof personnelRoleCodes)[number],
            ),
        )
      )
        throw new BadRequestException('Invalid role set.');
      if (
        roleCodes.includes('FARM_OWNER') &&
        !actor.roleCodes.includes('ADMIN')
      )
        throw new ForbiddenException({
          code: 'ROLE_NOT_ASSIGNABLE',
          message: 'Only a farm admin may assign farm owners.',
        });
      const found = await db
        .select({ code: roles.code })
        .from(roles)
        .where(and(inArray(roles.code, roleCodes), eq(roles.scope, 'FARM')));
      if (found.length !== roleCodes.length)
        throw new BadRequestException('A requested farm role is unavailable.');
    }
    if (warehouseIds?.length) {
      const found = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.farmId, farmId),
            eq(warehouses.status, 'ACTIVE'),
            inArray(warehouses.id, warehouseIds),
          ),
        )
        .for('share');
      if (found.length !== warehouseIds.length)
        throw new BadRequestException({
          code: 'INVALID_WORKPLACE',
          message:
            'Workplaces must be active warehouses in this farm, without duplicates.',
        });
    }
  }

  private async replaceRoles(tx: Tx, memberId: string, roleCodes: string[]) {
    const found = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(inArray(roles.code, roleCodes), eq(roles.scope, 'FARM')));
    // System grants (including legacy membership ADMIN) are outside personnel management.
    await tx
      .delete(farmMemberRoles)
      .where(
        and(
          eq(farmMemberRoles.farmMemberId, memberId),
          inArray(
            farmMemberRoles.roleId,
            tx
              .select({ id: roles.id })
              .from(roles)
              .where(eq(roles.scope, 'FARM')),
          ),
        ),
      );
    await tx
      .insert(farmMemberRoles)
      .values(
        found.map((role) => ({ farmMemberId: memberId, roleId: role.id })),
      );
  }

  private async replaceWarehouses(
    tx: Tx,
    memberId: string,
    warehouseIds: string[],
  ) {
    await tx
      .delete(farmMemberWarehouses)
      .where(eq(farmMemberWarehouses.farmMemberId, memberId));
    if (warehouseIds.length)
      await tx.insert(farmMemberWarehouses).values(
        warehouseIds.map((warehouseId) => ({
          farmMemberId: memberId,
          warehouseId,
        })),
      );
  }

  private workProfile(input: WorkProfileDto, patch = false) {
    const result: Partial<
      Pick<
        typeof farmMembers.$inferInsert,
        'employeeCode' | 'jobTitle' | 'phone' | 'note'
      >
    > = {};
    for (const key of ['employeeCode', 'jobTitle', 'phone', 'note'] as const)
      if (!patch || input[key] !== undefined)
        result[key] = input[key]?.trim() || null;
    return result;
  }

  private auditProfile(
    detail: Awaited<ReturnType<PersonnelService['readDetail']>>,
  ) {
    return {
      employeeCode: detail.employeeCode,
      jobTitle: detail.jobTitle,
      phone: detail.phone,
      note: detail.note,
      membershipStatus: detail.membershipStatus,
      roleCodes: detail.roleCodes,
      warehouseIds: detail.warehouses.map((w) => w.id),
    };
  }

  private async audit(
    tx: Tx,
    farmId: string,
    userId: string,
    memberId: string,
    action: string,
    oldData: unknown,
    newData: unknown,
  ) {
    await tx.insert(auditLogs).values({
      farmId,
      userId,
      entityType: 'PERSONNEL',
      entityId: memberId,
      action,
      oldData,
      newData,
    });
  }

  async heldAssets(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    pagination: PaginationParams,
  ) {
    await this.detail(memberId, farmId, clerkUserId);
    const condition = and(
      eq(assetAssignments.farmId, farmId),
      eq(assetAssignments.assignedToMemberId, memberId),
      eq(assetAssignments.status, 'ACTIVE'),
    );
    const [data, totals] = await Promise.all([
      this.database.db
        .select({
          id: assets.id,
          assetCode: assets.assetCode,
          itemName: items.name,
          status: assets.status,
          assignedAt: assetAssignments.assignedAt,
        })
        .from(assetAssignments)
        .innerJoin(
          assets,
          and(
            eq(assets.id, assetAssignments.assetId),
            eq(assets.farmId, farmId),
          ),
        )
        .innerJoin(items, eq(items.id, assets.itemId))
        .where(condition)
        .orderBy(desc(assetAssignments.assignedAt), assets.id)
        .limit(pagination.pageSize)
        .offset(pagination.offset),
      this.database.db
        .select({ value: count() })
        .from(assetAssignments)
        .where(condition),
    ]);
    return { data, page: this.page(pagination, Number(totals[0].value)) };
  }

  async history(
    memberId: string,
    farmId: string,
    clerkUserId: string,
    pagination: PaginationParams,
  ) {
    await this.detail(memberId, farmId, clerkUserId);
    const condition = and(
      eq(auditLogs.farmId, farmId),
      eq(auditLogs.entityType, 'PERSONNEL'),
      eq(auditLogs.entityId, memberId),
    );
    const [data, totals] = await Promise.all([
      this.database.db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          actorName: users.fullName,
          actorEmail: users.email,
          oldData: auditLogs.oldData,
          newData: auditLogs.newData,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .where(condition)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(pagination.pageSize)
        .offset(pagination.offset),
      this.database.db
        .select({ value: count() })
        .from(auditLogs)
        .where(condition),
    ]);
    return { data, page: this.page(pagination, Number(totals[0].value)) };
  }

  private page(pagination: PaginationParams, totalItems: number) {
    return {
      number: pagination.page,
      size: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  private throwDatabaseError(error: unknown): never {
    const failure = error as { code?: string; cause?: { code?: string } };
    if ((failure.code ?? failure.cause?.code) === '23505')
      throw new ConflictException({
        code: 'PERSONNEL_CONFLICT',
        message: 'The employee code or membership already exists.',
      });
    throw error;
  }
}

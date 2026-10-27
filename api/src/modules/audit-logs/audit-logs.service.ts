import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  farmMemberRoles,
  farmMembers,
  roles,
  users,
} from '../../db/schema';
import { DatabaseService } from '../../db/database.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import type { PaginationParams } from '../../common/query-params';

type AuditLogFilters = PaginationParams & {
  clerkUserId: string;
  farmId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
};

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  private async getScope(farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      false,
    );
    const membershipRoles = await this.databaseService.db
      .select({ roleCode: roles.code })
      .from(farmMembers)
      .leftJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(
        and(eq(farmMembers.id, memberId), eq(farmMembers.farmId, farmId)),
      );
    const roleCodes = membershipRoles.map(({ roleCode }) => roleCode);
    return {
      memberId,
      scope: roleCodes.some((role) => ['ADMIN', 'FARM_OWNER'].includes(role ?? ''))
        ? ('FARM' as const)
        : ('CREATED_BY_ME' as const),
    };
  }

  private createdByMemberCondition(memberId: string) {
    return sql`(
      ${auditLogs.oldData}->>'created_by_member_id' = ${memberId}
      or ${auditLogs.newData}->>'created_by_member_id' = ${memberId}
      or ${auditLogs.oldData}->>'createdByMemberId' = ${memberId}
      or ${auditLogs.newData}->>'createdByMemberId' = ${memberId}
    )`;
  }

  async get(id: string, farmId: string, clerkUserId: string) {
    const { memberId, scope } = await this.getScope(farmId, clerkUserId);
    const conditions = [eq(auditLogs.id, id), eq(auditLogs.farmId, farmId)];
    if (scope === 'CREATED_BY_ME') {
      conditions.push(this.createdByMemberCondition(memberId));
    }
    const [row] = await this.databaseService.db
      .select({
        audit: auditLogs,
        actorName: users.fullName,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(and(...conditions))
      .limit(1);
    if (!row) throw new NotFoundException('Audit log not found');
    return {
      ...row.audit,
      actor:
        row.actorName || row.actorEmail
          ? { name: row.actorName, email: row.actorEmail }
          : null,
    };
  }

  async list(filters: AuditLogFilters) {
    const { memberId, scope } = await this.getScope(
      filters.farmId,
      filters.clerkUserId,
    );

    const conditions = [eq(auditLogs.farmId, filters.farmId)];
    if (scope === 'CREATED_BY_ME') {
      conditions.push(this.createdByMemberCondition(memberId));
    }
    if (filters.entityType) {
      const entityType = filters.entityType.toUpperCase();
      conditions.push(
        entityType === 'MAINTENANCE' || entityType === 'MAINTENANCE_RECORD'
          ? sql`upper(${auditLogs.entityType}) in ('MAINTENANCE', 'MAINTENANCE_RECORD')`
          : sql`upper(${auditLogs.entityType}) = ${entityType}`,
      );
    }
    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters.action) {
      const action = filters.action.toUpperCase();
      conditions.push(
        action === 'CREATE'
          ? sql`upper(${auditLogs.action}) in ('CREATE', 'INSERT')`
          : sql`upper(${auditLogs.action}) = ${action}`,
      );
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      this.databaseService.db
        .select({
          audit: auditLogs,
          actorName: users.fullName,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: sql<number>`count(*)` })
        .from(auditLogs)
        .where(where),
    ]);

    const data = rows.map(({ audit, actorName, actorEmail }) => ({
      ...audit,
      actor:
        actorName || actorEmail ? { name: actorName, email: actorEmail } : null,
    }));
    const totalItems = Number(totalRows[0]?.value ?? 0);

    return {
      data,
      scope,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }
}

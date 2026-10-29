import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, sql, SQL } from 'drizzle-orm';
import type { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { auditLogs, users } from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';

export interface AuditLogFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

const auditLogFields = {
  id: auditLogs.id,
  farmId: auditLogs.farmId,
  userId: auditLogs.userId,
  action: auditLogs.action,
  entityType: auditLogs.entityType,
  entityId: auditLogs.entityId,
  oldData: auditLogs.oldData,
  newData: auditLogs.newData,
  createdAt: auditLogs.createdAt,
  actorName: users.fullName,
  actorEmail: users.email,
};

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: AuditLogFilters) {
    const conditions = await this.scope(filters.farmId, filters.clerkUserId);
    if (filters.entityType)
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.entityId)
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    const where = and(...conditions);
    const [rows, [total]] = await Promise.all([
      this.databaseService.db
        .select(auditLogFields)
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(auditLogs)
        .where(where),
    ]);
    const totalItems = Number(total?.value ?? 0);
    return {
      data: rows.map((row) => this.present(row)),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async get(id: string, farmId: string, clerkUserId: string) {
    const conditions = await this.scope(farmId, clerkUserId);
    const [row] = await this.databaseService.db
      .select(auditLogFields)
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(and(eq(auditLogs.id, id), ...conditions))
      .limit(1);
    if (!row) throw new NotFoundException('Audit log not found');
    return this.present(row);
  }

  /** Approvers read the whole farm history; employees only that of documents they created. */
  private async scope(farmId: string, clerkUserId: string): Promise<SQL[]> {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const conditions = [eq(auditLogs.farmId, farmId)];
    if (roleCodes.some((code) => ['ADMIN', 'FARM_OWNER'].includes(code)))
      return conditions;
    if (!roleCodes.includes('EMPLOYEE'))
      throw new ForbiddenException('Audit history permission is required');
    // shortcut: unindexed JSON filter, scans the farm's audit rows; add a column or expression index when history grows.
    conditions.push(
      sql`${auditLogs.newData}->>'createdByMemberId' = ${memberId}`,
    );
    return conditions;
  }

  private present<
    T extends { actorName: string | null; actorEmail: string | null },
  >({ actorName, actorEmail, ...log }: T) {
    return {
      ...log,
      actor:
        actorName || actorEmail ? { name: actorName, email: actorEmail } : null,
    };
  }
}

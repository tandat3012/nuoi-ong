import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  AnyColumn,
  count,
  desc,
  eq,
  inArray,
  sql,
  SQL,
} from 'drizzle-orm';
import type { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  assetTransferRequests,
  auditLogs,
  farmMembers,
  inventoryLots,
  items,
  locations,
  maintenanceRecords,
  maintenanceRequests,
  stockCounts,
  stockIssues,
  stockReceipts,
  stockTransfers,
  suppliers,
  users,
  warehouses,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';

export interface AuditLogFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      references: await this.references(filters.farmId, rows),
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

  /**
   * Codes or names for every id in the page (the entity and ids inside the
   * snapshots), so readers never see raw UUIDs. UUIDs are unique across
   * tables, so one flat map is enough; every lookup stays inside the farm.
   */
  private async references(
    farmId: string,
    rows: { entityId: string | null; oldData: unknown; newData: unknown }[],
  ): Promise<Record<string, string>> {
    const found = new Set<string>();
    const collect = (value: unknown): void => {
      if (typeof value === 'string') {
        if (UUID.test(value)) found.add(value);
      } else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object')
        Object.values(value).forEach(collect);
    };
    for (const row of rows) {
      if (row.entityId) found.add(row.entityId);
      collect(row.oldData);
      collect(row.newData);
    }
    const ids = [...found];
    if (!ids.length) return {};
    const db = this.databaseService.db;
    const codeName = (code: AnyColumn, name: AnyColumn) =>
      sql<string>`${code} || ' — ' || ${name}`;
    const groups = await Promise.all([
      db
        .select({
          id: warehouses.id,
          label: codeName(warehouses.code, warehouses.name),
        })
        .from(warehouses)
        .where(and(eq(warehouses.farmId, farmId), inArray(warehouses.id, ids))),
      db
        .select({ id: items.id, label: codeName(items.code, items.name) })
        .from(items)
        .where(and(eq(items.farmId, farmId), inArray(items.id, ids))),
      db
        .select({
          id: locations.id,
          label: codeName(locations.code, locations.name),
        })
        .from(locations)
        .where(and(eq(locations.farmId, farmId), inArray(locations.id, ids))),
      db
        .select({
          id: suppliers.id,
          label: codeName(suppliers.code, suppliers.name),
        })
        .from(suppliers)
        .where(and(eq(suppliers.farmId, farmId), inArray(suppliers.id, ids))),
      db
        .select({ id: inventoryLots.id, label: inventoryLots.lotNumber })
        .from(inventoryLots)
        .where(
          and(eq(inventoryLots.farmId, farmId), inArray(inventoryLots.id, ids)),
        ),
      db
        .select({ id: assets.id, label: assets.assetCode })
        .from(assets)
        .where(and(eq(assets.farmId, farmId), inArray(assets.id, ids))),
      db
        .select({
          id: farmMembers.id,
          label: sql<string>`coalesce(nullif(${users.fullName}, ''), ${users.email})`,
        })
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(
          and(eq(farmMembers.farmId, farmId), inArray(farmMembers.id, ids)),
        ),
      db
        .select({ id: stockReceipts.id, label: stockReceipts.receiptCode })
        .from(stockReceipts)
        .where(
          and(eq(stockReceipts.farmId, farmId), inArray(stockReceipts.id, ids)),
        ),
      db
        .select({ id: stockIssues.id, label: stockIssues.issueCode })
        .from(stockIssues)
        .where(
          and(eq(stockIssues.farmId, farmId), inArray(stockIssues.id, ids)),
        ),
      db
        .select({ id: stockTransfers.id, label: stockTransfers.transferCode })
        .from(stockTransfers)
        .where(
          and(
            eq(stockTransfers.farmId, farmId),
            inArray(stockTransfers.id, ids),
          ),
        ),
      db
        .select({ id: stockCounts.id, label: stockCounts.countCode })
        .from(stockCounts)
        .where(
          and(eq(stockCounts.farmId, farmId), inArray(stockCounts.id, ids)),
        ),
      // Maintenance records and requests are named by the asset they concern.
      db
        .select({ id: maintenanceRecords.id, label: assets.assetCode })
        .from(maintenanceRecords)
        .innerJoin(assets, eq(assets.id, maintenanceRecords.assetId))
        .where(
          and(
            eq(maintenanceRecords.farmId, farmId),
            inArray(maintenanceRecords.id, ids),
          ),
        ),
      db
        .select({ id: maintenanceRequests.id, label: assets.assetCode })
        .from(maintenanceRequests)
        .innerJoin(assets, eq(assets.id, maintenanceRequests.assetId))
        .where(
          and(
            eq(maintenanceRequests.farmId, farmId),
            inArray(maintenanceRequests.id, ids),
          ),
        ),
      db
        .select({ id: assetTransferRequests.id, label: assets.assetCode })
        .from(assetTransferRequests)
        .innerJoin(assets, eq(assets.id, assetTransferRequests.assetId))
        .where(
          and(
            eq(assetTransferRequests.farmId, farmId),
            inArray(assetTransferRequests.id, ids),
          ),
        ),
    ]);
    return Object.fromEntries(
      groups.flat().flatMap(({ id, label }) => (label ? [[id, label]] : [])),
    );
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

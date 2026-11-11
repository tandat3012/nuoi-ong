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
  assetAssignments,
  assetIncidents,
  assets,
  assetTransferRequests,
  auditLogs,
  categories,
  farmMembers,
  farms,
  inventoryLots,
  items,
  locations,
  maintenanceRecords,
  maintenanceRequests,
  stockCounts,
  stockIssues,
  stockReceipts,
  stockTransfers,
  storeCategories,
  storeOrders,
  storeProductVariants,
  storeProducts,
  storeWarrantyRequests,
  suppliers,
  units,
  users,
  warehouses,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import {
  FARM_ADMIN_ROLES,
  STOCK_WRITE_ROLES,
  hasAnyRole,
} from '../auth/farm-access/farm-role-groups';

export interface AuditLogFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_GLOBAL =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

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
    const { conditions, visibility } = await this.scope(
      filters.farmId,
      filters.clerkUserId,
    );
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
      scope: visibility,
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
    const { conditions } = await this.scope(farmId, clerkUserId);
    const [row] = await this.databaseService.db
      .select(auditLogFields)
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(and(eq(auditLogs.id, id), ...conditions))
      .limit(1);
    if (!row) throw new NotFoundException('Audit log not found');
    return this.present(row);
  }

  async getDetail(id: string, farmId: string, clerkUserId: string) {
    const data = await this.get(id, farmId, clerkUserId);
    return {
      data,
      references: await this.references(farmId, [data]),
    };
  }

  /** Admins and owners read farm history; other staff read only actions they performed. */

  private async scope(
    farmId: string,
    clerkUserId: string,
  ): Promise<{
    conditions: SQL[];
    visibility: 'FARM' | 'PERFORMED_BY_ME';
  }> {
    const { userId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const conditions = [eq(auditLogs.farmId, farmId)];
    if (hasAnyRole(roleCodes, FARM_ADMIN_ROLES))
      return { conditions, visibility: 'FARM' };
    if (!hasAnyRole(roleCodes, [...STOCK_WRITE_ROLES, 'STORE_MANAGER']))
      throw new ForbiddenException('Audit history permission is required');
    conditions.push(eq(auditLogs.userId, userId));
    return { conditions, visibility: 'PERFORMED_BY_ME' };
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
        else if (value.length >= 36) {
          for (const match of value.match(UUID_GLOBAL) ?? []) found.add(match);
        }
      } else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object')
        Object.values(value).forEach(collect);
    };
    for (const row of rows) {
      if (row.entityId && UUID.test(row.entityId)) found.add(row.entityId);
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
        .select({ id: inventoryLots.id, label: inventoryLots.lotCode })
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
        .select({
          id: stockReceipts.id,
          label: sql<string>`coalesce(${stockReceipts.receiptCode}, 'PN-' || left(${stockReceipts.id}::text, 8))`,
        })
        .from(stockReceipts)
        .where(
          and(eq(stockReceipts.farmId, farmId), inArray(stockReceipts.id, ids)),
        ),
      db
        .select({
          id: stockIssues.id,
          label: sql<string>`coalesce(${stockIssues.issueCode}, 'PX-' || left(${stockIssues.id}::text, 8))`,
        })
        .from(stockIssues)
        .where(
          and(eq(stockIssues.farmId, farmId), inArray(stockIssues.id, ids)),
        ),
      db
        .select({
          id: stockTransfers.id,
          label: sql<string>`coalesce(${stockTransfers.transferCode}, 'CK-' || left(${stockTransfers.id}::text, 8))`,
        })
        .from(stockTransfers)
        .where(
          and(
            eq(stockTransfers.farmId, farmId),
            inArray(stockTransfers.id, ids),
          ),
        ),
      db
        .select({
          id: stockCounts.id,
          label: sql<string>`coalesce(${stockCounts.countCode}, 'KK-' || left(${stockCounts.id}::text, 8))`,
        })
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
      // NV10: the shared catalog is public; sales settings are named by this farm.
      db
        .select({ id: storeProducts.id, label: storeProducts.name })
        .from(storeProducts)
        .where(inArray(storeProducts.id, ids)),
      db
        .select({
          id: storeProductVariants.id,
          label: sql<string>`${storeProducts.name} || ' — ' || ${storeProductVariants.name}`,
        })
        .from(storeProductVariants)
        .innerJoin(
          storeProducts,
          eq(storeProducts.id, storeProductVariants.productId),
        )
        .where(inArray(storeProductVariants.id, ids)),
      db
        .select({ id: storeCategories.id, label: storeCategories.name })
        .from(storeCategories)
        .where(inArray(storeCategories.id, ids)),
      db
        .select({ id: farms.id, label: farms.name })
        .from(farms)
        .where(and(eq(farms.id, farmId), inArray(farms.id, ids))),
      db
        .select({
          id: categories.id,
          label: codeName(categories.code, categories.name),
        })
        .from(categories)
        .where(inArray(categories.id, ids)),
      db
        .select({
          id: units.id,
          label: sql<string>`case when nullif(${units.symbol}, '') is not null then ${units.name} || ' (' || ${units.symbol} || ')' else ${units.name} end`,
        })
        .from(units)
        .where(inArray(units.id, ids)),
      db
        .select({
          id: users.id,
          label: sql<string>`coalesce(nullif(${users.fullName}, ''), ${users.email})`,
        })
        .from(users)
        .innerJoin(farmMembers, eq(farmMembers.userId, users.id))
        .where(and(eq(farmMembers.farmId, farmId), inArray(users.id, ids))),
      db
        .select({
          id: assetIncidents.id,
          label: sql<string>`'Sự cố ' || ${assets.assetCode}`,
        })
        .from(assetIncidents)
        .innerJoin(assets, eq(assets.id, assetIncidents.assetId))
        .where(
          and(
            eq(assetIncidents.farmId, farmId),
            inArray(assetIncidents.id, ids),
          ),
        ),
      db
        .select({
          id: assetAssignments.id,
          label: sql<string>`'Cấp phát ' || ${assets.assetCode} || ' — ' || coalesce(nullif(${users.fullName}, ''), ${users.email})`,
        })
        .from(assetAssignments)
        .innerJoin(assets, eq(assets.id, assetAssignments.assetId))
        .innerJoin(
          farmMembers,
          eq(farmMembers.id, assetAssignments.assignedToMemberId),
        )
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(
          and(
            eq(assetAssignments.farmId, farmId),
            inArray(assetAssignments.id, ids),
          ),
        ),
      db
        .select({
          id: storeOrders.id,
          label: sql<string>`'DH' || lpad(${storeOrders.orderNumber}::text, 6, '0')`,
        })
        .from(storeOrders)
        .where(
          and(eq(storeOrders.farmId, farmId), inArray(storeOrders.id, ids)),
        ),
      db
        .select({
          id: storeWarrantyRequests.id,
          label: sql<string>`'BH' || lpad(${storeWarrantyRequests.requestNumber}::text, 6, '0')`,
        })
        .from(storeWarrantyRequests)
        .where(
          and(
            eq(storeWarrantyRequests.farmId, farmId),
            inArray(storeWarrantyRequests.id, ids),
          ),
        ),
    ]);
    return Object.fromEntries(
      groups
        .flat()
        .map(({ id, label }) => [id, label ?? `(nháp #${id.slice(0, 8)})`]),
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

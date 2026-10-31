import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  sql,
  SQL,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assetAssignments,
  assetIncidents,
  assets,
  auditLogs,
  farmMembers,
  inventoryBalances,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  maintenanceStatus,
  suppliers,
  users,
  warehouses,
} from '../../db/schema';
import { TRANSFER_PENDING_CONFLICT } from '../assets/asset-lifecycle.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';
import {
  CreateMaintenanceRecordDto,
  CompleteMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
} from './dto/maintenance.dto';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type Actor = { memberId: string; userId: string };

type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  assetId?: string;
  status?: (typeof maintenanceStatus.enumValues)[number];
};

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: Filters) {
    await this.warehousesService.assertFarmAccess(
      filters.farmId,
      filters.clerkUserId,
      false,
    );
    const conditions: SQL[] = [eq(maintenanceRecords.farmId, filters.farmId)];
    if (filters.assetId)
      conditions.push(eq(maintenanceRecords.assetId, filters.assetId));
    if (filters.status)
      conditions.push(eq(maintenanceRecords.status, filters.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(maintenanceRecords),
          assetCode: assets.assetCode,
          serialNumber: assets.serialNumber,
        })
        .from(maintenanceRecords)
        .leftJoin(
          assets,
          and(
            eq(assets.id, maintenanceRecords.assetId),
            eq(assets.farmId, maintenanceRecords.farmId),
          ),
        )
        .where(where)
        .orderBy(
          desc(maintenanceRecords.createdAt),
          desc(maintenanceRecords.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(maintenanceRecords)
        .where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return {
      data,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async get(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, false);
    const [record] = await this.databaseService.db
      .select({
        ...getTableColumns(maintenanceRecords),
        assetCode: assets.assetCode,
        serialNumber: assets.serialNumber,
      })
      .from(maintenanceRecords)
      .leftJoin(
        assets,
        and(
          eq(assets.id, maintenanceRecords.assetId),
          eq(assets.farmId, maintenanceRecords.farmId),
        ),
      )
      .where(
        and(
          eq(maintenanceRecords.id, id),
          eq(maintenanceRecords.farmId, farmId),
        ),
      )
      .limit(1);
    if (!record) throw new NotFoundException('Maintenance record not found');
    return record;
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateMaintenanceRecordDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction((tx) =>
      this.schedule(tx, farmId, actor.userId, input),
    );
  }

  /** Schedules a record inside the caller's transaction; also used to approve maintenance requests. */
  async schedule(
    tx: Transaction,
    farmId: string,
    actorUserId: string,
    input: CreateMaintenanceRecordDto,
  ) {
    const [asset] = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.id, input.assetId), eq(assets.farmId, farmId)))
      .for('update')
      .limit(1);
    if (!asset) throw new NotFoundException('Asset not found');
    if (['LOST', 'RETIRED'].includes(asset.status))
      throw new ConflictException(
        'Terminal assets cannot be scheduled for maintenance',
      );
    if (asset.status === 'TRANSFER_PENDING')
      throw new ConflictException(TRANSFER_PENDING_CONFLICT);
    const [item] = await tx
      .select({ id: items.id, trackingMode: items.trackingMode })
      .from(items)
      .where(
        and(
          eq(items.id, asset.itemId),
          eq(items.farmId, farmId),
          eq(items.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!item || item.trackingMode !== 'ASSET')
      throw new ConflictException(
        'Asset item must remain active and ASSET tracked',
      );
    await this.validateReferences(tx, farmId, asset.id, input);
    const [activeRecord] = await tx
      .select({ id: maintenanceRecords.id })
      .from(maintenanceRecords)
      .where(
        and(
          eq(maintenanceRecords.assetId, input.assetId),
          eq(maintenanceRecords.farmId, farmId),
          inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']),
        ),
      )
      .limit(1);
    if (activeRecord)
      throw new ConflictException(
        'Asset already has an active maintenance record',
      );
    const [record] = await tx
      .insert(maintenanceRecords)
      .values({
        farmId,
        assetId: input.assetId,
        incidentId: input.incidentId,
        maintenanceType: input.maintenanceType,
        scheduledAt: input.scheduledAt,
        description: input.description,
        performedByMemberId: input.performedByMemberId,
        supplierId: input.supplierId,
        laborCost: input.laborCost ?? '0',
        materialCost: input.materialCost ?? '0',
        otherCost: input.otherCost ?? '0',
      })
      .returning();
    await this.audit(
      tx,
      farmId,
      actorUserId,
      'ASSET_MAINTENANCE_SCHEDULED',
      asset.id,
      { status: asset.status },
      {
        status: asset.status,
        referenceId: record.id,
        summary: `Đã lên lịch ${this.maintenanceName(record.maintenanceType)}`,
      },
    );
    return record;
  }

  async update(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateMaintenanceRecordDto,
  ) {
    await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const current = await this.getRecord(tx, id, farmId, true);
      if (current.status === 'COMPLETED' || current.status === 'CANCELLED')
        throw new ConflictException(
          'Completed or cancelled records cannot be edited',
        );
      await this.validateReferences(tx, farmId, current.assetId, input);
      const changes: Partial<typeof maintenanceRecords.$inferInsert> = {};
      for (const key of [
        'maintenanceType',
        'scheduledAt',
        'description',
        'resultNote',
        'performedByMemberId',
        'supplierId',
        'laborCost',
        'materialCost',
        'otherCost',
      ] as const)
        if (input[key] !== undefined) changes[key] = input[key] as never;
      if (!Object.keys(changes).length) return current;
      changes.updatedAt = new Date().toISOString();
      const [record] = await tx
        .update(maintenanceRecords)
        .set(changes)
        .where(
          and(
            eq(maintenanceRecords.id, id),
            eq(maintenanceRecords.farmId, farmId),
          ),
        )
        .returning();
      return record;
    });
  }

  async start(id: string, farmId: string, clerkUserId: string) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true);
      if (record.status !== 'SCHEDULED')
        throw new ConflictException('Only SCHEDULED records can start');
      const [preview] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .limit(1);
      if (!preview) throw new NotFoundException('Asset not found');
      if (
        !['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE'].includes(
          preview.status,
        )
      )
        throw new ConflictException(
          'Asset cannot enter maintenance from its current status',
        );

      let sourceWarehouseId: string | undefined;
      let balanceId: string | undefined;
      let sourceLocationId: string | undefined;
      if (preview.status === 'AVAILABLE') {
        if (!preview.currentLocationId)
          throw new ConflictException('Available asset has no source location');
        const source = await this.activeSource(
          tx,
          farmId,
          preview.currentLocationId,
        );
        if (!source.warehouseId)
          throw new ConflictException(
            'Available asset must be in a warehouse to start maintenance',
          );
        sourceLocationId = source.id;
        sourceWarehouseId = source.warehouseId;
        await this.activeWarehouse(tx, farmId, sourceWarehouseId);
        await this.ensureBalance(tx, farmId, sourceWarehouseId, preview.itemId);
        const [balance] = await tx
          .select({ id: inventoryBalances.id })
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.farmId, farmId),
              eq(inventoryBalances.warehouseId, sourceWarehouseId),
              eq(inventoryBalances.itemId, preview.itemId),
              isNull(inventoryBalances.lotId),
              gte(inventoryBalances.quantityOnHand, '1'),
            ),
          )
          .for('update')
          .limit(1);
        if (!balance)
          throw new ConflictException(
            'Asset is missing from warehouse inventory',
          );
        balanceId = balance.id;
      }

      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      if (
        asset.status !== preview.status ||
        asset.itemId !== preview.itemId ||
        asset.currentLocationId !== preview.currentLocationId
      )
        throw new ConflictException(
          'Asset changed while starting maintenance; reload and retry',
        );
      if (asset.status === 'AVAILABLE')
        await this.activeLocation(
          tx,
          farmId,
          sourceLocationId!,
          sourceWarehouseId!,
        );
      // Direct issues and completed repairs can leave IN_USE assets without a holder.
      if (asset.status === 'ASSIGNED') {
        const [assignment] = await tx
          .select({ id: assetAssignments.id })
          .from(assetAssignments)
          .where(
            and(
              eq(assetAssignments.farmId, farmId),
              eq(assetAssignments.assetId, asset.id),
              eq(assetAssignments.status, 'ACTIVE'),
            ),
          )
          .limit(1);
        if (!assignment)
          throw new ConflictException(
            'Active assignment required for this asset status',
          );
      }

      const now = new Date().toISOString();
      if (balanceId) {
        const [balance] = await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} - 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(inventoryBalances.id, balanceId),
              gte(inventoryBalances.quantityOnHand, '1'),
            ),
          )
          .returning({ id: inventoryBalances.id });
        if (!balance)
          throw new ConflictException(
            'Asset is missing from warehouse inventory',
          );
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: sourceWarehouseId!,
          itemId: asset.itemId,
          assetId: asset.id,
          transactionType: 'MAINTENANCE_ISSUE',
          quantityChange: '-1',
          sourceType: 'ASSET_MAINTENANCE',
          sourceId: record.id,
          performedByMemberId: actor.memberId,
          reason: record.description ?? null,
        });
      }
      await tx
        .update(assets)
        .set({ status: 'MAINTENANCE', updatedAt: now })
        .where(and(eq(assets.id, asset.id), eq(assets.farmId, farmId)));
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({ status: 'IN_PROGRESS', startedAt: now, updatedAt: now })
        .where(
          and(
            eq(maintenanceRecords.id, id),
            eq(maintenanceRecords.farmId, farmId),
          ),
        )
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_STARTED',
        asset.id,
        { status: asset.status },
        {
          status: 'MAINTENANCE',
          referenceId: record.id,
          summary: 'Đã bắt đầu bảo trì tài sản',
        },
      );
      return updated;
    });
  }

  async complete(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: CompleteMaintenanceRecordDto = {},
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true);
      if (record.status !== 'IN_PROGRESS')
        throw new ConflictException('Only IN_PROGRESS records can complete');
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.status !== 'MAINTENANCE')
        throw new ConflictException('Asset is no longer in maintenance');
      const now = new Date().toISOString();
      const changes: Partial<typeof maintenanceRecords.$inferInsert> = {
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
      };
      for (const field of [
        'resultNote',
        'laborCost',
        'materialCost',
        'otherCost',
      ] as const)
        if (input[field] !== undefined) changes[field] = input[field] as never;
      const [updated] = await tx
        .update(maintenanceRecords)
        .set(changes)
        .where(
          and(
            eq(maintenanceRecords.id, id),
            eq(maintenanceRecords.farmId, farmId),
          ),
        )
        .returning();
      await tx
        .update(assets)
        .set({
          status: 'IN_USE',
          lastMaintenanceDate: now.slice(0, 10),
          updatedAt: now,
        })
        .where(and(eq(assets.id, asset.id), eq(assets.farmId, farmId)));
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_COMPLETED',
        asset.id,
        { status: 'MAINTENANCE' },
        {
          status: 'IN_USE',
          referenceId: record.id,
          summary: `Hoàn tất ${this.maintenanceName(record.maintenanceType)}${input.resultNote ? `: ${input.resultNote}` : ''}`,
        },
      );
      return updated;
    });
  }

  async cancel(id: string, farmId: string, clerkUserId: string) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true);
      if (!['SCHEDULED', 'IN_PROGRESS'].includes(record.status))
        throw new ConflictException('Only active records can be cancelled');
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      if (record.status === 'IN_PROGRESS' && asset.status !== 'MAINTENANCE')
        throw new ConflictException('Asset is no longer in maintenance');
      const now = new Date().toISOString();
      const nextStatus =
        record.status === 'IN_PROGRESS' ? 'IN_USE' : asset.status;
      if (record.status === 'IN_PROGRESS')
        await tx
          .update(assets)
          .set({ status: 'IN_USE', updatedAt: now })
          .where(and(eq(assets.id, asset.id), eq(assets.farmId, farmId)));
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({ status: 'CANCELLED', updatedAt: now })
        .where(
          and(
            eq(maintenanceRecords.id, id),
            eq(maintenanceRecords.farmId, farmId),
          ),
        )
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_CANCELLED',
        asset.id,
        { status: asset.status },
        {
          status: nextStatus,
          referenceId: record.id,
          summary: 'Đã hủy hồ sơ bảo trì',
        },
      );
      return updated;
    });
  }
  private async getRecord(
    tx: Transaction,
    id: string,
    farmId: string,
    forUpdate = false,
  ) {
    const query = tx
      .select()
      .from(maintenanceRecords)
      .where(
        and(
          eq(maintenanceRecords.id, id),
          eq(maintenanceRecords.farmId, farmId),
        ),
      )
      .limit(1);
    const [record] = forUpdate ? await query.for('update') : await query;
    if (!record) throw new NotFoundException('Maintenance record not found');
    return record;
  }

  private async actor(farmId: string, clerkUserId: string): Promise<Actor> {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const [actor] = await this.databaseService.db
      .select({ userId: users.id })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(
        and(
          eq(farmMembers.id, memberId),
          eq(farmMembers.farmId, farmId),
          eq(farmMembers.status, 'ACTIVE'),
          eq(users.authProviderUserId, clerkUserId),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!actor)
      throw new ConflictException('Active farm membership is required');
    return { memberId, userId: actor.userId };
  }

  private async validateReferences(
    tx: Transaction,
    farmId: string,
    assetId: string,
    input: {
      incidentId?: string | null;
      performedByMemberId?: string | null;
      supplierId?: string | null;
    },
  ) {
    if (input.incidentId) {
      const [incident] = await tx
        .select({ id: assetIncidents.id })
        .from(assetIncidents)
        .where(
          and(
            eq(assetIncidents.id, input.incidentId),
            eq(assetIncidents.farmId, farmId),
            eq(assetIncidents.assetId, assetId),
          ),
        )
        .for('share')
        .limit(1);
      if (!incident)
        throw new ConflictException(
          'Incident must belong to this asset and farm',
        );
    }
    if (input.performedByMemberId) {
      const [member] = await tx
        .select({ id: farmMembers.id })
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(
          and(
            eq(farmMembers.id, input.performedByMemberId),
            eq(farmMembers.farmId, farmId),
            eq(farmMembers.status, 'ACTIVE'),
            eq(users.status, 'ACTIVE'),
          ),
        )
        .for('share')
        .limit(1);
      if (!member)
        throw new ConflictException(
          'Performer must be an active member of this farm',
        );
    }
    if (input.supplierId) {
      const [supplier] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, input.supplierId),
            eq(suppliers.farmId, farmId),
            eq(suppliers.status, 'ACTIVE'),
          ),
        )
        .for('share')
        .limit(1);
      if (!supplier)
        throw new ConflictException('Supplier must be active in this farm');
    }
  }

  private async activeWarehouse(tx: Transaction, farmId: string, id: string) {
    const [warehouse] = await tx
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, id),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!warehouse)
      throw new ConflictException(
        'Warehouse must exist and be active in this farm',
      );
  }

  private async activeSource(tx: Transaction, farmId: string, id: string) {
    const [location] = await tx
      .select({
        id: locations.id,
        warehouseId: locations.warehouseId,
      })
      .from(locations)
      .where(
        and(
          eq(locations.id, id),
          eq(locations.farmId, farmId),
          eq(locations.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!location) throw new ConflictException('Asset location must be active');
    return location;
  }

  private async activeLocation(
    tx: Transaction,
    farmId: string,
    id: string,
    warehouseId: string,
  ) {
    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, id),
          eq(locations.farmId, farmId),
          eq(locations.warehouseId, warehouseId),
          eq(locations.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!location)
      throw new ConflictException(
        'Asset location must be active in its warehouse',
      );
  }

  private async ensureBalance(
    tx: Transaction,
    farmId: string,
    warehouseId: string,
    itemId: string,
  ) {
    await tx
      .insert(inventoryBalances)
      .values({ farmId, warehouseId, itemId, lotId: null })
      .onConflictDoNothing({
        target: [
          inventoryBalances.itemId,
          inventoryBalances.lotId,
          inventoryBalances.warehouseId,
        ],
      });
  }

  private async audit(
    tx: Transaction,
    farmId: string,
    userId: string,
    action: string,
    assetId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
  ) {
    await tx.insert(auditLogs).values({
      farmId,
      userId,
      action,
      entityType: 'ASSET',
      entityId: assetId,
      oldData,
      newData,
    });
  }

  private maintenanceName(type: string) {
    const names: Record<string, string> = {
      PREVENTIVE: 'bảo trì phòng ngừa',
      CORRECTIVE: 'bảo trì khắc phục',
      INSPECTION: 'kiểm tra tài sản',
    };
    return names[type] ?? 'bảo trì tài sản';
  }
}

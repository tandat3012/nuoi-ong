import {
  ConflictException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { assertHoldsStillCovered } from '../warehouses/stock-holds';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  or,
  sql,
  SQL,
  type AnyColumn,
} from 'drizzle-orm';
import { activeMaintenanceCondition } from './maintenance-state';
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
import { maintenanceNextDate, maintenanceAlert } from './maintenance-dates';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
  notifyMaintenanceStaff,
} from '../notifications/notification-events';
import { TRANSFER_PENDING_CONFLICT } from '../assets/asset-lifecycle.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import {
  assertInScope,
  inScope,
  scopeCondition,
  type WarehouseScope,
} from '../warehouses/warehouse-scope';
import { assetInScope, assetWarehouseId } from '../assets/asset-warehouse';
import {
  FARM_ADMIN_ROLES,
  MAINTENANCE_WORK_ROLES,
  MAINTENANCE_SCHEDULE_ROLES,
  WAREHOUSE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';
import {
  CreateMaintenanceRecordDto,
  CompleteMaintenanceRecordDto,
  UpdateMaintenanceRecordDto,
  MaintenanceReturnDto,
} from './dto/maintenance.dto';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type Actor = { memberId: string; userId: string; scope: WarehouseScope };

type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  assetId?: string;
  recordId?: string;
  status?: (typeof maintenanceStatus.enumValues)[number];
  dateFrom?: string;
  dateTo?: string;
};

const issuedByName = sql<string | null>`(SELECT COALESCE(u.full_name, u.email)
  FROM farm_members m JOIN users u ON u.id = m.user_id
  WHERE m.id = ${maintenanceRecords.issuedByMemberId})`;

const memberNameSql = (memberIdCol: AnyColumn) =>
  sql<
    string | null
  >`(SELECT COALESCE(u.full_name, u.email) FROM farm_members m JOIN users u ON u.id = m.user_id WHERE m.id = ${memberIdCol})`;

const maintenanceExtraColumns = {
  itemName: sql<
    string | null
  >`(SELECT name FROM items WHERE id=${assets.itemId})`,
  supplierName: sql<
    string | null
  >`(SELECT name FROM suppliers WHERE id=${maintenanceRecords.supplierId})`,
  assetWarehouseName: sql<
    string | null
  >`(SELECT w.name FROM locations l JOIN warehouses w ON w.id = l.warehouse_id WHERE l.id=${assets.currentLocationId})`,
  assetLocationName: sql<
    string | null
  >`(SELECT name FROM locations WHERE id=${assets.currentLocationId})`,
  performedByName: memberNameSql(maintenanceRecords.performedByMemberId),
  receivedByName: memberNameSql(maintenanceRecords.receivedByMemberId),
  inspectedByName: memberNameSql(maintenanceRecords.inspectedByMemberId),
};

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private validateReturnDate(
    scheduledAt: string | null | undefined,
    expectedReturnAt: string | null | undefined,
    reference: string,
  ) {
    if (
      scheduledAt &&
      expectedReturnAt &&
      new Date(expectedReturnAt) < new Date(scheduledAt)
    ) {
      this.logger.warn(
        `Invalid maintenance return date: reference=${reference} scheduledAt=${scheduledAt} expectedReturnAt=${expectedReturnAt}`,
      );
      throw new BadRequestException(
        'Expected return cannot precede scheduled maintenance',
      );
    }
  }
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: Filters) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );
    const conditions: SQL[] = [eq(maintenanceRecords.farmId, filters.farmId)];
    const scoped = this.recordInScope(scope);
    if (scoped) conditions.push(scoped);
    if (filters.recordId)
      conditions.push(eq(maintenanceRecords.id, filters.recordId));
    if (filters.assetId)
      conditions.push(eq(maintenanceRecords.assetId, filters.assetId));
    if (filters.status)
      conditions.push(eq(maintenanceRecords.status, filters.status));
    if (filters.dateFrom)
      conditions.push(
        sql`${maintenanceRecords.scheduledAt} >= (${filters.dateFrom}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    if (filters.dateTo)
      conditions.push(
        sql`${maintenanceRecords.scheduledAt} < ((${filters.dateTo}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(maintenanceRecords),
          assetCode: assets.assetCode,
          serialNumber: assets.serialNumber,
          returnWarehouseName: sql<
            string | null
          >`(SELECT name FROM warehouses WHERE id=${maintenanceRecords.returnWarehouseId})`,
          returnLocationName: sql<
            string | null
          >`(SELECT name FROM locations WHERE id=${maintenanceRecords.returnLocationId})`,
          issuedByName,
          ...maintenanceExtraColumns,
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
      data: data.map((record) => ({
        ...record,
        alert: maintenanceAlert(record),
        returnCode: `BT-${record.id}`,
        returnWarehouseInScope: inScope(scope, record.returnWarehouseId),
      })),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async get(id: string, farmId: string, clerkUserId: string) {
    const scope = await this.warehousesService.warehouseScope(
      farmId,
      clerkUserId,
    );
    const [record] = await this.databaseService.db
      .select({
        ...getTableColumns(maintenanceRecords),
        assetCode: assets.assetCode,
        serialNumber: assets.serialNumber,
        returnWarehouseName: sql<
          string | null
        >`(SELECT name FROM warehouses WHERE id=${maintenanceRecords.returnWarehouseId})`,
        returnLocationName: sql<
          string | null
        >`(SELECT name FROM locations WHERE id=${maintenanceRecords.returnLocationId})`,
        issuedByName,
        ...maintenanceExtraColumns,
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
          this.recordInScope(scope),
        ),
      )
      .limit(1);
    if (!record) throw new NotFoundException('Maintenance record not found');
    return {
      ...record,
      alert: maintenanceAlert(record),
      returnCode: `BT-${record.id}`,
      // Only the receiving warehouse reviews the return; the UI hides the actions otherwise.
      returnWarehouseInScope: inScope(scope, record.returnWarehouseId),
    };
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateMaintenanceRecordDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      await this.assertAssetInScope(tx, input.assetId, actor.scope);
      return this.schedule(tx, farmId, actor.userId, input);
    });
  }

  /** Schedules a record inside the caller's transaction; also used to approve maintenance requests. */
  async schedule(
    tx: Transaction,
    farmId: string,
    actorUserId: string,
    input: CreateMaintenanceRecordDto,
  ) {
    this.validateReturnDate(
      input.scheduledAt,
      input.expectedReturnAt,
      input.assetId,
    );
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
          activeMaintenanceCondition,
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
        expectedReturnAt: input.expectedReturnAt,
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
    const warehouseId = await this.assetWarehouse(tx, asset.id);
    await notifyMaintenanceStaff(
      tx,
      this.recordNotification(record, 'SCHEDULED'),
      warehouseId,
      actorUserId,
    );
    if (record.supplierId && record.expectedReturnAt) {
      const [actorMember] = await tx
        .select({ id: farmMembers.id })
        .from(farmMembers)
        .where(
          and(
            eq(farmMembers.farmId, farmId),
            eq(farmMembers.userId, actorUserId),
          ),
        )
        .limit(1);
      await notifyFarmApprovers(
        tx,
        this.recordNotification(record, 'READY_TO_SEND'),
        actorMember.id,
        warehouseId,
      );
    }
    return record;
  }

  async update(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateMaintenanceRecordDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const current = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (current.status !== 'SCHEDULED')
        throw new ConflictException(
          'Completed or cancelled records cannot be edited',
        );
      this.validateReturnDate(
        input.scheduledAt === undefined
          ? current.scheduledAt
          : input.scheduledAt,
        input.expectedReturnAt === undefined
          ? current.expectedReturnAt
          : input.expectedReturnAt,
        id,
      );
      await this.validateReferences(tx, farmId, current.assetId, input);
      const changes: Partial<typeof maintenanceRecords.$inferInsert> = {};
      for (const key of [
        'maintenanceType',
        'scheduledAt',
        'expectedReturnAt',
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
      if (
        record.supplierId &&
        record.expectedReturnAt &&
        (input.supplierId !== undefined || input.expectedReturnAt !== undefined)
      ) {
        await notifyFarmApprovers(
          tx,
          this.recordNotification(record, 'READY_TO_SEND'),
          actor.memberId,
          await this.assetWarehouse(tx, record.assetId),
        );
      }
      return record;
    });
  }

  /** The warehouse confirms the asset physically left for repair: debits stock once (AC10). */
  async start(id: string, farmId: string, clerkUserId: string) {
    const actor = await this.actor(farmId, clerkUserId, WAREHOUSE_MANAGE_ROLES);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (record.status !== 'SCHEDULED')
        throw new ConflictException('Only SCHEDULED records can start');
      const [preview] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .limit(1);
      if (!preview) throw new NotFoundException('Asset not found');
      if (
        !['AVAILABLE', 'DAMAGED', 'ASSIGNED', 'IN_USE', 'MAINTENANCE'].includes(
          preview.status,
        )
      )
        throw new ConflictException(
          'Asset cannot enter maintenance from its current status',
        );

      await this.validateReferences(tx, farmId, record.assetId, record);
      if (!record.supplierId || !record.expectedReturnAt)
        throw new ConflictException(
          'Select maintenance supplier and expected return date before sending',
        );
      if (new Date(record.expectedReturnAt).getTime() <= Date.now())
        throw new BadRequestException('Expected return must be in the future');
      let sourceWarehouseId: string | undefined;
      let balanceId: string | undefined;
      let sourceLocationId: string | undefined;
      const [failedReturn] =
        preview.status === 'MAINTENANCE' && preview.currentLocationId
          ? await tx
              .select({ id: maintenanceRecords.id })
              .from(maintenanceRecords)
              .where(
                and(
                  eq(maintenanceRecords.assetId, preview.id),
                  eq(maintenanceRecords.status, 'FAILED'),
                  eq(maintenanceRecords.returnStatus, 'CONFIRMED'),
                ),
              )
              .limit(1)
          : [];
      // A damaged return sits in the warehouse like an available asset.
      if (['AVAILABLE', 'DAMAGED'].includes(preview.status) || failedReturn) {
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
      if (asset.status === 'AVAILABLE' || asset.status === 'DAMAGED')
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
      await tx
        .update(assetAssignments)
        .set({ status: 'RETURNED', returnedAt: now, updatedAt: now })
        .where(
          and(
            eq(assetAssignments.assetId, asset.id),
            eq(assetAssignments.status, 'ACTIVE'),
          ),
        );
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
        await assertHoldsStillCovered(tx, balance.id, {
          assetId: asset.id,
        });
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
        .set({ status: 'MAINTENANCE', currentLocationId: null, updatedAt: now })
        .where(and(eq(assets.id, asset.id), eq(assets.farmId, farmId)));
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          status: 'IN_PROGRESS',
          startedAt: now,
          issuedByMemberId: actor.memberId,
          updatedAt: now,
        })
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
          summary: 'Kho đã xác nhận xuất thiết bị đi sửa',
        },
      );
      await notifyMaintenanceStaff(
        tx,
        this.recordNotification(updated, 'IN_PROGRESS'),
        await this.assetWarehouse(tx, updated.assetId),
        actor.userId,
      );
      return updated;
    });
  }

  async receive(
    id: string,
    farmId: string,
    clerkUserId: string,
    receivedAt: string,
  ) {
    const actor = await this.actor(farmId, clerkUserId, MAINTENANCE_WORK_ROLES);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (record.status !== 'IN_PROGRESS')
        throw new ConflictException(
          'Only external maintenance can be received',
        );
      if (
        !record.startedAt ||
        Date.parse(receivedAt) < Date.parse(record.startedAt) ||
        Date.parse(receivedAt) > Date.now()
      )
        throw new BadRequestException('Invalid actual return date');
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          status: 'RECEIVED',
          receivedAt,
          receivedByMemberId: actor.memberId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(maintenanceRecords.id, id))
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_RECEIVED',
        record.assetId,
        { status: record.status },
        { status: updated.status, referenceId: id },
      );
      return updated;
    });
  }

  async complete(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: CompleteMaintenanceRecordDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId, MAINTENANCE_WORK_ROLES);
    if (!input.resultNote?.trim())
      throw new BadRequestException('Inspection result is required');
    if (input.outcome === 'PASSED' && !input.intervalMonths)
      throw new BadRequestException('Next maintenance interval is required');
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (record.status !== 'RECEIVED' || !record.receivedAt)
        throw new ConflictException('Receive the asset before inspection');
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update');
      if (!asset || asset.status !== 'MAINTENANCE')
        throw new ConflictException('Asset is no longer in maintenance');
      const now = new Date().toISOString();
      const nextDueDate =
        input.outcome === 'PASSED'
          ? maintenanceNextDate(record.receivedAt, input.intervalMonths!)
          : null;
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          status: input.outcome === 'PASSED' ? 'COMPLETED' : 'FAILED',
          completedAt: now,
          inspectedByMemberId: actor.memberId,
          intervalMonths:
            input.outcome === 'PASSED' ? input.intervalMonths : null,
          nextDueDate,
          resultNote: input.resultNote!.trim(),
          laborCost: input.laborCost,
          materialCost: input.materialCost,
          otherCost: input.otherCost,
          updatedAt: now,
        })
        .where(eq(maintenanceRecords.id, id))
        .returning();
      if (nextDueDate)
        await tx
          .update(assets)
          .set({
            lastMaintenanceDate: maintenanceNextDate(record.receivedAt, 0),
            nextMaintenanceDate: nextDueDate,
            updatedAt: now,
          })
          .where(eq(assets.id, record.assetId));
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_COMPLETED',
        record.assetId,
        { status: record.status },
        {
          status: updated.status,
          referenceId: id,
          summary: input.resultNote!.trim(),
        },
      );
      return updated;
    });
  }

  async submitReturn(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: MaintenanceReturnDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId, MAINTENANCE_WORK_ROLES);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (
        !['COMPLETED', 'FAILED'].includes(record.status) ||
        !record.receivedAt ||
        (record.returnStatus && record.returnStatus !== 'REJECTED')
      )
        throw new ConflictException(
          'Only inspected assets without a pending or approved receipt can be submitted',
        );
      await this.activeWarehouse(tx, farmId, input.warehouseId);
      await this.activeLocation(
        tx,
        farmId,
        input.locationId,
        input.warehouseId,
      );
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          returnStatus: 'PENDING_APPROVAL',
          returnWarehouseId: input.warehouseId,
          returnLocationId: input.locationId,
          returnCreatedByMemberId: actor.memberId,
          returnRejectionReason: null,
          returnReviewedByMemberId: null,
          returnReviewedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(maintenanceRecords.id, id))
        .returning();
      await notifyFarmApprovers(
        tx,
        this.returnNotification(updated, 'PENDING_APPROVAL'),
        actor.memberId,
        updated.returnWarehouseId,
      );
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_RETURN_SUBMITTED',
        record.assetId,
        { returnStatus: record.returnStatus },
        { returnStatus: updated.returnStatus, referenceId: id },
      );
      return updated;
    });
  }

  async reviewReturn(
    id: string,
    farmId: string,
    clerkUserId: string,
    approve: boolean,
    reason?: string,
  ) {
    const actor = await this.actor(farmId, clerkUserId, WAREHOUSE_MANAGE_ROLES);
    if (!approve && (!reason || reason.trim().length < 3))
      throw new BadRequestException(
        'Rejection reason must have at least 3 characters',
      );
    return this.databaseService.db.transaction(async (tx) => {
      // The warehouse receiving the asset back reviews the return, wherever it left from.
      const record = await this.getRecord(tx, id, farmId, true);
      assertInScope(actor.scope, record.returnWarehouseId);
      if (record.returnStatus !== 'PENDING_APPROVAL')
        throw new ConflictException(
          'Only pending maintenance receipts can be reviewed',
        );
      // Stock flows lock balances before assets; use the same order when receiving.
      let returnBalanceId: string | undefined;
      let returnItemId: string | undefined;
      if (approve) {
        const [preview] = await tx
          .select({ itemId: assets.itemId })
          .from(assets)
          .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)));
        if (!preview) throw new NotFoundException('Asset not found');
        returnItemId = preview.itemId;
        await this.activeWarehouse(tx, farmId, record.returnWarehouseId!);
        await this.activeLocation(
          tx,
          farmId,
          record.returnLocationId!,
          record.returnWarehouseId!,
        );
        await this.ensureBalance(
          tx,
          farmId,
          record.returnWarehouseId!,
          preview.itemId,
        );
        const [balance] = await tx
          .select({ id: inventoryBalances.id })
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.farmId, farmId),
              eq(inventoryBalances.warehouseId, record.returnWarehouseId!),
              eq(inventoryBalances.itemId, preview.itemId),
              isNull(inventoryBalances.lotId),
            ),
          )
          .for('update');
        returnBalanceId = balance.id;
      }
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update');
      if (!asset || asset.status !== 'MAINTENANCE')
        throw new ConflictException('Asset is no longer in maintenance');
      const now = new Date().toISOString();
      if (approve) {
        if (asset.itemId !== returnItemId)
          throw new ConflictException(
            'Asset changed while receiving; reload and retry',
          );
        // Legacy maintenance starts could leave an assignment active.
        await tx
          .update(assetAssignments)
          .set({ status: 'RETURNED', returnedAt: now, updatedAt: now })
          .where(
            and(
              eq(assetAssignments.farmId, farmId),
              eq(assetAssignments.assetId, asset.id),
              eq(assetAssignments.status, 'ACTIVE'),
            ),
          );
        await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`,
            updatedAt: now,
          })
          .where(eq(inventoryBalances.id, returnBalanceId!));
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: record.returnWarehouseId!,
          itemId: asset.itemId,
          assetId: asset.id,
          transactionType: 'RETURN_IN',
          quantityChange: '1',
          sourceType: 'MAINTENANCE_RETURN',
          sourceId: record.id,
          performedByMemberId: actor.memberId,
          reason: record.resultNote,
        });
        await tx
          .update(assets)
          .set({
            // Back in stock but not in use: a passed repair waits for the
            // owner's final decision (NV04), a failed one stays out of use.
            status: 'MAINTENANCE',
            currentLocationId: record.returnLocationId,
            updatedAt: now,
          })
          .where(eq(assets.id, asset.id));
      }
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          returnStatus: approve ? 'CONFIRMED' : 'REJECTED',
          returnReviewedByMemberId: actor.memberId,
          returnReviewedAt: now,
          returnRejectionReason: approve ? null : reason!.trim(),
          updatedAt: now,
        })
        .where(eq(maintenanceRecords.id, id))
        .returning();
      await notifyDocumentCreator(
        tx,
        {
          ...this.returnNotification(
            updated,
            approve ? 'CONFIRMED' : 'REJECTED',
          ),
          rejectionReason: updated.returnRejectionReason ?? undefined,
        },
        record.returnCreatedByMemberId,
      );
      await notifyMaintenanceStaff(
        tx,
        {
          ...this.returnNotification(
            updated,
            approve ? 'CONFIRMED' : 'REJECTED',
          ),
          rejectionReason: updated.returnRejectionReason ?? undefined,
        },
        await this.assetWarehouse(tx, updated.assetId),
        actor.userId,
        record.returnCreatedByMemberId,
      );
      await this.audit(
        tx,
        farmId,
        actor.userId,
        approve
          ? 'ASSET_MAINTENANCE_RETURN_APPROVED'
          : 'ASSET_MAINTENANCE_RETURN_REJECTED',
        record.assetId,
        { returnStatus: record.returnStatus },
        {
          returnStatus: updated.returnStatus,
          referenceId: id,
          summary: updated.returnRejectionReason,
        },
      );
      return updated;
    });
  }

  /** NV04: the owner/admin decides whether a passed repair goes back into use. */
  async decide(
    id: string,
    farmId: string,
    clerkUserId: string,
    reuse: boolean,
    note?: string,
  ) {
    const actor = await this.actor(farmId, clerkUserId, FARM_ADMIN_ROLES);
    const decisionNote = note?.trim() || null;
    if (!reuse && !decisionNote)
      throw new BadRequestException('Keeping an asset out of use needs a note');
    const decision = reuse ? 'REUSE' : 'HOLD';
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      // A retried click: the same decision once, never a second movement.
      if (record.finalDecision === decision) return record;
      if (record.finalDecision)
        throw new ConflictException('The final decision was already made');
      if (record.status !== 'COMPLETED' || record.returnStatus !== 'CONFIRMED')
        throw new ConflictException(
          'Only a passed repair received back in stock awaits a final decision',
        );
      const [asset] = await tx
        .select({ status: assets.status })
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update');
      if (asset?.status !== 'MAINTENANCE')
        throw new ConflictException(
          'Asset is no longer waiting for a decision',
        );
      const now = new Date().toISOString();
      // Not reused: it stays in stock as DAMAGED, for another repair or retirement.
      await tx
        .update(assets)
        .set({ status: reuse ? 'AVAILABLE' : 'DAMAGED', updatedAt: now })
        .where(eq(assets.id, record.assetId));
      const [updated] = await tx
        .update(maintenanceRecords)
        .set({
          finalDecision: decision,
          finalDecisionNote: decisionNote,
          finalDecidedByMemberId: actor.memberId,
          finalDecidedAt: now,
          updatedAt: now,
        })
        .where(eq(maintenanceRecords.id, id))
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_MAINTENANCE_FINAL_DECISION',
        record.assetId,
        { status: asset.status },
        {
          status: reuse ? 'AVAILABLE' : 'DAMAGED',
          referenceId: id,
          summary: decisionNote,
        },
      );
      return updated;
    });
  }

  private async assetWarehouse(tx: Transaction, assetId: string) {
    const [row] = await tx
      .select({ warehouseId: assetWarehouseId })
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);
    return row?.warehouseId ?? null;
  }

  private recordNotification(
    record: typeof maintenanceRecords.$inferSelect,
    status: 'SCHEDULED' | 'READY_TO_SEND' | 'IN_PROGRESS',
  ) {
    return {
      farmId: record.farmId,
      entityType: 'MAINTENANCE_RECORD',
      entityId: record.id,
      documentCode: `BT-${record.id.slice(0, 8)}`,
      documentKind: 'Hồ sơ bảo trì',
      status,
    };
  }

  private returnNotification(
    record: typeof maintenanceRecords.$inferSelect,
    status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED',
  ) {
    return {
      farmId: record.farmId,
      entityType: 'MAINTENANCE_RETURN',
      entityId: record.id,
      documentCode: `BT-${record.id.slice(0, 8)}`,
      documentKind: 'Phiếu nhập lại bảo trì',
      status,
    };
  }

  async cancel(id: string, farmId: string, clerkUserId: string) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const record = await this.getRecord(tx, id, farmId, true, actor.scope);
      if (record.status !== 'SCHEDULED')
        throw new ConflictException('Only active records can be cancelled');
      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, record.assetId), eq(assets.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      const now = new Date().toISOString();
      const nextStatus = asset.status;
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
  /** A record is visible to its asset's warehouse and to the warehouse it returns to. */
  private recordInScope(scope: WarehouseScope) {
    if (scope === null) return undefined;
    return or(
      assetInScope(maintenanceRecords.assetId, scope),
      scopeCondition(maintenanceRecords.returnWarehouseId, scope),
    );
  }

  /** 403 when the asset belongs to a warehouse outside `scope`. */
  async assertAssetInScope(
    tx: Pick<Transaction, 'select'>,
    assetId: string,
    scope: WarehouseScope,
  ) {
    if (scope === null) return;
    const [row] = await tx
      .select({ warehouseId: assetWarehouseId })
      .from(assets)
      .where(eq(assets.id, assetId));
    assertInScope(scope, row?.warehouseId);
  }

  /** Loads the record; with a `scope`, 403 when its asset belongs to another warehouse. */
  private async getRecord(
    tx: Transaction,
    id: string,
    farmId: string,
    forUpdate = false,
    scope: WarehouseScope = null,
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
    await this.assertAssetInScope(tx, record.assetId, scope);
    return record;
  }

  private async actor(
    farmId: string,
    clerkUserId: string,
    allowedRoles = MAINTENANCE_SCHEDULE_ROLES,
  ): Promise<Actor> {
    const { memberId, scope } = await this.warehousesService.assertScopedAccess(
      farmId,
      clerkUserId,
      true,
      allowedRoles,
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
    return { memberId, userId: actor.userId, scope };
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

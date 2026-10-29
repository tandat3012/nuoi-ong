import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../db/database.service';
import {
  assetAssignments,
  assetIncidents,
  assetStatus,
  assets,
  auditLogs,
  farmMembers,
  inventoryBalances,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  users,
  warehouses,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import {
  AssignAssetDto,
  CreateAssetDto,
  RecoverAssetDto,
  ReportAssetIncidentDto,
  RetireAssetDto,
  TransferAssetDto,
  UpdateAssetDto,
  UpdateAssetIncidentStatusDto,
} from './dto/asset-lifecycle.dto';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type AssetStatus = (typeof assetStatus.enumValues)[number];
export type Actor = { memberId: string; userId: string };

export const TRANSFER_PENDING_CONFLICT =
  'Asset has a pending transfer request; approve or reject it first';
type LocationRow = {
  id: string;
  warehouseId: string | null;
  code: string;
  name: string;
};

@Injectable()
export class AssetLifecycleService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async create(farmId: string, clerkUserId: string, input: CreateAssetDto) {
    const actor = await this.actor(farmId, clerkUserId);
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        await this.activeItem(tx, farmId, input.itemId);
        await this.activeWarehouse(tx, farmId, input.warehouseId);
        const location = await this.activeLocation(
          tx,
          farmId,
          input.locationId,
          input.warehouseId,
        );
        const [asset] = await tx
          .insert(assets)
          .values({
            farmId,
            itemId: input.itemId,
            currentLocationId: location.id,
            assetCode: input.assetCode,
            serialNumber: input.serialNumber,
            purchaseDate: input.purchaseDate,
            purchasePrice: input.purchasePrice,
            warrantyExpiryDate: input.warrantyExpiryDate,
            nextMaintenanceDate: input.nextMaintenanceDate,
            note: input.note,
          })
          .returning();
        const now = new Date().toISOString();
        await tx
          .insert(inventoryBalances)
          .values({
            farmId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            lotId: null,
            quantityOnHand: '1',
          })
          .onConflictDoUpdate({
            target: [
              inventoryBalances.itemId,
              inventoryBalances.lotId,
              inventoryBalances.warehouseId,
            ],
            set: {
              quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`,
              updatedAt: now,
            },
          });
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          assetId: asset.id,
          transactionType: 'RECEIPT',
          quantityChange: '1',
          sourceType: 'ASSET_CREATE',
          sourceId: asset.id,
          performedByMemberId: actor.memberId,
          reason: input.note ?? null,
        });
        await this.audit(
          tx,
          farmId,
          actor.userId,
          'ASSET_CREATED',
          asset.id,
          null,
          {
            summary: `Tạo tài sản ${asset.assetCode} tại ${location.code} — ${location.name}`,
            status: asset.status,
            locationId: location.id,
          },
        );
        return asset;
      });
    } catch (error) {
      this.mapUniqueConflict(error);
    }
  }

  async update(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateAssetDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    const fields = [
      'serialNumber',
      'purchaseDate',
      'purchasePrice',
      'warrantyExpiryDate',
      'nextMaintenanceDate',
      'note',
    ] as const;
    if (!fields.some((field) => input[field] !== undefined))
      throw new BadRequestException('At least one metadata field is required');
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const asset = await this.getAsset(tx, id, farmId, true);
        if (asset.updatedAt !== input.updatedAt)
          throw new ConflictException(
            'Asset changed since it was loaded; reload before editing',
          );
        if (
          input.nextMaintenanceDate &&
          asset.lastMaintenanceDate &&
          input.nextMaintenanceDate < asset.lastMaintenanceDate
        )
          throw new BadRequestException(
            'Next maintenance date cannot precede the last maintenance date',
          );
        const changes: Partial<typeof assets.$inferInsert> = {
          updatedAt: new Date().toISOString(),
        };
        const oldData: Record<string, unknown> = {};
        const newData: Record<string, unknown> = {};
        const labels: Record<(typeof fields)[number], string> = {
          serialNumber: 'số sê-ri',
          purchaseDate: 'ngày mua',
          purchasePrice: 'giá mua',
          warrantyExpiryDate: 'ngày hết bảo hành',
          nextMaintenanceDate: 'ngày bảo trì tiếp theo',
          note: 'ghi chú',
        };
        for (const field of fields) {
          if (input[field] === undefined) continue;
          changes[field] = input[field];
          oldData[field] = asset[field];
          newData[field] = input[field];
        }
        const [updated] = await tx
          .update(assets)
          .set(changes)
          .where(
            and(
              eq(assets.id, id),
              eq(assets.farmId, farmId),
              eq(assets.updatedAt, input.updatedAt),
            ),
          )
          .returning();
        if (!updated)
          throw new ConflictException(
            'Asset changed since it was loaded; reload before editing',
          );
        await this.audit(
          tx,
          farmId,
          actor.userId,
          'ASSET_METADATA_UPDATED',
          id,
          oldData,
          {
            ...newData,
            summary: `Đã cập nhật ${fields
              .filter((field) => input[field] !== undefined)
              .map((field) => labels[field])
              .join(', ')}`,
          },
        );
        return updated;
      });
    } catch (error) {
      this.mapUniqueConflict(error);
    }
  }

  async assign(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: AssignAssetDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const preliminary = await this.getAsset(tx, id, farmId);
      if (!['AVAILABLE', 'ASSIGNED', 'IN_USE'].includes(preliminary.status))
        throw new ConflictException(
          'Only AVAILABLE, ASSIGNED, or IN_USE assets can be assigned',
        );
      let balanceId: string | undefined;
      let sourceWarehouseId: string | undefined;
      if (preliminary.status === 'AVAILABLE') {
        const sourceLocation = preliminary.currentLocationId
          ? await this.locationWithWarehouse(
              tx,
              farmId,
              preliminary.currentLocationId,
            )
          : undefined;
        if (!sourceLocation?.warehouseId)
          throw new ConflictException(
            'Available asset must have an active warehouse location',
          );
        sourceWarehouseId = sourceLocation.warehouseId;
        await this.activeWarehouse(tx, farmId, sourceWarehouseId);
        balanceId = await this.lockAvailableBalance(
          tx,
          farmId,
          sourceWarehouseId,
          preliminary.itemId,
        );
      }

      const asset = await this.getAsset(tx, id, farmId, true);
      if (
        asset.status !== preliminary.status ||
        asset.currentLocationId !== preliminary.currentLocationId ||
        asset.itemId !== preliminary.itemId
      )
        throw new ConflictException(
          'Asset changed during assignment; reload before retrying',
        );
      await this.assertNoActiveMaintenance(tx, farmId, id);
      if (asset.status === 'AVAILABLE') {
        const source = await this.activeLocation(
          tx,
          farmId,
          asset.currentLocationId!,
          sourceWarehouseId,
        );
        if (source.warehouseId !== sourceWarehouseId)
          throw new ConflictException(
            'Asset source location changed during assignment',
          );
        await this.activeWarehouse(tx, farmId, sourceWarehouseId);
      }
      const assignee = await this.activeMember(
        tx,
        farmId,
        input.assignedToMemberId,
      );
      const destination = await this.activeLocation(
        tx,
        farmId,
        input.locationId,
      );
      if (destination.warehouseId)
        await this.activeWarehouse(tx, farmId, destination.warehouseId);
      const [activeAssignment] = await tx
        .select()
        .from(assetAssignments)
        .where(
          and(
            eq(assetAssignments.farmId, farmId),
            eq(assetAssignments.assetId, id),
            eq(assetAssignments.status, 'ACTIVE'),
          ),
        )
        .for('update')
        .limit(1);
      if (activeAssignment?.assignedToMemberId === input.assignedToMemberId)
        throw new ConflictException('Asset is already assigned to this member');
      const now = new Date().toISOString();
      if (activeAssignment)
        await tx
          .update(assetAssignments)
          .set({ status: 'CANCELLED', updatedAt: now })
          .where(eq(assetAssignments.id, activeAssignment.id));
      const [assignment] = await tx
        .insert(assetAssignments)
        .values({
          farmId,
          assetId: id,
          assignedToMemberId: input.assignedToMemberId,
          assignedByMemberId: actor.memberId,
          expectedReturnAt: input.expectedReturnAt ?? null,
          note: input.note ?? null,
        })
        .returning();
      let status: AssetStatus = asset.status;
      if (asset.status === 'AVAILABLE') {
        await this.debitBalance(tx, balanceId!);
        status = 'ASSIGNED';
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: sourceWarehouseId!,
          itemId: asset.itemId,
          assetId: id,
          transactionType: 'ASSIGNMENT_OUT',
          quantityChange: '-1',
          sourceType: 'ASSET_ASSIGNMENT',
          sourceId: assignment.id,
          performedByMemberId: actor.memberId,
          reason: input.note ?? null,
        });
      }
      const [updated] = await tx
        .update(assets)
        .set({
          status,
          currentLocationId: destination.id,
          updatedAt: now,
        })
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        activeAssignment ? 'ASSET_REASSIGNED' : 'ASSET_ASSIGNED',
        id,
        { status: asset.status, locationId: asset.currentLocationId },
        {
          status,
          locationId: destination.id,
          assignmentId: assignment.id,
          referenceId: assignment.id,
          summary: `${
            activeAssignment ? 'Bàn giao lại' : 'Cấp phát'
          } cho ${assignee.name} tại ${destination.code} — ${destination.name}`,
        },
      );
      return updated;
    });
  }

  async startUse(id: string, farmId: string, clerkUserId: string) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const asset = await this.getAsset(tx, id, farmId, true);
      if (asset.status !== 'ASSIGNED')
        throw new ConflictException('Only ASSIGNED assets can start use');
      await this.assertNoActiveMaintenance(tx, farmId, id);
      const [assignment] = await tx
        .select({ id: assetAssignments.id })
        .from(assetAssignments)
        .where(
          and(
            eq(assetAssignments.farmId, farmId),
            eq(assetAssignments.assetId, id),
            eq(assetAssignments.status, 'ACTIVE'),
          ),
        )
        .for('update')
        .limit(1);
      if (!assignment)
        throw new ConflictException('An active assignment is required');
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(assets)
        .set({ status: 'IN_USE', updatedAt: now })
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_USE_STARTED',
        id,
        { status: asset.status },
        { status: 'IN_USE', summary: 'Người nhận bắt đầu sử dụng tài sản' },
      );
      return updated;
    });
  }

  async transfer(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: TransferAssetDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction((tx) =>
      this.transferInTransaction(tx, id, farmId, actor, input),
    );
  }

  /**
   * Moves the asset inside the caller's transaction and leaves it AVAILABLE.
   * Approving a transfer request passes `fromStatus` TRANSFER_PENDING.
   */
  async transferInTransaction(
    tx: Transaction,
    id: string,
    farmId: string,
    actor: Actor,
    input: TransferAssetDto,
    fromStatus: 'AVAILABLE' | 'TRANSFER_PENDING' = 'AVAILABLE',
  ) {
    const preliminary = await this.getAsset(tx, id, farmId);
    if (preliminary.status !== fromStatus)
      throw new ConflictException('Only AVAILABLE assets can be transferred');
    if (!preliminary.currentLocationId)
      throw new ConflictException('Asset has no recorded source location');
    const source = await this.locationWithWarehouse(
      tx,
      farmId,
      preliminary.currentLocationId,
    );
    if (!source.warehouseId)
      throw new ConflictException(
        'Asset source location is not associated with a warehouse',
      );
    await this.activeWarehouse(tx, farmId, source.warehouseId);
    await this.activeWarehouse(tx, farmId, input.warehouseId);
    const destinationPreview = await this.locationWithWarehouse(
      tx,
      farmId,
      input.locationId,
    );
    if (destinationPreview.warehouseId !== input.warehouseId)
      throw new ConflictException(
        'Receiving location must belong to the selected warehouse',
      );
    if (preliminary.currentLocationId === input.locationId)
      throw new ConflictException('Asset is already at this location');

    const warehouseIds = [
      ...new Set([source.warehouseId, input.warehouseId]),
    ].sort((left, right) => left.localeCompare(right));
    for (const warehouseId of warehouseIds)
      await this.ensureBalance(tx, farmId, warehouseId, preliminary.itemId);
    const balances = new Map<string, string>();
    for (const warehouseId of warehouseIds) {
      const [balance] = await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.farmId, farmId),
            eq(inventoryBalances.warehouseId, warehouseId),
            eq(inventoryBalances.itemId, preliminary.itemId),
            isNull(inventoryBalances.lotId),
            warehouseId === source.warehouseId
              ? gte(inventoryBalances.quantityOnHand, '1')
              : undefined,
          ),
        )
        .for('update')
        .limit(1);
      if (!balance)
        throw new ConflictException(
          warehouseId === source.warehouseId
            ? 'Asset is missing from source warehouse inventory'
            : 'Receiving warehouse balance is unavailable',
        );
      balances.set(warehouseId, balance.id);
    }

    const asset = await this.getAsset(tx, id, farmId, true);
    if (
      asset.status !== fromStatus ||
      asset.itemId !== preliminary.itemId ||
      asset.currentLocationId !== preliminary.currentLocationId
    )
      throw new ConflictException(
        'Asset changed during transfer; reload before retrying',
      );
    await this.assertNoActiveMaintenance(tx, farmId, id);
    const lockedSource = await this.activeLocation(
      tx,
      farmId,
      asset.currentLocationId,
      source.warehouseId,
    );
    const destination = await this.activeLocation(
      tx,
      farmId,
      input.locationId,
      input.warehouseId,
    );
    await this.activeWarehouse(tx, farmId, source.warehouseId);
    await this.activeWarehouse(tx, farmId, input.warehouseId);

    const now = new Date().toISOString();
    if (source.warehouseId !== input.warehouseId) {
      const sourceBalanceId = balances.get(source.warehouseId)!;
      const destinationBalanceId = balances.get(input.warehouseId)!;
      await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} - 1`,
          updatedAt: now,
        })
        .where(eq(inventoryBalances.id, sourceBalanceId));
      await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`,
          updatedAt: now,
        })
        .where(eq(inventoryBalances.id, destinationBalanceId));
      const movementGroupId = randomUUID();
      await tx.insert(inventoryTransactions).values([
        {
          farmId,
          warehouseId: source.warehouseId,
          itemId: asset.itemId,
          assetId: id,
          transactionType: 'TRANSFER_OUT',
          quantityChange: '-1',
          sourceType: 'ASSET_TRANSFER',
          sourceId: id,
          movementGroupId,
          performedByMemberId: actor.memberId,
          reason: input.note ?? null,
        },
        {
          farmId,
          warehouseId: input.warehouseId,
          itemId: asset.itemId,
          assetId: id,
          transactionType: 'TRANSFER_IN',
          quantityChange: '1',
          sourceType: 'ASSET_TRANSFER',
          sourceId: id,
          movementGroupId,
          performedByMemberId: actor.memberId,
          reason: input.note ?? null,
        },
      ]);
    }
    const [updated] = await tx
      .update(assets)
      .set({
        currentLocationId: destination.id,
        status: 'AVAILABLE',
        updatedAt: now,
      })
      .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
      .returning();
    await this.audit(
      tx,
      farmId,
      actor.userId,
      'ASSET_TRANSFERRED',
      id,
      { locationId: lockedSource.id, warehouseId: source.warehouseId },
      {
        locationId: destination.id,
        warehouseId: input.warehouseId,
        summary: `Chuyển từ ${lockedSource.code} — ${lockedSource.name} đến ${destination.code} — ${destination.name}`,
      },
    );
    return updated;
  }

  async retire(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: RetireAssetDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const preliminary = await this.getAsset(tx, id, farmId);
      if (preliminary.status !== 'AVAILABLE')
        throw new ConflictException(
          'Return assigned or in-use assets before retiring them',
        );
      if (!preliminary.currentLocationId)
        throw new ConflictException('Available asset has no source location');
      const locationPreview = await this.locationWithWarehouse(
        tx,
        farmId,
        preliminary.currentLocationId,
      );
      if (!locationPreview.warehouseId)
        throw new ConflictException(
          'Available asset must be in a warehouse before retirement',
        );
      await this.activeWarehouse(tx, farmId, locationPreview.warehouseId);
      const balanceId = await this.lockAvailableBalance(
        tx,
        farmId,
        locationPreview.warehouseId,
        preliminary.itemId,
      );
      const asset = await this.getAsset(tx, id, farmId, true);
      if (
        asset.status !== 'AVAILABLE' ||
        asset.itemId !== preliminary.itemId ||
        asset.currentLocationId !== preliminary.currentLocationId
      )
        throw new ConflictException(
          'Asset changed during retirement; reload before retrying',
        );
      await this.assertNoActiveMaintenance(tx, farmId, id);
      await this.activeLocation(
        tx,
        farmId,
        asset.currentLocationId,
        locationPreview.warehouseId,
      );
      const now = new Date().toISOString();
      await this.debitBalance(tx, balanceId);
      const [updated] = await tx
        .update(assets)
        .set({ status: 'RETIRED', updatedAt: now })
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .returning();
      await tx.insert(inventoryTransactions).values({
        farmId,
        warehouseId: locationPreview.warehouseId,
        itemId: asset.itemId,
        assetId: id,
        transactionType: 'ADJUSTMENT_OUT',
        quantityChange: '-1',
        sourceType: 'ASSET_RETIRE',
        sourceId: id,
        performedByMemberId: actor.memberId,
        reason: input.note,
      });
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_RETIRED',
        id,
        { status: asset.status },
        { status: 'RETIRED', summary: `Ngừng sử dụng: ${input.note}` },
      );
      return updated;
    });
  }

  async reportIncident(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: ReportAssetIncidentDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const preliminary = await this.getAsset(tx, id, farmId);
      if (['LOST', 'RETIRED'].includes(preliminary.status))
        throw new ConflictException(
          'Terminal assets cannot receive new incidents',
        );
      if (preliminary.status === 'TRANSFER_PENDING')
        throw new ConflictException(TRANSFER_PENDING_CONFLICT);
      let balanceId: string | undefined;
      let sourceWarehouseId: string | undefined;
      if (input.incidentType === 'LOSS' && preliminary.status === 'AVAILABLE') {
        if (!preliminary.currentLocationId)
          throw new ConflictException('Available asset has no source location');
        const source = await this.locationWithWarehouse(
          tx,
          farmId,
          preliminary.currentLocationId,
        );
        if (!source.warehouseId)
          throw new ConflictException(
            'Available asset must be in a warehouse before it can be reported lost',
          );
        sourceWarehouseId = source.warehouseId;
        await this.activeWarehouse(tx, farmId, sourceWarehouseId);
        balanceId = await this.lockAvailableBalance(
          tx,
          farmId,
          sourceWarehouseId,
          preliminary.itemId,
        );
      }
      const asset = await this.getAsset(tx, id, farmId, true);
      if (
        asset.status !== preliminary.status ||
        asset.itemId !== preliminary.itemId ||
        asset.currentLocationId !== preliminary.currentLocationId
      )
        throw new ConflictException(
          'Asset changed while reporting; reload before retrying',
        );
      if (['LOST', 'RETIRED'].includes(asset.status))
        throw new ConflictException(
          'Terminal assets cannot receive new incidents',
        );
      if (input.incidentType === 'LOSS')
        await this.assertNoActiveMaintenance(tx, farmId, id);
      if (input.incidentType === 'LOSS' && asset.status === 'AVAILABLE') {
        if (!asset.currentLocationId || !sourceWarehouseId || !balanceId)
          throw new ConflictException(
            'Available asset source inventory is unavailable',
          );
        await this.activeLocation(
          tx,
          farmId,
          asset.currentLocationId,
          sourceWarehouseId,
        );
        await this.activeWarehouse(tx, farmId, sourceWarehouseId);
      }
      const [incident] = await tx
        .insert(assetIncidents)
        .values({
          farmId,
          assetId: id,
          reportedByMemberId: actor.memberId,
          incidentType: input.incidentType,
          description: input.description,
          severity:
            input.severity as (typeof assetIncidents.$inferInsert)['severity'],
        })
        .returning();
      const now = new Date().toISOString();
      let updated = asset;
      if (input.incidentType === 'LOSS') {
        if (asset.status === 'AVAILABLE') {
          await this.debitBalance(tx, balanceId!);
          await tx.insert(inventoryTransactions).values({
            farmId,
            warehouseId: sourceWarehouseId!,
            itemId: asset.itemId,
            assetId: id,
            transactionType: 'ADJUSTMENT_OUT',
            quantityChange: '-1',
            sourceType: 'ASSET_LOSS',
            sourceId: incident.id,
            performedByMemberId: actor.memberId,
            reason: input.description,
          });
        }
        await tx
          .update(assetAssignments)
          .set({ status: 'CANCELLED', updatedAt: now })
          .where(
            and(
              eq(assetAssignments.farmId, farmId),
              eq(assetAssignments.assetId, id),
              eq(assetAssignments.status, 'ACTIVE'),
            ),
          );
        [updated] = await tx
          .update(assets)
          .set({ status: 'LOST', updatedAt: now })
          .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
          .returning();
      }
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_INCIDENT_REPORTED',
        id,
        { status: asset.status },
        {
          status: updated.status,
          referenceId: incident.id,
          summary: `${input.incidentType === 'LOSS' ? 'Báo mất' : 'Ghi nhận sự cố'}: ${input.description}`,
        },
      );
      return incident;
    });
  }

  async updateIncidentStatus(
    id: string,
    incidentId: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateAssetIncidentStatusDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const asset = await this.getAsset(tx, id, farmId, true);
      const [incident] = await tx
        .select()
        .from(assetIncidents)
        .where(
          and(
            eq(assetIncidents.id, incidentId),
            eq(assetIncidents.assetId, id),
            eq(assetIncidents.farmId, farmId),
          ),
        )
        .for('update')
        .limit(1);
      if (!incident) throw new NotFoundException('Asset incident not found');
      const allowed =
        (incident.status === 'OPEN' &&
          ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'].includes(input.status)) ||
        (incident.status === 'IN_PROGRESS' &&
          ['RESOLVED', 'CANCELLED'].includes(input.status));
      if (!allowed)
        throw new ConflictException(
          'Incident is terminal or the requested status transition is invalid',
        );
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(assetIncidents)
        .set({
          status: input.status,
          resolvedAt: input.status === 'RESOLVED' ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(assetIncidents.id, incidentId),
            eq(assetIncidents.assetId, id),
            eq(assetIncidents.farmId, farmId),
          ),
        )
        .returning();
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_INCIDENT_STATUS',
        id,
        { status: incident.status },
        {
          status: updated.status,
          referenceId: incident.id,
          summary: `Cập nhật báo cáo sự cố: ${incident.status} → ${updated.status}`,
        },
      );
      return { incident: updated, asset };
    });
  }

  async recover(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: RecoverAssetDto,
  ) {
    const actor = await this.actor(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const preliminary = await this.getAsset(tx, id, farmId);
      if (preliminary.status !== 'LOST')
        throw new ConflictException('Only LOST assets can be recovered');
      await this.activeWarehouse(tx, farmId, input.warehouseId);
      await this.previewLocationInWarehouse(
        tx,
        farmId,
        input.locationId,
        input.warehouseId,
      );
      await this.ensureBalance(
        tx,
        farmId,
        input.warehouseId,
        preliminary.itemId,
      );
      const balance = await this.lockBalance(
        tx,
        farmId,
        input.warehouseId,
        preliminary.itemId,
      );
      const asset = await this.getAsset(tx, id, farmId, true);
      if (asset.status !== 'LOST' || asset.itemId !== preliminary.itemId)
        throw new ConflictException(
          'Asset changed during recovery; reload before retrying',
        );
      const location = await this.activeLocation(
        tx,
        farmId,
        input.locationId,
        input.warehouseId,
      );
      await this.activeWarehouse(tx, farmId, input.warehouseId);
      await this.assertNoActiveMaintenance(tx, farmId, id);
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(assets)
        .set({
          status: 'AVAILABLE',
          currentLocationId: location.id,
          updatedAt: now,
        })
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .returning();
      await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`,
          updatedAt: now,
        })
        .where(eq(inventoryBalances.id, balance.id));
      await tx.insert(inventoryTransactions).values({
        farmId,
        warehouseId: input.warehouseId,
        itemId: asset.itemId,
        assetId: id,
        transactionType: 'RETURN_IN',
        quantityChange: '1',
        sourceType: 'ASSET_RECOVERY',
        sourceId: id,
        performedByMemberId: actor.memberId,
        reason: input.note ?? null,
      });
      await this.audit(
        tx,
        farmId,
        actor.userId,
        'ASSET_RECOVERED',
        id,
        { status: asset.status, locationId: asset.currentLocationId },
        {
          status: 'AVAILABLE',
          locationId: location.id,
          summary: `Đã nhập lại tài sản tại ${location.code} — ${location.name}`,
        },
      );
      return updated;
    });
  }

  private async actor(farmId: string, clerkUserId: string): Promise<Actor> {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
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
      throw new ForbiddenException('Active farm membership is required');
    return { memberId, userId: actor.userId };
  }

  private async activeMember(
    db: Pick<Db, 'select'> | Pick<Transaction, 'select'>,
    farmId: string,
    memberId: string,
  ) {
    const [member] = await db
      .select({
        id: farmMembers.id,
        name: sql<string>`coalesce(${users.fullName}, ${users.email})`,
      })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(
        and(
          eq(farmMembers.id, memberId),
          eq(farmMembers.farmId, farmId),
          eq(farmMembers.status, 'ACTIVE'),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!member)
      throw new ConflictException(
        'Assigned member must be active in this farm',
      );
    return member;
  }

  private async activeItem(tx: Transaction, farmId: string, itemId: string) {
    const [item] = await tx
      .select({ id: items.id, trackingMode: items.trackingMode })
      .from(items)
      .where(
        and(
          eq(items.id, itemId),
          eq(items.farmId, farmId),
          eq(items.status, 'ACTIVE'),
        ),
      )
      .for('share')
      .limit(1);
    if (!item || item.trackingMode !== 'ASSET')
      throw new ConflictException(
        'Item must be active and track individual assets',
      );
    return item;
  }

  private async activeWarehouse(
    tx: Transaction,
    farmId: string,
    warehouseId: string,
  ) {
    const [warehouse] = await tx
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, warehouseId),
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
    return warehouse;
  }

  private async activeLocation(
    tx: Transaction,
    farmId: string,
    locationId: string,
    warehouseId?: string,
  ): Promise<LocationRow> {
    const [location] = await tx
      .select({
        id: locations.id,
        warehouseId: locations.warehouseId,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.farmId, farmId),
          eq(locations.status, 'ACTIVE'),
          warehouseId ? eq(locations.warehouseId, warehouseId) : undefined,
        ),
      )
      .for('share')
      .limit(1);
    if (!location)
      throw new ConflictException('Location must be active in this farm');
    return location;
  }

  private async previewLocationInWarehouse(
    tx: Transaction,
    farmId: string,
    locationId: string,
    warehouseId: string,
  ) {
    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.farmId, farmId),
          eq(locations.warehouseId, warehouseId),
          eq(locations.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!location)
      throw new ConflictException(
        'Receiving location must be active in the selected warehouse',
      );
  }

  private async locationWithWarehouse(
    tx: Transaction,
    farmId: string,
    locationId: string,
  ): Promise<LocationRow> {
    const [location] = await tx
      .select({
        id: locations.id,
        warehouseId: locations.warehouseId,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.farmId, farmId),
          eq(locations.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!location)
      throw new ConflictException('Asset location must be active in this farm');
    return location;
  }

  private async lockAvailableBalance(
    tx: Transaction,
    farmId: string,
    warehouseId: string,
    itemId: string,
  ) {
    const [balance] = await tx
      .select({ id: inventoryBalances.id })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, farmId),
          eq(inventoryBalances.warehouseId, warehouseId),
          eq(inventoryBalances.itemId, itemId),
          isNull(inventoryBalances.lotId),
          gte(inventoryBalances.quantityOnHand, '1'),
        ),
      )
      .for('update')
      .limit(1);
    if (!balance)
      throw new ConflictException('Asset is missing from warehouse inventory');
    return balance.id;
  }

  private async lockBalance(
    tx: Transaction,
    farmId: string,
    warehouseId: string,
    itemId: string,
  ) {
    const [balance] = await tx
      .select({ id: inventoryBalances.id })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, farmId),
          eq(inventoryBalances.warehouseId, warehouseId),
          eq(inventoryBalances.itemId, itemId),
          isNull(inventoryBalances.lotId),
        ),
      )
      .for('update')
      .limit(1);
    if (!balance)
      throw new ConflictException('Receiving inventory balance is unavailable');
    return balance;
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

  private async debitBalance(tx: Transaction, balanceId: string) {
    const [updated] = await tx
      .update(inventoryBalances)
      .set({
        quantityOnHand: sql`${inventoryBalances.quantityOnHand} - 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(inventoryBalances.id, balanceId),
          gte(inventoryBalances.quantityOnHand, '1'),
        ),
      )
      .returning({ id: inventoryBalances.id });
    if (!updated)
      throw new ConflictException('Asset is missing from warehouse inventory');
  }

  private async assertNoActiveMaintenance(
    tx: Transaction,
    farmId: string,
    assetId: string,
  ) {
    const [maintenance] = await tx
      .select({ id: maintenanceRecords.id })
      .from(maintenanceRecords)
      .where(
        and(
          eq(maintenanceRecords.farmId, farmId),
          eq(maintenanceRecords.assetId, assetId),
          inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']),
        ),
      )
      .limit(1);
    if (maintenance)
      throw new ConflictException('Asset has active maintenance');
  }

  private async getAsset(
    tx: Transaction,
    id: string,
    farmId: string,
    forUpdate = false,
  ) {
    const query = tx
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
      .limit(1);
    const [asset] = forUpdate ? await query.for('update') : await query;
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private async audit(
    tx: Transaction,
    farmId: string,
    userId: string,
    action: string,
    entityId: string,
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null,
    entityType = 'ASSET',
  ) {
    await tx.insert(auditLogs).values({
      farmId,
      userId,
      action,
      entityType,
      entityId,
      oldData,
      newData,
    });
  }

  private mapUniqueConflict(error: unknown): never {
    const databaseError = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const code = databaseError?.code ?? databaseError?.cause?.code;
    const constraint =
      databaseError?.constraint ?? databaseError?.cause?.constraint;
    if (code === '23505' && constraint === 'uq_asset_code_per_farm')
      throw new ConflictException('Asset code already exists in this farm');
    if (code === '23505' && constraint === 'ux_asset_serial_per_farm')
      throw new ConflictException(
        'Asset serial number already exists in this farm',
      );
    throw error;
  }
}

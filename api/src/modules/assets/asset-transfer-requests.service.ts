import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assetTransferRequests,
  assets,
  auditLogs,
  documentStatus,
  farmMembers,
  items,
  locations,
  maintenanceRecords,
  users,
  warehouses,
} from '../../db/schema';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
} from '../notifications/notification-events';
import { WarehousesService } from '../warehouses/warehouses.service';
import { AssetLifecycleService } from './asset-lifecycle.service';
import { CreateAssetTransferRequestDto } from './dto/asset-lifecycle.dto';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type TransferRequest = typeof assetTransferRequests.$inferSelect;

export interface AssetTransferRequestFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: (typeof documentStatus.enumValues)[number];
  assetId?: string;
}

const fromLocations = alias(locations, 'transfer_from_locations');
const toLocations = alias(locations, 'transfer_to_locations');
const requesterMembers = alias(farmMembers, 'transfer_requesters');
const requesterUsers = alias(users, 'transfer_requester_users');
const reviewerMembers = alias(farmMembers, 'transfer_reviewers');
const reviewerUsers = alias(users, 'transfer_reviewer_users');

const NOTIFICATION_TITLES = {
  PENDING_APPROVAL: 'Yêu cầu chuyển tài sản cần duyệt',
  CONFIRMED: 'Yêu cầu chuyển tài sản đã được duyệt',
  REJECTED: 'Yêu cầu chuyển tài sản bị từ chối',
};

/**
 * Employees ask to move an AVAILABLE asset to another warehouse location. The
 * asset stays TRANSFER_PENDING (no other lifecycle action) until an approver runs
 * the transfer or rejects the request, which makes it AVAILABLE again.
 */
@Injectable()
export class AssetTransferRequestsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
    private readonly lifecycleService: AssetLifecycleService,
  ) {}

  async list(filters: AssetTransferRequestFilters) {
    const conditions = await this.scope(filters.farmId, filters.clerkUserId);
    if (filters.status)
      conditions.push(eq(assetTransferRequests.status, filters.status));
    if (filters.assetId)
      conditions.push(eq(assetTransferRequests.assetId, filters.assetId));
    const where = and(...conditions);
    const [data, [total]] = await Promise.all([
      this.detailQuery()
        .where(where)
        .orderBy(
          desc(assetTransferRequests.createdAt),
          desc(assetTransferRequests.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(assetTransferRequests)
        .where(where),
    ]);
    const totalItems = Number(total?.value ?? 0);
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
    const conditions = await this.scope(farmId, clerkUserId);
    const [request] = await this.detailQuery()
      .where(and(eq(assetTransferRequests.id, id), ...conditions))
      .limit(1);
    if (!request)
      throw new NotFoundException('Asset transfer request not found');
    return request;
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateAssetTransferRequestDto,
  ) {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (!roleCodes.includes('EMPLOYEE'))
      throw new ForbiddenException(
        'Only farm employees can request an asset transfer',
      );
    return this.databaseService.db
      .transaction(async (tx) => {
        const [asset] = await tx
          .select({
            assetCode: assets.assetCode,
            status: assets.status,
            currentLocationId: assets.currentLocationId,
          })
          .from(assets)
          .where(and(eq(assets.id, input.assetId), eq(assets.farmId, farmId)))
          .for('update')
          .limit(1);
        if (!asset) throw new NotFoundException('Asset not found');
        if (asset.status !== 'AVAILABLE')
          throw new ConflictException(
            'Only AVAILABLE assets can be requested for transfer',
          );
        if (!asset.currentLocationId)
          throw new ConflictException('Asset has no recorded source location');
        if (asset.currentLocationId === input.locationId)
          throw new ConflictException('Asset is already at this location');
        await this.assertDestination(tx, farmId, input);
        await this.assertNoActiveMaintenance(tx, farmId, input.assetId);
        await tx
          .update(assets)
          .set({
            status: 'TRANSFER_PENDING',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(assets.id, input.assetId));
        const [request] = await tx
          .insert(assetTransferRequests)
          .values({
            farmId,
            assetId: input.assetId,
            requestedByMemberId: memberId,
            fromLocationId: asset.currentLocationId,
            toWarehouseId: input.warehouseId,
            toLocationId: input.locationId,
            note: input.note?.trim() || null,
          })
          .returning();
        await this.audit(tx, memberId, 'CREATE', null, request);
        await notifyFarmApprovers(
          tx,
          this.notification(request, asset.assetCode, 'PENDING_APPROVAL'),
          memberId,
        );
        return request;
      })
      .catch((error: unknown) => {
        const databaseError = error as {
          constraint?: string;
          cause?: { constraint?: string };
        };
        const constraint =
          databaseError?.constraint ?? databaseError?.cause?.constraint;
        if (constraint === 'ux_pending_asset_transfer_request_per_asset')
          throw new ConflictException(
            'This asset already has a pending transfer request',
          );
        throw error;
      });
  }

  async approve(id: string, farmId: string, clerkUserId: string) {
    const reviewer = await this.reviewer(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const { request, assetCode } = await this.lockPending(tx, id, farmId);
      const asset = await this.lifecycleService.transferInTransaction(
        tx,
        request.assetId,
        farmId,
        reviewer,
        {
          warehouseId: request.toWarehouseId,
          locationId: request.toLocationId,
          note: request.note,
        },
        'TRANSFER_PENDING',
      );
      const updated = await this.review(tx, request, reviewer.memberId, {
        status: 'CONFIRMED',
      });
      await this.audit(tx, reviewer.memberId, 'CONFIRM', request, updated);
      await notifyDocumentCreator(
        tx,
        this.notification(request, assetCode, 'CONFIRMED'),
        request.requestedByMemberId,
      );
      return { request: updated, asset };
    });
  }

  async reject(
    id: string,
    farmId: string,
    clerkUserId: string,
    rejectionReason: string,
  ) {
    const reviewer = await this.reviewer(farmId, clerkUserId);
    const reason = rejectionReason.trim();
    if (reason.length < 3)
      throw new BadRequestException(
        'Rejection reason must have at least 3 characters',
      );
    return this.databaseService.db.transaction(async (tx) => {
      const { request, assetCode } = await this.lockPending(tx, id, farmId);
      await tx
        .update(assets)
        .set({ status: 'AVAILABLE', updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(assets.id, request.assetId),
            eq(assets.status, 'TRANSFER_PENDING'),
          ),
        );
      const updated = await this.review(tx, request, reviewer.memberId, {
        status: 'REJECTED',
        rejectionReason: reason,
      });
      await this.audit(tx, reviewer.memberId, 'REJECT', request, updated);
      await notifyDocumentCreator(
        tx,
        {
          ...this.notification(request, assetCode, 'REJECTED'),
          rejectionReason: reason,
        },
        request.requestedByMemberId,
      );
      return updated;
    });
  }

  private detailQuery() {
    return this.databaseService.db
      .select({
        ...getTableColumns(assetTransferRequests),
        assetCode: assets.assetCode,
        itemName: items.name,
        fromLocationCode: fromLocations.code,
        fromLocationName: fromLocations.name,
        toLocationCode: toLocations.code,
        toLocationName: toLocations.name,
        toWarehouseCode: warehouses.code,
        toWarehouseName: warehouses.name,
        requestedByName: requesterUsers.fullName,
        requestedByEmail: requesterUsers.email,
        reviewedByName: reviewerUsers.fullName,
        reviewedByEmail: reviewerUsers.email,
      })
      .from(assetTransferRequests)
      .innerJoin(assets, eq(assets.id, assetTransferRequests.assetId))
      .innerJoin(items, eq(items.id, assets.itemId))
      .leftJoin(
        fromLocations,
        eq(fromLocations.id, assetTransferRequests.fromLocationId),
      )
      .leftJoin(
        toLocations,
        eq(toLocations.id, assetTransferRequests.toLocationId),
      )
      .leftJoin(
        warehouses,
        eq(warehouses.id, assetTransferRequests.toWarehouseId),
      )
      .leftJoin(
        requesterMembers,
        eq(requesterMembers.id, assetTransferRequests.requestedByMemberId),
      )
      .leftJoin(requesterUsers, eq(requesterUsers.id, requesterMembers.userId))
      .leftJoin(
        reviewerMembers,
        eq(reviewerMembers.id, assetTransferRequests.reviewedByMemberId),
      )
      .leftJoin(reviewerUsers, eq(reviewerUsers.id, reviewerMembers.userId))
      .$dynamic();
  }

  /** Approvers see every request of the farm; anyone else only their own. */
  private async scope(farmId: string, clerkUserId: string) {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const conditions = [eq(assetTransferRequests.farmId, farmId)];
    if (!roleCodes.some((code) => ['ADMIN', 'FARM_OWNER'].includes(code)))
      conditions.push(eq(assetTransferRequests.requestedByMemberId, memberId));
    return conditions;
  }

  private async reviewer(farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    const [member] = await this.databaseService.db
      .select({ userId: farmMembers.userId })
      .from(farmMembers)
      .where(eq(farmMembers.id, memberId))
      .limit(1);
    return { memberId, userId: member.userId };
  }

  private async lockPending(tx: Transaction, id: string, farmId: string) {
    const [request] = await tx
      .select()
      .from(assetTransferRequests)
      .where(
        and(
          eq(assetTransferRequests.id, id),
          eq(assetTransferRequests.farmId, farmId),
        ),
      )
      .for('update')
      .limit(1);
    if (!request)
      throw new NotFoundException('Asset transfer request not found');
    if (request.status !== 'PENDING_APPROVAL')
      throw new ConflictException(
        'Only PENDING_APPROVAL transfer requests can be reviewed',
      );
    const [asset] = await tx
      .select({ assetCode: assets.assetCode })
      .from(assets)
      .where(eq(assets.id, request.assetId))
      .limit(1);
    return { request, assetCode: asset?.assetCode ?? '' };
  }

  private async review(
    tx: Transaction,
    request: TransferRequest,
    reviewerMemberId: string,
    changes: Pick<
      typeof assetTransferRequests.$inferInsert,
      'status' | 'rejectionReason'
    >,
  ) {
    const now = new Date().toISOString();
    const [updated] = await tx
      .update(assetTransferRequests)
      .set({
        ...changes,
        reviewedByMemberId: reviewerMemberId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(assetTransferRequests.id, request.id))
      .returning();
    return updated;
  }

  private async assertDestination(
    tx: Transaction,
    farmId: string,
    input: CreateAssetTransferRequestDto,
  ) {
    const [destination] = await tx
      .select({ id: locations.id })
      .from(locations)
      .innerJoin(warehouses, eq(warehouses.id, locations.warehouseId))
      .where(
        and(
          eq(locations.id, input.locationId),
          eq(locations.farmId, farmId),
          eq(locations.warehouseId, input.warehouseId),
          eq(locations.status, 'ACTIVE'),
          eq(warehouses.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!destination)
      throw new ConflictException(
        'Receiving location must be ACTIVE and belong to the selected ACTIVE warehouse',
      );
  }

  private async assertNoActiveMaintenance(
    tx: Transaction,
    farmId: string,
    assetId: string,
  ) {
    const [active] = await tx
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
    if (active) throw new ConflictException('Asset has active maintenance');
  }

  private notification(
    request: TransferRequest,
    assetCode: string,
    status: keyof typeof NOTIFICATION_TITLES,
  ) {
    return {
      farmId: request.farmId,
      entityType: 'ASSET_TRANSFER_REQUEST',
      entityId: request.id,
      documentCode: assetCode,
      documentKind: 'Yêu cầu chuyển tài sản',
      status,
      title: NOTIFICATION_TITLES[status],
    };
  }

  /** `createdByMemberId` lets employees read the history of their own requests via GET /audit-logs. */
  private async audit(
    tx: Transaction,
    actorMemberId: string,
    action: 'CREATE' | 'CONFIRM' | 'REJECT',
    before: TransferRequest | null,
    after: TransferRequest,
  ) {
    const snapshot = (request: TransferRequest) => ({
      createdByMemberId: request.requestedByMemberId,
      assetId: request.assetId,
      fromLocationId: request.fromLocationId,
      toWarehouseId: request.toWarehouseId,
      toLocationId: request.toLocationId,
      note: request.note,
      status: request.status,
      rejectionReason: request.rejectionReason,
    });
    await tx.insert(auditLogs).values({
      farmId: after.farmId,
      userId: sql`(SELECT user_id FROM farm_members WHERE id = ${actorMemberId})`,
      action,
      entityType: 'ASSET_TRANSFER_REQUEST',
      entityId: after.id,
      oldData: before && snapshot(before),
      newData: snapshot(after),
    });
  }
}

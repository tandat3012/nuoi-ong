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
  assets,
  auditLogs,
  documentStatus,
  farmMembers,
  items,
  maintenanceRecords,
  maintenanceRequests,
  users,
} from '../../db/schema';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
} from '../notifications/notification-events';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateMaintenanceRequestDto } from './dto/maintenance-request.dto';
import { MaintenanceService } from './maintenance.service';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;

export interface MaintenanceRequestFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: (typeof documentStatus.enumValues)[number];
  assetId?: string;
}

const requesterMembers = alias(farmMembers, 'maintenance_requesters');
const requesterUsers = alias(users, 'maintenance_requester_users');
const reviewerMembers = alias(farmMembers, 'maintenance_reviewers');
const reviewerUsers = alias(users, 'maintenance_reviewer_users');

const NOTIFICATION_TITLES = {
  PENDING_APPROVAL: 'Yêu cầu bảo trì cần duyệt',
  CONFIRMED: 'Yêu cầu bảo trì đã được duyệt',
  REJECTED: 'Yêu cầu bảo trì bị từ chối',
};

/**
 * Employees report an asset that needs repair or inspection; an approver either
 * schedules the maintenance (CONFIRMED) or rejects the request with a reason.
 */
@Injectable()
export class MaintenanceRequestsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  async list(filters: MaintenanceRequestFilters) {
    const conditions = await this.scope(filters.farmId, filters.clerkUserId);
    if (filters.status)
      conditions.push(eq(maintenanceRequests.status, filters.status));
    if (filters.assetId)
      conditions.push(eq(maintenanceRequests.assetId, filters.assetId));
    const where = and(...conditions);
    const [data, [total]] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(maintenanceRequests),
          assetCode: assets.assetCode,
          itemName: items.name,
        })
        .from(maintenanceRequests)
        .innerJoin(
          assets,
          and(
            eq(assets.id, maintenanceRequests.assetId),
            eq(assets.farmId, maintenanceRequests.farmId),
          ),
        )
        .innerJoin(items, eq(items.id, assets.itemId))
        .where(where)
        .orderBy(
          desc(maintenanceRequests.createdAt),
          desc(maintenanceRequests.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(maintenanceRequests)
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
    const [request] = await this.databaseService.db
      .select({
        ...getTableColumns(maintenanceRequests),
        assetCode: assets.assetCode,
        itemName: items.name,
        requestedByName: requesterUsers.fullName,
        requestedByEmail: requesterUsers.email,
        reviewedByName: reviewerUsers.fullName,
        reviewedByEmail: reviewerUsers.email,
        maintenanceScheduledAt: maintenanceRecords.scheduledAt,
        maintenanceRecordStatus: maintenanceRecords.status,
      })
      .from(maintenanceRequests)
      .innerJoin(
        assets,
        and(
          eq(assets.id, maintenanceRequests.assetId),
          eq(assets.farmId, maintenanceRequests.farmId),
        ),
      )
      .innerJoin(items, eq(items.id, assets.itemId))
      .leftJoin(
        requesterMembers,
        eq(requesterMembers.id, maintenanceRequests.requestedByMemberId),
      )
      .leftJoin(requesterUsers, eq(requesterUsers.id, requesterMembers.userId))
      .leftJoin(
        reviewerMembers,
        eq(reviewerMembers.id, maintenanceRequests.reviewedByMemberId),
      )
      .leftJoin(reviewerUsers, eq(reviewerUsers.id, reviewerMembers.userId))
      .leftJoin(
        maintenanceRecords,
        and(
          eq(maintenanceRecords.id, maintenanceRequests.maintenanceRecordId),
          eq(maintenanceRecords.farmId, maintenanceRequests.farmId),
        ),
      )
      .where(and(eq(maintenanceRequests.id, id), ...conditions))
      .limit(1);
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateMaintenanceRequestDto,
  ) {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (!roleCodes.includes('EMPLOYEE'))
      throw new ForbiddenException(
        'Only farm employees can request maintenance',
      );
    const description = input.description.trim();
    if (description.length < 3)
      throw new BadRequestException(
        'Description must have at least 3 characters',
      );
    return this.databaseService.db
      .transaction(async (tx) => {
        const [asset] = await tx
          .select({ assetCode: assets.assetCode, status: assets.status })
          .from(assets)
          .where(and(eq(assets.id, input.assetId), eq(assets.farmId, farmId)))
          // No row lock: approve locks request then asset, so locking the asset here could deadlock.
          .limit(1);
        if (!asset) throw new NotFoundException('Asset not found');
        if (['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status))
          throw new ConflictException(
            'Asset is not eligible for a maintenance request',
          );
        await this.assertNoActiveMaintenance(tx, farmId, input.assetId);
        const [request] = await tx
          .insert(maintenanceRequests)
          .values({
            farmId,
            assetId: input.assetId,
            requestedByMemberId: memberId,
            maintenanceType: input.maintenanceType,
            description,
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
          code?: string;
          constraint?: string;
          cause?: { code?: string; constraint?: string };
        };
        const constraint =
          databaseError?.constraint ?? databaseError?.cause?.constraint;
        if (constraint === 'ux_pending_maintenance_request_per_asset')
          throw new ConflictException(
            'This asset already has a pending maintenance request',
          );
        throw error;
      });
  }

  async approve(
    id: string,
    farmId: string,
    clerkUserId: string,
    scheduledAt: string,
  ) {
    const reviewer = await this.reviewer(farmId, clerkUserId);
    return this.databaseService.db.transaction(async (tx) => {
      const { request, assetCode } = await this.lockPending(tx, id, farmId);
      const maintenanceRecord = await this.maintenanceService.schedule(
        tx,
        farmId,
        reviewer.userId,
        {
          assetId: request.assetId,
          maintenanceType: request.maintenanceType,
          scheduledAt,
          description: request.description,
        },
      );
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(maintenanceRequests)
        .set({
          status: 'CONFIRMED',
          reviewedByMemberId: reviewer.memberId,
          reviewedAt: now,
          maintenanceRecordId: maintenanceRecord.id,
          updatedAt: now,
        })
        .where(eq(maintenanceRequests.id, id))
        .returning();
      await this.audit(tx, reviewer.memberId, 'CONFIRM', request, updated);
      await notifyDocumentCreator(
        tx,
        this.notification(request, assetCode, 'CONFIRMED'),
        request.requestedByMemberId,
      );
      return { request: updated, maintenanceRecord };
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
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(maintenanceRequests)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedByMemberId: reviewer.memberId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(maintenanceRequests.id, id))
        .returning();
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

  /** Approvers see every request of the farm; anyone else only their own. */
  private async scope(farmId: string, clerkUserId: string) {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const conditions = [eq(maintenanceRequests.farmId, farmId)];
    if (!roleCodes.some((code) => ['ADMIN', 'FARM_OWNER'].includes(code)))
      conditions.push(eq(maintenanceRequests.requestedByMemberId, memberId));
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
      .from(maintenanceRequests)
      .where(
        and(
          eq(maintenanceRequests.id, id),
          eq(maintenanceRequests.farmId, farmId),
        ),
      )
      .for('update')
      .limit(1);
    if (!request) throw new NotFoundException('Maintenance request not found');
    if (request.status !== 'PENDING_APPROVAL')
      throw new ConflictException(
        'Only PENDING_APPROVAL maintenance requests can be reviewed',
      );
    const [asset] = await tx
      .select({ assetCode: assets.assetCode })
      .from(assets)
      .where(eq(assets.id, request.assetId))
      .limit(1);
    return { request, assetCode: asset?.assetCode ?? '' };
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
    if (active)
      throw new ConflictException(
        'Asset already has an active maintenance record',
      );
  }

  private notification(
    request: MaintenanceRequest,
    assetCode: string,
    status: keyof typeof NOTIFICATION_TITLES,
  ) {
    return {
      farmId: request.farmId,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: request.id,
      documentCode: assetCode,
      documentKind: 'Yêu cầu bảo trì tài sản',
      status,
      title: NOTIFICATION_TITLES[status],
    };
  }

  /** `createdByMemberId` lets employees read the history of their own requests via GET /audit-logs. */
  private async audit(
    tx: Transaction,
    actorMemberId: string,
    action: 'CREATE' | 'CONFIRM' | 'REJECT',
    before: MaintenanceRequest | null,
    after: MaintenanceRequest,
  ) {
    const snapshot = (request: MaintenanceRequest) => ({
      createdByMemberId: request.requestedByMemberId,
      assetId: request.assetId,
      maintenanceType: request.maintenanceType,
      description: request.description,
      status: request.status,
      rejectionReason: request.rejectionReason,
      maintenanceRecordId: request.maintenanceRecordId,
    });
    await tx.insert(auditLogs).values({
      farmId: after.farmId,
      userId: sql`(SELECT user_id FROM farm_members WHERE id = ${actorMemberId})`,
      action,
      entityType: 'MAINTENANCE_REQUEST',
      entityId: after.id,
      oldData: before && snapshot(before),
      newData: snapshot(after),
    });
  }
}

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, getTableColumns, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../../db/database.service';
import { assets, auditLogs, documentStatus, farmMemberRoles, farmMembers, items, maintenanceRecords, maintenanceRequests, notifications, roles, users } from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import { enqueueDocumentPushes } from '../notifications/notification-push-outbox';
import type { CreateMaintenanceRequestDto } from './dto/maintenance-request.dto';

const requesterMembers = alias(farmMembers, 'maintenance_requesters');
const requesterUsers = alias(users, 'maintenance_requester_users');
const reviewerMembers = alias(farmMembers, 'maintenance_reviewers');
const reviewerUsers = alias(users, 'maintenance_reviewer_users');
const linkedMaintenanceRecords = alias(maintenanceRecords, 'request_maintenance_records');

@Injectable()
export class MaintenanceRequestsService {
  constructor(private readonly dbService: DatabaseService, private readonly warehouses: WarehousesService) {}

  async list(farmId: string, clerkUserId: string, page: number, pageSize: number, status?: (typeof documentStatus.enumValues)[number], assetId?: string) {
    const memberId = await this.warehouses.assertFarmAccess(farmId, clerkUserId, false);
    const conditions = [eq(maintenanceRequests.farmId, farmId)];
    if (!(await this.isManager(memberId))) conditions.push(eq(maintenanceRequests.requestedByMemberId, memberId));
    if (status) conditions.push(eq(maintenanceRequests.status, status));
    if (assetId) conditions.push(eq(maintenanceRequests.assetId, assetId));
    const where = and(...conditions);
    const [rows, totals] = await Promise.all([
      this.dbService.db.select({
        ...getTableColumns(maintenanceRequests),
        assetCode: assets.assetCode,
        itemName: items.name,
      })
        .from(maintenanceRequests).innerJoin(assets, and(eq(assets.id, maintenanceRequests.assetId), eq(assets.farmId, farmId)))
        .innerJoin(items, eq(items.id, assets.itemId)).where(where)
        .orderBy(desc(maintenanceRequests.createdAt), desc(maintenanceRequests.id)).limit(pageSize).offset((page - 1) * pageSize),
      this.dbService.db.select({ value: count() }).from(maintenanceRequests).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data: rows, page: { number: page, size: pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } };
  }

  async get(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehouses.assertFarmAccess(farmId, clerkUserId, false);
    const accessCondition = (await this.isManager(memberId)) ? undefined : eq(maintenanceRequests.requestedByMemberId, memberId);
    const [request] = await this.dbService.db.select({
      ...getTableColumns(maintenanceRequests),
      assetCode: assets.assetCode,
      itemName: items.name,
      requestedByName: requesterUsers.fullName,
      requestedByEmail: requesterUsers.email,
      reviewedByName: sql<string | null>`COALESCE(NULLIF(BTRIM(${reviewerUsers.fullName}), ''), ${reviewerUsers.email})`,
      reviewedByEmail: reviewerUsers.email,
      maintenanceScheduledAt: linkedMaintenanceRecords.scheduledAt,
      maintenanceRecordStatus: linkedMaintenanceRecords.status,
    })
      .from(maintenanceRequests).innerJoin(assets, and(eq(assets.id, maintenanceRequests.assetId), eq(assets.farmId, farmId)))
      .innerJoin(items, eq(items.id, assets.itemId))
      .innerJoin(requesterMembers, and(eq(requesterMembers.id, maintenanceRequests.requestedByMemberId), eq(requesterMembers.farmId, farmId)))
      .innerJoin(requesterUsers, eq(requesterUsers.id, requesterMembers.userId))
      .leftJoin(reviewerMembers, and(eq(reviewerMembers.id, maintenanceRequests.reviewedByMemberId), eq(reviewerMembers.farmId, farmId)))
      .leftJoin(reviewerUsers, eq(reviewerUsers.id, reviewerMembers.userId))
      .leftJoin(linkedMaintenanceRecords, and(eq(linkedMaintenanceRecords.id, maintenanceRequests.maintenanceRecordId), eq(linkedMaintenanceRecords.farmId, farmId)))
      .where(and(eq(maintenanceRequests.id, id), eq(maintenanceRequests.farmId, farmId), accessCondition)).limit(1);
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async create(farmId: string, clerkUserId: string, input: CreateMaintenanceRequestDto) {
    const memberId = await this.warehouses.assertFarmAccess(farmId, clerkUserId, 'document');
    const employeeRole = await this.dbService.db.select({ code: roles.code }).from(farmMemberRoles)
      .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId)).where(eq(farmMemberRoles.farmMemberId, memberId));
    if (!employeeRole.some(({ code }) => code === 'EMPLOYEE')) throw new ForbiddenException('Only an active farm employee can submit an unexpected-maintenance request');
    const [asset] = await this.dbService.db.select({ id: assets.id, status: assets.status }).from(assets).where(and(eq(assets.id, input.assetId), eq(assets.farmId, farmId))).limit(1);
    if (!asset) throw new NotFoundException('Asset not found in this farm');
    if (['LOST', 'RETIRED', 'MAINTENANCE'].includes(asset.status)) throw new ConflictException('Asset is not eligible for a new maintenance request');
    const [active] = await this.dbService.db.select({ id: maintenanceRecords.id }).from(maintenanceRecords).where(and(eq(maintenanceRecords.farmId, farmId), eq(maintenanceRecords.assetId, input.assetId), inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']))).limit(1);
    if (active) throw new ConflictException('Asset already has active maintenance');

    return this.dbService.db.transaction(async (tx) => {
      const [request] = await tx.insert(maintenanceRequests).values({ farmId, assetId: input.assetId, requestedByMemberId: memberId, maintenanceType: input.maintenanceType, description: input.description.trim() }).returning();
      const approvers = await tx.select({ userId: farmMembers.userId }).from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId)).innerJoin(farmMemberRoles, eq(farmMemberRoles.farmMemberId, farmMembers.id)).innerJoin(roles, eq(roles.id, farmMemberRoles.roleId))
        .where(and(eq(farmMembers.farmId, farmId), eq(farmMembers.status, 'ACTIVE'), eq(users.status, 'ACTIVE'), inArray(roles.code, ['ADMIN', 'FARM_OWNER']), ne(farmMembers.id, memberId)));
      const recipientIds = [...new Set(approvers.map(({ userId }) => userId))];
      const inserted = recipientIds.length ? await tx.insert(notifications).values(recipientIds.map((userId) => ({ userId, farmId, type: 'MAINTENANCE_REQUEST_PENDING_APPROVAL', title: 'Yêu cầu bảo trì cần duyệt', body: `Yêu cầu sửa chữa tài sản ${input.assetId.slice(0, 8)} đang chờ duyệt.`, entityType: 'MAINTENANCE_REQUEST', entityId: request.id, data: { documentType: 'MAINTENANCE_REQUEST', documentId: request.id, status: 'PENDING_APPROVAL' } }))).returning({ id: notifications.id }) : [];
      await enqueueDocumentPushes(tx, inserted.map(({ id }) => id));
      const [actor] = await tx.select({ id: users.id }).from(users).where(eq(users.authProviderUserId, clerkUserId)).limit(1);
      await tx.insert(auditLogs).values({ farmId, userId: actor?.id ?? null, action: 'CREATE', entityType: 'MAINTENANCE_REQUEST', entityId: request.id, newData: request });
      return request;
    }).catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new ConflictException('There is already a pending maintenance request for this asset');
      throw error;
    });
  }

  async approve(id: string, farmId: string, clerkUserId: string, scheduledAt: string) {
    const reviewerId = await this.warehouses.assertFarmAccess(farmId, clerkUserId, true);
    return this.dbService.db.transaction(async (tx) => {
      const [request] = await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), eq(maintenanceRequests.farmId, farmId))).for('update').limit(1);
      if (!request) throw new NotFoundException('Maintenance request not found');
      if (request.status !== 'PENDING_APPROVAL') throw new ConflictException('Only pending maintenance requests can be approved');
      const [active] = await tx.select({ id: maintenanceRecords.id }).from(maintenanceRecords).where(and(eq(maintenanceRecords.farmId, farmId), eq(maintenanceRecords.assetId, request.assetId), inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']))).limit(1);
      if (active) throw new ConflictException('Asset already has active maintenance');
      const [record] = await tx.insert(maintenanceRecords).values({ farmId, assetId: request.assetId, maintenanceType: request.maintenanceType, scheduledAt, description: request.description, incidentId: null }).returning();
      const now = new Date().toISOString();
      const [updated] = await tx.update(maintenanceRequests).set({ status: 'CONFIRMED', reviewedByMemberId: reviewerId, reviewedAt: now, maintenanceRecordId: record.id, updatedAt: now }).where(eq(maintenanceRequests.id, id)).returning();
      await this.notifyCreator(tx, request.requestedByMemberId, farmId, id, 'CONFIRMED', clerkUserId);
      return { request: updated, maintenanceRecord: record };
    });
  }

  async reject(id: string, farmId: string, clerkUserId: string, reason: string) {
    const reviewerId = await this.warehouses.assertFarmAccess(farmId, clerkUserId, true);
    return this.dbService.db.transaction(async (tx) => {
      const [request] = await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), eq(maintenanceRequests.farmId, farmId))).for('update').limit(1);
      if (!request) throw new NotFoundException('Maintenance request not found');
      if (request.status !== 'PENDING_APPROVAL') throw new ConflictException('Only pending maintenance requests can be rejected');
      const now = new Date().toISOString();
      const [updated] = await tx.update(maintenanceRequests).set({ status: 'REJECTED', rejectionReason: reason.trim(), reviewedByMemberId: reviewerId, reviewedAt: now, updatedAt: now }).where(eq(maintenanceRequests.id, id)).returning();
      await this.notifyCreator(tx, request.requestedByMemberId, farmId, id, 'REJECTED', clerkUserId, reason.trim());
      return updated;
    });
  }

  private async notifyCreator(tx: any, memberId: string, farmId: string, id: string, status: 'CONFIRMED' | 'REJECTED', clerkUserId: string, rejectionReason?: string) {
    const [recipient] = await tx.select({ userId: farmMembers.userId }).from(farmMembers).innerJoin(users, eq(users.id, farmMembers.userId)).where(and(eq(farmMembers.id, memberId), eq(farmMembers.farmId, farmId), eq(farmMembers.status, 'ACTIVE'), eq(users.status, 'ACTIVE'))).limit(1);
    if (!recipient) return;
    const [notification] = await tx.insert(notifications).values({ userId: recipient.userId, farmId, type: `MAINTENANCE_REQUEST_${status}`, title: status === 'CONFIRMED' ? 'Yêu cầu bảo trì đã duyệt' : 'Yêu cầu bảo trì bị từ chối', body: status === 'CONFIRMED' ? 'Quản lý đã duyệt và lên lịch bảo trì.' : `Quản lý từ chối yêu cầu: ${rejectionReason}`, entityType: 'MAINTENANCE_REQUEST', entityId: id, data: { documentType: 'MAINTENANCE_REQUEST', documentId: id, status, rejectionReason: rejectionReason ?? null } }).returning({ id: notifications.id });
    await enqueueDocumentPushes(tx, [notification.id]);
    const [actor] = await tx.select({ id: users.id }).from(users).where(eq(users.authProviderUserId, clerkUserId)).limit(1);
    await tx.insert(auditLogs).values({ farmId, userId: actor?.id ?? null, action: status === 'CONFIRMED' ? 'APPROVE' : 'REJECT', entityType: 'MAINTENANCE_REQUEST', entityId: id, newData: { status, rejectionReason: rejectionReason ?? null } });
  }

  private async isManager(memberId: string) {
    const memberRoles = await this.dbService.db.select({ code: roles.code }).from(farmMemberRoles)
      .innerJoin(roles, eq(roles.id, farmMemberRoles.roleId)).where(eq(farmMemberRoles.farmMemberId, memberId));
    return memberRoles.some(({ code }) => code === 'ADMIN' || code === 'FARM_OWNER');
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import QRCode from 'qrcode';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assetAssignments,
  assetIncidents,
  assets,
  auditLogs,
  farmMembers,
  inventoryTransactions,
  maintenanceRecords,
  users,
  warehouses,
} from '../../db/schema';

export const assetHistoryKinds = [
  'assignments',
  'incidents',
  'maintenance',
  'movements',
  'changes',
] as const;
export type AssetHistoryKind = (typeof assetHistoryKinds)[number];

export type AssetHistoryEntry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  status: string | null;
  referenceId: string | null;
};

type Page = PaginationParams & { farmId: string; search?: string };
type HistoryPage = PaginationParams & {
  farmId: string;
  assetId: string;
  kind: AssetHistoryKind;
};

@Injectable()
export class AssetHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listMembers(filters: Page) {
    const conditions: SQL[] = [
      eq(farmMembers.farmId, filters.farmId),
      eq(farmMembers.status, 'ACTIVE'),
      eq(users.status, 'ACTIVE'),
    ];
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(ilike(users.fullName, pattern), ilike(users.email, pattern))!,
      );
    }
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: farmMembers.id,
          name: sql<string>`coalesce(${users.fullName}, ${users.email})`,
          email: users.email,
        })
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(where)
        .orderBy(asc(users.fullName), asc(users.email), asc(farmMembers.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(farmMembers)
        .innerJoin(users, eq(users.id, farmMembers.userId))
        .where(where),
    ]);
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  async holder(assetId: string, farmId: string) {
    await this.assertAsset(assetId, farmId);
    const assignedTo = alias(farmMembers, 'asset_holder_member');
    const holderUser = alias(users, 'asset_holder_user');
    const [assignment] = await this.databaseService.db
      .select({
        id: assetAssignments.id,
        assignedToMemberId: assetAssignments.assignedToMemberId,
        memberName: sql<
          string | null
        >`coalesce(${holderUser.fullName}, ${holderUser.email})`,
        assignedAt: assetAssignments.assignedAt,
        expectedReturnAt: assetAssignments.expectedReturnAt,
        note: assetAssignments.note,
      })
      .from(assetAssignments)
      .leftJoin(
        assignedTo,
        and(
          eq(assignedTo.id, assetAssignments.assignedToMemberId),
          eq(assignedTo.farmId, assetAssignments.farmId),
        ),
      )
      .leftJoin(holderUser, eq(holderUser.id, assignedTo.userId))
      .where(
        and(
          eq(assetAssignments.assetId, assetId),
          eq(assetAssignments.farmId, farmId),
          eq(assetAssignments.status, 'ACTIVE'),
        ),
      )
      .orderBy(desc(assetAssignments.assignedAt), desc(assetAssignments.id))
      .limit(1);
    return assignment
      ? {
          ...assignment,
          memberName: assignment.memberName ?? 'Thành viên không còn hoạt động',
        }
      : null;
  }

  async history(filters: HistoryPage) {
    await this.assertAsset(filters.assetId, filters.farmId);
    switch (filters.kind) {
      case 'assignments':
        return this.assignments(filters);
      case 'incidents':
        return this.incidents(filters);
      case 'maintenance':
        return this.maintenance(filters);
      case 'movements':
        return this.movements(filters);
      case 'changes':
        return this.changes(filters);
    }
  }

  async label(assetId: string, farmId: string) {
    const [asset] = await this.databaseService.db
      .select({ assetCode: assets.assetCode })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.farmId, farmId)))
      .limit(1);
    if (!asset) throw new NotFoundException('Asset not found');
    return {
      assetCode: asset.assetCode,
      svg: await QRCode.toString(asset.assetCode, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
      }),
    };
  }

  private async assignments(filters: HistoryPage) {
    const assignedTo = alias(farmMembers, 'asset_assigned_to_member');
    const assignedBy = alias(farmMembers, 'asset_assigned_by_member');
    const assignee = alias(users, 'asset_assignee');
    const assigner = alias(users, 'asset_assigner');
    const where = and(
      eq(assetAssignments.farmId, filters.farmId),
      eq(assetAssignments.assetId, filters.assetId),
    );
    const [rows, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: assetAssignments.id,
          status: assetAssignments.status,
          assignedToName: sql<
            string | null
          >`coalesce(${assignee.fullName}, ${assignee.email})`,
          assignedByName: sql<
            string | null
          >`coalesce(${assigner.fullName}, ${assigner.email})`,
          assignedAt: assetAssignments.assignedAt,
          expectedReturnAt: assetAssignments.expectedReturnAt,
          returnedAt: assetAssignments.returnedAt,
          note: assetAssignments.note,
        })
        .from(assetAssignments)
        .leftJoin(
          assignedTo,
          and(
            eq(assignedTo.id, assetAssignments.assignedToMemberId),
            eq(assignedTo.farmId, assetAssignments.farmId),
          ),
        )
        .leftJoin(assignee, eq(assignee.id, assignedTo.userId))
        .leftJoin(
          assignedBy,
          and(
            eq(assignedBy.id, assetAssignments.assignedByMemberId),
            eq(assignedBy.farmId, assetAssignments.farmId),
          ),
        )
        .leftJoin(assigner, eq(assigner.id, assignedBy.userId))
        .where(where)
        .orderBy(desc(assetAssignments.assignedAt), desc(assetAssignments.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(assetAssignments)
        .where(where),
    ]);
    const data = rows.map((row) => ({
      id: row.id,
      at: row.assignedAt,
      title:
        row.status === 'RETURNED'
          ? 'Tài sản đã được trả'
          : row.status === 'CANCELLED'
            ? 'Đã hủy bàn giao tài sản'
            : 'Cấp phát tài sản',
      detail: [
        `Người nhận: ${row.assignedToName ?? 'Thành viên không còn hoạt động'}`,
        `Người giao: ${row.assignedByName ?? 'Thành viên không còn hoạt động'}`,
        row.expectedReturnAt
          ? `Dự kiến trả: ${row.expectedReturnAt}`
          : undefined,
        row.returnedAt ? `Đã trả lúc: ${row.returnedAt}` : undefined,
        row.note ?? undefined,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      status: row.status,
      referenceId: row.id,
    }));
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  private async incidents(filters: HistoryPage) {
    const reporterMember = alias(farmMembers, 'asset_reporter_member');
    const reporter = alias(users, 'asset_reporter');
    const where = and(
      eq(assetIncidents.farmId, filters.farmId),
      eq(assetIncidents.assetId, filters.assetId),
    );
    const [rows, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: assetIncidents.id,
          incidentType: assetIncidents.incidentType,
          description: assetIncidents.description,
          severity: assetIncidents.severity,
          status: assetIncidents.status,
          reportedAt: assetIncidents.reportedAt,
          reporterName: sql<
            string | null
          >`coalesce(${reporter.fullName}, ${reporter.email})`,
        })
        .from(assetIncidents)
        .leftJoin(
          reporterMember,
          and(
            eq(reporterMember.id, assetIncidents.reportedByMemberId),
            eq(reporterMember.farmId, assetIncidents.farmId),
          ),
        )
        .leftJoin(reporter, eq(reporter.id, reporterMember.userId))
        .where(where)
        .orderBy(desc(assetIncidents.reportedAt), desc(assetIncidents.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(assetIncidents)
        .where(where),
    ]);
    const typeNames: Record<string, string> = {
      DAMAGE: 'Hư hỏng',
      LOSS: 'Thất lạc',
      OTHER: 'Sự cố khác',
    };
    const data = rows.map((row) => ({
      id: row.id,
      at: row.reportedAt,
      title: typeNames[row.incidentType ?? ''] ?? 'Sự cố tài sản',
      detail: [
        row.description,
        `Mức độ: ${row.severity}`,
        `Người báo: ${row.reporterName ?? 'Thành viên không còn hoạt động'}`,
      ].join(' · '),
      status: row.status,
      referenceId: row.id,
    }));
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  private async maintenance(filters: HistoryPage) {
    const performerMember = alias(farmMembers, 'asset_performer_member');
    const performer = alias(users, 'asset_performer');
    const where = and(
      eq(maintenanceRecords.farmId, filters.farmId),
      eq(maintenanceRecords.assetId, filters.assetId),
    );
    const [rows, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: maintenanceRecords.id,
          status: maintenanceRecords.status,
          maintenanceType: maintenanceRecords.maintenanceType,
          description: maintenanceRecords.description,
          resultNote: maintenanceRecords.resultNote,
          startedAt: maintenanceRecords.startedAt,
          createdAt: maintenanceRecords.createdAt,
          scheduledAt: maintenanceRecords.scheduledAt,
          totalCost: maintenanceRecords.totalCost,
          performerName: sql<
            string | null
          >`coalesce(${performer.fullName}, ${performer.email})`,
        })
        .from(maintenanceRecords)
        .leftJoin(
          performerMember,
          and(
            eq(performerMember.id, maintenanceRecords.performedByMemberId),
            eq(performerMember.farmId, maintenanceRecords.farmId),
          ),
        )
        .leftJoin(performer, eq(performer.id, performerMember.userId))
        .where(where)
        .orderBy(
          desc(
            sql<string>`coalesce(${maintenanceRecords.startedAt}, ${maintenanceRecords.createdAt})`,
          ),
          desc(maintenanceRecords.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(maintenanceRecords)
        .where(where),
    ]);
    const typeNames: Record<string, string> = {
      PREVENTIVE: 'Bảo trì phòng ngừa',
      CORRECTIVE: 'Bảo trì khắc phục',
      INSPECTION: 'Kiểm tra tài sản',
    };
    const data = rows.map((row) => ({
      id: row.id,
      at: row.startedAt ?? row.createdAt,
      title: typeNames[row.maintenanceType] ?? 'Bảo trì tài sản',
      detail: [
        row.description ?? undefined,
        row.resultNote ?? undefined,
        row.performerName ? `Người thực hiện: ${row.performerName}` : undefined,
        row.totalCost ? `Tổng chi phí: ${row.totalCost}` : undefined,
        row.scheduledAt ? `Lịch: ${row.scheduledAt}` : undefined,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      status: row.status,
      referenceId: row.id,
    }));
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  private async movements(filters: HistoryPage) {
    const warehouse = alias(warehouses, 'asset_movement_warehouse');
    const performerMember = alias(farmMembers, 'asset_movement_member');
    const performer = alias(users, 'asset_movement_performer');
    const where = and(
      eq(inventoryTransactions.farmId, filters.farmId),
      eq(inventoryTransactions.assetId, filters.assetId),
    );
    const [rows, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: inventoryTransactions.id,
          at: inventoryTransactions.createdAt,
          transactionType: inventoryTransactions.transactionType,
          sourceType: inventoryTransactions.sourceType,
          sourceId: inventoryTransactions.sourceId,
          quantityChange: inventoryTransactions.quantityChange,
          reason: inventoryTransactions.reason,
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          performerName: sql<
            string | null
          >`coalesce(${performer.fullName}, ${performer.email})`,
        })
        .from(inventoryTransactions)
        .leftJoin(
          warehouse,
          and(
            eq(warehouse.id, inventoryTransactions.warehouseId),
            eq(warehouse.farmId, inventoryTransactions.farmId),
          ),
        )
        .leftJoin(
          performerMember,
          and(
            eq(performerMember.id, inventoryTransactions.performedByMemberId),
            eq(performerMember.farmId, inventoryTransactions.farmId),
          ),
        )
        .leftJoin(performer, eq(performer.id, performerMember.userId))
        .where(where)
        .orderBy(
          desc(inventoryTransactions.createdAt),
          desc(inventoryTransactions.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(inventoryTransactions)
        .where(where),
    ]);
    const titles: Record<string, string> = {
      RECEIPT: 'Nhập tài sản',
      ISSUE: 'Xuất tài sản',
      ASSIGNMENT_OUT: 'Cấp phát tài sản',
      RETURN_IN: 'Nhận lại tài sản',
      TRANSFER_OUT: 'Chuyển tài sản đi',
      TRANSFER_IN: 'Nhận tài sản điều chuyển',
      ADJUSTMENT_OUT: 'Điều chỉnh giảm tài sản',
      ADJUSTMENT_IN: 'Điều chỉnh tăng tài sản',
      MAINTENANCE_ISSUE: 'Đưa tài sản vào bảo trì',
    };
    const sourceNames: Record<string, string> = {
      ASSET_CREATE: 'Tạo tài sản thủ công',
      ASSET_RETIRE: 'Ngừng sử dụng',
      ASSET_LOSS: 'Báo mất',
      ASSET_RECOVERY: 'Ghi nhận tìm lại',
      ASSET_TRANSFER: 'Điều chuyển tài sản',
      ASSET_MAINTENANCE: 'Bắt đầu bảo trì',
    };
    const data = rows.map((row) => ({
      id: row.id,
      at: row.at,
      title:
        sourceNames[row.sourceType] ??
        titles[row.transactionType] ??
        'Di chuyển tồn kho',
      detail: [
        row.warehouseCode && row.warehouseName
          ? `Kho: ${row.warehouseCode} — ${row.warehouseName}`
          : undefined,
        `Số lượng: ${row.quantityChange}`,
        row.performerName ? `Người thực hiện: ${row.performerName}` : undefined,
        row.reason ?? undefined,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      status: null,
      referenceId: row.sourceId,
    }));
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  private async changes(filters: HistoryPage) {
    const actorMember = alias(farmMembers, 'asset_audit_actor_member');
    const where = and(
      eq(auditLogs.farmId, filters.farmId),
      eq(auditLogs.entityType, 'ASSET'),
      eq(auditLogs.entityId, filters.assetId),
    );
    const [rows, totals] = await Promise.all([
      this.databaseService.db
        .select({
          id: auditLogs.id,
          at: auditLogs.createdAt,
          action: auditLogs.action,
          newData: auditLogs.newData,
          oldData: auditLogs.oldData,
          actorName: sql<
            string | null
          >`coalesce(${users.fullName}, ${users.email})`,
        })
        .from(auditLogs)
        .leftJoin(
          actorMember,
          and(
            eq(actorMember.farmId, auditLogs.farmId),
            eq(actorMember.userId, auditLogs.userId),
          ),
        )
        .leftJoin(users, eq(users.id, actorMember.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(auditLogs)
        .where(where),
    ]);
    const titles: Record<string, string> = {
      ASSET_CREATED: 'Tạo tài sản',
      ASSET_METADATA_UPDATED: 'Cập nhật thông tin tài sản',
      ASSET_ASSIGNED: 'Cấp phát tài sản',
      ASSET_REASSIGNED: 'Đổi người nhận tài sản',
      ASSET_USE_STARTED: 'Bắt đầu sử dụng',
      ASSET_RETURNED: 'Nhận lại tài sản',
      ASSET_TRANSFERRED: 'Điều chuyển tài sản',
      ASSET_RETIRED: 'Ngừng sử dụng tài sản',
      ASSET_INCIDENT_REPORTED: 'Ghi nhận sự cố tài sản',
      ASSET_INCIDENT_STATUS: 'Cập nhật xử lý sự cố',
      ASSET_RECOVERED: 'Ghi nhận tìm lại tài sản',
      ASSET_MAINTENANCE_SCHEDULED: 'Lên lịch bảo trì',
      ASSET_MAINTENANCE_STARTED: 'Bắt đầu bảo trì',
      ASSET_MAINTENANCE_COMPLETED: 'Hoàn tất bảo trì',
      ASSET_MAINTENANCE_CANCELLED: 'Dừng bảo trì',
    };
    const data = rows.map((row) => {
      const next = this.jsonRecord(row.newData);
      const previous = this.jsonRecord(row.oldData);
      return {
        id: row.id,
        at: row.at,
        title: titles[row.action] ?? 'Thay đổi tài sản',
        detail: [
          this.stringValue(next.summary),
          this.statusChange(previous.status, next.status),
          row.actorName ? `Người thực hiện: ${row.actorName}` : undefined,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
        status: this.stringValue(next.status) ?? null,
        referenceId: this.stringValue(next.referenceId) ?? null,
      };
    });
    return this.page(data, Number(totals[0]?.value ?? 0), filters);
  }

  private async assertAsset(assetId: string, farmId: string) {
    const [asset] = await this.databaseService.db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.farmId, farmId)))
      .limit(1);
    if (!asset) throw new NotFoundException('Asset not found');
  }

  private page<T>(data: T[], totalItems: number, filters: PaginationParams) {
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

  private jsonRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value : undefined;
  }

  private statusChange(previous: unknown, next: unknown) {
    if (typeof previous !== 'string' || typeof next !== 'string')
      return undefined;
    return `Trạng thái: ${previous} → ${next}`;
  }
}

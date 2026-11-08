import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { notifications, users } from '../../db/schema';
import {
  NOTIFICATION_DOCUMENT_KINDS,
  formatNotificationBody,
  formatNotificationDocumentCode,
} from './notification-events';

type ListFilters = PaginationParams & {
  clerkUserId: string;
  farmId: string;
  unreadOnly?: boolean;
};

type NotificationRow = typeof notifications.$inferSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  private async getUserId(clerkUserId: string) {
    const [user] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.authProviderUserId, clerkUserId),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!user) throw new ForbiddenException('Active user account is required');
    return user.id;
  }

  private normalizeNotificationRow(row: NotificationRow): NotificationRow {
    const rawData =
      row.data && typeof row.data === 'object' && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : null;
    const entityType =
      (typeof rawData?.documentType === 'string'
        ? rawData.documentType
        : null) ?? row.entityType;
    const entityId =
      (typeof rawData?.documentId === 'string' ? rawData.documentId : null) ??
      row.entityId;
    const storedCode =
      typeof rawData?.documentCode === 'string' ? rawData.documentCode : null;
    const resolvedCode = formatNotificationDocumentCode(
      entityType,
      entityId,
      storedCode,
    );
    const status =
      (typeof rawData?.status === 'string' ? rawData.status : null) ??
      (entityType && row.type.startsWith(`${entityType}_`)
        ? row.type.slice(entityType.length + 1)
        : null);
    const rejectionReason =
      typeof rawData?.rejectionReason === 'string'
        ? rawData.rejectionReason
        : null;
    const documentKind = entityType
      ? NOTIFICATION_DOCUMENT_KINDS[entityType]
      : undefined;
    const nextBody =
      documentKind && resolvedCode
        ? (formatNotificationBody(
            documentKind,
            resolvedCode,
            status,
            rejectionReason,
          ) ?? row.body)
        : row.body;

    return {
      ...row,
      body: nextBody,
      data: rawData
        ? {
            ...rawData,
            documentCode: resolvedCode || rawData.documentCode || null,
          }
        : resolvedCode
          ? {
              documentType: entityType,
              documentId: entityId,
              documentCode: resolvedCode,
              status,
              rejectionReason,
            }
          : row.data,
    };
  }

  async list(filters: ListFilters) {
    const userId = await this.getUserId(filters.clerkUserId);
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.farmId, filters.farmId),
    ];
    if (filters.unreadOnly) conditions.push(isNull(notifications.readAt));
    const where = and(...conditions);
    const [rawRows, unreadTotals, filteredTotals] = await Promise.all([
      this.database.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.database.db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.farmId, filters.farmId),
            isNull(notifications.readAt),
          ),
        ),
      this.database.db
        .select({ value: count() })
        .from(notifications)
        .where(where),
    ]);
    const data = rawRows.map((row) => this.normalizeNotificationRow(row));
    const filteredCount = Number(filteredTotals[0]?.value ?? 0);
    return {
      data,
      unreadCount: Number(unreadTotals[0]?.value ?? 0),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems: filteredCount,
        totalPages: Math.ceil(filteredCount / filters.pageSize),
      },
    };
  }

  async markRead(id: string, farmId: string, clerkUserId: string) {
    const userId = await this.getUserId(clerkUserId);
    const [row] = await this.database.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          eq(notifications.farmId, farmId),
          isNull(notifications.readAt),
        ),
      )
      .returning();
    if (row) return { data: row };
    const [existing] = await this.database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          eq(notifications.farmId, farmId),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException('Notification not found');
    return { data: existing, alreadyRead: true };
  }

  async markAllRead(farmId: string, clerkUserId: string) {
    const userId = await this.getUserId(clerkUserId);
    const updated = await this.database.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.farmId, farmId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return { updatedCount: updated.length };
  }
}

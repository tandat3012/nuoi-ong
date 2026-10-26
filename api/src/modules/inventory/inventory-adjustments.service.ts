import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../../db/database.service';
import {
  documentStatus,
  farmMembers,
  inventoryAdjustments,
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  units,
  users,
  warehouses,
} from '../../db/schema';
import { PaginationParams, requireUuid } from '../../common/query-params';
import {
  AdjustmentReasonCode,
  CreateInventoryAdjustmentDto,
  SIGNED_DECIMAL,
} from './dto/create-adjustment.dto';
import { WarehousesService } from '../warehouses/warehouses.service';

const inventoryLotId = sql<string>`${inventoryLots}."id"`;
const inventoryLotFarmId = sql<string>`${inventoryLots}."farm_id"`;
const inventoryLotItemId = sql<string>`${inventoryLots}."item_id"`;
const inventoryLotNumber = sql<string | null>`${inventoryLots}."lot_number"`;
const inventoryLotExpired = sql<boolean>`coalesce(${inventoryLots}."expiry_date" < CURRENT_DATE, false)`;

const APPROVER_ROLES = ['ADMIN', 'FARM_OWNER'];
const REQUESTER_ROLES = [...APPROVER_ROLES, 'EMPLOYEE'];

// Ledger rows keep a readable reason so the movement history needs no lookup.
const REASON_LABELS: Record<AdjustmentReasonCode, string> = {
  STOCK_COUNT: 'Chênh lệch kiểm kê',
  SHRINKAGE: 'Hao hụt',
  DAMAGE: 'Hư hỏng',
  EXPIRED: 'Hết hạn',
  DATA_ENTRY_ERROR: 'Nhập/xuất sai',
  OTHER: 'Khác',
};

type AdjustmentStatus = (typeof documentStatus.enumValues)[number];
type AdjustmentRecord = typeof inventoryAdjustments.$inferSelect;
type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

interface AdjustmentTarget {
  warehouseId: string;
  itemId: string;
  lotId?: string | null;
}

export interface AdjustmentListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: AdjustmentStatus;
  warehouseId?: string;
  itemId?: string;
  /** Only adjustments requested by the caller. */
  mine?: boolean;
}

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /** Owners/admins apply immediately; employees create a PENDING_APPROVAL request. */
  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateInventoryAdjustmentDto,
  ) {
    requireUuid(farmId, 'farmId');
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const canApprove = roleCodes.some((code) => APPROVER_ROLES.includes(code));
    if (!roleCodes.some((code) => REQUESTER_ROLES.includes(code))) {
      throw new ForbiddenException(
        'Inventory adjustment permission is required',
      );
    }
    this.validateIds(input);
    const { quantityChange, isPositive, note } =
      this.normalizeAdjustment(input);

    const replay = await this.findReplay(farmId, memberId, input);
    if (replay) return replay;

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const lotId = await this.assertTarget(tx, farmId, input, isPositive);
        const now = new Date().toISOString();
        const [adjustment] = await tx
          .insert(inventoryAdjustments)
          .values({
            farmId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            lotId,
            quantityChange,
            reasonCode: input.reasonCode,
            note,
            status: canApprove ? 'CONFIRMED' : 'PENDING_APPROVAL',
            idempotencyKey: input.idempotencyKey,
            requestedByMemberId: memberId,
            reviewedByMemberId: canApprove ? memberId : null,
            reviewedAt: canApprove ? now : null,
          })
          .returning();

        if (!canApprove) {
          // Fail early on an impossible decrease; approval re-checks atomically.
          if (!isPositive) await this.assertAvailable(tx, adjustment);
          return { adjustment, transaction: null };
        }
        const transaction = await this.applyStock(tx, adjustment);
        return { adjustment, transaction };
      });
    } catch (error: unknown) {
      if (
        this.getDatabaseError(error).constraint ===
        'ux_inventory_adjustment_idempotency'
      ) {
        // A concurrent retry with the same key won the insert.
        const winner = await this.findReplay(farmId, memberId, input);
        if (winner) return winner;
      }
      throw this.mapDatabaseError(error);
    }
  }

  async approve(farmId: string, clerkUserId: string, id: string) {
    requireUuid(farmId, 'farmId');
    requireUuid(id, 'id');
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        // The status predicate makes approve-once atomic under concurrent clicks.
        const [adjustment] = await tx
          .update(inventoryAdjustments)
          .set({
            status: 'CONFIRMED',
            reviewedByMemberId: memberId,
            reviewedAt: new Date().toISOString(),
          })
          .where(this.pendingPredicate(farmId, id))
          .returning();
        if (!adjustment) throw await this.notPendingError(tx, farmId, id);
        await this.assertTarget(
          tx,
          farmId,
          adjustment,
          !adjustment.quantityChange.startsWith('-'),
        );
        const transaction = await this.applyStock(tx, adjustment);
        return { adjustment, transaction };
      });
    } catch (error: unknown) {
      throw this.mapDatabaseError(error);
    }
  }

  async reject(
    farmId: string,
    clerkUserId: string,
    id: string,
    reason: string,
  ) {
    requireUuid(farmId, 'farmId');
    requireUuid(id, 'id');
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    return this.databaseService.db.transaction(async (tx) => {
      const [adjustment] = await tx
        .update(inventoryAdjustments)
        .set({
          status: 'REJECTED',
          reviewedByMemberId: memberId,
          reviewedAt: new Date().toISOString(),
          rejectionReason: reason,
        })
        .where(this.pendingPredicate(farmId, id))
        .returning();
      if (!adjustment) throw await this.notPendingError(tx, farmId, id);
      return { adjustment, transaction: null };
    });
  }

  async list(filters: AdjustmentListFilters) {
    const memberId = await this.warehousesService.assertFarmAccess(
      filters.farmId,
      filters.clerkUserId,
      false,
    );
    const requesterMember = alias(farmMembers, 'requester_member');
    const requesterUser = alias(users, 'requester_user');
    const reviewerMember = alias(farmMembers, 'reviewer_member');
    const reviewerUser = alias(users, 'reviewer_user');
    const predicates: SQL[] = [eq(inventoryAdjustments.farmId, filters.farmId)];
    if (filters.status) {
      predicates.push(eq(inventoryAdjustments.status, filters.status));
    }
    if (filters.warehouseId) {
      predicates.push(
        eq(inventoryAdjustments.warehouseId, filters.warehouseId),
      );
    }
    if (filters.itemId) {
      predicates.push(eq(inventoryAdjustments.itemId, filters.itemId));
    }
    if (filters.mine) {
      predicates.push(eq(inventoryAdjustments.requestedByMemberId, memberId));
    }
    const where = and(...predicates);

    const [rows, total] = await Promise.all([
      this.databaseService.db
        .select({
          id: inventoryAdjustments.id,
          status: inventoryAdjustments.status,
          quantityChange: inventoryAdjustments.quantityChange,
          reasonCode: inventoryAdjustments.reasonCode,
          note: inventoryAdjustments.note,
          rejectionReason: inventoryAdjustments.rejectionReason,
          createdAt: inventoryAdjustments.createdAt,
          reviewedAt: inventoryAdjustments.reviewedAt,
          itemId: items.id,
          itemCode: items.code,
          itemName: items.name,
          unitName: units.name,
          unitSymbol: units.symbol,
          warehouseId: warehouses.id,
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
          lotId: inventoryAdjustments.lotId,
          lotNumber: inventoryLotNumber,
          requesterId: requesterMember.id,
          requesterName: requesterUser.fullName,
          reviewerId: reviewerMember.id,
          reviewerName: reviewerUser.fullName,
        })
        .from(inventoryAdjustments)
        .innerJoin(items, eq(inventoryAdjustments.itemId, items.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .innerJoin(
          warehouses,
          eq(inventoryAdjustments.warehouseId, warehouses.id),
        )
        .leftJoin(inventoryLots, eq(inventoryAdjustments.lotId, inventoryLotId))
        .innerJoin(
          requesterMember,
          eq(inventoryAdjustments.requestedByMemberId, requesterMember.id),
        )
        .innerJoin(requesterUser, eq(requesterMember.userId, requesterUser.id))
        .leftJoin(
          reviewerMember,
          eq(inventoryAdjustments.reviewedByMemberId, reviewerMember.id),
        )
        .leftJoin(reviewerUser, eq(reviewerMember.userId, reviewerUser.id))
        .where(where)
        .orderBy(desc(inventoryAdjustments.createdAt), inventoryAdjustments.id)
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(inventoryAdjustments)
        .where(where),
    ]);

    const totalItems = Number(total[0]?.value ?? 0);
    return {
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        quantityChange: row.quantityChange,
        reasonCode: row.reasonCode,
        note: row.note,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt,
        item: { id: row.itemId, code: row.itemCode, name: row.itemName },
        unit: { name: row.unitName, symbol: row.unitSymbol },
        warehouse: {
          id: row.warehouseId,
          code: row.warehouseCode,
          name: row.warehouseName,
        },
        lot: row.lotId ? { id: row.lotId, lotNumber: row.lotNumber } : null,
        requester: { id: row.requesterId, displayName: row.requesterName },
        reviewer: row.reviewerId
          ? { id: row.reviewerId, displayName: row.reviewerName }
          : null,
      })),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  /** Returns the earlier result for a retried idempotency key, or null for a new key. */
  private async findReplay(
    farmId: string,
    memberId: string,
    input: CreateInventoryAdjustmentDto,
  ) {
    const [adjustment] = await this.databaseService.db
      .select()
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.farmId, farmId),
          eq(inventoryAdjustments.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (!adjustment) return null;
    if (
      adjustment.requestedByMemberId !== memberId ||
      adjustment.warehouseId !== input.warehouseId ||
      adjustment.itemId !== input.itemId
    ) {
      throw new ConflictException(
        'idempotencyKey was already used for a different adjustment',
      );
    }
    const [transaction] = await this.databaseService.db
      .select()
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.sourceType, 'INVENTORY_ADJUSTMENT'),
          eq(inventoryTransactions.sourceId, adjustment.id),
        ),
      )
      .limit(1);
    return { adjustment, transaction: transaction ?? null };
  }

  /** Validates warehouse, item and lot; returns the lot id to store. */
  private async assertTarget(
    tx: Transaction,
    farmId: string,
    target: AdjustmentTarget,
    isPositive: boolean,
  ) {
    const [warehouse] = await tx
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, target.warehouseId),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!warehouse) {
      throw new ConflictException('Warehouse must exist and be ACTIVE');
    }

    const [item] = await tx
      .select({
        id: items.id,
        trackingMode: items.trackingMode,
        status: items.status,
      })
      .from(items)
      .where(and(eq(items.id, target.itemId), eq(items.farmId, farmId)))
      .limit(1);
    if (!item) throw new NotFoundException('Item not found');
    if (item.trackingMode === 'ASSET') {
      throw new ConflictException('ASSET items cannot be adjusted');
    }
    // Inactive items and expired lots may only be drained, never topped up.
    if (isPositive && item.status === 'INACTIVE') {
      throw new ConflictException('INACTIVE items can only be decreased');
    }

    if (item.trackingMode === 'QUANTITY') {
      if (target.lotId) {
        throw new BadRequestException('QUANTITY items cannot use a lotId');
      }
      return null;
    }
    if (!target.lotId) {
      throw new BadRequestException('LOT items require a lotId');
    }
    const [lot] = await tx
      .select({ id: inventoryLotId, expired: inventoryLotExpired })
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLotId, target.lotId),
          eq(inventoryLotFarmId, farmId),
          eq(inventoryLotItemId, target.itemId),
        ),
      )
      .limit(1);
    if (!lot) throw new NotFoundException('LOT not found');
    if (isPositive && lot.expired) {
      throw new ConflictException('Expired lots can only be decreased');
    }
    return lot.id;
  }

  private async assertAvailable(tx: Transaction, record: AdjustmentRecord) {
    const [balance] = await tx
      .select({ id: inventoryBalances.id })
      .from(inventoryBalances)
      .where(
        and(
          this.balancePredicate(record),
          gte(inventoryBalances.quantityOnHand, record.quantityChange.slice(1)),
        ),
      )
      .limit(1);
    if (!balance) {
      throw new ConflictException(
        'Adjustment would exceed available inventory',
      );
    }
  }

  private async applyStock(tx: Transaction, record: AdjustmentRecord) {
    const isPositive = !record.quantityChange.startsWith('-');
    const absoluteChange = record.quantityChange.replace(/^-/, '');
    if (isPositive) {
      // Let PostgreSQL serialize concurrent increments, including first inserts.
      const [balance] = await tx
        .insert(inventoryBalances)
        .values({
          farmId: record.farmId,
          warehouseId: record.warehouseId,
          itemId: record.itemId,
          lotId: record.lotId,
          quantityOnHand: absoluteChange,
        })
        .onConflictDoUpdate({
          target: [
            inventoryBalances.itemId,
            inventoryBalances.lotId,
            inventoryBalances.warehouseId,
          ],
          set: {
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} + excluded.quantity_on_hand`,
            updatedAt: new Date().toISOString(),
          },
          setWhere: eq(inventoryBalances.farmId, record.farmId),
        })
        .returning({ id: inventoryBalances.id });
      if (!balance) {
        throw new ConflictException('Inventory balance could not be updated');
      }
    } else {
      // This predicate makes the decrement atomic with the stock check.
      const [balance] = await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${absoluteChange}`,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            this.balancePredicate(record),
            gte(inventoryBalances.quantityOnHand, absoluteChange),
          ),
        )
        .returning({ id: inventoryBalances.id });
      if (!balance) {
        throw new ConflictException(
          'Adjustment would exceed available inventory',
        );
      }
    }

    const [transaction] = await tx
      .insert(inventoryTransactions)
      .values({
        farmId: record.farmId,
        warehouseId: record.warehouseId,
        itemId: record.itemId,
        lotId: record.lotId,
        transactionType: isPositive ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantityChange: record.quantityChange,
        reason: record.note
          ? `${REASON_LABELS[record.reasonCode]}: ${record.note}`
          : REASON_LABELS[record.reasonCode],
        sourceType: 'INVENTORY_ADJUSTMENT',
        sourceId: record.id,
        performedByMemberId: record.requestedByMemberId,
      })
      .returning();
    return transaction;
  }

  private balancePredicate(record: AdjustmentRecord) {
    return and(
      eq(inventoryBalances.farmId, record.farmId),
      eq(inventoryBalances.warehouseId, record.warehouseId),
      eq(inventoryBalances.itemId, record.itemId),
      record.lotId
        ? eq(inventoryBalances.lotId, record.lotId)
        : isNull(inventoryBalances.lotId),
    );
  }

  private pendingPredicate(farmId: string, id: string) {
    return and(
      eq(inventoryAdjustments.id, id),
      eq(inventoryAdjustments.farmId, farmId),
      eq(inventoryAdjustments.status, 'PENDING_APPROVAL'),
    );
  }

  private async notPendingError(tx: Transaction, farmId: string, id: string) {
    const [existing] = await tx
      .select({ id: inventoryAdjustments.id })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.id, id),
          eq(inventoryAdjustments.farmId, farmId),
        ),
      )
      .limit(1);
    return existing
      ? new ConflictException('Adjustment has already been reviewed')
      : new NotFoundException('Adjustment not found');
  }

  private validateIds(input: CreateInventoryAdjustmentDto) {
    requireUuid(input.idempotencyKey, 'idempotencyKey');
    requireUuid(input.warehouseId, 'warehouseId');
    requireUuid(input.itemId, 'itemId');
    if (input.lotId != null) requireUuid(input.lotId, 'lotId');
  }

  private normalizeAdjustment(input: CreateInventoryAdjustmentDto) {
    const quantityChange = input.quantityChange;
    if (
      typeof quantityChange !== 'string' ||
      !SIGNED_DECIMAL.test(quantityChange)
    ) {
      throw new BadRequestException(
        'quantityChange must be a signed decimal with at most 15 integer and 3 fractional digits',
      );
    }

    const unsigned = quantityChange.replace(/^[+-]/, '');
    if (/^0(?:\.0{1,3})?$/.test(unsigned)) {
      throw new BadRequestException('quantityChange must not be zero');
    }
    if (!(input.reasonCode in REASON_LABELS)) {
      throw new BadRequestException('reasonCode is not supported');
    }
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > 4000) {
      throw new BadRequestException(
        'note must contain at most 4000 characters',
      );
    }
    if (input.reasonCode === 'OTHER' && note.length === 0) {
      throw new BadRequestException(
        'note is required when reasonCode is OTHER',
      );
    }

    const isNegative = quantityChange.startsWith('-');
    return {
      quantityChange: `${isNegative ? '-' : ''}${unsigned}`,
      isPositive: !isNegative,
      note: note || null,
    };
  }

  private mapDatabaseError(error: unknown) {
    if (this.getDatabaseError(error).code === '22003') {
      return new ConflictException(
        'Inventory quantity exceeds supported precision',
      );
    }
    return error;
  }

  private getDatabaseError(error: unknown): {
    code?: string;
    constraint?: string;
  } {
    if (typeof error !== 'object' || error === null) return {};
    const databaseError = error as {
      code?: unknown;
      constraint?: unknown;
      cause?: { code?: unknown; constraint?: unknown };
    };
    const source =
      typeof databaseError.code === 'string'
        ? databaseError
        : (databaseError.cause ?? {});
    return {
      code: typeof source.code === 'string' ? source.code : undefined,
      constraint:
        typeof source.constraint === 'string' ? source.constraint : undefined,
    };
  }
}

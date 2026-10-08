import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  warehouses,
} from '../../db/schema';
import { requireUuid } from '../../common/query-params';
import {
  CreateInventoryAdjustmentDto,
  SIGNED_DECIMAL,
} from './dto/create-adjustment.dto';
import { WarehousesService } from '../warehouses/warehouses.service';

const inventoryLotId = sql<string>`${inventoryLots}."id"`;
const inventoryLotFarmId = sql<string>`${inventoryLots}."farm_id"`;
const inventoryLotItemId = sql<string>`${inventoryLots}."item_id"`;

interface NormalizedAdjustment {
  quantityChange: string;
  isPositive: boolean;
  absoluteChange: string;
  reason: string;
}

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateInventoryAdjustmentDto,
  ) {
    requireUuid(farmId, 'farmId');
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    this.validateIds(input);
    const adjustment = this.normalizeAdjustment(input);

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const [warehouse] = await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(
            and(
              eq(warehouses.id, input.warehouseId),
              eq(warehouses.farmId, farmId),
              eq(warehouses.status, 'ACTIVE'),
            ),
          )
          .limit(1);
        if (!warehouse) {
          throw new ConflictException('Warehouse must exist and be ACTIVE');
        }

        const [item] = await tx
          .select({ id: items.id, trackingMode: items.trackingMode })
          .from(items)
          .where(and(eq(items.id, input.itemId), eq(items.farmId, farmId)))
          .limit(1);
        if (!item) throw new NotFoundException('Item not found');

        if (item.trackingMode === 'ASSET') {
          throw new ConflictException('ASSET items cannot be adjusted');
        }

        let lotId: string | null = null;
        if (item.trackingMode === 'LOT') {
          if (!input.lotId) {
            throw new BadRequestException('LOT items require a lotId');
          }
          const [lot] = await tx
            .select({ id: inventoryLotId })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLotId, input.lotId),
                eq(inventoryLotFarmId, farmId),
                eq(inventoryLotItemId, input.itemId),
              ),
            )
            .limit(1);
          if (!lot) throw new NotFoundException('LOT not found');
          lotId = lot.id;
        } else if (input.lotId) {
          throw new BadRequestException('QUANTITY items cannot use a lotId');
        }

        if (adjustment.isPositive) {
          // Let PostgreSQL serialize concurrent increments, including first inserts.
          const [balance] = await tx
            .insert(inventoryBalances)
            .values({
              farmId,
              warehouseId: input.warehouseId,
              itemId: input.itemId,
              lotId,
              quantityOnHand: adjustment.quantityChange,
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
              setWhere: eq(inventoryBalances.farmId, farmId),
            })
            .returning({ id: inventoryBalances.id });
          if (!balance) {
            throw new ConflictException(
              'Inventory balance could not be updated',
            );
          }
        } else {
          // This predicate makes the decrement atomic with the stock check.
          const [balance] = await tx
            .update(inventoryBalances)
            .set({
              quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${adjustment.absoluteChange}`,
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(inventoryBalances.farmId, farmId),
                eq(inventoryBalances.warehouseId, input.warehouseId),
                eq(inventoryBalances.itemId, input.itemId),
                lotId
                  ? eq(inventoryBalances.lotId, lotId)
                  : isNull(inventoryBalances.lotId),
                gte(
                  inventoryBalances.quantityOnHand,
                  adjustment.absoluteChange,
                ),
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
            farmId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            lotId,
            transactionType: adjustment.isPositive
              ? 'ADJUSTMENT_IN'
              : 'ADJUSTMENT_OUT',
            quantityChange: adjustment.quantityChange,
            reason: adjustment.reason,
            sourceType: 'INVENTORY_ADJUSTMENT',
            sourceId: randomUUID(),
            performedByMemberId: memberId,
          })
          .returning();

        return { transaction };
      });
    } catch (error: unknown) {
      if (this.getDatabaseErrorCode(error) === '22003') {
        throw new ConflictException(
          'Inventory quantity exceeds supported precision',
        );
      }
      throw error;
    }
  }

  private validateIds(input: CreateInventoryAdjustmentDto) {
    requireUuid(input.warehouseId, 'warehouseId');
    requireUuid(input.itemId, 'itemId');
    if (input.lotId != null) requireUuid(input.lotId, 'lotId');
  }

  private normalizeAdjustment(
    input: CreateInventoryAdjustmentDto,
  ): NormalizedAdjustment {
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
    const isNegative = quantityChange.startsWith('-');
    const normalizedMagnitude = unsigned;
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length === 0 || reason.length > 4000) {
      throw new BadRequestException('reason must contain 1 to 4000 characters');
    }

    return {
      quantityChange: `${isNegative ? '-' : ''}${normalizedMagnitude}`,
      isPositive: !isNegative,
      absoluteChange: normalizedMagnitude,
      reason,
    };
  }

  private getDatabaseErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const databaseError = error as {
      code?: unknown;
      cause?: { code?: unknown };
    };
    if (typeof databaseError.code === 'string') return databaseError.code;
    return typeof databaseError.cause?.code === 'string'
      ? databaseError.cause.code
      : undefined;
  }
}

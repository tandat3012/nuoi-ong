import { randomUUID } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { inventoryBalances, inventoryLots, inventoryTransactions, items, warehouses } from '../../db/schema';
import { CreateInventoryAdjustmentDto } from './dto/create-adjustment.dto';
import { WarehousesService } from '../warehouses/warehouses.service';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(private readonly databaseService: DatabaseService, private readonly warehousesService: WarehousesService) {}

  async create(farmId: string, clerkUserId: string, input: CreateInventoryAdjustmentDto) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const change = Number(input.quantityChange);
    if (!Number.isFinite(change) || change === 0) throw new ConflictException('quantityChange must not be zero');
    return this.databaseService.db.transaction(async (tx) => {
      const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.farmId, farmId), eq(warehouses.status, 'ACTIVE')));
      if (!warehouse) throw new ConflictException('Warehouse must exist and be ACTIVE');
      const [item] = await tx.select({ id: items.id }).from(items).where(and(eq(items.id, input.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Item not found');
      if (input.lotId) {
        const [lot] = await tx.select({ id: inventoryLots.id }).from(inventoryLots).where(and(eq(inventoryLots.id, input.lotId), eq(inventoryLots.farmId, farmId), eq(inventoryLots.itemId, input.itemId)));
        if (!lot) throw new NotFoundException('LOT not found');
      }
      const [balance] = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, input.warehouseId), eq(inventoryBalances.itemId, input.itemId), input.lotId ? eq(inventoryBalances.lotId, input.lotId) : isNull(inventoryBalances.lotId))).limit(1);
      const current = Number(balance?.quantityOnHand ?? 0);
      if (current + change < 0) throw new ConflictException('Adjustment would make inventory negative');
      if (balance) await tx.update(inventoryBalances).set({ quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${input.quantityChange}`, updatedAt: new Date().toISOString() }).where(eq(inventoryBalances.id, balance.id));
      else await tx.insert(inventoryBalances).values({ farmId, warehouseId: input.warehouseId, itemId: input.itemId, lotId: input.lotId ?? null, quantityOnHand: input.quantityChange });
      const [transaction] = await tx.insert(inventoryTransactions).values({ farmId, warehouseId: input.warehouseId, itemId: input.itemId, lotId: input.lotId ?? null, transactionType: change > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantityChange: input.quantityChange, reason: input.reason, sourceType: 'INVENTORY_ADJUSTMENT', sourceId: randomUUID(), performedByMemberId: memberId }).returning();
      return { transaction };
    });
  }
}

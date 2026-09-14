import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, gte, ilike, isNull, isNotNull, or, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  itemType,
  items,
  recordStatus,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';

type Filters = { clerkUserId: string; farmId: string; warehouseId?: string; itemId?: string; lotId?: string };
type ItemFilters = PaginationParams & { clerkUserId: string; farmId: string; search?: string; itemType?: (typeof itemType.enumValues)[number]; status?: (typeof recordStatus.enumValues)[number] };

@Injectable()
export class InventoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async listItems(filters: ItemFilters) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const predicates: SQL[] = [eq(items.farmId, filters.farmId)];
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      predicates.push(or(ilike(items.code, pattern), ilike(items.name, pattern))!);
    }
    if (filters.itemType) predicates.push(eq(items.itemType, filters.itemType));
    if (filters.status) predicates.push(eq(items.status, filters.status));
    const where = and(...predicates);
    const [data, totals] = await Promise.all([
      this.databaseService.db.select({ id: items.id, farmId: items.farmId, code: items.code, name: items.name, itemType: items.itemType, trackingMode: items.trackingMode, status: items.status }).from(items).where(where).orderBy(asc(items.code)).limit(filters.pageSize).offset(filters.offset),
      this.databaseService.db.select({ value: count() }).from(items).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: filters.page, size: filters.pageSize, totalItems, totalPages: Math.ceil(totalItems / filters.pageSize) } };
  }

  async listBalances(filters: Filters) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const predicates: SQL[] = [eq(inventoryBalances.farmId, filters.farmId)];
    if (filters.warehouseId) predicates.push(eq(inventoryBalances.warehouseId, filters.warehouseId));
    if (filters.itemId) predicates.push(eq(inventoryBalances.itemId, filters.itemId));
    if (filters.lotId) predicates.push(eq(inventoryBalances.lotId, filters.lotId));
    const data = await this.databaseService.db.select({ balance: inventoryBalances, itemCode: items.code, itemName: items.name })
      .from(inventoryBalances).innerJoin(items, eq(inventoryBalances.itemId, items.id))
      .where(and(...predicates)).orderBy(asc(items.code), inventoryBalances.lotId);
    return { data };
  }

  async listTransactions(filters: Filters & PaginationParams) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const predicates: SQL[] = [eq(inventoryTransactions.farmId, filters.farmId)];
    if (filters.warehouseId) predicates.push(eq(inventoryTransactions.warehouseId, filters.warehouseId));
    if (filters.itemId) predicates.push(eq(inventoryTransactions.itemId, filters.itemId));
    const where = and(...predicates);
    const [data, totals] = await Promise.all([
      this.databaseService.db.select().from(inventoryTransactions).where(where)
        .orderBy(desc(inventoryTransactions.createdAt)).limit(filters.pageSize).offset(filters.offset),
      this.databaseService.db.select({ value: count() }).from(inventoryTransactions).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: filters.page, size: filters.pageSize, totalItems, totalPages: Math.ceil(totalItems / filters.pageSize) } };
  }

  async listLots(filters: Pick<Filters, 'clerkUserId' | 'farmId' | 'itemId'> & PaginationParams) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const predicates: SQL[] = [eq(inventoryLots.farmId, filters.farmId)];
    if (filters.itemId) predicates.push(eq(inventoryLots.itemId, filters.itemId));
    const [data, totals] = await Promise.all([
      this.databaseService.db.select().from(inventoryLots).where(and(...predicates))
        .orderBy(asc(inventoryLots.expiryDate), asc(inventoryLots.lotNumber))
        .limit(filters.pageSize).offset(filters.offset),
      this.databaseService.db.select({ value: count() }).from(inventoryLots).where(and(...predicates)),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: filters.page, size: filters.pageSize, totalItems, totalPages: Math.ceil(totalItems / filters.pageSize) } };
  }

  async lotSuggestions(filters: Filters) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const predicates: SQL[] = [eq(inventoryBalances.farmId, filters.farmId), isNotNull(inventoryBalances.lotId)];
    if (filters.itemId) predicates.push(eq(inventoryBalances.itemId, filters.itemId));
    if (filters.warehouseId) predicates.push(eq(inventoryBalances.warehouseId, filters.warehouseId));
    const today = new Date().toISOString().slice(0, 10);
    return this.databaseService.db.select({ lot: inventoryLots, balance: inventoryBalances })
      .from(inventoryBalances).innerJoin(inventoryLots, eq(inventoryBalances.lotId, inventoryLots.id))
      .where(and(...predicates, gt(inventoryBalances.quantityOnHand, '0'), or(isNull(inventoryLots.expiryDate), gte(inventoryLots.expiryDate, today))))
      .orderBy(asc(inventoryLots.expiryDate), asc(inventoryLots.createdAt));
  }
}

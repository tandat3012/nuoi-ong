import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, isNull, sql, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  stockTransferItems,
  stockTransfers,
  warehouses,
} from '../../db/schema';
import { CreateStockTransferDto, UpdateStockTransferDto } from './dto/stock-transfer.dto';
import { WarehousesService } from './warehouses.service';
import { auditedDocumentTransaction } from '../audit-logs/audited-document-transaction';
import { notifyDocumentCreator, notifyFarmApprovers } from '../notifications/notification-events';

type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
};
type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: Filters) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const conditions: SQL[] = [eq(stockTransfers.farmId, filters.farmId)];
    if (filters.status) conditions.push(eq(stockTransfers.status, filters.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db.select().from(stockTransfers).where(where)
        .orderBy(desc(stockTransfers.createdAt)).limit(filters.pageSize).offset(filters.offset),
      this.databaseService.db.select({ value: count() }).from(stockTransfers).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: filters.page, size: filters.pageSize, totalItems, totalPages: Math.ceil(totalItems / filters.pageSize) } };
  }

  async get(id: string, farmId: string, user: string) {
    await this.warehousesService.assertFarmAccess(farmId, user, false);
    return this.withItems(id, farmId);
  }

  async create(farmId: string, user: string, input: CreateStockTransferDto) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    this.validateItems(input.items);
    if (input.fromWarehouseId === input.toWarehouseId) throw new BadRequestException('Source and destination warehouses must differ');
    const id = await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', action: 'CREATE',
    }, async (tx) => {
      await this.assertWarehouse(tx, farmId, input.fromWarehouseId);
      await this.assertWarehouse(tx, farmId, input.toWarehouseId);
      await this.validateLines(tx, farmId, input.items);
      const [row] = await tx.insert(stockTransfers).values({
        farmId, fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId,
        transferCode: input.transferCode, transferDate: input.transferDate,
        note: input.note, createdByMemberId: memberId,
      }).returning({ id: stockTransfers.id });
      await tx.insert(stockTransferItems).values(input.items.map((line) => ({
        stockTransferId: row.id, itemId: line.itemId, lotId: line.lotId,
        assetId: line.assetId, quantity: line.quantity, note: line.note,
      })));
      return row.id;
    });
    return this.withItems(id, farmId);
  }

  async update(id: string, farmId: string, user: string, input: UpdateStockTransferDto) {
    await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    const current = await this.only(id, farmId);
    if (current.status !== 'DRAFT') throw new ConflictException('Only DRAFT transfers can be edited');
    const fromWarehouseId = input.fromWarehouseId ?? current.fromWarehouseId;
    const toWarehouseId = input.toWarehouseId ?? current.toWarehouseId;
    if (fromWarehouseId === toWarehouseId) throw new BadRequestException('Source and destination warehouses must differ');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', entityId: id, action: 'UPDATE',
    }, async (tx) => {
      await this.assertWarehouse(tx, farmId, fromWarehouseId);
      await this.assertWarehouse(tx, farmId, toWarehouseId);
      if (input.items) {
        this.validateItems(input.items);
        await this.validateLines(tx, farmId, input.items);
        await tx.delete(stockTransferItems).where(eq(stockTransferItems.stockTransferId, id));
        await tx.insert(stockTransferItems).values(input.items.map((line) => ({
          stockTransferId: id, itemId: line.itemId, lotId: line.lotId,
          assetId: line.assetId, quantity: line.quantity, note: line.note,
        })));
      }
      const changes: Partial<typeof stockTransfers.$inferInsert> = {};
      for (const key of ['fromWarehouseId', 'toWarehouseId', 'transferCode', 'transferDate', 'note'] as const) {
        if (input[key] !== undefined) changes[key] = input[key] as never;
      }
      changes.updatedAt = new Date().toISOString();
      await tx.update(stockTransfers).set(changes).where(eq(stockTransfers.id, id));
    });
    return this.withItems(id, farmId);
  }

  async cancel(id: string, farmId: string, user: string) {
    await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', entityId: id, action: 'CANCEL',
    }, async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status !== 'DRAFT') throw new ConflictException('Only DRAFT transfers can be cancelled');
      await tx.update(stockTransfers).set({ status: 'CANCELLED', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockTransfers.id, id));
    });
    return this.withItems(id, farmId);
  }

  async submit(id: string, farmId: string, user: string) {
    const submittingMemberId = await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', entityId: id, action: 'SUBMIT',
    }, async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status !== 'DRAFT') throw new ConflictException('Only DRAFT transfers can be submitted');
      const [line] = await tx.select({ id: stockTransferItems.id }).from(stockTransferItems).where(eq(stockTransferItems.stockTransferId, id)).limit(1);
      if (!line) throw new BadRequestException('Transfer must contain at least one item');
      await tx.update(stockTransfers).set({ status: 'PENDING_APPROVAL', updatedAt: new Date().toISOString() }).where(eq(stockTransfers.id, id));
      await notifyFarmApprovers(tx, {
        farmId, entityType: 'STOCK_TRANSFER', entityId: id,
        documentCode: row.transferCode, documentKind: 'Phiếu chuyển kho', status: 'PENDING_APPROVAL',
      }, submittingMemberId);
    });
    return this.withItems(id, farmId);
  }

  async reject(id: string, farmId: string, user: string, rejectionReason: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, user, true);
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', entityId: id, action: 'REJECT',
    }, async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL transfers can be rejected');
      await tx.update(stockTransfers).set({ status: 'REJECTED', rejectionReason: reason, rejectedByMemberId: memberId, rejectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockTransfers.id, id));
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_TRANSFER', entityId: id,
        documentCode: row.transferCode, documentKind: 'Phiếu chuyển kho', status: 'REJECTED', rejectionReason: reason,
      }, row.createdByMemberId);
    });
    return this.withItems(id, farmId);
  }

  async confirm(id: string, farmId: string, user: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, user, true);
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId: user, entityType: 'STOCK_TRANSFER', entityId: id, action: 'CONFIRM',
    }, async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status === 'CONFIRMED') return;
      if (row.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL transfers can be confirmed');
      await this.assertWarehouse(tx, farmId, row.fromWarehouseId);
      await this.assertWarehouse(tx, farmId, row.toWarehouseId);
      const lines = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.stockTransferId, id));
      if (!lines.length) throw new BadRequestException('Transfer must contain at least one item');
      for (const line of lines) {
        if (line.assetId) {
          const [activeMaintenance] = await tx.select({ id: maintenanceRecords.id }).from(maintenanceRecords)
            .where(and(eq(maintenanceRecords.farmId, farmId), eq(maintenanceRecords.assetId, line.assetId), inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']))).limit(1);
          if (activeMaintenance) throw new ConflictException('Asset with scheduled or active maintenance cannot be transferred');
          const [asset] = await tx.select({ id: assets.id, currentLocationId: assets.currentLocationId })
            .from(assets).innerJoin(locations, and(eq(locations.id, assets.currentLocationId), eq(locations.farmId, farmId)))
            .where(and(eq(assets.id, line.assetId), eq(assets.farmId, farmId), eq(assets.itemId, line.itemId), eq(assets.status, 'AVAILABLE'), eq(locations.warehouseId, row.fromWarehouseId))).for('update').limit(1);
          if (!asset) throw new ConflictException('Asset is no longer available in the selected source warehouse');
          const [targetLocation] = await tx.select({ id: locations.id }).from(locations)
            .where(and(eq(locations.farmId, farmId), eq(locations.warehouseId, row.toWarehouseId), eq(locations.status, 'ACTIVE')))
            .orderBy(asc(locations.createdAt), asc(locations.id)).limit(1);
          if (!targetLocation) throw new ConflictException('Destination warehouse has no active storage location for this asset');
          await tx.update(assets).set({ currentLocationId: targetLocation.id, updatedAt: new Date().toISOString() }).where(eq(assets.id, asset.id));
        } else {
          const [source] = await tx.select().from(inventoryBalances).where(and(
            eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, row.fromWarehouseId),
            eq(inventoryBalances.itemId, line.itemId), line.lotId ? eq(inventoryBalances.lotId, line.lotId) : isNull(inventoryBalances.lotId),
            gte(inventoryBalances.quantityOnHand, line.quantity),
          )).for('update').limit(1);
          if (!source) throw new ConflictException('Insufficient source inventory');
          await tx.update(inventoryBalances).set({ quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${line.quantity}`, updatedAt: new Date().toISOString() }).where(eq(inventoryBalances.id, source.id));
          const [destination] = await tx.select().from(inventoryBalances).where(and(
            eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, row.toWarehouseId),
            eq(inventoryBalances.itemId, line.itemId), line.lotId ? eq(inventoryBalances.lotId, line.lotId) : isNull(inventoryBalances.lotId),
          )).limit(1);
          if (destination) {
            await tx.update(inventoryBalances).set({ quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${line.quantity}`, updatedAt: new Date().toISOString() }).where(eq(inventoryBalances.id, destination.id));
          } else {
            await tx.insert(inventoryBalances).values({ farmId, warehouseId: row.toWarehouseId, itemId: line.itemId, lotId: line.lotId, quantityOnHand: line.quantity });
          }
        }
        await tx.insert(inventoryTransactions).values([
          { farmId, warehouseId: row.fromWarehouseId, itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, transactionType: 'TRANSFER_OUT', quantityChange: `-${line.quantity}`, sourceType: 'STOCK_TRANSFER', sourceId: id, performedByMemberId: memberId },
          { farmId, warehouseId: row.toWarehouseId, itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, transactionType: 'TRANSFER_IN', quantityChange: line.quantity, sourceType: 'STOCK_TRANSFER', sourceId: id, performedByMemberId: memberId },
        ]);
      }
      await tx.update(stockTransfers).set({ status: 'CONFIRMED', confirmedByMemberId: memberId, confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockTransfers.id, id));
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_TRANSFER', entityId: id,
        documentCode: row.transferCode, documentKind: 'Phiếu chuyển kho', status: 'CONFIRMED',
      }, row.createdByMemberId);
    });
    return this.withItems(id, farmId);
  }

  private async only(id: string, farmId: string, db: Db | Transaction = this.databaseService.db, forUpdate = false) {
    const query = db.select().from(stockTransfers).where(and(eq(stockTransfers.id, id), eq(stockTransfers.farmId, farmId)));
    const [row] = forUpdate ? await query.for('update').limit(1) : await query.limit(1);
    if (!row) throw new NotFoundException('Stock transfer not found');
    return row;
  }

  private async withItems(id: string, farmId: string) {
    const transfer = await this.only(id, farmId);
    const lines = await this.databaseService.db.select().from(stockTransferItems).where(eq(stockTransferItems.stockTransferId, id)).orderBy(asc(stockTransferItems.createdAt));
    return { transfer, items: lines };
  }

  private validateItems(lines: CreateStockTransferDto['items']) {
    if (!lines?.length) throw new BadRequestException('Transfer must contain at least one item');
  }

  private async assertWarehouse(db: Db | Transaction, farmId: string, id: string) {
    const [row] = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId), eq(warehouses.status, 'ACTIVE')));
    if (!row) throw new ConflictException('Warehouse must exist and be ACTIVE');
  }

  private async validateLines(db: Db | Transaction, farmId: string, lines: CreateStockTransferDto['items']) {
    for (const line of lines) {
      const [item] = await db.select({ id: items.id }).from(items).where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Transfer item not found');
      if (line.lotId) {
        const [lot] = await db.select({ id: inventoryLots.id }).from(inventoryLots).where(and(eq(inventoryLots.id, line.lotId), eq(inventoryLots.farmId, farmId), eq(inventoryLots.itemId, line.itemId)));
        if (!lot) throw new NotFoundException('LOT not found');
      }
      if (line.assetId) {
        const [asset] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, line.assetId), eq(assets.farmId, farmId), eq(assets.itemId, line.itemId)));
        if (!asset) throw new NotFoundException('ASSET not found');
      }
    }
  }
}

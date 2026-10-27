import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, SQL } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { inventoryBalances, inventoryTransactions, items, stockCountItems, stockCounts, warehouses } from '../../db/schema';
import { CreateStockCountDto, UpdateStockCountDto } from './dto/stock-count.dto';
import { WarehousesService } from './warehouses.service';
import { auditedDocumentTransaction } from '../audit-logs/audited-document-transaction';
import { notifyDocumentCreator, notifyFarmApprovers } from '../notifications/notification-events';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

type Filters = { farmId: string; clerkUserId: string; page: number; pageSize: number; offset: number; status?: 'DRAFT' | 'COUNTING' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' };
type SnapshotLine = { itemId: string; lotId?: string | null; assetId?: string | null; systemQuantity: string; actualQuantity: string; note?: string | null };

@Injectable()
export class StockCountsService {
  constructor(private readonly dbService: DatabaseService, private readonly warehousesService: WarehousesService) {}

  async list(f: Filters) {
    await this.warehousesService.assertFarmAccess(f.farmId, f.clerkUserId, false);
    const conditions: SQL[] = [eq(stockCounts.farmId, f.farmId)];
    if (f.status) conditions.push(eq(stockCounts.status, f.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.dbService.db.select().from(stockCounts).where(where).orderBy(desc(stockCounts.createdAt)).limit(f.pageSize).offset(f.offset),
      this.dbService.db.select({ value: count() }).from(stockCounts).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: f.page, size: f.pageSize, totalItems, totalPages: Math.ceil(totalItems / f.pageSize) } };
  }

  async get(id: string, farmId: string, user: string) { await this.warehousesService.assertFarmAccess(farmId, user, false); return this.withItems(id, farmId); }

  async create(farmId: string, user: string, input: CreateStockCountDto) {
    const member = await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    this.validateItems(input.items);
    const id = await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', action: 'CREATE' }, async tx => {
      await this.assertWarehouse(tx, farmId, input.warehouseId);
      const rows: SnapshotLine[] = [];
      for (const line of input.items) {
        await this.assertItem(tx, farmId, line.itemId);
        const [balance] = await this.findBalance(tx, farmId, input.warehouseId, line.itemId, line.lotId);
        rows.push({ itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, systemQuantity: balance?.quantityOnHand ?? '0', actualQuantity: line.actualQuantity, note: line.note });
      }
      const [row] = await tx.insert(stockCounts).values({ farmId, warehouseId: input.warehouseId, countCode: input.countCode, note: input.note, createdByMemberId: member }).returning({ id: stockCounts.id });
      await tx.insert(stockCountItems).values(rows.map(line => ({ stockCountId: row.id, ...line })));
      return row.id;
    });
    return this.withItems(id, farmId);
  }

  async update(id: string, farmId: string, user: string, input: UpdateStockCountDto) {
    await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    const current = await this.only(id, farmId);
    if (!['DRAFT', 'COUNTING'].includes(current.status)) throw new ConflictException('Only active counts can be edited');
    await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', entityId: id, action: 'UPDATE' }, async tx => {
      if (input.items) {
        this.validateItems(input.items);
        const rows: SnapshotLine[] = [];
        for (const line of input.items) {
          await this.assertItem(tx, farmId, line.itemId);
          const [balance] = await this.findBalance(tx, farmId, current.warehouseId, line.itemId, line.lotId);
          rows.push({ itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, systemQuantity: balance?.quantityOnHand ?? '0', actualQuantity: line.actualQuantity, note: line.note });
        }
        await tx.delete(stockCountItems).where(eq(stockCountItems.stockCountId, id));
        await tx.insert(stockCountItems).values(rows.map(line => ({ stockCountId: id, ...line })));
      }
      await tx.update(stockCounts).set({ ...(input.note !== undefined ? { note: input.note } : {}), status: 'COUNTING', updatedAt: new Date().toISOString() }).where(eq(stockCounts.id, id));
    });
    return this.withItems(id, farmId);
  }

  async cancel(id: string, farmId: string, user: string) {
    await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', entityId: id, action: 'CANCEL' }, async tx => {
      const row = await this.only(id, farmId);
      if (!['DRAFT', 'COUNTING'].includes(row.status)) throw new ConflictException('Only active counts can be cancelled');
      await tx.update(stockCounts).set({ status: 'CANCELLED', updatedAt: new Date().toISOString() }).where(eq(stockCounts.id, id));
    });
    return this.withItems(id, farmId);
  }

  async submit(id: string, farmId: string, user: string) {
    const submittingMemberId = await this.warehousesService.assertFarmAccess(farmId, user, 'document');
    await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', entityId: id, action: 'SUBMIT' }, async tx => {
      const row = await this.only(id, farmId, tx, true);
      if (!['DRAFT', 'COUNTING'].includes(row.status)) throw new ConflictException('Only active counts can be submitted');
      const [line] = await tx.select({ id: stockCountItems.id }).from(stockCountItems).where(eq(stockCountItems.stockCountId, id)).limit(1);
      if (!line) throw new BadRequestException('Count must contain at least one item');
      await tx.update(stockCounts).set({ status: 'PENDING_APPROVAL', updatedAt: new Date().toISOString() }).where(eq(stockCounts.id, id));
      await notifyFarmApprovers(tx, {
        farmId, entityType: 'STOCK_COUNT', entityId: id,
        documentCode: row.countCode, documentKind: 'Phiếu kiểm kê', status: 'PENDING_APPROVAL',
      }, submittingMemberId);
    });
    return this.withItems(id, farmId);
  }

  async reject(id: string, farmId: string, user: string, rejectionReason: string) {
    const member = await this.warehousesService.assertFarmAccess(farmId, user, true);
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', entityId: id, action: 'REJECT' }, async tx => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL counts can be rejected');
      await tx.update(stockCounts).set({ status: 'REJECTED', rejectionReason: reason, rejectedByMemberId: member, rejectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockCounts.id, id));
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_COUNT', entityId: id,
        documentCode: row.countCode, documentKind: 'Phiếu kiểm kê', status: 'REJECTED', rejectionReason: reason,
      }, row.createdByMemberId);
    });
    return this.withItems(id, farmId);
  }

  async confirm(id: string, farmId: string, user: string) {
    const member = await this.warehousesService.assertFarmAccess(farmId, user, true);
    await auditedDocumentTransaction(this.dbService.db, { farmId, clerkUserId: user, entityType: 'STOCK_COUNT', entityId: id, action: 'CONFIRM' }, async tx => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status === 'CONFIRMED') return;
      if (row.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL counts can be confirmed');
      const lines = await tx.select().from(stockCountItems).where(eq(stockCountItems.stockCountId, id));
      if (!lines.length) throw new BadRequestException('Count must contain at least one item');
      for (const line of lines) {
        const [balance] = await this.findBalance(tx, farmId, row.warehouseId, line.itemId, line.lotId);
        const current = balance?.quantityOnHand ?? '0';
        if (current !== line.systemQuantity) throw new ConflictException('STOCK_COUNT_STALE');
        const difference = Number(line.actualQuantity) - Number(line.systemQuantity);
        if (difference === 0) continue;
        if (balance) await tx.update(inventoryBalances).set({ quantityOnHand: line.actualQuantity, updatedAt: new Date().toISOString() }).where(eq(inventoryBalances.id, balance.id));
        else await tx.insert(inventoryBalances).values({ farmId, warehouseId: row.warehouseId, itemId: line.itemId, lotId: line.lotId, quantityOnHand: line.actualQuantity });
        await tx.insert(inventoryTransactions).values({ farmId, warehouseId: row.warehouseId, itemId: line.itemId, lotId: line.lotId, assetId: line.assetId, transactionType: difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantityChange: difference.toFixed(3), sourceType: 'STOCK_COUNT', sourceId: id, performedByMemberId: member, reason: line.note });
      }
      await tx.update(stockCounts).set({ status: 'CONFIRMED', confirmedByMemberId: member, confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockCounts.id, id));
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_COUNT', entityId: id,
        documentCode: row.countCode, documentKind: 'Phiếu kiểm kê', status: 'CONFIRMED',
      }, row.createdByMemberId);
    });
    return this.withItems(id, farmId);
  }

  private async only(id: string, farmId: string, db: Db | Transaction = this.dbService.db, forUpdate = false) { const query = db.select().from(stockCounts).where(and(eq(stockCounts.id, id), eq(stockCounts.farmId, farmId))); const [row] = forUpdate ? await query.for('update').limit(1) : await query.limit(1); if (!row) throw new NotFoundException('Stock count not found'); return row; }
  private async withItems(id: string, farmId: string) { const row = await this.only(id, farmId); const items = await this.dbService.db.select().from(stockCountItems).where(eq(stockCountItems.stockCountId, id)).orderBy(asc(stockCountItems.createdAt)); return { count: row, items }; }
  private validateItems(items: CreateStockCountDto['items']) { if (!items?.length) throw new BadRequestException('Count must contain at least one item'); }
  private async assertWarehouse(db: any, farmId: string, id: string) { const [row] = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, id), eq(warehouses.farmId, farmId), eq(warehouses.status, 'ACTIVE'))); if (!row) throw new ConflictException('Warehouse must exist and be ACTIVE'); }
  private async assertItem(db: any, farmId: string, id: string) { const [row] = await db.select({ id: items.id }).from(items).where(and(eq(items.id, id), eq(items.farmId, farmId))); if (!row) throw new NotFoundException('Count item not found'); }
  private findBalance(db: any, farmId: string, warehouseId: string, itemId: string, lotId?: string | null) { return db.select().from(inventoryBalances).where(and(eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, warehouseId), eq(inventoryBalances.itemId, itemId), lotId ? eq(inventoryBalances.lotId, lotId) : isNull(inventoryBalances.lotId))).limit(1); }
}

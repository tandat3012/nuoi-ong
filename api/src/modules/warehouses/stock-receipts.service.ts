import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  assets,
  items,
  stockReceiptItems,
  stockReceipts,
  suppliers,
  warehouses,
} from '../../db/schema';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { WarehousesService } from './warehouses.service';

export interface StockReceiptListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
}

@Injectable()
export class StockReceiptsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async listReceipts(filters: StockReceiptListFilters) {
    await this.warehousesService.assertFarmAccess(
      filters.farmId,
      filters.clerkUserId,
      false,
    );
    const conditions = [eq(stockReceipts.farmId, filters.farmId)];
    if (filters.status) conditions.push(eq(stockReceipts.status, filters.status));
    const [data, total] = await Promise.all([
      this.databaseService.db
        .select()
        .from(stockReceipts)
        .where(and(...conditions))
        .orderBy(desc(stockReceipts.createdAt), stockReceipts.id)
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(stockReceipts)
        .where(and(...conditions)),
    ]);
    const totalItems = Number(total[0]?.value ?? 0);
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

  async getReceipt(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, false);
    return this.getReceiptWithItems(id, farmId);
  }

  async createReceipt(
    farmId: string,
    clerkUserId: string,
    input: CreateStockReceiptDto,
  ) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    this.validateItems(input.items);
    const result = await this.databaseService.db.transaction(async (tx) => {
      await this.assertActiveWarehouse(tx, input.warehouseId, farmId);
      await this.assertReferences(tx, farmId, input);
      const [receipt] = await tx
        .insert(stockReceipts)
        .values({
          farmId,
          warehouseId: input.warehouseId,
          supplierId: input.supplierId,
          receiptCode: input.receiptCode,
          receiptDate: input.receiptDate,
          note: input.note,
          createdByMemberId: memberId,
          status: 'DRAFT',
        })
        .returning();
      await tx.insert(stockReceiptItems).values(
        input.items.map((item) => ({
          stockReceiptId: receipt.id,
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? '0',
          lotNumber: item.lotNumber,
          manufacturedDate: item.manufacturedDate,
          expiryDate: item.expiryDate,
          assetCode: item.assetCode,
          serialNumber: item.serialNumber,
          note: item.note,
        })),
      );
      return receipt.id;
    });
    return this.getReceiptWithItems(result, farmId);
  }

  async updateReceipt(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateStockReceiptDto,
  ) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const current = await this.getReceiptWithItems(id, farmId);
    if (current.receipt.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT receipts can be edited');
    }
    if (input.items) this.validateItems(input.items);
    await this.databaseService.db.transaction(async (tx) => {
      const changes: Partial<typeof stockReceipts.$inferInsert> = {};
      for (const key of ['warehouseId', 'supplierId', 'receiptCode', 'receiptDate', 'note'] as const) {
        if (input[key] !== undefined) changes[key] = input[key] as never;
      }
      if (input.warehouseId) await this.assertActiveWarehouse(tx, input.warehouseId, farmId);
      await this.assertReferences(tx, farmId, {
        ...current.receipt,
        ...input,
        items: input.items ?? current.items,
      } as CreateStockReceiptDto);
      changes.updatedAt = new Date().toISOString();
      if (Object.keys(changes).length > 0) {
        await tx.update(stockReceipts).set(changes).where(eq(stockReceipts.id, id));
      }
      if (input.items) {
        await tx.delete(stockReceiptItems).where(eq(stockReceiptItems.stockReceiptId, id));
        await tx.insert(stockReceiptItems).values(
          input.items.map((item) => ({
            stockReceiptId: id,
            itemId: item.itemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? '0',
            lotNumber: item.lotNumber,
            manufacturedDate: item.manufacturedDate,
            expiryDate: item.expiryDate,
            assetCode: item.assetCode,
            serialNumber: item.serialNumber,
            note: item.note,
          })),
        );
      }
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async cancelReceipt(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const receipt = await this.getReceiptOnly(id, farmId);
    if (receipt.status !== 'DRAFT') throw new ConflictException('Only DRAFT receipts can be cancelled');
    const [updated] = await this.databaseService.db
      .update(stockReceipts)
      .set({ status: 'CANCELLED', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(stockReceipts.id, id))
      .returning();
    return this.getReceiptWithItems(updated.id, farmId);
  }

  async confirmReceipt(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx);
      if (receipt.status === 'CONFIRMED') return;
      if (receipt.status !== 'DRAFT') throw new ConflictException('Only DRAFT receipts can be confirmed');
      await this.assertActiveWarehouse(tx, receipt.warehouseId, farmId);
      const lines = await tx.select().from(stockReceiptItems).where(eq(stockReceiptItems.stockReceiptId, id));
      if (lines.length === 0) throw new BadRequestException('Receipt must contain at least one item');
      for (const line of lines) {
        const [item] = await tx.select({ trackingMode: items.trackingMode }).from(items).where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
        if (!item) throw new NotFoundException('Receipt item not found');
        if (item.trackingMode === 'LOT' && !line.lotNumber) {
          throw new BadRequestException('LOT receipt lines require lotNumber');
        }
        if (item.trackingMode === 'LOT' && (line.assetCode || line.serialNumber)) {
          throw new BadRequestException('LOT receipt lines cannot contain asset metadata');
        }
        if (item.trackingMode === 'ASSET' && (!line.assetCode || line.quantity !== '1')) {
          throw new BadRequestException('ASSET receipt lines require assetCode and quantity 1');
        }
        if (item.trackingMode === 'ASSET' && (line.lotNumber || line.manufacturedDate || line.expiryDate)) {
          throw new BadRequestException('ASSET receipt lines cannot contain LOT metadata');
        }
        if (item.trackingMode === 'QUANTITY' && (line.lotNumber || line.manufacturedDate || line.expiryDate || line.assetCode || line.serialNumber)) {
          throw new BadRequestException('QUANTITY receipt lines cannot contain LOT or ASSET metadata');
        }

        let lotId = line.lotId;
        let assetId = line.assetId;
        if (item.trackingMode === 'LOT' && !lotId) {
          const [lot] = await tx.insert(inventoryLots).values({
            farmId,
            itemId: line.itemId,
            sourceReceiptItemId: line.id,
            lotNumber: line.lotNumber!,
            manufacturedDate: line.manufacturedDate,
            expiryDate: line.expiryDate,
            initialQuantity: line.quantity,
          }).returning({ id: inventoryLots.id });
          lotId = lot.id;
          await tx.update(stockReceiptItems).set({ lotId }).where(eq(stockReceiptItems.id, line.id));
        }
        if (item.trackingMode === 'ASSET' && !assetId) {
          const [asset] = await tx.insert(assets).values({
            farmId,
            itemId: line.itemId,
            sourceReceiptItemId: line.id,
            assetCode: line.assetCode!,
            serialNumber: line.serialNumber,
            purchaseDate: receipt.receiptDate,
            purchasePrice: line.unitPrice,
          }).returning({ id: assets.id });
          assetId = asset.id;
          await tx.update(stockReceiptItems).set({ assetId }).where(eq(stockReceiptItems.id, line.id));
        }

        const balanceLotId = item.trackingMode === 'LOT' ? lotId : null;
        const [balance] = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, receipt.warehouseId), eq(inventoryBalances.itemId, line.itemId), balanceLotId ? eq(inventoryBalances.lotId, balanceLotId) : isNull(inventoryBalances.lotId))).limit(1);
        if (balance) {
          await tx.update(inventoryBalances).set({ quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${line.quantity}`, updatedAt: new Date().toISOString() }).where(eq(inventoryBalances.id, balance.id));
        } else {
          await tx.insert(inventoryBalances).values({ farmId, warehouseId: receipt.warehouseId, itemId: line.itemId, lotId: balanceLotId, quantityOnHand: line.quantity });
        }
        await tx.insert(inventoryTransactions).values({ farmId, warehouseId: receipt.warehouseId, itemId: line.itemId, lotId, assetId, transactionType: 'RECEIPT', quantityChange: line.quantity, sourceType: 'STOCK_RECEIPT', sourceId: id, performedByMemberId: memberId });
      }
      await tx.update(stockReceipts).set({ status: 'CONFIRMED', confirmedByMemberId: memberId, confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockReceipts.id, id));
    });
    return this.getReceiptWithItems(id, farmId);
  }

  private async getReceiptOnly(id: string, farmId: string, db = this.databaseService.db) {
    const [receipt] = await db.select().from(stockReceipts).where(and(eq(stockReceipts.id, id), eq(stockReceipts.farmId, farmId))).limit(1);
    if (!receipt) throw new NotFoundException('Stock receipt not found');
    return receipt;
  }

  private async getReceiptWithItems(id: string, farmId: string) {
    const receipt = await this.getReceiptOnly(id, farmId);
    const items = await this.databaseService.db.select().from(stockReceiptItems).where(eq(stockReceiptItems.stockReceiptId, id));
    return { receipt, items };
  }

  private validateItems(items: CreateStockReceiptDto['items']) {
    if (!items?.length) throw new BadRequestException('Receipt must contain at least one item');
  }

  private async assertActiveWarehouse(db: any, warehouseId: string, farmId: string) {
    const [warehouse] = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.farmId, farmId), eq(warehouses.status, 'ACTIVE')));
    if (!warehouse) throw new ConflictException('Warehouse must exist and be ACTIVE');
  }

  private async assertReferences(db: any, farmId: string, input: CreateStockReceiptDto) {
    if (input.supplierId) {
      const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.farmId, farmId)));
      if (!supplier) throw new NotFoundException('Supplier not found');
    }
    for (const line of input.items ?? []) {
      const [item] = await db.select({ id: items.id }).from(items).where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Receipt item not found');
    }
  }
}

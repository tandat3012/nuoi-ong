import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  assets,
  items,
  locations,
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
  warehouseId?: string;
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
    if (filters.warehouseId)
      conditions.push(eq(stockReceipts.warehouseId, filters.warehouseId));
    const [data, total] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(stockReceipts),
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
          supplierCode: suppliers.code,
          supplierName: suppliers.name,
        })
        .from(stockReceipts)
        .innerJoin(
          warehouses,
          and(
            eq(warehouses.id, stockReceipts.warehouseId),
            eq(warehouses.farmId, stockReceipts.farmId),
          ),
        )
        .leftJoin(
          suppliers,
          and(
            eq(suppliers.id, stockReceipts.supplierId),
            eq(suppliers.farmId, stockReceipts.farmId),
          ),
        )
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
    const transaction = this.databaseService.db.transaction(async (tx) => {
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
          locationId: item.locationId,
          manufacturedDate: item.manufacturedDate,
          expiryDate: item.expiryDate,
          assetCode: item.assetCode,
          serialNumber: item.serialNumber,
          note: item.note,
        })),
      );
      return receipt.id;
    });
    const result = await transaction.catch((error: unknown) =>
      this.throwMappedUniqueConflict(
        error,
        'uq_receipt_code_per_farm',
        'Receipt code already exists for this farm',
      ),
    );
    return this.getReceiptWithItems(result, farmId);
  }

  async updateReceipt(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateStockReceiptDto,
  ) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    if (input.items) this.validateItems(input.items);
    const transaction = this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status !== 'DRAFT') {
        throw new ConflictException('Only DRAFT receipts can be edited');
      }
      const currentItems = await tx
        .select()
        .from(stockReceiptItems)
        .where(eq(stockReceiptItems.stockReceiptId, id));
      const current = { receipt, items: currentItems };
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
            locationId: item.locationId,
            manufacturedDate: item.manufacturedDate,
            expiryDate: item.expiryDate,
            assetCode: item.assetCode,
            serialNumber: item.serialNumber,
            note: item.note,
          })),
        );
      }
    });
    await transaction.catch((error: unknown) =>
      this.throwMappedUniqueConflict(
        error,
        'uq_receipt_code_per_farm',
        'Receipt code already exists for this farm',
      ),
    );
    return this.getReceiptWithItems(id, farmId);
  }

  async cancelReceipt(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT receipts can be cancelled');
      await tx
        .update(stockReceipts)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(stockReceipts.id, id), eq(stockReceipts.farmId, farmId)),
        );
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async confirmReceipt(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status === 'CONFIRMED') return;
      if (receipt.status !== 'DRAFT') throw new ConflictException('Only DRAFT receipts can be confirmed');
      await this.assertActiveWarehouse(tx, receipt.warehouseId, farmId);
      const lines = await tx.select().from(stockReceiptItems).where(eq(stockReceiptItems.stockReceiptId, id));
      if (lines.length === 0) throw new BadRequestException('Receipt must contain at least one item');
      for (const line of lines) {
        const [item] = await tx.select({ trackingMode: items.trackingMode }).from(items).where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
        if (!item) throw new NotFoundException('Receipt item not found');
        if (line.locationId) {
          if (item.trackingMode !== 'ASSET')
            throw new BadRequestException(
              'Only ASSET receipt lines can select a location',
            );
          await this.assertActiveLocation(
            tx,
            line.locationId,
            farmId,
            receipt.warehouseId,
          );
        }
        if (item.trackingMode === 'LOT' && !line.lotNumber) {
          throw new BadRequestException('LOT receipt lines require lotNumber');
        }
        if (item.trackingMode === 'LOT' && (line.assetCode || line.serialNumber)) {
          throw new BadRequestException('LOT receipt lines cannot contain asset metadata');
        }
        if (
          item.trackingMode === 'ASSET' &&
          (!line.assetCode || Number(line.quantity) !== 1)
        ) {
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
          let createdLotId: string;
          try {
            const [lot] = await tx.insert(inventoryLots).values({
              farmId,
              itemId: line.itemId,
              sourceReceiptItemId: line.id,
              lotNumber: line.lotNumber!,
              manufacturedDate: line.manufacturedDate,
              expiryDate: line.expiryDate,
              initialQuantity: line.quantity,
            }).returning({ id: inventoryLots.id });
            createdLotId = lot.id;
          } catch (error: unknown) {
            this.throwMappedUniqueConflict(
              error,
              'uq_lot_per_item_farm',
              'Lot number already exists for this item',
            );
          }
          lotId = createdLotId;
          await tx.update(stockReceiptItems).set({ lotId }).where(eq(stockReceiptItems.id, line.id));
        }
        if (item.trackingMode === 'ASSET' && !assetId) {
          let asset: { id: string };
          try {
            [asset] = await tx.insert(assets).values({
              farmId,
              itemId: line.itemId,
              sourceReceiptItemId: line.id,
              currentLocationId: line.locationId,
              assetCode: line.assetCode!,
              serialNumber: line.serialNumber,
              purchaseDate: receipt.receiptDate,
              purchasePrice: line.unitPrice,
            }).returning({ id: assets.id });
          } catch (error: unknown) {
            const databaseError = error as {
              code?: string;
              constraint?: string;
              cause?: { code?: string; constraint?: string };
            };
            const code = databaseError?.code ?? databaseError?.cause?.code;
            const constraint =
              databaseError?.constraint ?? databaseError?.cause?.constraint;
            if (code === '23505' && constraint === 'uq_asset_code_per_farm')
              throw new ConflictException(
                'Asset code already exists for this farm',
              );
            if (code === '23505' && constraint === 'ux_asset_serial_per_farm')
              throw new ConflictException(
                'Asset serial number already exists for this farm',
              );
            throw error;
          }
          assetId = asset.id;
          await tx.update(stockReceiptItems).set({ assetId }).where(eq(stockReceiptItems.id, line.id));
        }

        const balanceLotId = item.trackingMode === 'LOT' ? lotId : null;
        await tx
          .insert(inventoryBalances)
          .values({
            farmId,
            warehouseId: receipt.warehouseId,
            itemId: line.itemId,
            lotId: balanceLotId,
            quantityOnHand: line.quantity,
          })
          .onConflictDoUpdate({
            target: [
              inventoryBalances.itemId,
              inventoryBalances.lotId,
              inventoryBalances.warehouseId,
            ],
            set: {
              quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${line.quantity}`,
              updatedAt: new Date().toISOString(),
            },
          });
        await tx.insert(inventoryTransactions).values({ farmId, warehouseId: receipt.warehouseId, itemId: line.itemId, lotId, assetId, transactionType: 'RECEIPT', quantityChange: line.quantity, sourceType: 'STOCK_RECEIPT', sourceId: id, performedByMemberId: memberId });
      }
      await tx.update(stockReceipts).set({ status: 'CONFIRMED', confirmedByMemberId: memberId, confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(stockReceipts.id, id));
    });
    return this.getReceiptWithItems(id, farmId);
  }

  private async getReceiptOnly(
    id: string,
    farmId: string,
    db = this.databaseService.db,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(stockReceipts)
      .where(and(eq(stockReceipts.id, id), eq(stockReceipts.farmId, farmId)));
    const [receipt] = forUpdate
      ? await query.for('update').limit(1)
      : await query.limit(1);
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
      const [item] = await db.select({ id: items.id, trackingMode: items.trackingMode }).from(items).where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Receipt item not found');
      if (line.locationId) {
        if (item.trackingMode !== 'ASSET')
          throw new BadRequestException('Only ASSET receipt lines can select a location');
        await this.assertActiveLocation(
          db,
          line.locationId,
          farmId,
          input.warehouseId,
        );
      }
    }
  }

  private async assertActiveLocation(
    db: any,
    locationId: string,
    farmId: string,
    warehouseId: string,
  ) {
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.farmId, farmId),
          eq(locations.warehouseId, warehouseId),
          eq(locations.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!location)
      throw new NotFoundException(
        'Active location not found for this farm and warehouse',
      );
  }

  private throwMappedUniqueConflict(
    error: unknown,
    constraint: string,
    message: string,
  ): never {
    const databaseError = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const code = databaseError?.code ?? databaseError?.cause?.code;
    const actualConstraint =
      databaseError?.constraint ?? databaseError?.cause?.constraint;
    if (code === '23505' && actualConstraint === constraint) {
      throw new ConflictException(message);
    }
    throw error;
  }
}

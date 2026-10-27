import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, getTableColumns, sql } from 'drizzle-orm';
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
  units,
  warehouses,
} from '../../db/schema';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { WarehousesService } from './warehouses.service';
import { auditedDocumentTransaction } from '../audit-logs/audited-document-transaction';
import { notifyDocumentCreator, notifyFarmApprovers } from '../notifications/notification-events';

export interface StockReceiptListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
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
      'document',
    );
    this.validateItems(input.items);
    const transaction = auditedDocumentTransaction(this.databaseService.db, {
      farmId,
      clerkUserId,
      entityType: 'STOCK_RECEIPT',
      action: 'CREATE',
    }, async (tx) => {
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
          lotId: item.lotId ?? null,
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
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, 'document');
    if (input.items) this.validateItems(input.items);
    const transaction = auditedDocumentTransaction(this.databaseService.db, {
      farmId,
      clerkUserId,
      entityType: 'STOCK_RECEIPT',
      entityId: id,
      action: 'UPDATE',
    }, async (tx) => {
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
            lotId: item.lotId ?? null,
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
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, 'document');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId,
      clerkUserId,
      entityType: 'STOCK_RECEIPT',
      entityId: id,
      action: 'CANCEL',
    }, async (tx) => {
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

  async submitReceipt(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, 'document');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId, entityType: 'STOCK_RECEIPT', entityId: id, action: 'SUBMIT',
    }, async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status !== 'DRAFT') throw new ConflictException('Only DRAFT receipts can be submitted');
      const [item] = await tx.select({ id: stockReceiptItems.id }).from(stockReceiptItems)
        .where(eq(stockReceiptItems.stockReceiptId, id)).limit(1);
      if (!item) throw new BadRequestException('Receipt must contain at least one item');
      await tx.update(stockReceipts).set({ status: 'PENDING_APPROVAL', updatedAt: new Date().toISOString() })
        .where(eq(stockReceipts.id, id));
      await notifyFarmApprovers(tx, {
        farmId, entityType: 'STOCK_RECEIPT', entityId: id,
        documentCode: receipt.receiptCode, documentKind: 'Phiếu nhập kho', status: 'PENDING_APPROVAL',
      }, memberId);
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async rejectReceipt(id: string, farmId: string, clerkUserId: string, rejectionReason: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId, entityType: 'STOCK_RECEIPT', entityId: id, action: 'REJECT',
    }, async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL receipts can be rejected');
      await tx.update(stockReceipts).set({
        status: 'REJECTED', rejectionReason: reason, rejectedByMemberId: memberId,
        rejectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }).where(eq(stockReceipts.id, id));
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_RECEIPT', entityId: id,
        documentCode: receipt.receiptCode, documentKind: 'Phiếu nhập kho', status: 'REJECTED', rejectionReason: reason,
      }, receipt.createdByMemberId);
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async confirmReceipt(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await auditedDocumentTransaction(this.databaseService.db, {
      farmId, clerkUserId, entityType: 'STOCK_RECEIPT', entityId: id, action: 'CONFIRM',
    }, async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status === 'CONFIRMED') return;
      if (receipt.status !== 'PENDING_APPROVAL') throw new ConflictException('Only PENDING_APPROVAL receipts can be confirmed');
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
        if (item.trackingMode === 'LOT' && !line.lotId && !line.lotNumber) {
          throw new BadRequestException('LOT receipt lines require an existing lot or lotNumber');
        }
        if (item.trackingMode === 'LOT' && (line.assetCode || line.serialNumber)) {
          throw new BadRequestException('LOT receipt lines cannot contain asset metadata');
        }
        if (item.trackingMode === 'LOT' && line.lotId && (line.lotNumber || line.manufacturedDate || line.expiryDate)) {
          throw new BadRequestException('Existing LOT receipt lines cannot override lot metadata');
        }
        if (
          item.trackingMode === 'ASSET' &&
          (!line.assetCode || Number(line.quantity) !== 1)
        ) {
          throw new BadRequestException('ASSET receipt lines require assetCode and quantity 1');
        }
        if (item.trackingMode === 'ASSET' && (line.lotId || line.lotNumber || line.manufacturedDate || line.expiryDate)) {
          throw new BadRequestException('ASSET receipt lines cannot contain LOT metadata');
        }
        if (item.trackingMode === 'QUANTITY' && (line.lotId || line.lotNumber || line.manufacturedDate || line.expiryDate || line.assetCode || line.serialNumber)) {
          throw new BadRequestException('QUANTITY receipt lines cannot contain LOT or ASSET metadata');
        }

        let lotId = line.lotId;
        let assetId = line.assetId;
        if (item.trackingMode === 'LOT' && lotId) {
          const [existingLot] = await tx
            .select({ id: inventoryLots.id })
            .from(inventoryLots)
            .where(and(
              eq(inventoryLots.id, lotId),
              eq(inventoryLots.farmId, farmId),
              eq(inventoryLots.itemId, line.itemId),
            ))
            .for('update')
            .limit(1);
          if (!existingLot) throw new NotFoundException('Selected lot not found for this farm and item');
        }
        if (item.trackingMode === 'LOT' && !lotId) {
          if (line.manufacturedDate && line.expiryDate && line.expiryDate < line.manufacturedDate) {
            throw new BadRequestException('Expiry date cannot be earlier than manufactured date');
          }
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
      await notifyDocumentCreator(tx, {
        farmId, entityType: 'STOCK_RECEIPT', entityId: id,
        documentCode: receipt.receiptCode, documentKind: 'Phiếu nhập kho', status: 'CONFIRMED',
      }, receipt.createdByMemberId);
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
    const lineItems = await this.databaseService.db
      .select({
        ...getTableColumns(stockReceiptItems),
        itemCode: items.code,
        itemName: items.name,
        itemType: items.itemType,
        trackingMode: items.trackingMode,
        unitId: units.id,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotNumberFromLot: inventoryLots.lotNumber,
        lotManufacturedDate: inventoryLots.manufacturedDate,
        lotExpiryDate: inventoryLots.expiryDate,
        assetCodeFromAsset: assets.assetCode,
        assetSerialNumber: assets.serialNumber,
        locationCode: locations.code,
        locationName: locations.name,
      })
      .from(stockReceiptItems)
      .leftJoin(
        items,
        and(eq(items.id, stockReceiptItems.itemId), eq(items.farmId, farmId)),
      )
      .leftJoin(units, eq(units.id, items.unitId))
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryLots.id, stockReceiptItems.lotId),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, stockReceiptItems.itemId),
        ),
      )
      .leftJoin(
        assets,
        and(
          eq(assets.id, stockReceiptItems.assetId),
          eq(assets.farmId, farmId),
          eq(assets.itemId, stockReceiptItems.itemId),
        ),
      )
      .leftJoin(
        locations,
        and(
          eq(locations.id, stockReceiptItems.locationId),
          eq(locations.farmId, farmId),
        ),
      )
      .where(eq(stockReceiptItems.stockReceiptId, id))
      .orderBy(asc(stockReceiptItems.createdAt), asc(stockReceiptItems.id));
    return { receipt, items: lineItems };
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
      if (line.lotId) {
        if (item.trackingMode !== 'LOT' || line.lotNumber || line.manufacturedDate || line.expiryDate) {
          throw new BadRequestException('lotId can only select an existing LOT without new lot metadata');
        }
        const [lot] = await db
          .select({ id: inventoryLots.id })
          .from(inventoryLots)
          .where(and(
            eq(inventoryLots.id, line.lotId),
            eq(inventoryLots.farmId, farmId),
            eq(inventoryLots.itemId, line.itemId),
          ))
          .limit(1);
        if (!lot) throw new NotFoundException('Selected lot not found for this farm and item');
      } else if (item.trackingMode !== 'LOT' && (line.lotNumber || line.manufacturedDate || line.expiryDate)) {
        throw new BadRequestException('Lot metadata can only be used with LOT items');
      }
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

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
  units,
  warehouses,
} from '../../db/schema';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';
import { assertOwnDocument, WarehousesService } from './warehouses.service';
import { auditStockDocument } from './stock-document-audit';
import {
  confirmationCode,
  ignoreLegacyCode,
  numberingOptionChanges,
  rethrowCodeConflict,
} from './stock-document-code';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
} from '../notifications/notification-events';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';

export interface StockReceiptListFilters extends PaginationParams {
  farmId: string;
  clerkUserId: string;
  status?: typeof stockReceipts.$inferSelect.status;
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
    if (filters.status)
      conditions.push(eq(stockReceipts.status, filters.status));
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
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    const { memberId } = writer;
    const numbering = numberingOptionChanges(input, writer);
    this.validateItems(input.items);
    const transaction = this.databaseService.db.transaction(async (tx) => {
      await this.assertActiveWarehouse(tx, input.warehouseId, farmId);
      await this.assertReferences(tx, farmId, input);
      ignoreLegacyCode('receiptCode', input.receiptCode);
      const [receipt] = await tx
        .insert(stockReceipts)
        .values({
          ...numbering,
          farmId,
          warehouseId: input.warehouseId,
          supplierId: input.supplierId,
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
          lotId: item.lotId,
          supplierLotNumber: item.supplierLotNumber,
          locationId: item.locationId,
          manufacturedDate: item.manufacturedDate,
          expiryDate: item.expiryDate,
          assetCode: item.assetCode,
          serialNumber: item.serialNumber,
          note: item.note,
        })),
      );
      await auditStockDocument(
        tx,
        memberId,
        'STOCK_RECEIPT',
        'CREATE',
        null,
        receipt,
        {
          after: input.items,
        },
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
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    const numbering = numberingOptionChanges(input, writer);
    if (input.items) this.validateItems(input.items);
    const transaction = this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      assertOwnDocument(writer, receipt.createdByMemberId);
      if (receipt.status !== 'DRAFT') {
        throw new ConflictException('Only DRAFT receipts can be edited');
      }
      const currentItems = await tx
        .select()
        .from(stockReceiptItems)
        .where(eq(stockReceiptItems.stockReceiptId, id));
      const current = { receipt, items: currentItems };
      const changes: Partial<typeof stockReceipts.$inferInsert> = {};
      for (const key of [
        'warehouseId',
        'supplierId',
        'receiptDate',
        'note',
      ] as const) {
        if (input[key] !== undefined) changes[key] = input[key] as never;
      }
      if (input.warehouseId)
        await this.assertActiveWarehouse(tx, input.warehouseId, farmId);
      await this.assertReferences(tx, farmId, {
        ...current.receipt,
        ...input,
        items: input.items ?? current.items,
      } as CreateStockReceiptDto);
      changes.updatedAt = new Date().toISOString();
      Object.assign(changes, numbering);
      if (Object.keys(changes).length > 0) {
        ignoreLegacyCode('receiptCode', input.receiptCode);
        await tx
          .update(stockReceipts)
          .set(changes)
          .where(eq(stockReceipts.id, id));
      }
      if (input.items) {
        // Legacy numbers follow the replaced line by id, so removing or reordering lines cannot shift them.
        const legacyByLine = new Map(
          currentItems.map((line) => [line.id, line] as const),
        );
        const legacyLotNumber = (item: (typeof input.items)[number]) => {
          const source = item.lineId && legacyByLine.get(item.lineId);
          if (!source) return null;
          legacyByLine.delete(source.id);
          return !item.lotId && source.itemId === item.itemId
            ? source.legacyLotNumber
            : null;
        };
        await tx
          .delete(stockReceiptItems)
          .where(eq(stockReceiptItems.stockReceiptId, id));
        await tx.insert(stockReceiptItems).values(
          input.items.map((item) => ({
            stockReceiptId: id,
            itemId: item.itemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? '0',
            lotId: item.lotId,
            supplierLotNumber: item.supplierLotNumber,
            legacyLotNumber: legacyLotNumber(item),
            locationId: item.locationId,
            manufacturedDate: item.manufacturedDate,
            expiryDate: item.expiryDate,
            assetCode: item.assetCode,
            serialNumber: item.serialNumber,
            note: item.note,
          })),
        );
      }
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_RECEIPT',
        'UPDATE',
        receipt,
        { ...receipt, ...changes },
        input.items ? { before: currentItems, after: input.items } : {},
      );
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
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      assertOwnDocument(writer, receipt.createdByMemberId);
      if (receipt.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT receipts can be cancelled');
      await tx
        .update(stockReceipts)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(stockReceipts.id, id), eq(stockReceipts.farmId, farmId)));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_RECEIPT',
        'CANCEL',
        receipt,
        {
          ...receipt,
          status: 'CANCELLED',
        },
      );
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async submitReceipt(id: string, farmId: string, clerkUserId: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      assertOwnDocument(writer, receipt.createdByMemberId);
      if (receipt.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT receipts can be submitted');
      const [line] = await tx
        .select({ id: stockReceiptItems.id })
        .from(stockReceiptItems)
        .where(eq(stockReceiptItems.stockReceiptId, id))
        .limit(1);
      if (!line)
        throw new BadRequestException('Receipt must contain at least one item');
      await tx
        .update(stockReceipts)
        .set({
          status: 'PENDING_APPROVAL',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockReceipts.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_RECEIPT',
        'SUBMIT',
        receipt,
        {
          ...receipt,
          status: 'PENDING_APPROVAL',
        },
      );
      await notifyFarmApprovers(
        tx,
        this.notification(receipt, 'PENDING_APPROVAL'),
        writer.memberId,
      );
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async rejectReceipt(
    id: string,
    farmId: string,
    clerkUserId: string,
    rejectionReason: string,
  ) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status !== 'PENDING_APPROVAL')
        throw new ConflictException(
          'Only PENDING_APPROVAL receipts can be rejected',
        );
      const now = new Date().toISOString();
      await tx
        .update(stockReceipts)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedByMemberId: memberId,
          rejectedAt: now,
          updatedAt: now,
        })
        .where(eq(stockReceipts.id, id));
      await auditStockDocument(
        tx,
        memberId,
        'STOCK_RECEIPT',
        'REJECT',
        receipt,
        {
          ...receipt,
          status: 'REJECTED',
          rejectionReason: reason,
        },
      );
      if (receipt.createdByMemberId !== memberId)
        await notifyDocumentCreator(
          tx,
          {
            ...this.notification(receipt, 'REJECTED'),
            rejectionReason: reason,
          },
          receipt.createdByMemberId,
        );
    });
    return this.getReceiptWithItems(id, farmId);
  }

  async confirmReceipt(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const confirmation = this.databaseService.db.transaction(async (tx) => {
      const receipt = await this.getReceiptOnly(id, farmId, tx, true);
      if (receipt.status === 'CONFIRMED') return;
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(receipt.status))
        throw new ConflictException(
          'Only DRAFT or PENDING_APPROVAL receipts can be confirmed',
        );
      await this.assertActiveWarehouse(tx, receipt.warehouseId, farmId);
      const lines = await tx
        .select()
        .from(stockReceiptItems)
        .where(eq(stockReceiptItems.stockReceiptId, id));
      if (lines.length === 0)
        throw new BadRequestException('Receipt must contain at least one item');
      for (const line of lines) {
        const [item] = await tx
          .select({ trackingMode: items.trackingMode })
          .from(items)
          .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
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
        if (
          line.lotId &&
          (item.trackingMode !== 'LOT' ||
            line.supplierLotNumber ||
            line.manufacturedDate ||
            line.expiryDate)
        ) {
          throw new BadRequestException(
            'lotId only selects an existing lot of a LOT item, without new lot metadata',
          );
        }
        this.assertLotDates(line);
        if (
          item.trackingMode === 'LOT' &&
          (line.assetCode || line.serialNumber)
        ) {
          throw new BadRequestException(
            'LOT receipt lines cannot contain asset metadata',
          );
        }
        if (
          item.trackingMode === 'ASSET' &&
          (!line.assetCode || Number(line.quantity) !== 1)
        ) {
          throw new BadRequestException(
            'ASSET receipt lines require assetCode and quantity 1',
          );
        }
        if (
          item.trackingMode === 'ASSET' &&
          (line.supplierLotNumber || line.manufacturedDate || line.expiryDate)
        ) {
          throw new BadRequestException(
            'ASSET receipt lines cannot contain LOT metadata',
          );
        }
        if (
          item.trackingMode === 'QUANTITY' &&
          (line.supplierLotNumber ||
            line.manufacturedDate ||
            line.expiryDate ||
            line.assetCode ||
            line.serialNumber)
        ) {
          throw new BadRequestException(
            'QUANTITY receipt lines cannot contain LOT or ASSET metadata',
          );
        }

        let lotId = line.lotId;
        let assetId = line.assetId;
        if (item.trackingMode === 'LOT' && lotId)
          await this.assertLot(tx, lotId, farmId, line.itemId, true);
        if (item.trackingMode === 'LOT' && !lotId) {
          // lot_code comes from the database sequence; equal supplier numbers never merge lots.
          const [lot] = await tx
            .insert(inventoryLots)
            .values({
              farmId,
              itemId: line.itemId,
              sourceReceiptItemId: line.id,
              supplierLotNumber: line.supplierLotNumber,
              legacyLotNumber: line.legacyLotNumber,
              manufacturedDate: line.manufacturedDate,
              expiryDate: line.expiryDate,
              initialQuantity: line.quantity,
            })
            .returning({ id: inventoryLots.id });
          lotId = lot.id;
          await tx
            .update(stockReceiptItems)
            .set({ lotId })
            .where(eq(stockReceiptItems.id, line.id));
        }
        if (item.trackingMode === 'ASSET' && !assetId) {
          let asset: { id: string };
          try {
            [asset] = await tx
              .insert(assets)
              .values({
                farmId,
                itemId: line.itemId,
                sourceReceiptItemId: line.id,
                currentLocationId: line.locationId,
                assetCode: line.assetCode!,
                serialNumber: line.serialNumber,
                purchaseDate: receipt.receiptDate,
                purchasePrice: line.unitPrice,
              })
              .returning({ id: assets.id });
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
          await tx
            .update(stockReceiptItems)
            .set({ assetId })
            .where(eq(stockReceiptItems.id, line.id));
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
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: receipt.warehouseId,
          itemId: line.itemId,
          lotId,
          assetId,
          transactionType: 'RECEIPT',
          quantityChange: line.quantity,
          sourceType: 'STOCK_RECEIPT',
          sourceId: id,
          performedByMemberId: memberId,
        });
      }
      const confirmedAt = new Date();
      const { code: receiptCode, codeSource } = await confirmationCode(
        tx,
        farmId,
        'PN',
        { code: receipt.receiptCode, requestedCode: receipt.requestedCode },
        confirmedAt,
      );
      await tx
        .update(stockReceipts)
        .set({
          status: 'CONFIRMED',
          receiptCode,
          codeSource,
          confirmedByMemberId: memberId,
          confirmedAt: confirmedAt.toISOString(),
          updatedAt: confirmedAt.toISOString(),
        })
        .where(eq(stockReceipts.id, id));
      const confirmed = {
        ...receipt,
        receiptCode,
        codeSource: codeSource ?? receipt.codeSource,
        status: 'CONFIRMED' as const,
      };
      await auditStockDocument(
        tx,
        memberId,
        'STOCK_RECEIPT',
        'CONFIRM',
        receipt,
        confirmed,
      );
      if (receipt.createdByMemberId !== memberId)
        await notifyDocumentCreator(
          tx,
          this.notification(confirmed, 'CONFIRMED'),
          receipt.createdByMemberId,
        );
    });
    await confirmation.catch(rethrowCodeConflict);
    return this.getReceiptWithItems(id, farmId);
  }

  private notification(
    receipt: typeof stockReceipts.$inferSelect,
    status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED',
  ) {
    return {
      farmId: receipt.farmId,
      entityType: 'STOCK_RECEIPT',
      entityId: receipt.id,
      documentCode: receipt.receiptCode,
      documentKind: 'Phiếu nhập kho',
      status,
    };
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
    const lines = await this.databaseService.db
      .select({
        ...getTableColumns(stockReceiptItems),
        itemCode: items.code,
        itemName: items.name,
        itemType: items.itemType,
        trackingMode: items.trackingMode,
        unitId: units.id,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotCode: inventoryLots.lotCode,
        lotSupplierLotNumber: inventoryLots.supplierLotNumber,
        lotLegacyLotNumber: inventoryLots.legacyLotNumber,
        // Deprecated aliases for clients built before the lot identity split.
        lotNumber: sql<
          string | null
        >`coalesce(${stockReceiptItems.supplierLotNumber}, ${stockReceiptItems.legacyLotNumber})`,
        lotNumberFromLot: inventoryLots.lotCode,
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
        ),
      )
      .leftJoin(
        assets,
        and(
          eq(assets.id, stockReceiptItems.assetId),
          eq(assets.farmId, farmId),
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
      .orderBy(stockReceiptItems.createdAt, stockReceiptItems.id);
    return { receipt, items: lines };
  }

  private validateItems(items: CreateStockReceiptDto['items']) {
    if (!items?.length)
      throw new BadRequestException('Receipt must contain at least one item');
  }

  private async assertActiveWarehouse(
    db: Pick<DatabaseService['db'], 'select'>,
    warehouseId: string,
    farmId: string,
  ) {
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, warehouseId),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      );
    if (!warehouse)
      throw new ConflictException('Warehouse must exist and be ACTIVE');
  }

  private async assertReferences(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    input: CreateStockReceiptDto,
  ) {
    if (input.supplierId) {
      const [supplier] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(eq(suppliers.id, input.supplierId), eq(suppliers.farmId, farmId)),
        );
      if (!supplier) throw new NotFoundException('Supplier not found');
    }
    for (const line of input.items ?? []) {
      const [item] = await db
        .select({ id: items.id, trackingMode: items.trackingMode })
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Receipt item not found');
      if (line.lotId) {
        if (
          item.trackingMode !== 'LOT' ||
          line.supplierLotNumber ||
          line.manufacturedDate ||
          line.expiryDate
        )
          throw new BadRequestException(
            'lotId only selects an existing lot of a LOT item, without new lot metadata',
          );
        await this.assertLot(db, line.lotId, farmId, line.itemId);
      }
      this.assertLotDates(line);
      if (line.locationId) {
        if (item.trackingMode !== 'ASSET')
          throw new BadRequestException(
            'Only ASSET receipt lines can select a location',
          );
        await this.assertActiveLocation(
          db,
          line.locationId,
          farmId,
          input.warehouseId,
        );
      }
    }
  }

  private assertLotDates(line: {
    manufacturedDate?: string | null;
    expiryDate?: string | null;
  }) {
    if (
      line.manufacturedDate &&
      line.expiryDate &&
      line.expiryDate < line.manufacturedDate
    )
      throw new BadRequestException(
        'Expiry date cannot be earlier than manufactured date',
      );
  }

  private async assertLot(
    db: Pick<DatabaseService['db'], 'select'>,
    lotId: string,
    farmId: string,
    itemId: string,
    forUpdate = false,
  ) {
    const query = db
      .select({ id: inventoryLots.id })
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLots.id, lotId),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, itemId),
        ),
      );
    const [lot] = forUpdate
      ? await query.for('update').limit(1)
      : await query.limit(1);
    if (!lot)
      throw new NotFoundException(
        'Selected lot not found for this farm and item',
      );
  }

  private async assertActiveLocation(
    db: Pick<DatabaseService['db'], 'select'>,
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

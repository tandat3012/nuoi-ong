import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  SQL,
  getTableColumns,
} from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  stockCountItems,
  stockCounts,
  units,
  warehouses,
} from '../../db/schema';
import {
  CreateStockCountDto,
  UpdateStockCountDto,
} from './dto/stock-count.dto';
import { assertOwnDocument, WarehousesService } from './warehouses.service';
import { auditStockDocument } from './stock-document-audit';
import {
  allocateDocumentCode,
  lockManualCodeScope,
} from './stock-document-code';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
} from '../notifications/notification-events';

type Filters = {
  farmId: string;
  clerkUserId: string;
  page: number;
  pageSize: number;
  offset: number;
  status?: typeof stockCounts.$inferSelect.status;
};
type SnapshotLine = {
  itemId: string;
  lotId?: string | null;
  assetId?: string | null;
  systemQuantity: string;
  actualQuantity: string;
  note?: string | null;
};

@Injectable()
export class StockCountsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(f: Filters) {
    await this.warehousesService.assertFarmAccess(
      f.farmId,
      f.clerkUserId,
      false,
    );
    const conditions: SQL[] = [eq(stockCounts.farmId, f.farmId)];
    if (f.status) conditions.push(eq(stockCounts.status, f.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.dbService.db
        .select()
        .from(stockCounts)
        .where(where)
        .orderBy(desc(stockCounts.createdAt))
        .limit(f.pageSize)
        .offset(f.offset),
      this.dbService.db
        .select({ value: count() })
        .from(stockCounts)
        .where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return {
      data,
      page: {
        number: f.page,
        size: f.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / f.pageSize),
      },
    };
  }

  async get(id: string, farmId: string, user: string) {
    await this.warehousesService.assertFarmAccess(farmId, user, false);
    return this.withItems(id, farmId);
  }

  async create(farmId: string, user: string, input: CreateStockCountDto) {
    const { memberId: member } =
      await this.warehousesService.assertDocumentWriter(farmId, user);
    this.validateItems(input.items);
    const id = await this.dbService.db.transaction(async (tx) => {
      await this.assertWarehouse(tx, farmId, input.warehouseId);
      const rows: SnapshotLine[] = [];
      for (const line of input.items) {
        await this.assertLine(tx, farmId, line);
        const [balance] = await this.findBalance(
          tx,
          farmId,
          input.warehouseId,
          line.itemId,
          line.lotId,
        );
        rows.push({
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          systemQuantity: balance?.quantityOnHand ?? '0',
          actualQuantity: line.actualQuantity,
          note: line.note,
        });
      }
      await lockManualCodeScope(tx, farmId, 'KK', input.countCode);
      const [row] = await tx
        .insert(stockCounts)
        .values({
          farmId,
          warehouseId: input.warehouseId,
          countCode: input.countCode,
          note: input.note,
          createdByMemberId: member,
        })
        .returning();
      await tx
        .insert(stockCountItems)
        .values(rows.map((line) => ({ stockCountId: row.id, ...line })));
      await auditStockDocument(tx, member, 'STOCK_COUNT', 'CREATE', null, row, {
        after: rows,
      });
      return row.id;
    });
    return this.withItems(id, farmId);
  }

  async update(
    id: string,
    farmId: string,
    user: string,
    input: UpdateStockCountDto,
  ) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    await this.dbService.db.transaction(async (tx) => {
      const current = await this.only(id, farmId, tx, true);
      assertOwnDocument(writer, current.createdByMemberId);
      if (!['DRAFT', 'COUNTING'].includes(current.status))
        throw new ConflictException('Only active counts can be edited');
      let lines: { before?: object[]; after?: object[] } = {};
      if (input.items) {
        this.validateItems(input.items);
        const rows: SnapshotLine[] = [];
        for (const line of input.items) {
          await this.assertLine(tx, farmId, line);
          const [balance] = await this.findBalance(
            tx,
            farmId,
            current.warehouseId,
            line.itemId,
            line.lotId,
          );
          rows.push({
            itemId: line.itemId,
            lotId: line.lotId,
            assetId: line.assetId,
            systemQuantity: balance?.quantityOnHand ?? '0',
            actualQuantity: line.actualQuantity,
            note: line.note,
          });
        }
        const before = await tx
          .select()
          .from(stockCountItems)
          .where(eq(stockCountItems.stockCountId, id));
        lines = { before, after: rows };
        await tx
          .delete(stockCountItems)
          .where(eq(stockCountItems.stockCountId, id));
        await tx
          .insert(stockCountItems)
          .values(rows.map((line) => ({ stockCountId: id, ...line })));
      }
      const changes = {
        ...(input.note !== undefined ? { note: input.note } : {}),
        status: 'COUNTING' as const,
      };
      await tx
        .update(stockCounts)
        .set({ ...changes, updatedAt: new Date().toISOString() })
        .where(eq(stockCounts.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_COUNT',
        'UPDATE',
        current,
        { ...current, ...changes },
        lines,
      );
    });
    return this.withItems(id, farmId);
  }

  async cancel(id: string, farmId: string, user: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    await this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertOwnDocument(writer, row.createdByMemberId);
      if (!['DRAFT', 'COUNTING'].includes(row.status))
        throw new ConflictException('Only active counts can be cancelled');
      await tx
        .update(stockCounts)
        .set({ status: 'CANCELLED', updatedAt: new Date().toISOString() })
        .where(eq(stockCounts.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_COUNT',
        'CANCEL',
        row,
        {
          ...row,
          status: 'CANCELLED',
        },
      );
    });
    return this.withItems(id, farmId);
  }

  async submit(id: string, farmId: string, user: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    await this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertOwnDocument(writer, row.createdByMemberId);
      if (!['DRAFT', 'COUNTING'].includes(row.status))
        throw new ConflictException('Only active counts can be submitted');
      const [line] = await tx
        .select({ id: stockCountItems.id })
        .from(stockCountItems)
        .where(eq(stockCountItems.stockCountId, id))
        .limit(1);
      if (!line)
        throw new BadRequestException('Count must contain at least one item');
      await tx
        .update(stockCounts)
        .set({
          status: 'PENDING_APPROVAL',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockCounts.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_COUNT',
        'SUBMIT',
        row,
        {
          ...row,
          status: 'PENDING_APPROVAL',
        },
      );
      await notifyFarmApprovers(
        tx,
        this.notification(row, 'PENDING_APPROVAL'),
        writer.memberId,
      );
    });
    return this.withItems(id, farmId);
  }

  async reject(
    id: string,
    farmId: string,
    user: string,
    rejectionReason: string,
  ) {
    const member = await this.warehousesService.assertFarmAccess(
      farmId,
      user,
      true,
    );
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status !== 'PENDING_APPROVAL')
        throw new ConflictException(
          'Only PENDING_APPROVAL counts can be rejected',
        );
      const now = new Date().toISOString();
      await tx
        .update(stockCounts)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedByMemberId: member,
          rejectedAt: now,
          updatedAt: now,
        })
        .where(eq(stockCounts.id, id));
      await auditStockDocument(tx, member, 'STOCK_COUNT', 'REJECT', row, {
        ...row,
        status: 'REJECTED',
        rejectionReason: reason,
      });
      if (row.createdByMemberId !== member)
        await notifyDocumentCreator(
          tx,
          { ...this.notification(row, 'REJECTED'), rejectionReason: reason },
          row.createdByMemberId,
        );
    });
    return this.withItems(id, farmId);
  }

  async confirm(id: string, farmId: string, user: string) {
    const member = await this.warehousesService.assertFarmAccess(
      farmId,
      user,
      true,
    );
    await this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      if (row.status === 'CONFIRMED') return;
      if (!['DRAFT', 'COUNTING', 'PENDING_APPROVAL'].includes(row.status))
        throw new ConflictException('Only active counts can be confirmed');
      const lines = await tx
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.stockCountId, id));
      if (!lines.length)
        throw new BadRequestException('Count must contain at least one item');
      for (const line of lines) {
        await this.assertLine(tx, farmId, line, true);
        const [balance] = await this.findBalance(
          tx,
          farmId,
          row.warehouseId,
          line.itemId,
          line.lotId,
        );
        const current = balance?.quantityOnHand ?? '0';
        if (current !== line.systemQuantity)
          throw new ConflictException('STOCK_COUNT_STALE');
        const difference = line.difference;
        if (!difference || Number(difference) === 0) continue;
        if (balance)
          await tx
            .update(inventoryBalances)
            .set({
              quantityOnHand: line.actualQuantity,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(inventoryBalances.id, balance.id));
        else
          await tx.insert(inventoryBalances).values({
            farmId,
            warehouseId: row.warehouseId,
            itemId: line.itemId,
            lotId: line.lotId,
            quantityOnHand: line.actualQuantity,
          });
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: row.warehouseId,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          transactionType: difference.startsWith('-')
            ? 'ADJUSTMENT_OUT'
            : 'ADJUSTMENT_IN',
          quantityChange: difference,
          sourceType: 'STOCK_COUNT',
          sourceId: id,
          performedByMemberId: member,
          reason: line.note,
        });
      }
      const confirmedAt = new Date();
      // Legacy drafts keep their code; uncoded drafts take the next number.
      const countCode =
        row.countCode ??
        (await allocateDocumentCode(tx, farmId, 'KK', confirmedAt));
      await tx
        .update(stockCounts)
        .set({
          status: 'CONFIRMED',
          countCode,
          confirmedByMemberId: member,
          confirmedAt: confirmedAt.toISOString(),
          updatedAt: confirmedAt.toISOString(),
        })
        .where(eq(stockCounts.id, id));
      const confirmed = { ...row, countCode, status: 'CONFIRMED' as const };
      await auditStockDocument(
        tx,
        member,
        'STOCK_COUNT',
        'CONFIRM',
        row,
        confirmed,
      );
      if (row.createdByMemberId !== member)
        await notifyDocumentCreator(
          tx,
          this.notification(confirmed, 'CONFIRMED'),
          row.createdByMemberId,
        );
    });
    return this.withItems(id, farmId);
  }

  private notification(
    row: typeof stockCounts.$inferSelect,
    status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED',
  ) {
    return {
      farmId: row.farmId,
      entityType: 'STOCK_COUNT',
      entityId: row.id,
      documentCode: row.countCode,
      documentKind: 'Phiếu kiểm kê',
      status,
    };
  }

  private async only(
    id: string,
    farmId: string,
    db: Pick<DatabaseService['db'], 'select'> = this.dbService.db,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(stockCounts)
      .where(and(eq(stockCounts.id, id), eq(stockCounts.farmId, farmId)))
      .limit(1);
    const [row] = forUpdate ? await query.for('update') : await query;
    if (!row) throw new NotFoundException('Stock count not found');
    return row;
  }
  private async withItems(id: string, farmId: string) {
    const row = await this.only(id, farmId);
    const lines = await this.dbService.db
      .select({
        ...getTableColumns(stockCountItems),
        itemCode: items.code,
        itemName: items.name,
        trackingMode: items.trackingMode,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotNumber: inventoryLots.lotNumber,
        lotExpiryDate: inventoryLots.expiryDate,
      })
      .from(stockCountItems)
      .leftJoin(
        items,
        and(eq(items.id, stockCountItems.itemId), eq(items.farmId, farmId)),
      )
      .leftJoin(units, eq(units.id, items.unitId))
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryLots.id, stockCountItems.lotId),
          eq(inventoryLots.farmId, farmId),
        ),
      )
      .where(eq(stockCountItems.stockCountId, id))
      .orderBy(asc(stockCountItems.createdAt));
    return { count: row, items: lines };
  }
  private validateItems(items: CreateStockCountDto['items']) {
    if (!items?.length)
      throw new BadRequestException('Count must contain at least one item');
  }
  private async assertWarehouse(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    id: string,
  ) {
    const [row] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, id),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      );
    if (!row) throw new ConflictException('Warehouse must exist and be ACTIVE');
  }
  /** Counts adjust quantity balances only; assets are reconciled through asset records. */
  private async assertLine(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    line: { itemId: string; lotId?: string | null; assetId?: string | null },
    confirming = false,
  ) {
    const Invalid = confirming ? ConflictException : BadRequestException;
    const [item] = await db
      .select({ id: items.id, trackingMode: items.trackingMode })
      .from(items)
      .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
    if (!item) throw new NotFoundException('Count item not found');
    if (line.assetId || item.trackingMode === 'ASSET')
      throw new Invalid(
        'ASSET items cannot be counted; check them through asset records',
      );
    if (item.trackingMode === 'LOT' && !line.lotId)
      throw new Invalid('LOT items require a lotId');
    if (item.trackingMode !== 'LOT' && line.lotId)
      throw new Invalid('Only LOT items accept a lotId');
    if (!line.lotId) return;
    const [lot] = await db
      .select({ id: inventoryLots.id })
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLots.id, line.lotId),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, line.itemId),
        ),
      );
    if (!lot) throw new NotFoundException('LOT not found');
  }
  private findBalance(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    warehouseId: string,
    itemId: string,
    lotId?: string | null,
  ) {
    return db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, farmId),
          eq(inventoryBalances.warehouseId, warehouseId),
          eq(inventoryBalances.itemId, itemId),
          lotId
            ? eq(inventoryBalances.lotId, lotId)
            : isNull(inventoryBalances.lotId),
        ),
      )
      .limit(1);
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  or,
  sql,
  SQL,
  getTableColumns,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  stockTransferItems,
  stockTransfers,
  units,
  warehouses,
} from '../../db/schema';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  UpdateStockTransferDto,
} from './dto/stock-transfer.dto';
import { assertInScope, inScope, scopeCondition } from './warehouse-scope';
import { assertOwnDocument, WarehousesService } from './warehouses.service';
import { auditStockDocument } from './stock-document-audit';
import { StockTransferHooks } from './stock-transfer-hooks';
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
const balanceKey = (
  warehouseId: string,
  itemId: string,
  lotId: string | null,
) => `${warehouseId}:${itemId}:${lotId ?? ''}`;
// Exact compare of numeric(18,3) strings; doubles lose digits past 15.
const milli = (quantity: string) => {
  const [whole, fraction = ''] = quantity.split('.');
  return BigInt(whole + fraction.padEnd(3, '0'));
};
type ReceivedLine = NonNullable<ReceiveStockTransferDto['items']>[number];
type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  status?: typeof stockTransfers.$inferSelect.status;
};
@Injectable()
export class StockTransfersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
    @Optional()
    private readonly hooks: StockTransferHooks = new StockTransferHooks(),
  ) {}
  async list(f: Filters) {
    const { memberId: readMemberId, scope } =
      await this.warehousesService.documentReadScope(f.farmId, f.clerkUserId);
    const c: SQL[] = [eq(stockTransfers.farmId, f.farmId)];
    if (scope)
      c.push(
        or(
          scopeCondition(stockTransfers.fromWarehouseId, scope),
          scopeCondition(stockTransfers.toWarehouseId, scope),
        )!,
      );
    if (readMemberId)
      c.push(eq(stockTransfers.createdByMemberId, readMemberId));
    if (f.status) c.push(eq(stockTransfers.status, f.status));
    const w = and(...c);
    const [data, t] = await Promise.all([
      this.databaseService.db
        .select()
        .from(stockTransfers)
        .where(w)
        .orderBy(desc(stockTransfers.createdAt))
        .limit(f.pageSize)
        .offset(f.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(stockTransfers)
        .where(w),
    ]);
    const totalItems = Number(t[0]?.value ?? 0);
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
    const { memberId: readMemberId, scope } =
      await this.warehousesService.documentReadScope(farmId, user);
    const result = await this.withItems(id, farmId);
    if (
      (readMemberId && result.transfer.createdByMemberId !== readMemberId) ||
      !(
        inScope(scope, result.transfer.fromWarehouseId) ||
        inScope(scope, result.transfer.toWarehouseId)
      )
    )
      throw new NotFoundException('Stock transfer not found');
    return result;
  }
  async create(farmId: string, user: string, input: CreateStockTransferDto) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    assertInScope(writer.scope, input.fromWarehouseId, input.toWarehouseId);
    const member = writer.memberId;
    const numbering = numberingOptionChanges(input, writer);
    this.validateItems(input.items);
    if (input.fromWarehouseId === input.toWarehouseId)
      throw new BadRequestException(
        'Source and destination warehouses must differ',
      );
    const id = await this.databaseService.db.transaction(async (tx) => {
      await this.assertWarehouse(tx, farmId, input.fromWarehouseId);
      await this.assertWarehouse(tx, farmId, input.toWarehouseId);
      await this.validateLines(tx, farmId, input.items);
      ignoreLegacyCode('transferCode', input.transferCode);
      const [row] = await tx
        .insert(stockTransfers)
        .values({
          ...numbering,
          farmId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          transferDate: input.transferDate,
          note: input.note,
          createdByMemberId: member,
        })
        .returning();
      await tx.insert(stockTransferItems).values(
        input.items.map((x) => ({
          stockTransferId: row.id,
          itemId: x.itemId,
          lotId: x.lotId,
          assetId: x.assetId,
          quantity: x.quantity,
          note: x.note,
        })),
      );
      await auditStockDocument(
        tx,
        member,
        'STOCK_TRANSFER',
        'CREATE',
        null,
        row,
        {
          after: input.items,
        },
      );
      return row.id;
    });
    return this.withItems(id, farmId);
  }
  async update(
    id: string,
    farmId: string,
    user: string,
    input: UpdateStockTransferDto,
  ) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    const numbering = numberingOptionChanges(input, writer);
    await this.databaseService.db.transaction(async (tx) => {
      const cur = await this.only(id, farmId, tx, true);
      assertOwnDocument(
        writer,
        cur.createdByMemberId,
        cur.fromWarehouseId,
        cur.toWarehouseId,
      );
      if (cur.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT transfers can be edited');
      const from = input.fromWarehouseId ?? cur.fromWarehouseId;
      const to = input.toWarehouseId ?? cur.toWarehouseId;
      assertInScope(writer.scope, from, to);
      if (from === to)
        throw new BadRequestException(
          'Source and destination warehouses must differ',
        );
      await this.assertWarehouse(tx, farmId, from);
      await this.assertWarehouse(tx, farmId, to);
      const currentItems = await tx
        .select()
        .from(stockTransferItems)
        .where(eq(stockTransferItems.stockTransferId, id));
      const lines = input.items ?? currentItems;
      if (input.items) {
        this.validateItems(input.items);
        await tx
          .delete(stockTransferItems)
          .where(eq(stockTransferItems.stockTransferId, id));
        await tx.insert(stockTransferItems).values(
          input.items.map((x) => ({
            stockTransferId: id,
            itemId: x.itemId,
            lotId: x.lotId,
            assetId: x.assetId,
            quantity: x.quantity,
            note: x.note,
          })),
        );
      }
      await this.validateLines(tx, farmId, lines);
      const changes: Partial<typeof stockTransfers.$inferInsert> = {};
      for (const k of [
        'fromWarehouseId',
        'toWarehouseId',
        'transferDate',
        'note',
      ] as const)
        if (input[k] !== undefined) changes[k] = input[k] as never;
      changes.updatedAt = new Date().toISOString();
      Object.assign(changes, numbering);
      ignoreLegacyCode('transferCode', input.transferCode);
      await tx
        .update(stockTransfers)
        .set(changes)
        .where(eq(stockTransfers.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_TRANSFER',
        'UPDATE',
        cur,
        { ...cur, ...changes },
        input.items ? { before: currentItems, after: input.items } : {},
      );
    });
    return this.withItems(id, farmId);
  }
  async cancel(id: string, farmId: string, user: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertOwnDocument(
        writer,
        row.createdByMemberId,
        row.fromWarehouseId,
        row.toWarehouseId,
      );
      if (row.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT transfers can be cancelled');
      await tx
        .update(stockTransfers)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockTransfers.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_TRANSFER',
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
    await this.databaseService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertOwnDocument(
        writer,
        row.createdByMemberId,
        row.fromWarehouseId,
        row.toWarehouseId,
      );
      if (row.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT transfers can be submitted');
      const [line] = await tx
        .select({ id: stockTransferItems.id })
        .from(stockTransferItems)
        .where(eq(stockTransferItems.stockTransferId, id))
        .limit(1);
      if (!line)
        throw new BadRequestException(
          'Transfer must contain at least one item',
        );
      await tx
        .update(stockTransfers)
        .set({
          status: 'PENDING_APPROVAL',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockTransfers.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_TRANSFER',
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
        row.fromWarehouseId,
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
    const { memberId: member, scope } =
      await this.warehousesService.assertScopedAccess(
        farmId,
        user,
        true,
        WAREHOUSE_MANAGE_ROLES,
      );
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await this.databaseService.db.transaction(async (tx) => {
      await this.hooks.run('lock', tx, id);
      const row = await this.only(id, farmId, tx, true);
      assertInScope(scope, row.fromWarehouseId);
      if (row.status !== 'PENDING_APPROVAL')
        throw new ConflictException(
          'Only PENDING_APPROVAL transfers can be rejected',
        );
      const now = new Date().toISOString();
      await tx
        .update(stockTransfers)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedByMemberId: member,
          rejectedAt: now,
          updatedAt: now,
        })
        .where(eq(stockTransfers.id, id));
      await auditStockDocument(tx, member, 'STOCK_TRANSFER', 'REJECT', row, {
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
      await this.hooks.run('rejected', tx, id, member);
    });
    return this.withItems(id, farmId);
  }
  /** Source manager approves and dispatches: debits the source, nothing arrives yet. */
  async confirm(id: string, farmId: string, user: string) {
    const { memberId: member, scope } =
      await this.warehousesService.assertScopedAccess(
        farmId,
        user,
        true,
        WAREHOUSE_MANAGE_ROLES,
      );
    const confirmation = this.databaseService.db.transaction(async (tx) => {
      await this.hooks.run('lock', tx, id);
      const row = await this.only(id, farmId, tx, true);
      assertInScope(scope, row.fromWarehouseId);
      // A retried click: already dispatched, never debit twice.
      if (row.status === 'IN_TRANSIT' || row.status === 'CONFIRMED') return;
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(row.status))
        throw new ConflictException(
          'Only DRAFT or PENDING_APPROVAL transfers can be confirmed',
        );
      await this.assertWarehouse(tx, farmId, row.fromWarehouseId);
      await this.assertWarehouse(tx, farmId, row.toWarehouseId);
      const lines = await tx
        .select()
        .from(stockTransferItems)
        .where(eq(stockTransferItems.stockTransferId, id));
      if (!lines.length)
        throw new BadRequestException(
          'Transfer must contain at least one item',
        );
      await this.validateLines(tx, farmId, lines, true);
      const balances = await this.lockBalances(
        tx,
        farmId,
        row.fromWarehouseId,
        lines,
      );
      for (const line of lines) {
        const debited = await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${line.quantity}`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(
                inventoryBalances.id,
                balances.get(
                  balanceKey(row.fromWarehouseId, line.itemId, line.lotId),
                )!,
              ),
              gte(inventoryBalances.quantityOnHand, line.quantity),
            ),
          )
          .returning({ id: inventoryBalances.id });
        if (!debited.length)
          throw new ConflictException('Insufficient source inventory');
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: row.fromWarehouseId,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          transactionType: 'TRANSFER_OUT',
          quantityChange: `-${line.quantity}`,
          sourceType: 'STOCK_TRANSFER',
          sourceId: id,
          performedByMemberId: member,
        });
      }
      const dispatchedAt = new Date();
      const { code: transferCode, codeSource } = await confirmationCode(
        tx,
        farmId,
        'CK',
        { code: row.transferCode, requestedCode: row.requestedCode },
        dispatchedAt,
      );
      await tx
        .update(stockTransfers)
        .set({
          status: 'IN_TRANSIT',
          transferCode,
          codeSource,
          dispatchedByMemberId: member,
          dispatchedAt: dispatchedAt.toISOString(),
          updatedAt: dispatchedAt.toISOString(),
        })
        .where(eq(stockTransfers.id, id));
      const dispatched = {
        ...row,
        transferCode,
        codeSource: codeSource ?? row.codeSource,
        status: 'IN_TRANSIT' as const,
      };
      await auditStockDocument(
        tx,
        member,
        'STOCK_TRANSFER',
        'DISPATCH',
        row,
        dispatched,
      );
      // The destination's managers count the goods in; the creator hears on arrival.
      await notifyFarmApprovers(
        tx,
        this.notification(dispatched, 'IN_TRANSIT'),
        member,
        row.toWarehouseId,
      );
    });
    await confirmation.catch(rethrowCodeConflict);
    return this.withItems(id, farmId);
  }

  /**
   * Destination manager counts the goods in. Lines not listed arrived in full;
   * a short line needs a reason and only what arrived is credited.
   */
  async receive(
    id: string,
    farmId: string,
    user: string,
    received: ReceiveStockTransferDto['items'] = [],
  ) {
    const { memberId: member, scope } =
      await this.warehousesService.assertScopedAccess(
        farmId,
        user,
        true,
        WAREHOUSE_MANAGE_ROLES,
      );
    await this.databaseService.db.transaction(async (tx) => {
      await this.hooks.run('lock', tx, id);
      const row = await this.only(id, farmId, tx, true);
      assertInScope(scope, row.toWarehouseId);
      // A retried click: already received, never credit twice.
      if (row.status === 'CONFIRMED') return;
      if (row.status !== 'IN_TRANSIT')
        throw new ConflictException(
          'Only IN_TRANSIT transfers can be received',
        );
      await this.assertWarehouse(tx, farmId, row.toWarehouseId);
      const lines = await tx
        .select()
        .from(stockTransferItems)
        .where(eq(stockTransferItems.stockTransferId, id));
      const counted = new Map<string, ReceivedLine>();
      for (const entry of received) {
        if (counted.has(entry.id))
          throw new BadRequestException('Duplicate transfer line');
        counted.set(entry.id, entry);
      }
      for (const lineId of counted.keys())
        if (!lines.some((line) => line.id === lineId))
          throw new BadRequestException('Transfer line not found');
      const balances = await this.lockBalances(
        tx,
        farmId,
        row.toWarehouseId,
        lines,
      );
      for (const line of lines) {
        const entry = counted.get(line.id);
        const quantity = entry?.receivedQuantity ?? line.quantity;
        const reason = entry?.discrepancyReason?.trim() || null;
        const short = milli(quantity) < milli(line.quantity);
        if (milli(quantity) > milli(line.quantity))
          throw new BadRequestException(
            'Received quantity cannot exceed the dispatched quantity',
          );
        if (short && !reason)
          throw new BadRequestException(
            'A short line needs a discrepancy reason',
          );
        await tx
          .update(stockTransferItems)
          .set({
            receivedQuantity: quantity,
            discrepancyReason: short ? reason : null,
          })
          .where(eq(stockTransferItems.id, line.id));
        if (milli(quantity) === 0n) continue;
        await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${quantity}`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            eq(
              inventoryBalances.id,
              balances.get(
                balanceKey(row.toWarehouseId, line.itemId, line.lotId),
              )!,
            ),
          );
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: row.toWarehouseId,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          transactionType: 'TRANSFER_IN',
          quantityChange: quantity,
          sourceType: 'STOCK_TRANSFER',
          sourceId: id,
          performedByMemberId: member,
        });
      }
      const now = new Date().toISOString();
      await tx
        .update(stockTransfers)
        .set({
          status: 'CONFIRMED',
          confirmedByMemberId: member,
          confirmedAt: now,
          updatedAt: now,
        })
        .where(eq(stockTransfers.id, id));
      const confirmed = { ...row, status: 'CONFIRMED' as const };
      await auditStockDocument(
        tx,
        member,
        'STOCK_TRANSFER',
        'RECEIVE',
        row,
        confirmed,
        { after: received },
      );
      if (row.createdByMemberId !== member)
        await notifyDocumentCreator(
          tx,
          {
            ...this.notification(confirmed, 'CONFIRMED'),
            title: 'Kho đích đã nhận hàng',
          },
          row.createdByMemberId,
        );
      await this.hooks.run('confirmed', tx, id, member);
    });
    return this.withItems(id, farmId);
  }

  // Locks the warehouse's balances of these lines in id order, so concurrent
  // documents cannot deadlock. Missing rows are created at zero first, in key
  // order, so concurrent first-time destinations cannot race.
  private async lockBalances(
    tx: Pick<DatabaseService['db'], 'select' | 'insert'>,
    farmId: string,
    warehouseId: string,
    lines: { itemId: string; lotId: string | null }[],
  ) {
    const keys = new Map<
      string,
      { warehouseId: string; itemId: string; lotId: string | null }
    >();
    for (const line of lines)
      keys.set(balanceKey(warehouseId, line.itemId, line.lotId), {
        warehouseId,
        itemId: line.itemId,
        lotId: line.lotId,
      });
    const sorted = [...keys.keys()].sort().map((key) => keys.get(key)!);
    await tx
      .insert(inventoryBalances)
      .values(sorted.map((key) => ({ farmId, ...key })))
      .onConflictDoNothing({
        target: [
          inventoryBalances.itemId,
          inventoryBalances.lotId,
          inventoryBalances.warehouseId,
        ],
      });
    const locked = await tx
      .select({
        id: inventoryBalances.id,
        warehouseId: inventoryBalances.warehouseId,
        itemId: inventoryBalances.itemId,
        lotId: inventoryBalances.lotId,
      })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.farmId, farmId),
          or(
            ...sorted.map((key) =>
              and(
                eq(inventoryBalances.warehouseId, key.warehouseId),
                eq(inventoryBalances.itemId, key.itemId),
                key.lotId
                  ? eq(inventoryBalances.lotId, key.lotId)
                  : isNull(inventoryBalances.lotId),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(inventoryBalances.id))
      .for('update');
    return new Map(
      locked.map((balance) => [
        balanceKey(balance.warehouseId, balance.itemId, balance.lotId),
        balance.id,
      ]),
    );
  }
  private notification(
    row: typeof stockTransfers.$inferSelect,
    status: 'PENDING_APPROVAL' | 'IN_TRANSIT' | 'CONFIRMED' | 'REJECTED',
  ) {
    return {
      farmId: row.farmId,
      entityType: 'STOCK_TRANSFER',
      entityId: row.id,
      documentCode: row.transferCode,
      documentKind: 'Phiếu chuyển kho',
      status,
    };
  }
  private async only(
    id: string,
    farmId: string,
    db: Pick<DatabaseService['db'], 'select'> = this.databaseService.db,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.id, id), eq(stockTransfers.farmId, farmId)))
      .limit(1);
    const [row] = forUpdate ? await query.for('update') : await query;
    if (!row) throw new NotFoundException('Stock transfer not found');
    return row;
  }
  private async withItems(id: string, farmId: string) {
    const transfer = await this.only(id, farmId);
    const lines = await this.databaseService.db
      .select({
        ...getTableColumns(stockTransferItems),
        itemCode: items.code,
        itemName: items.name,
        trackingMode: items.trackingMode,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotCode: inventoryLots.lotCode,
        lotSupplierLotNumber: inventoryLots.supplierLotNumber,
        lotNumber: inventoryLots.lotCode, // deprecated alias of lotCode
        lotExpiryDate: inventoryLots.expiryDate,
      })
      .from(stockTransferItems)
      .leftJoin(
        items,
        and(eq(items.id, stockTransferItems.itemId), eq(items.farmId, farmId)),
      )
      .leftJoin(units, eq(units.id, items.unitId))
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryLots.id, stockTransferItems.lotId),
          eq(inventoryLots.farmId, farmId),
        ),
      )
      .where(eq(stockTransferItems.stockTransferId, id))
      .orderBy(asc(stockTransferItems.createdAt));
    return { transfer, items: lines };
  }
  private validateItems(lines: CreateStockTransferDto['items']) {
    if (!lines?.length)
      throw new BadRequestException('Transfer must contain at least one item');
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
  private async validateLines(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    lines: CreateStockTransferDto['items'],
    confirming = false,
  ) {
    for (const line of lines) {
      const [item] = await db
        .select({ id: items.id, trackingMode: items.trackingMode })
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)))
        .for('share')
        .limit(1);
      if (!item) throw new NotFoundException('Transfer item not found');
      if (line.assetId || item.trackingMode === 'ASSET') {
        const Exception = confirming ? ConflictException : BadRequestException;
        throw new Exception(
          'ASSET items must be moved using the asset transfer endpoint',
        );
      }
      const Invalid = confirming ? ConflictException : BadRequestException;
      if (item.trackingMode === 'LOT' && !line.lotId)
        throw new Invalid('LOT items require a lotId');
      if (item.trackingMode !== 'LOT' && line.lotId)
        throw new Invalid('Only LOT items accept a lotId');
      if (line.lotId) {
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
    }
  }
}

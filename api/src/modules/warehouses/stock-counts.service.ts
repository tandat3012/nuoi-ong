import {
  ForbiddenException,
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
  ilike,
  isNull,
  or,
  SQL,
  getTableColumns,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../../db/database.service';
import {
  assetIncidents,
  assets,
  auditLogs,
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  stockCountItems,
  stockCounts,
  units,
  warehouses,
} from '../../db/schema';
import {
  CreateStockCountDto,
  UpdateStockCountDto,
} from './dto/stock-count.dto';
import { assertInScope, inScope, scopeCondition } from './warehouse-scope';
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
import { activeMaintenanceCondition } from '../maintenance/maintenance-state';

type Filters = {
  farmId: string;
  clerkUserId: string;
  page: number;
  pageSize: number;
  offset: number;
  status?: typeof stockCounts.$inferSelect.status;
  search?: string;
};
type SnapshotLine = {
  itemId: string;
  lotId?: string | null;
  assetId?: string | null;
  systemQuantity: string;
  actualQuantity: string;
  note?: string | null;
  assetCondition?: 'GOOD' | 'DAMAGED' | null;
  foundLocationId?: string | null;
  assetVersion?: string | null;
};
type CountLine = typeof stockCountItems.$inferSelect;
type Tx = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
const foundLocations = alias(locations, 'count_found_locations');

/** P1-12: an asset line changes something (missing, damaged or found elsewhere), so it needs approval. */
const assetLineChanges = (line: CountLine) =>
  !!line.assetId &&
  (Number(line.actualQuantity) === 0 ||
    line.assetCondition === 'DAMAGED' ||
    !!line.foundLocationId);

export const SELF_APPROVAL = {
  code: 'SELF_APPROVAL',
  message:
    'A stock difference must be approved by someone other than its author',
};

@Injectable()
export class StockCountsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(f: Filters) {
    const { memberId: readMemberId, scope } =
      await this.warehousesService.documentReadScope(f.farmId, f.clerkUserId);
    const conditions: SQL[] = [eq(stockCounts.farmId, f.farmId)];
    const scoped = scopeCondition(stockCounts.warehouseId, scope);
    if (scoped) conditions.push(scoped);
    if (readMemberId)
      conditions.push(eq(stockCounts.createdByMemberId, readMemberId));
    if (f.status) conditions.push(eq(stockCounts.status, f.status));
    if (f.search) {
      const pattern = `%${f.search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(stockCounts.countCode, pattern),
          ilike(stockCounts.note, pattern),
        )!,
      );
    }
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
    const { memberId: readMemberId, scope } =
      await this.warehousesService.documentReadScope(farmId, user);
    const result = await this.withItems(id, farmId);
    if (
      (readMemberId && result.count.createdByMemberId !== readMemberId) ||
      !inScope(scope, result.count.warehouseId)
    )
      throw new NotFoundException('Stock count not found');
    return result;
  }

  async create(farmId: string, user: string, input: CreateStockCountDto) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      user,
    );
    assertInScope(writer.scope, input.warehouseId);
    const member = writer.memberId;
    const numbering = numberingOptionChanges(input, writer);
    this.validateItems(input.items);
    const id = await this.dbService.db.transaction(async (tx) => {
      await this.assertWarehouse(tx, farmId, input.warehouseId);
      const rows = await this.snapshot(
        tx,
        farmId,
        input.warehouseId,
        input.items,
      );
      ignoreLegacyCode('countCode', input.countCode);
      const [row] = await tx
        .insert(stockCounts)
        .values({
          ...numbering,
          farmId,
          warehouseId: input.warehouseId,
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
    const numbering = numberingOptionChanges(input, writer);
    await this.dbService.db.transaction(async (tx) => {
      const current = await this.only(id, farmId, tx, true);
      assertOwnDocument(writer, current.createdByMemberId, current.warehouseId);
      if (!['DRAFT', 'COUNTING'].includes(current.status))
        throw new ConflictException('Only active counts can be edited');
      let lines: { before?: object[]; after?: object[] } = {};
      if (input.items) {
        this.validateItems(input.items);
        const rows = await this.snapshot(
          tx,
          farmId,
          current.warehouseId,
          input.items,
        );
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
        ...numbering,
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
      assertOwnDocument(writer, row.createdByMemberId, row.warehouseId);
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
      assertOwnDocument(writer, row.createdByMemberId, row.warehouseId);
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
        row.warehouseId,
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
    await this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertInScope(scope, row.warehouseId);
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
    const { memberId: member, scope } =
      await this.warehousesService.assertScopedAccess(
        farmId,
        user,
        true,
        WAREHOUSE_MANAGE_ROLES,
      );
    const confirmation = this.dbService.db.transaction(async (tx) => {
      const row = await this.only(id, farmId, tx, true);
      assertInScope(scope, row.warehouseId);
      if (row.status === 'CONFIRMED') return;
      if (!['DRAFT', 'COUNTING', 'PENDING_APPROVAL'].includes(row.status))
        throw new ConflictException('Only active counts can be confirmed');
      // A count must not credit a warehouse deactivated while it was open.
      await this.assertWarehouse(tx, farmId, row.warehouseId);
      // Same lock order as stock issue confirmation, so the two cannot deadlock.
      const lines = await tx
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.stockCountId, id))
        .orderBy(
          asc(stockCountItems.itemId),
          asc(stockCountItems.lotId),
          asc(stockCountItems.assetId),
        );
      if (!lines.length)
        throw new BadRequestException('Count must contain at least one item');
      // NV03: a difference changes stock only once someone other than the counter approves it.
      if (
        row.createdByMemberId === member &&
        lines.some(
          (line) =>
            (line.difference && Number(line.difference) !== 0) ||
            assetLineChanges(line),
        )
      )
        throw new ForbiddenException(SELF_APPROVAL);
      for (const line of lines) {
        await this.assertLine(tx, farmId, line, true);
        if (line.assetId) {
          await this.confirmAssetLine(tx, row, line, member);
          continue;
        }
        // Row lock: a concurrent issue/receipt/transfer either commits first
        // (and the count turns stale) or waits until the count is written.
        const [balance] = await this.findBalance(
          tx,
          farmId,
          row.warehouseId,
          line.itemId,
          line.lotId,
          true,
        );
        // Both are numeric(18,3) strings; compare exactly, since Number() loses
        // the last digits of large quantities. A missing balance reads '0.000'.
        if ((balance?.quantityOnHand ?? '0.000') !== line.systemQuantity)
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
        else {
          // No row to lock: a receipt that created it meanwhile makes the count stale.
          const [inserted] = await tx
            .insert(inventoryBalances)
            .values({
              farmId,
              warehouseId: row.warehouseId,
              itemId: line.itemId,
              lotId: line.lotId,
              quantityOnHand: line.actualQuantity,
            })
            .onConflictDoNothing()
            .returning({ id: inventoryBalances.id });
          if (!inserted) throw new ConflictException('STOCK_COUNT_STALE');
        }
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
      const { code: countCode, codeSource } = await confirmationCode(
        tx,
        farmId,
        'KK',
        { code: row.countCode, requestedCode: row.requestedCode },
        confirmedAt,
      );
      await tx
        .update(stockCounts)
        .set({
          status: 'CONFIRMED',
          countCode,
          codeSource,
          confirmedByMemberId: member,
          confirmedAt: confirmedAt.toISOString(),
          updatedAt: confirmedAt.toISOString(),
        })
        .where(eq(stockCounts.id, id));
      const confirmed = {
        ...row,
        countCode,
        codeSource: codeSource ?? row.codeSource,
        status: 'CONFIRMED' as const,
      };
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
    await confirmation.catch((error: unknown) => {
      // Writers lock balances in different orders, so PostgreSQL may abort the
      // count as a deadlock victim; the competing move went through, so the
      // snapshot is stale either way.
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.cause?.code ?? failure.code) === '40P01')
        throw new ConflictException('STOCK_COUNT_STALE');
      rethrowCodeConflict(error);
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
        itemImageUrl: items.imageUrl,
        trackingMode: items.trackingMode,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotCode: inventoryLots.lotCode,
        lotSupplierLotNumber: inventoryLots.supplierLotNumber,
        lotNumber: inventoryLots.lotCode, // deprecated alias of lotCode
        lotExpiryDate: inventoryLots.expiryDate,
        assetCode: assets.assetCode,
        foundLocationCode: foundLocations.code,
        foundLocationName: foundLocations.name,
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
      .leftJoin(
        assets,
        and(eq(assets.id, stockCountItems.assetId), eq(assets.farmId, farmId)),
      )
      .leftJoin(
        foundLocations,
        eq(foundLocations.id, stockCountItems.foundLocationId),
      )
      .where(eq(stockCountItems.stockCountId, id))
      .orderBy(asc(stockCountItems.createdAt));
    return { count: row, items: lines };
  }
  /** System quantities at the time of counting; an asset line expects its asset in this warehouse. */
  private async snapshot(
    tx: Tx,
    farmId: string,
    warehouseId: string,
    lines: CreateStockCountDto['items'],
  ) {
    const assetIds = lines.flatMap((line) => line.assetId ?? []);
    if (new Set(assetIds).size !== assetIds.length)
      throw new BadRequestException('Each asset can be counted only once');
    const rows: SnapshotLine[] = [];
    for (const line of lines) {
      await this.assertLine(tx, farmId, line);
      if (line.assetId) {
        rows.push(await this.assetSnapshot(tx, farmId, warehouseId, line));
        continue;
      }
      if (line.assetCondition || line.foundLocationId)
        throw new BadRequestException(
          'Only ASSET lines take a condition or a found location',
        );
      const [balance] = await this.findBalance(
        tx,
        farmId,
        warehouseId,
        line.itemId,
        line.lotId,
      );
      rows.push({
        itemId: line.itemId,
        lotId: line.lotId,
        systemQuantity: balance?.quantityOnHand ?? '0',
        actualQuantity: line.actualQuantity,
        note: line.note,
      });
    }
    return rows;
  }

  private async assetSnapshot(
    tx: Tx,
    farmId: string,
    warehouseId: string,
    line: CreateStockCountDto['items'][number],
  ): Promise<SnapshotLine> {
    const asset = await this.countedAsset(
      tx,
      farmId,
      warehouseId,
      line,
      BadRequestException,
    );
    const found = Number(line.actualQuantity);
    if (found !== 0 && found !== 1)
      throw new BadRequestException(
        'An asset line counts 1 (found) or 0 (missing)',
      );
    if (!found && (line.assetCondition || line.foundLocationId))
      throw new BadRequestException(
        'A missing asset has no condition or found location',
      );
    // Explicit, so a client that drops the field fails instead of resetting a damage note to GOOD.
    if (found && !line.assetCondition)
      throw new BadRequestException('A found asset needs its assetCondition');
    // As with a loss report: a damaged asset that is gone is retired, never recovered as usable.
    if (!found && asset.status === 'DAMAGED')
      throw new BadRequestException(
        'A missing damaged asset is retired, not counted as lost',
      );
    if (line.foundLocationId)
      await this.countLocation(tx, farmId, warehouseId, line.foundLocationId);
    return {
      itemId: line.itemId,
      assetId: line.assetId,
      systemQuantity: '1',
      actualQuantity: String(found),
      note: line.note,
      assetCondition: found ? line.assetCondition : null,
      foundLocationId: line.foundLocationId ?? null,
      assetVersion: asset.updatedAt,
    };
  }

  /** The asset must sit in this warehouse's stock (AVAILABLE or DAMAGED); never one handed out, away or of another farm. */
  private async countedAsset(
    tx: Tx,
    farmId: string,
    warehouseId: string,
    line: { itemId: string; assetId?: string | null },
    Invalid: typeof BadRequestException | typeof ConflictException,
    forUpdate = false,
  ) {
    const query = tx
      .select({
        id: assets.id,
        assetCode: assets.assetCode,
        status: assets.status,
        currentLocationId: assets.currentLocationId,
        updatedAt: assets.updatedAt,
        warehouseId: locations.warehouseId,
      })
      .from(assets)
      .leftJoin(locations, eq(locations.id, assets.currentLocationId))
      .where(
        and(
          eq(assets.id, line.assetId!),
          eq(assets.farmId, farmId),
          eq(assets.itemId, line.itemId),
        ),
      )
      .limit(1);
    const [asset] = forUpdate
      ? await query.for('update', { of: assets })
      : await query;
    if (!asset) throw new NotFoundException('Counted asset not found');
    if (
      !['AVAILABLE', 'DAMAGED'].includes(asset.status) ||
      asset.warehouseId !== warehouseId
    )
      throw new Invalid(
        forUpdate
          ? 'STOCK_COUNT_STALE'
          : "Asset is not in this warehouse's stock",
      );
    return asset;
  }

  private async countLocation(
    tx: Tx,
    farmId: string,
    warehouseId: string,
    locationId: string,
  ) {
    const [location] = await tx
      .select({ id: locations.id, code: locations.code })
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
      throw new ConflictException(
        'Found location must be ACTIVE in the counted warehouse',
      );
    return location;
  }

  /**
   * P1-12: settles one counted asset through its lifecycle. Missing: out of stock
   * and LOST with a loss incident (recoverable later). Damaged: DAMAGED in place.
   * Found elsewhere in the warehouse: moved to where it was found.
   */
  private async confirmAssetLine(
    tx: Tx,
    count: typeof stockCounts.$inferSelect,
    line: CountLine,
    member: string,
  ) {
    const farmId = count.farmId;
    // Balance before asset, as every asset movement locks them.
    const [balance] = await this.findBalance(
      tx,
      farmId,
      count.warehouseId,
      line.itemId,
      null,
      true,
    );
    const asset = await this.countedAsset(
      tx,
      farmId,
      count.warehouseId,
      line,
      ConflictException,
      true,
    );
    // Moved, handed out and back, damaged or repaired since it was counted: count again.
    if (asset.updatedAt !== line.assetVersion)
      throw new ConflictException('STOCK_COUNT_STALE');
    const now = new Date().toISOString();
    const userId = sql`(SELECT user_id FROM farm_members WHERE id = ${member})`;
    const reason = `Kiểm kê ${count.countCode ?? count.id.slice(0, 8)}`;
    if (Number(line.actualQuantity) === 0) {
      if (!balance || Number(balance.quantityOnHand) < 1)
        throw new ConflictException('STOCK_COUNT_STALE');
      // Recovery refuses an asset with open maintenance, so settle that first.
      const [maintenance] = await tx
        .select({ id: maintenanceRecords.id })
        .from(maintenanceRecords)
        .where(
          and(
            eq(maintenanceRecords.farmId, farmId),
            eq(maintenanceRecords.assetId, asset.id),
            activeMaintenanceCondition,
          ),
        )
        .limit(1);
      if (maintenance)
        throw new ConflictException(
          'Asset has active maintenance; finish or cancel it before recording it missing',
        );
      await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} - 1`,
          updatedAt: now,
        })
        .where(eq(inventoryBalances.id, balance.id));
      await tx.insert(inventoryTransactions).values({
        farmId,
        warehouseId: count.warehouseId,
        itemId: line.itemId,
        assetId: asset.id,
        transactionType: 'ADJUSTMENT_OUT',
        quantityChange: '-1',
        sourceType: 'STOCK_COUNT',
        sourceId: count.id,
        performedByMemberId: member,
        reason: line.note ?? reason,
      });
      const [incident] = await tx
        .insert(assetIncidents)
        .values({
          farmId,
          assetId: asset.id,
          reportedByMemberId: member,
          incidentType: 'LOSS',
          description: `${reason}: không tìm thấy${line.note ? ` — ${line.note}` : ''}`,
          severity: 'MEDIUM',
        })
        .returning({ id: assetIncidents.id });
      await tx
        .update(assets)
        .set({ status: 'LOST', updatedAt: now })
        .where(eq(assets.id, asset.id));
      await tx.insert(auditLogs).values({
        farmId,
        userId,
        action: 'ASSET_COUNTED',
        entityType: 'ASSET',
        entityId: asset.id,
        oldData: { status: asset.status },
        newData: {
          status: 'LOST',
          referenceId: incident.id,
          stockCountId: count.id,
          summary: `${reason}: thiếu, chuyển Thất lạc`,
        },
      });
      return;
    }
    const status = line.assetCondition === 'DAMAGED' ? 'DAMAGED' : asset.status;
    let locationId = asset.currentLocationId;
    if (line.foundLocationId && line.foundLocationId !== locationId)
      locationId = (
        await this.countLocation(
          tx,
          farmId,
          count.warehouseId,
          line.foundLocationId,
        )
      ).id;
    if (status === asset.status && locationId === asset.currentLocationId)
      return;
    await tx
      .update(assets)
      .set({ status, currentLocationId: locationId, updatedAt: now })
      .where(eq(assets.id, asset.id));
    await tx.insert(auditLogs).values({
      farmId,
      userId,
      action: 'ASSET_COUNTED',
      entityType: 'ASSET',
      entityId: asset.id,
      oldData: { status: asset.status, locationId: asset.currentLocationId },
      newData: {
        status,
        locationId,
        stockCountId: count.id,
        summary: `${reason}: ${
          status === 'DAMAGED' && asset.status !== 'DAMAGED' ? 'hỏng' : 'có'
        }${locationId !== asset.currentLocationId ? ', đúng vị trí thực tế' : ''}`,
      },
    });
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
      )
      // Shares the row lock deactivation takes, so it waits for this move (NV08).
      .for('share');
    if (!row) throw new ConflictException('Warehouse must exist and be ACTIVE');
  }
  /** Quantity/LOT lines adjust balances; ASSET lines are counted one asset each (P1-12). */
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
    if (item.trackingMode === 'ASSET') {
      if (!line.assetId)
        throw new Invalid('ASSET items are counted one asset per line');
      return;
    }
    if (line.assetId) throw new Invalid('Only ASSET items accept an assetId');
    if (item.trackingMode === 'LOT' && !line.lotId)
      throw new Invalid('LOT items require a lotId');
    if (item.trackingMode !== 'LOT' && line.lotId)
      throw new Invalid('Only LOT items accept a lotId');
    if (!line.lotId) return;
    const query = db
      .select({ id: inventoryLots.id })
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLots.id, line.lotId),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, line.itemId),
        ),
      );
    // Lot before balance, as receipts into an existing lot do; the count's
    // ledger row needs this key-share lock on the lot anyway.
    const [lot] = confirming ? await query.for('key share') : await query;
    if (!lot) throw new NotFoundException('LOT not found');
  }
  private findBalance(
    db: Pick<DatabaseService['db'], 'select'>,
    farmId: string,
    warehouseId: string,
    itemId: string,
    lotId?: string | null,
    forUpdate = false,
  ) {
    const query = db
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
    return forUpdate ? query.for('update') : query;
  }
}

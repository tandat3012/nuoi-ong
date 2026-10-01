import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gte, isNull, sql, SQL } from 'drizzle-orm';
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
  stockIssueItems,
  stockIssues,
  warehouses,
} from '../../db/schema';
import { CreateStockIssueDto } from './dto/create-stock-issue.dto';
import { UpdateStockIssueDto } from './dto/update-stock-issue.dto';
import { WarehousesService } from './warehouses.service';

type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
};
type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class StockIssuesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: Filters) {
    await this.warehousesService.assertFarmAccess(
      filters.farmId,
      filters.clerkUserId,
      false,
    );
    const conditions: SQL[] = [eq(stockIssues.farmId, filters.farmId)];
    if (filters.status) conditions.push(eq(stockIssues.status, filters.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select()
        .from(stockIssues)
        .where(where)
        .orderBy(desc(stockIssues.createdAt))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(stockIssues)
        .where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
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

  async get(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, false);
    return this.withItems(id, farmId);
  }

  async create(farmId: string, clerkUserId: string, input: CreateStockIssueDto) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    this.validateItems(input.items);
    const issueType = input.issueType ?? 'CONSUMPTION';
    await this.validateMaintenance(farmId, issueType, input.maintenanceRecordId);
    const id = await this.databaseService.db.transaction(async (tx) => {
      await this.assertWarehouse(tx, farmId, input.warehouseId);
      await this.validateLines(tx, farmId, input.items);
      const [issue] = await tx
        .insert(stockIssues)
        .values({
          farmId,
          warehouseId: input.warehouseId,
          issueCode: input.issueCode,
          issueDate: input.issueDate,
          issueType,
          maintenanceRecordId: input.maintenanceRecordId,
          reason: input.reason,
          note: input.note,
          createdByMemberId: memberId,
        })
        .returning({ id: stockIssues.id });
      await tx.insert(stockIssueItems).values(
        input.items.map((line) => ({
          stockIssueId: issue.id,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          quantity: line.quantity,
          note: line.note,
        })),
      );
      return issue.id;
    });
    return this.withItems(id, farmId);
  }

  async update(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateStockIssueDto,
  ) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await this.databaseService.db.transaction(async (tx) => {
      const current = await this.getOnly(id, farmId, tx, true);
      if (current.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT issues can be edited');
      const issueType = input.issueType ?? current.issueType;
      await this.validateMaintenance(
        farmId,
        issueType,
        input.maintenanceRecordId === undefined
          ? current.maintenanceRecordId
          : input.maintenanceRecordId,
        tx,
      );
      if (input.items) {
        this.validateItems(input.items);
        await this.validateLines(tx, farmId, input.items);
        await tx.delete(stockIssueItems).where(eq(stockIssueItems.stockIssueId, id));
        await tx.insert(stockIssueItems).values(
          input.items.map((line) => ({
            stockIssueId: id,
            itemId: line.itemId,
            lotId: line.lotId,
            assetId: line.assetId,
            quantity: line.quantity,
            note: line.note,
          })),
        );
      }
      if (input.warehouseId)
        await this.assertWarehouse(tx, farmId, input.warehouseId);
      const changes: Partial<typeof stockIssues.$inferInsert> = {};
      for (const key of [
        'warehouseId',
        'issueCode',
        'issueDate',
        'issueType',
        'maintenanceRecordId',
        'reason',
        'note',
      ] as const)
        if (input[key] !== undefined) changes[key] = input[key] as never;
      changes.updatedAt = new Date().toISOString();
      if (Object.keys(changes).length)
        await tx.update(stockIssues).set(changes).where(eq(stockIssues.id, id));
    });
    return this.withItems(id, farmId);
  }

  async cancel(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    await this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      if (issue.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT issues can be cancelled');
      await tx
        .update(stockIssues)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockIssues.id, id));
    });
    return this.withItems(id, farmId);
  }

  async confirm(id: string, farmId: string, clerkUserId: string) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      if (issue.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT issues can be confirmed');
      await this.assertWarehouse(tx, farmId, issue.warehouseId);
      const lines = await tx
        .select()
        .from(stockIssueItems)
        .where(eq(stockIssueItems.stockIssueId, id))
        .orderBy(
          asc(stockIssueItems.itemId),
          asc(stockIssueItems.lotId),
          asc(stockIssueItems.assetId),
        );
      if (!lines.length)
        throw new BadRequestException('Issue must contain at least one item');
      for (const line of lines) {
        const [item] = await tx
          .select({ trackingMode: items.trackingMode })
          .from(items)
          .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
        if (!item) throw new NotFoundException('Issue item not found');
        this.validateTracking(item.trackingMode, line);
        if (line.lotId) {
          const [lot] = await tx
            .select({ expiryDate: inventoryLots.expiryDate })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLots.id, line.lotId),
                eq(inventoryLots.farmId, farmId),
                eq(inventoryLots.itemId, line.itemId),
              ),
            )
            .limit(1);
          if (
            !lot ||
            (lot.expiryDate &&
              lot.expiryDate < new Date().toISOString().slice(0, 10))
          )
            throw new ConflictException('LOT is missing or expired');
        }
        // Lock the shared balance before individual assets, including for multi-asset issues.
        const [balance] = await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${line.quantity}`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(inventoryBalances.farmId, farmId),
              eq(inventoryBalances.warehouseId, issue.warehouseId),
              eq(inventoryBalances.itemId, line.itemId),
              line.lotId
                ? eq(inventoryBalances.lotId, line.lotId)
                : isNull(inventoryBalances.lotId),
              gte(inventoryBalances.quantityOnHand, line.quantity),
            ),
          )
          .returning({ id: inventoryBalances.id });
        if (!balance) throw new ConflictException('Insufficient inventory');
        if (line.assetId) {
          const [asset] = await tx
            .select()
            .from(assets)
            .where(
              and(
                eq(assets.id, line.assetId),
                eq(assets.farmId, farmId),
                eq(assets.itemId, line.itemId),
              ),
            )
            .for('update');
          if (!asset || asset.status !== 'AVAILABLE')
            throw new ConflictException('ASSET is missing or unavailable');
          const [location] = asset.currentLocationId
            ? await tx
                .select({ id: locations.id })
                .from(locations)
                .where(
                  and(
                    eq(locations.id, asset.currentLocationId),
                    eq(locations.farmId, farmId),
                    eq(locations.warehouseId, issue.warehouseId),
                  ),
                )
                .for('share')
            : [];
          if (!location)
            throw new ConflictException(
              'ASSET must be located in the source warehouse',
            );
          await tx
            .update(assets)
            .set({
              status:
                issue.issueType === 'DISPOSAL'
                  ? 'RETIRED'
                  : issue.issueType === 'DAMAGE'
                    ? 'MAINTENANCE'
                    : 'IN_USE',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(assets.id, line.assetId));
        }
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: issue.warehouseId,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          transactionType:
            issue.issueType === 'MAINTENANCE' ? 'MAINTENANCE_ISSUE' : 'ISSUE',
          quantityChange: `-${line.quantity}`,
          sourceType: 'STOCK_ISSUE',
          sourceId: id,
          performedByMemberId: memberId,
        });
      }
      await tx
        .update(stockIssues)
        .set({
          status: 'CONFIRMED',
          confirmedByMemberId: memberId,
          confirmedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockIssues.id, id));
    });
    return this.withItems(id, farmId);
  }

  private async getOnly(
    id: string,
    farmId: string,
    db: Db | Transaction = this.databaseService.db,
    forUpdate = false,
  ) {
    const query = db
      .select()
      .from(stockIssues)
      .where(and(eq(stockIssues.id, id), eq(stockIssues.farmId, farmId)))
      .limit(1);
    const [issue] = forUpdate ? await query.for('update') : await query;
    if (!issue) throw new NotFoundException('Stock issue not found');
    return issue;
  }

  private async withItems(id: string, farmId: string) {
    const issue = await this.getOnly(id, farmId);
    const items = await this.databaseService.db
      .select()
      .from(stockIssueItems)
      .where(eq(stockIssueItems.stockIssueId, id))
      .orderBy(asc(stockIssueItems.createdAt));
    return { issue, items };
  }

  private validateItems(lines: CreateStockIssueDto['items']) {
    if (!lines?.length)
      throw new BadRequestException('Issue must contain at least one item');
  }

  private async assertWarehouse(
    db: Db | Transaction,
    farmId: string,
    warehouseId: string,
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

  private async validateMaintenance(
    farmId: string,
    issueType: string,
    maintenanceRecordId?: string | null,
    db: Db | Transaction = this.databaseService.db,
  ) {
    if (issueType === 'MAINTENANCE' && !maintenanceRecordId)
      throw new BadRequestException(
        'MAINTENANCE issues require maintenanceRecordId',
      );
    if (issueType !== 'MAINTENANCE' && maintenanceRecordId)
      throw new BadRequestException(
        'maintenanceRecordId is only valid for MAINTENANCE issues',
      );
    if (maintenanceRecordId) {
      const [record] = await db
        .select({ id: maintenanceRecords.id })
        .from(maintenanceRecords)
        .where(
          and(
            eq(maintenanceRecords.id, maintenanceRecordId),
            eq(maintenanceRecords.farmId, farmId),
          ),
        );
      if (!record) throw new NotFoundException('Maintenance record not found');
    }
  }

  private validateTracking(
    mode: typeof items.$inferSelect.trackingMode,
    line: CreateStockIssueDto['items'][number],
  ) {
    if (!(Number(line.quantity) > 0))
      throw new BadRequestException('quantity must be greater than zero');
    if (mode === 'QUANTITY' && (line.lotId || line.assetId))
      throw new BadRequestException(
        'QUANTITY issue lines cannot contain lotId or assetId',
      );
    if (mode === 'LOT' && (!line.lotId || line.assetId))
      throw new BadRequestException(
        'LOT issue lines require lotId and cannot contain assetId',
      );
    if (
      mode === 'ASSET' &&
      (!line.assetId || line.lotId || Number(line.quantity) !== 1)
    )
      throw new BadRequestException(
        'ASSET issue lines require assetId, quantity 1, and cannot contain lotId',
      );
  }

  private async validateLines(
    db: Db | Transaction,
    farmId: string,
    lines: CreateStockIssueDto['items'],
  ) {
    for (const line of lines) {
      const [item] = await db
        .select({ trackingMode: items.trackingMode })
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Issue item not found');
      this.validateTracking(item.trackingMode, line);
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
          )
          .limit(1);
        if (!lot) throw new NotFoundException('LOT not found');
      }
      if (line.assetId) {
        const [asset] = await db
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              eq(assets.id, line.assetId),
              eq(assets.farmId, farmId),
              eq(assets.itemId, line.itemId),
            ),
          );
        if (!asset) throw new NotFoundException('ASSET not found');
      }
    }
  }
}

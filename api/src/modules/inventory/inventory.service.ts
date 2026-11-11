import { Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  isNotNull,
  ne,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { qrSvg, scanUrl } from '../../common/qr';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  categories,
  farmMembers,
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  inventoryTransactionType,
  items,
  locations,
  stockCounts,
  stockIssues,
  stockReceiptItems,
  stockReceipts,
  stockTransfers,
  suppliers,
  trackingMode,
  units,
  users,
  warehouses,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import { inScope, scopeCondition, type WarehouseScope } from '../warehouses/warehouse-scope';

const transactionAssetTable = sql`${assets} AS transaction_asset`;
const assetReturnSourceTable = sql`${assets} AS asset_return_source`;

type TrackingMode = (typeof trackingMode.enumValues)[number];

type Filters = {
  clerkUserId: string;
  farmId: string;
  warehouseId?: string;
  itemId?: string;
  lotId?: string;
  assetId?: string;
  search?: string;
  categoryId?: string;
  trackingMode?: TrackingMode;
  excludeTrackingMode?: TrackingMode;
  itemIds?: string[];
};

type ItemSummaryFilters = {
  clerkUserId: string;
  farmId: string;
  warehouseId?: string;
  search?: string;
  categoryId?: string;
  trackingMode?: TrackingMode;
  excludeTrackingMode?: TrackingMode;
  lowStockOnly?: boolean;
};

type ForecastFilters = {
  clerkUserId: string;
  farmId: string;
  warehouseId: string;
};

type TransactionFilters = Filters & {
  transactionType?: (typeof inventoryTransactionType.enumValues)[number];
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private scopeSql(column: string, scope: WarehouseScope) {
    if (scope === null) return sql``;
    if (scope.length === 0) return sql`AND FALSE`;
    return sql`AND ${sql.raw(column)} IN ${scope}`;
  }

  async listBalances(filters: Filters & PaginationParams) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );
    const [selectedAsset] = filters.assetId
      ? await this.databaseService.db
          .select({
            id: assets.id,
            assetCode: assets.assetCode,
            serialNumber: assets.serialNumber,
            status: assets.status,
            locationName: locations.name,
          })
          .from(assets)
          .leftJoin(
            locations,
            and(
              eq(locations.id, assets.currentLocationId),
              eq(locations.farmId, assets.farmId),
            ),
          )
          .where(
            and(
              eq(assets.id, filters.assetId),
              eq(assets.farmId, filters.farmId),
            ),
          )
          .limit(1)
      : [];
    if (filters.assetId && !selectedAsset)
      throw new NotFoundException('Asset not found in this farm');
    const lotIdColumn = sql<string | null>`${inventoryLots}."id"`;
    const lotFarmIdColumn = sql<string | null>`${inventoryLots}."farm_id"`;
    const lotItemIdColumn = sql<string | null>`${inventoryLots}."item_id"`;
    const lotCodeColumn = sql<string | null>`${inventoryLots}."lot_code"`;
    const lotSupplierNumberColumn = sql<
      string | null
    >`${inventoryLots}."supplier_lot_number"`;
    const lotLegacyNumberColumn = sql<
      string | null
    >`${inventoryLots}."legacy_lot_number"`;
    const lotExpiryDateColumn = sql<
      string | null
    >`${inventoryLots}."expiry_date"`;
    const predicates: SQL[] = [
      eq(inventoryBalances.farmId, filters.farmId),
      eq(items.farmId, filters.farmId),
      eq(warehouses.farmId, filters.farmId),
      gt(inventoryBalances.quantityOnHand, '0'),
    ];
    const scoped = scopeCondition(inventoryBalances.warehouseId, scope);
    if (scoped) predicates.push(scoped);
    if (filters.warehouseId)
      predicates.push(eq(inventoryBalances.warehouseId, filters.warehouseId));
    if (filters.itemId)
      predicates.push(eq(inventoryBalances.itemId, filters.itemId));
    if (filters.itemIds?.length)
      predicates.push(inArray(inventoryBalances.itemId, filters.itemIds));
    if (filters.lotId)
      predicates.push(eq(inventoryBalances.lotId, filters.lotId));
    if (filters.categoryId)
      predicates.push(eq(items.categoryId, filters.categoryId));
    if (filters.trackingMode)
      predicates.push(eq(items.trackingMode, filters.trackingMode));
    if (filters.excludeTrackingMode)
      predicates.push(ne(items.trackingMode, filters.excludeTrackingMode));
    if (filters.search) {
      const pattern = `%${this.escapeLike(filters.search)}%`;
      predicates.push(
        or(
          ilike(items.code, pattern),
          ilike(items.name, pattern),
          ilike(items.barcode, pattern),
          ilike(lotCodeColumn, pattern),
          ilike(lotSupplierNumberColumn, pattern),
        )!,
      );
    }
    if (filters.assetId) {
      predicates.push(
        eq(items.trackingMode, 'ASSET'),
        isNull(inventoryBalances.lotId),
      );
      predicates.push(sql`EXISTS (
        SELECT 1 FROM assets a JOIN locations l ON l.id=a.current_location_id AND l.farm_id=a.farm_id
        WHERE a.id=${filters.assetId} AND a.farm_id=${filters.farmId}
          AND a.item_id=${inventoryBalances.itemId} AND l.warehouse_id=${inventoryBalances.warehouseId}
          AND (a.status IN ('AVAILABLE','TRANSFER_PENDING','DAMAGED') OR (a.status='MAINTENANCE' AND EXISTS (
            SELECT 1 FROM maintenance_records m WHERE m.asset_id=a.id AND m.status IN ('FAILED','COMPLETED') AND m.return_status='CONFIRMED'
          )))
      )`);
    }
    const validLot = or(
      isNull(inventoryBalances.lotId),
      and(
        isNotNull(lotIdColumn),
        eq(lotFarmIdColumn, filters.farmId),
        eq(lotItemIdColumn, inventoryBalances.itemId),
      ),
    )!;
    predicates.push(validLot);
    const where = and(...predicates);
    const localToday = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const [rows, totals, summaryRows] = await Promise.all([
      this.databaseService.db
        .select({
          id: inventoryBalances.id,
          farmId: inventoryBalances.farmId,
          quantityOnHand: inventoryBalances.quantityOnHand,
          updatedAt: inventoryBalances.updatedAt,
          itemId: items.id,
          itemCode: items.code,
          itemName: items.name,
          itemType: items.itemType,
          trackingMode: items.trackingMode,
          itemImageUrl: items.imageUrl,
          itemMinStockLevel: items.minStockLevel,
          categoryName: categories.name,
          unitId: units.id,
          unitName: units.name,
          unitSymbol: units.symbol,
          warehouseId: warehouses.id,
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
          lotId: lotIdColumn,
          lotCode: lotCodeColumn,
          supplierLotNumber: lotSupplierNumberColumn,
          legacyLotNumber: lotLegacyNumberColumn,
          expiryDate: lotExpiryDateColumn,
        })
        .from(inventoryBalances)
        .innerJoin(items, eq(inventoryBalances.itemId, items.id))
        .leftJoin(categories, eq(items.categoryId, categories.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .innerJoin(warehouses, eq(inventoryBalances.warehouseId, warehouses.id))
        .leftJoin(inventoryLots, eq(inventoryBalances.lotId, lotIdColumn))
        .where(where)
        .orderBy(
          asc(warehouses.code),
          asc(items.code),
          sql`${lotExpiryDateColumn} ASC NULLS LAST`,
          asc(lotCodeColumn),
          asc(inventoryBalances.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(inventoryBalances)
        .innerJoin(items, eq(inventoryBalances.itemId, items.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .innerJoin(warehouses, eq(inventoryBalances.warehouseId, warehouses.id))
        .leftJoin(inventoryLots, eq(inventoryBalances.lotId, lotIdColumn))
        .where(where),
      this.databaseService.db
        .select({
          lotBalanceRows: sql<number>`COUNT(*) FILTER (WHERE ${items.trackingMode} = 'LOT')::int`,
          assetBalanceRows: sql<number>`COUNT(*) FILTER (WHERE ${items.trackingMode} = 'ASSET')::int`,
          lotRowsWithoutLot: sql<number>`COUNT(*) FILTER (WHERE ${items.trackingMode} = 'LOT' AND ${inventoryBalances.lotId} IS NULL)::int`,
          lotsWithoutExpiry: sql<number>`COUNT(DISTINCT ${inventoryBalances.lotId}) FILTER (WHERE ${items.trackingMode} = 'LOT' AND ${inventoryBalances.lotId} IS NOT NULL AND ${lotExpiryDateColumn} IS NULL)::int`,
          expiredLots: sql<number>`COUNT(DISTINCT ${inventoryBalances.lotId}) FILTER (WHERE ${items.trackingMode} = 'LOT' AND ${lotExpiryDateColumn} < ${localToday})::int`,
          expiringLots: sql<number>`COUNT(DISTINCT ${inventoryBalances.lotId}) FILTER (WHERE ${items.trackingMode} = 'LOT' AND ${lotExpiryDateColumn} >= ${localToday} AND ${lotExpiryDateColumn} <= (${localToday} + 30))::int`,
          healthyLots: sql<number>`COUNT(DISTINCT ${inventoryBalances.lotId}) FILTER (WHERE ${items.trackingMode} = 'LOT' AND ${lotExpiryDateColumn} > (${localToday} + 30))::int`,
        })
        .from(inventoryBalances)
        .innerJoin(items, eq(inventoryBalances.itemId, items.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .innerJoin(warehouses, eq(inventoryBalances.warehouseId, warehouses.id))
        .leftJoin(inventoryLots, eq(inventoryBalances.lotId, lotIdColumn))
        .where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    const summary = summaryRows[0] ?? {
      lotBalanceRows: 0,
      assetBalanceRows: 0,
      lotRowsWithoutLot: 0,
      lotsWithoutExpiry: 0,
      expiredLots: 0,
      expiringLots: 0,
      healthyLots: 0,
    };
    return {
      ...(selectedAsset ? { selectedAsset } : {}),
      data: rows.map((row) => ({
        id: row.id,
        quantityOnHand: filters.assetId ? '1.000' : row.quantityOnHand,
        // Keep the Mobile response fields while exposing the richer Web/API shape.
        balance: {
          id: row.id,
          farmId: row.farmId,
          warehouseId: row.warehouseId,
          itemId: row.itemId,
          lotId: row.lotId,
          quantityOnHand: filters.assetId ? '1.000' : row.quantityOnHand,
          updatedAt: row.updatedAt,
        },
        itemCode: row.itemCode,
        itemName: row.itemName,
        itemType: row.itemType,
        trackingMode: row.trackingMode,
        itemImageUrl: row.itemImageUrl,
        minStockLevel: row.itemMinStockLevel,
        categoryName: row.categoryName,
        item: {
          id: row.itemId,
          code: row.itemCode,
          name: row.itemName,
          trackingMode: row.trackingMode,
          imageUrl: row.itemImageUrl,
          minStockLevel: row.itemMinStockLevel,
          categoryName: row.categoryName,
          unit: { id: row.unitId, name: row.unitName, symbol: row.unitSymbol },
        },
        warehouse: {
          id: row.warehouseId,
          code: row.warehouseCode,
          name: row.warehouseName,
        },
        lot: row.lotId
          ? {
              id: row.lotId,
              lotCode: row.lotCode!,
              supplierLotNumber: row.supplierLotNumber,
              legacyLotNumber: row.legacyLotNumber,
              lotNumber: row.lotCode!, // deprecated alias of lotCode
              expiryDate: row.expiryDate,
            }
          : null,
        updatedAt: row.updatedAt,
      })),
      summary,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async getBalanceQr(id: string, farmId: string, clerkUserId: string) {
    const scope = await this.warehousesService.warehouseScope(
      farmId,
      clerkUserId,
    );
    const [row] = await this.databaseService.db
      .select({
        balance: inventoryBalances,
        itemCode: items.code,
        itemName: items.name,
        itemImageUrl: items.imageUrl,
        itemType: items.itemType,
        trackingMode: items.trackingMode,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        lotCode: inventoryLots.lotCode,
        supplierLotNumber: inventoryLots.supplierLotNumber,
        legacyLotNumber: inventoryLots.legacyLotNumber,
      })
      .from(inventoryBalances)
      .innerJoin(
        items,
        and(eq(inventoryBalances.itemId, items.id), eq(items.farmId, farmId)),
      )
      .innerJoin(
        warehouses,
        and(
          eq(inventoryBalances.warehouseId, warehouses.id),
          eq(warehouses.farmId, farmId),
        ),
      )
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryBalances.lotId, inventoryLots.id),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, inventoryBalances.itemId),
        ),
      )
      .where(
        and(
          eq(inventoryBalances.id, id),
          eq(inventoryBalances.farmId, farmId),
          scopeCondition(inventoryBalances.warehouseId, scope),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Inventory balance not found');
    const qrUrl = scanUrl(`inventory/${row.balance.id}`);
    const svg = await qrSvg(qrUrl);

    return {
      balanceId: row.balance.id,
      qrUrl,
      format: 'svg',
      imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
      balance: row.balance,
      itemCode: row.itemCode,
      itemName: row.itemName,
      itemImageUrl: row.itemImageUrl,
      itemType: row.itemType,
      trackingMode: row.trackingMode,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      lotCode: row.lotCode,
      supplierLotNumber: row.supplierLotNumber,
      legacyLotNumber: row.legacyLotNumber,
      lotNumber: row.lotCode, // deprecated alias of lotCode
    };
  }

  async listTransactions(filters: TransactionFilters & PaginationParams) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );

    // Circular schema references make these table columns lose their inferred types.
    const lotIdColumn = sql<string | null>`${inventoryLots}."id"`;
    const lotFarmIdColumn = sql<string | null>`${inventoryLots}."farm_id"`;
    const lotItemIdColumn = sql<string | null>`${inventoryLots}."item_id"`;
    const lotCodeColumn = sql<string | null>`${inventoryLots}."lot_code"`;
    const lotSupplierNumberColumn = sql<
      string | null
    >`${inventoryLots}."supplier_lot_number"`;
    const lotLegacyNumberColumn = sql<
      string | null
    >`${inventoryLots}."legacy_lot_number"`;
    const lotExpiryDateColumn = sql<
      string | null
    >`${inventoryLots}."expiry_date"`;
    const transactionAssetId = sql<string | null>`transaction_asset."id"`;
    const transactionAssetFarmId = sql<
      string | null
    >`transaction_asset."farm_id"`;
    const transactionAssetItemId = sql<
      string | null
    >`transaction_asset."item_id"`;
    const transactionAssetCode = sql<
      string | null
    >`transaction_asset."asset_code"`;
    const transactionAssetSerialNumber = sql<
      string | null
    >`transaction_asset."serial_number"`;
    const assetReturnId = sql<string | null>`asset_return_source."id"`;
    const assetReturnFarmId = sql<string | null>`asset_return_source."farm_id"`;
    const assetReturnCode = sql<
      string | null
    >`asset_return_source."asset_code"`;
    const memberId = sql<string | null>`${farmMembers}."id"`;
    const memberFarmId = sql<string | null>`${farmMembers}."farm_id"`;
    const memberUserId = sql<string | null>`${farmMembers}."user_id"`;
    const userId = sql<string | null>`${users}."id"`;
    const userFullName = sql<string | null>`${users}."full_name"`;

    const predicates: SQL[] = [
      eq(inventoryTransactions.farmId, filters.farmId),
    ];
    const scoped = scopeCondition(inventoryTransactions.warehouseId, scope);
    if (scoped) predicates.push(scoped);
    if (filters.warehouseId) {
      predicates.push(
        eq(inventoryTransactions.warehouseId, filters.warehouseId),
      );
    }
    if (filters.itemId) {
      predicates.push(eq(inventoryTransactions.itemId, filters.itemId));
    }
    if (filters.transactionType) {
      predicates.push(
        eq(inventoryTransactions.transactionType, filters.transactionType),
      );
    }
    if (filters.dateFrom) {
      predicates.push(
        sql`${inventoryTransactions.createdAt} >= (${filters.dateFrom}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    }
    if (filters.dateTo) {
      predicates.push(
        sql`${inventoryTransactions.createdAt} < ((${filters.dateTo}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      );
    }
    const where = and(...predicates);

    const rowsQuery = this.databaseService.db
      .select({
        id: inventoryTransactions.id,
        transactionType: inventoryTransactions.transactionType,
        quantityChange: inventoryTransactions.quantityChange,
        reason: inventoryTransactions.reason,
        createdAt: inventoryTransactions.createdAt,
        itemId: items.id,
        itemCode: items.code,
        itemName: items.name,
        unitId: units.id,
        unitName: units.name,
        unitSymbol: units.symbol,
        warehouseId: warehouses.id,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        lotId: lotIdColumn,
        lotCode: lotCodeColumn,
        lotSupplierNumber: lotSupplierNumberColumn,
        lotLegacyNumber: lotLegacyNumberColumn,
        lotExpiryDate: lotExpiryDateColumn,
        assetId: transactionAssetId,
        assetCode: transactionAssetCode,
        assetSerialNumber: transactionAssetSerialNumber,
        performerId: memberId,
        performerName: userFullName,
        sourceType: inventoryTransactions.sourceType,
        sourceId: inventoryTransactions.sourceId,
        receiptCode: sql<string | null>`${stockReceipts}."receipt_code"`,
        issueCode: sql<string | null>`${stockIssues}."issue_code"`,
        transferCode: sql<string | null>`${stockTransfers}."transfer_code"`,
        countCode: sql<string | null>`${stockCounts}."count_code"`,
        assetReturnCode,
      })
      .from(inventoryTransactions)
      .innerJoin(
        items,
        and(
          eq(inventoryTransactions.itemId, items.id),
          eq(items.farmId, filters.farmId),
        ),
      )
      .innerJoin(units, eq(items.unitId, units.id))
      .innerJoin(
        warehouses,
        and(
          eq(inventoryTransactions.warehouseId, warehouses.id),
          eq(warehouses.farmId, filters.farmId),
        ),
      )
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryTransactions.lotId, lotIdColumn),
          eq(lotFarmIdColumn, filters.farmId),
          eq(lotItemIdColumn, inventoryTransactions.itemId),
        ),
      )
      .leftJoin(
        transactionAssetTable,
        and(
          eq(inventoryTransactions.assetId, transactionAssetId),
          eq(transactionAssetFarmId, filters.farmId),
          eq(transactionAssetItemId, inventoryTransactions.itemId),
        ),
      )
      .leftJoin(
        farmMembers,
        and(
          eq(inventoryTransactions.performedByMemberId, memberId),
          eq(memberFarmId, filters.farmId),
        ),
      )
      .leftJoin(users, eq(memberUserId, userId))
      .leftJoin(
        stockReceipts,
        and(
          eq(inventoryTransactions.sourceType, 'STOCK_RECEIPT'),
          eq(inventoryTransactions.sourceId, stockReceipts.id),
          eq(stockReceipts.farmId, filters.farmId),
        ),
      )
      .leftJoin(
        stockIssues,
        and(
          eq(inventoryTransactions.sourceType, 'STOCK_ISSUE'),
          eq(inventoryTransactions.sourceId, stockIssues.id),
          eq(stockIssues.farmId, filters.farmId),
        ),
      )
      .leftJoin(
        stockTransfers,
        and(
          eq(inventoryTransactions.sourceType, 'STOCK_TRANSFER'),
          eq(inventoryTransactions.sourceId, stockTransfers.id),
          eq(stockTransfers.farmId, filters.farmId),
        ),
      )
      .leftJoin(
        stockCounts,
        and(
          eq(inventoryTransactions.sourceType, 'STOCK_COUNT'),
          eq(inventoryTransactions.sourceId, stockCounts.id),
          eq(stockCounts.farmId, filters.farmId),
        ),
      )
      .leftJoin(
        assetReturnSourceTable,
        and(
          eq(inventoryTransactions.sourceType, 'ASSET_RETURN'),
          eq(inventoryTransactions.sourceId, assetReturnId),
          eq(assetReturnFarmId, filters.farmId),
          eq(
            sql<string | null>`asset_return_source."item_id"`,
            inventoryTransactions.itemId,
          ),
        ),
      )
      .where(where)
      .orderBy(
        desc(inventoryTransactions.createdAt),
        desc(inventoryTransactions.id),
      )
      .limit(filters.pageSize)
      .offset(filters.offset);

    const totalsQuery = this.databaseService.db
      .select({ value: count() })
      .from(inventoryTransactions)
      .innerJoin(
        items,
        and(
          eq(inventoryTransactions.itemId, items.id),
          eq(items.farmId, filters.farmId),
        ),
      )
      .innerJoin(units, eq(items.unitId, units.id))
      .innerJoin(
        warehouses,
        and(
          eq(inventoryTransactions.warehouseId, warehouses.id),
          eq(warehouses.farmId, filters.farmId),
        ),
      )
      .where(where);

    const [rows, totals] = await Promise.all([rowsQuery, totalsQuery]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return {
      data: rows.map((row) => {
        let sourceCode: string | null = null;
        if (row.sourceType === 'STOCK_RECEIPT') sourceCode = row.receiptCode;
        if (row.sourceType === 'STOCK_ISSUE') sourceCode = row.issueCode;
        if (row.sourceType === 'STOCK_TRANSFER') sourceCode = row.transferCode;
        if (row.sourceType === 'STOCK_COUNT') sourceCode = row.countCode;
        if (row.sourceType === 'ASSET_RETURN') sourceCode = row.assetReturnCode;

        const performerName = row.performerName?.trim();
        return {
          id: row.id,
          transactionType: row.transactionType,
          quantityChange: row.quantityChange,
          reason: row.reason,
          createdAt: row.createdAt,
          item: {
            id: row.itemId,
            code: row.itemCode,
            name: row.itemName,
            unit: {
              id: row.unitId,
              name: row.unitName,
              symbol: row.unitSymbol,
            },
          },
          warehouse: {
            id: row.warehouseId,
            code: row.warehouseCode,
            name: row.warehouseName,
          },
          lot: row.lotId
            ? {
                id: row.lotId,
                lotCode: row.lotCode!,
                supplierLotNumber: row.lotSupplierNumber,
                legacyLotNumber: row.lotLegacyNumber,
                lotNumber: row.lotCode!, // deprecated alias of lotCode
                expiryDate: row.lotExpiryDate,
              }
            : null,
          asset: row.assetId
            ? {
                id: row.assetId,
                assetCode: row.assetCode!,
                serialNumber: row.assetSerialNumber,
              }
            : null,
          performer:
            row.performerId && performerName
              ? { id: row.performerId, displayName: performerName }
              : null,
          source: {
            type: row.sourceType,
            id: row.sourceId,
            code: sourceCode,
          },
        };
      }),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async listLots(
    filters: Pick<Filters, 'clerkUserId' | 'farmId' | 'itemId'> &
      PaginationParams & { supplierLotNumber?: string; search?: string },
  ) {
    await this.warehousesService.assertFarmAccess(
      filters.farmId,
      filters.clerkUserId,
      false,
    );
    const predicates: SQL[] = [eq(inventoryLots.farmId, filters.farmId)];
    if (filters.itemId)
      predicates.push(eq(inventoryLots.itemId, filters.itemId));
    // Exact match only: used to suggest (never enforce) reuse of a lot with the same printed number.
    if (filters.supplierLotNumber)
      predicates.push(
        eq(inventoryLots.supplierLotNumber, filters.supplierLotNumber),
      );
    if (filters.search) {
      const pattern = `%${this.escapeLike(filters.search)}%`;
      predicates.push(
        or(
          ilike(inventoryLots.lotCode, pattern),
          ilike(inventoryLots.supplierLotNumber, pattern),
          ilike(inventoryLots.legacyLotNumber, pattern),
        )!,
      );
    }
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(inventoryLots),
          lotNumber: inventoryLots.lotCode, // deprecated alias of lotCode
          sourceSupplierId: suppliers.id,
          sourceSupplierName: suppliers.name,
        })
        .from(inventoryLots)
        .leftJoin(
          stockReceiptItems,
          eq(stockReceiptItems.id, inventoryLots.sourceReceiptItemId),
        )
        .leftJoin(
          stockReceipts,
          and(
            eq(stockReceipts.id, stockReceiptItems.stockReceiptId),
            eq(stockReceipts.farmId, filters.farmId),
          ),
        )
        .leftJoin(
          suppliers,
          and(
            eq(suppliers.id, stockReceipts.supplierId),
            eq(suppliers.farmId, filters.farmId),
          ),
        )
        .where(and(...predicates))
        .orderBy(
          asc(inventoryLots.expiryDate),
          asc(inventoryLots.lotCode),
          asc(inventoryLots.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(inventoryLots)
        .where(and(...predicates)),
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

  async getLot(id: string, farmId: string, clerkUserId: string) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, false);
    const [lot] = await this.databaseService.db
      .select({
        ...getTableColumns(inventoryLots),
        lotNumber: inventoryLots.lotCode,
        sourceSupplierId: suppliers.id,
        sourceSupplierName: suppliers.name,
        itemCode: items.code,
        itemName: items.name,
        itemType: items.itemType,
        trackingMode: items.trackingMode,
        itemImageUrl: items.imageUrl,
        unitId: units.id,
        unitName: units.name,
        unitSymbol: units.symbol,
      })
      .from(inventoryLots)
      .innerJoin(
        items,
        and(eq(items.id, inventoryLots.itemId), eq(items.farmId, farmId)),
      )
      .leftJoin(units, eq(units.id, items.unitId))
      .leftJoin(
        stockReceiptItems,
        eq(stockReceiptItems.id, inventoryLots.sourceReceiptItemId),
      )
      .leftJoin(
        stockReceipts,
        and(
          eq(stockReceipts.id, stockReceiptItems.stockReceiptId),
          eq(stockReceipts.farmId, farmId),
        ),
      )
      .leftJoin(
        suppliers,
        and(
          eq(suppliers.id, stockReceipts.supplierId),
          eq(suppliers.farmId, farmId),
        ),
      )
      .where(and(eq(inventoryLots.id, id), eq(inventoryLots.farmId, farmId)))
      .limit(1);
    if (!lot) throw new NotFoundException('Inventory lot not found');
    return lot;
  }

  async getItemsSummary(filters: ItemSummaryFilters & PaginationParams) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );
    if (
      (scope !== null && scope.length === 0) ||
      (filters.warehouseId && !inScope(scope, filters.warehouseId))
    ) {
      return {
        data: [],
        summary: {
          stockedItemCount: 0,
          lotItemCount: 0,
          totalQuantity: '0',
          belowMinimumCount: 0,
        },
        page: {
          number: filters.page,
          size: filters.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      };
    }

    const warehouseSql = filters.warehouseId
      ? sql`AND ib.warehouse_id = ${filters.warehouseId}`
      : sql``;
    const scopeSql = this.scopeSql('ib.warehouse_id', scope);
    const searchPattern = filters.search
      ? `%${this.escapeLike(filters.search)}%`
      : null;
    const itemFilterSql = sql`
      ${searchPattern ? sql`AND (i.code ILIKE ${searchPattern} OR i.name ILIKE ${searchPattern} OR i.barcode ILIKE ${searchPattern})` : sql``}
      ${filters.categoryId ? sql`AND i.category_id = ${filters.categoryId}` : sql``}
      ${filters.trackingMode ? sql`AND i.tracking_mode = ${filters.trackingMode}` : sql``}
      ${filters.excludeTrackingMode ? sql`AND i.tracking_mode <> ${filters.excludeTrackingMode}` : sql``}
    `;

    const stockCte = sql`
      WITH stock_by_item AS (
        SELECT
          ib.item_id,
          SUM(ib.quantity_on_hand) AS quantity_on_hand,
          COUNT(DISTINCT ib.lot_id) FILTER (WHERE ib.lot_id IS NOT NULL)::int AS lot_count,
          CASE
            WHEN COUNT(DISTINCT ib.lot_id) FILTER (WHERE ib.lot_id IS NOT NULL) = 1
            THEN MAX(ib.lot_id::text)
            ELSE NULL
          END AS single_lot_id,
          CASE
            WHEN COUNT(DISTINCT ib.lot_id) FILTER (WHERE ib.lot_id IS NOT NULL) = 1
            THEN MAX(il.lot_code)
            ELSE NULL
          END AS single_lot_code
        FROM inventory_balances ib
        INNER JOIN items i ON i.id = ib.item_id AND i.farm_id = ib.farm_id
        INNER JOIN warehouses w ON w.id = ib.warehouse_id AND w.farm_id = ib.farm_id
        LEFT JOIN inventory_lots il
          ON il.id = ib.lot_id
          AND il.farm_id = ib.farm_id
          AND il.item_id = ib.item_id
        WHERE ib.farm_id = ${filters.farmId}
          AND ib.quantity_on_hand > 0
          ${scopeSql}
          ${warehouseSql}
          AND (
            (i.tracking_mode = 'LOT' AND ib.lot_id IS NOT NULL AND il.id IS NOT NULL)
            OR (i.tracking_mode <> 'LOT' AND ib.lot_id IS NULL)
          )
        GROUP BY ib.item_id
      )
    `;

    type SummaryRow = {
      itemId: string;
      itemCode: string;
      itemName: string;
      itemType: string;
      trackingMode: TrackingMode;
      itemImageUrl: string | null;
      minStockLevel: string;
      categoryId: string;
      categoryName: string;
      unitId: string;
      unitName: string;
      unitSymbol: string | null;
      quantityOnHand: string;
      lotCount: number;
      singleLotId: string | null;
      singleLotCode: string | null;
    };

    type MetaRow = {
      stockedItemCount: number;
      lotItemCount: number;
      totalQuantity: string;
      belowMinimumCount: number;
      totalItems: number;
    };

    const dataQuery = filters.lowStockOnly
      ? sql`
          ${stockCte}
          SELECT
            i.id AS "itemId",
            i.code AS "itemCode",
            i.name AS "itemName",
            i.item_type AS "itemType",
            i.tracking_mode AS "trackingMode",
            i.image_url AS "itemImageUrl",
            i.min_stock_level::text AS "minStockLevel",
            c.id AS "categoryId",
            c.name AS "categoryName",
            u.id AS "unitId",
            u.name AS "unitName",
            u.symbol AS "unitSymbol",
            COALESCE(s.quantity_on_hand, 0)::text AS "quantityOnHand",
            COALESCE(s.lot_count, 0)::int AS "lotCount",
            s.single_lot_id AS "singleLotId",
            s.single_lot_code AS "singleLotCode"
          FROM items i
          LEFT JOIN stock_by_item s ON s.item_id = i.id
          INNER JOIN categories c ON c.id = i.category_id
          INNER JOIN units u ON u.id = i.unit_id
          WHERE i.farm_id = ${filters.farmId}
            AND i.status = 'ACTIVE'
            AND i.min_stock_level > 0
            AND COALESCE(s.quantity_on_hand, 0) < i.min_stock_level
            ${itemFilterSql}
          ORDER BY i.code ASC, i.id ASC
          LIMIT ${filters.pageSize} OFFSET ${filters.offset}
        `
      : sql`
          ${stockCte}
          SELECT
            i.id AS "itemId",
            i.code AS "itemCode",
            i.name AS "itemName",
            i.item_type AS "itemType",
            i.tracking_mode AS "trackingMode",
            i.image_url AS "itemImageUrl",
            i.min_stock_level::text AS "minStockLevel",
            c.id AS "categoryId",
            c.name AS "categoryName",
            u.id AS "unitId",
            u.name AS "unitName",
            u.symbol AS "unitSymbol",
            s.quantity_on_hand::text AS "quantityOnHand",
            s.lot_count AS "lotCount",
            s.single_lot_id AS "singleLotId",
            s.single_lot_code AS "singleLotCode"
          FROM stock_by_item s
          INNER JOIN items i ON i.id = s.item_id AND i.farm_id = ${filters.farmId}
          INNER JOIN categories c ON c.id = i.category_id
          INNER JOIN units u ON u.id = i.unit_id
          WHERE TRUE
            ${itemFilterSql}
          ORDER BY i.code ASC, i.id ASC
          LIMIT ${filters.pageSize} OFFSET ${filters.offset}
        `;

    const totalItemsSubquery = filters.lowStockOnly
      ? sql`(SELECT COUNT(*)::int FROM items i LEFT JOIN stock_by_item s ON s.item_id = i.id WHERE i.farm_id = ${filters.farmId} AND i.status = 'ACTIVE' AND i.min_stock_level > 0 AND COALESCE(s.quantity_on_hand, 0) < i.min_stock_level ${itemFilterSql})`
      : sql`(SELECT COUNT(*)::int FROM stock_by_item s INNER JOIN items i ON i.id = s.item_id AND i.farm_id = ${filters.farmId} WHERE TRUE ${itemFilterSql})`;

    const metaQuery = sql`
      ${stockCte}
      SELECT
        (SELECT COUNT(*)::int FROM stock_by_item) AS "stockedItemCount",
        (SELECT COUNT(*) FILTER (WHERE i.tracking_mode = 'LOT')::int
          FROM stock_by_item s
          INNER JOIN items i ON i.id = s.item_id AND i.farm_id = ${filters.farmId}) AS "lotItemCount",
        (SELECT COALESCE(SUM(quantity_on_hand), 0)::text FROM stock_by_item) AS "totalQuantity",
        (SELECT COUNT(*)::int
          FROM items i
          LEFT JOIN stock_by_item s ON s.item_id = i.id
          WHERE i.farm_id = ${filters.farmId}
            AND i.status = 'ACTIVE'
            AND i.min_stock_level > 0
            AND COALESCE(s.quantity_on_hand, 0) < i.min_stock_level) AS "belowMinimumCount",
        ${totalItemsSubquery} AS "totalItems"
    `;

    const [rowsResult, metaResult] = await Promise.all([
      this.databaseService.db.execute<SummaryRow>(dataQuery),
      this.databaseService.db.execute<MetaRow>(metaQuery),
    ]);

    const meta = metaResult.rows[0] ?? {
      stockedItemCount: 0,
      lotItemCount: 0,
      totalQuantity: '0',
      belowMinimumCount: 0,
      totalItems: 0,
    };
    const totalItems = Number(meta.totalItems ?? 0);

    return {
      data: rowsResult.rows.map((row) => ({
        ...row,
        lotCount: Number(row.lotCount ?? 0),
      })),
      summary: {
        stockedItemCount: Number(meta.stockedItemCount ?? 0),
        lotItemCount: Number(meta.lotItemCount ?? 0),
        totalQuantity: meta.totalQuantity ?? '0',
        belowMinimumCount: Number(meta.belowMinimumCount ?? 0),
      },
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async getForecast(filters: ForecastFilters & PaginationParams) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );
    if (!inScope(scope, filters.warehouseId)) {
      return {
        data: [],
        page: {
          number: filters.page,
          size: filters.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      };
    }

    type ForecastRow = {
      itemId: string;
      code: string;
      name: string;
      unit: string;
      quantityOnHand: number;
      averageDailyOutflow: number;
      estimatedDaysRemaining: number;
    };

    const cte = sql`
      WITH outflow AS (
        SELECT
          t.item_id,
          SUM(ABS(t.quantity_change)) AS total_outflow,
          MIN(t.created_at) AS oldest_created_at
        FROM inventory_transactions t
        WHERE t.farm_id = ${filters.farmId}
          AND t.warehouse_id = ${filters.warehouseId}
          AND t.created_at >= (now() - interval '30 days')
          AND t.created_at <= now()
          AND t.transaction_type IN ('ISSUE', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'ASSIGNMENT_OUT', 'MAINTENANCE_ISSUE')
          AND t.quantity_change < 0
        GROUP BY t.item_id
        HAVING SUM(ABS(t.quantity_change)) > 0
      ),
      stock AS (
        SELECT
          b.item_id,
          SUM(b.quantity_on_hand) AS quantity_on_hand
        FROM inventory_balances b
        WHERE b.farm_id = ${filters.farmId}
          AND b.warehouse_id = ${filters.warehouseId}
          AND b.quantity_on_hand > 0
        GROUP BY b.item_id
        HAVING SUM(b.quantity_on_hand) > 0
      )
    `;

    const [rowsResult, totalResult] = await Promise.all([
      this.databaseService.db.execute<ForecastRow>(sql`
        ${cte},
        forecast AS (
          SELECT
            i.id AS "itemId",
            i.code AS "code",
            i.name AS "name",
            COALESCE(NULLIF(u.symbol, ''), u.name, '') AS "unit",
            s.quantity_on_hand::double precision AS "quantityOnHand",
            (o.total_outflow::double precision / GREATEST(1.0, LEAST(30.0, EXTRACT(EPOCH FROM (now() - o.oldest_created_at)) / 86400.0))) AS "averageDailyOutflow",
            (s.quantity_on_hand::double precision / NULLIF((o.total_outflow::double precision / GREATEST(1.0, LEAST(30.0, EXTRACT(EPOCH FROM (now() - o.oldest_created_at)) / 86400.0))), 0)) AS "estimatedDaysRemaining"
          FROM outflow o
          INNER JOIN stock s ON s.item_id = o.item_id
          INNER JOIN items i ON i.id = o.item_id AND i.farm_id = ${filters.farmId}
          LEFT JOIN units u ON u.id = i.unit_id
        )
        SELECT *
        FROM forecast
        WHERE "estimatedDaysRemaining" IS NOT NULL
        ORDER BY "estimatedDaysRemaining" ASC, "code" ASC
        LIMIT ${filters.pageSize} OFFSET ${filters.offset}
      `),
      this.databaseService.db.execute<{ value: number }>(sql`
        ${cte}
        SELECT COUNT(*)::int AS value
        FROM outflow o
        INNER JOIN stock s ON s.item_id = o.item_id
      `),
    ]);

    const totalItems = Number(totalResult.rows[0]?.value ?? 0);
    return {
      data: rowsResult.rows.map((row) => ({
        itemId: row.itemId,
        code: row.code,
        name: row.name,
        unit: row.unit,
        quantityOnHand: Number(row.quantityOnHand),
        averageDailyOutflow: Number(row.averageDailyOutflow),
        estimatedDaysRemaining: Number(row.estimatedDaysRemaining),
      })),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async lotSuggestions(filters: Filters) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
    );
    const predicates: SQL[] = [
      eq(inventoryBalances.farmId, filters.farmId),
      isNotNull(inventoryBalances.lotId),
    ];
    const scoped = scopeCondition(inventoryBalances.warehouseId, scope);
    if (scoped) predicates.push(scoped);
    if (filters.itemId)
      predicates.push(eq(inventoryBalances.itemId, filters.itemId));
    if (filters.warehouseId)
      predicates.push(eq(inventoryBalances.warehouseId, filters.warehouseId));
    const today = new Date().toISOString().slice(0, 10);
    return this.databaseService.db
      .select({
        lot: {
          ...getTableColumns(inventoryLots),
          lotNumber: inventoryLots.lotCode, // deprecated alias of lotCode
        },
        balance: inventoryBalances,
      })
      .from(inventoryBalances)
      .innerJoin(inventoryLots, eq(inventoryBalances.lotId, inventoryLots.id))
      .where(
        and(
          ...predicates,
          gt(inventoryBalances.quantityOnHand, '0'),
          or(
            isNull(inventoryLots.expiryDate),
            gte(inventoryLots.expiryDate, today),
          ),
        ),
      )
      .orderBy(asc(inventoryLots.expiryDate), asc(inventoryLots.createdAt));
  }
}

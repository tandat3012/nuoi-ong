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
  isNull,
  isNotNull,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { qrSvg, scanUrl } from '../../common/qr';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
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
  units,
  users,
  warehouses,
} from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import { scopeCondition } from '../warehouses/warehouse-scope';

const transactionAssetTable = sql`${assets} AS transaction_asset`;
const assetReturnSourceTable = sql`${assets} AS asset_return_source`;

type Filters = {
  clerkUserId: string;
  farmId: string;
  warehouseId?: string;
  itemId?: string;
  lotId?: string;
  assetId?: string;
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

  async listBalances(filters: Filters & PaginationParams) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
      filters.warehouseId,
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
    if (filters.lotId)
      predicates.push(eq(inventoryBalances.lotId, filters.lotId));
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
    const [rows, totals] = await Promise.all([
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
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
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
        item: {
          id: row.itemId,
          code: row.itemCode,
          name: row.itemName,
          trackingMode: row.trackingMode,
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
      PaginationParams & { supplierLotNumber?: string },
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

  async lotSuggestions(filters: Filters) {
    const scope = await this.warehousesService.warehouseScope(
      filters.farmId,
      filters.clerkUserId,
      filters.warehouseId,
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

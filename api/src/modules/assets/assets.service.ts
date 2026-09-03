import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, isNull, or, sql, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { assetAssignments, assets, assetStatus, inventoryBalances, inventoryTransactions, items, locations, warehouses } from '../../db/schema';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { WarehousesService } from '../warehouses/warehouses.service';

type AssetStatus = (typeof assetStatus.enumValues)[number];

export interface AssetListFilters extends PaginationParams {
  farmId: string;
  search?: string;
  status?: AssetStatus;
  itemId?: string;
  locationId?: string;
}

@Injectable()
export class AssetsService {
  constructor(private readonly databaseService: DatabaseService, private readonly warehousesService: WarehousesService) {}

  async returnAsset(id: string, farmId: string, clerkUserId: string, input: ReturnAssetDto) {
    const memberId = await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    return this.databaseService.db.transaction(async (tx) => {
      const [asset] = await tx.select().from(assets).where(and(eq(assets.id, id), eq(assets.farmId, farmId))).limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      if (!['IN_USE', 'ASSIGNED'].includes(asset.status)) throw new ConflictException('Only assigned or in-use assets can be returned');
      const [warehouse] = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.farmId, farmId), eq(warehouses.status, 'ACTIVE')));
      if (!warehouse) throw new ConflictException('Warehouse must exist and be ACTIVE');
      const now = new Date().toISOString();
      await tx.update(assetAssignments).set({ status: 'RETURNED', returnedAt: now, updatedAt: now }).where(and(eq(assetAssignments.assetId, id), eq(assetAssignments.farmId, farmId), eq(assetAssignments.status, 'ACTIVE')));
      await tx.update(assets).set({ status: 'AVAILABLE', updatedAt: now }).where(eq(assets.id, id));
      const [balance] = await tx.select().from(inventoryBalances).where(and(eq(inventoryBalances.farmId, farmId), eq(inventoryBalances.warehouseId, input.warehouseId), eq(inventoryBalances.itemId, asset.itemId), isNull(inventoryBalances.lotId))).limit(1);
      if (balance) await tx.update(inventoryBalances).set({ quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`, updatedAt: now }).where(eq(inventoryBalances.id, balance.id));
      else await tx.insert(inventoryBalances).values({ farmId, warehouseId: input.warehouseId, itemId: asset.itemId, lotId: null, quantityOnHand: '1' });
      await tx.insert(inventoryTransactions).values({ farmId, warehouseId: input.warehouseId, itemId: asset.itemId, assetId: id, transactionType: 'RETURN_IN', quantityChange: '1', sourceType: 'ASSET_RETURN', sourceId: id, performedByMemberId: memberId, reason: input.note });
      return (await tx.select().from(assets).where(eq(assets.id, id)).limit(1))[0];
    });
  }

  async listAssets(filters: AssetListFilters) {
    const predicates: SQL[] = [eq(assets.farmId, filters.farmId)];

    if (filters.search) {
      predicates.push(
        or(
          ilike(assets.assetCode, `%${filters.search}%`),
          ilike(assets.serialNumber, `%${filters.search}%`),
          ilike(items.name, `%${filters.search}%`),
        )!,
      );
    }
    if (filters.status) {
      predicates.push(eq(assets.status, filters.status));
    }
    if (filters.itemId) {
      predicates.push(eq(assets.itemId, filters.itemId));
    }
    if (filters.locationId) {
      predicates.push(eq(assets.currentLocationId, filters.locationId));
    }

    const where = and(...predicates);
    const [data, totalRows] = await Promise.all([
      this.databaseService.db
        .select({
          asset: assets,
          itemCode: items.code,
          itemName: items.name,
          locationCode: locations.code,
          locationName: locations.name,
        })
        .from(assets)
        .innerJoin(items, eq(assets.itemId, items.id))
        .leftJoin(locations, eq(assets.currentLocationId, locations.id))
        .where(where)
        .orderBy(asc(assets.assetCode))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(assets)
        .innerJoin(items, eq(assets.itemId, items.id))
        .where(where),
    ]);

    const totalItems = Number(totalRows[0]?.value ?? 0);

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

  async getAsset(id: string, farmId: string) {
    return this.findOne(and(eq(assets.id, id), eq(assets.farmId, farmId)));
  }

  async getAssetByCode(assetCode: string, farmId: string) {
    return this.findOne(
      and(eq(assets.assetCode, assetCode), eq(assets.farmId, farmId)),
    );
  }

  async getAssetByQr(qrToken: string, farmId: string) {
    return this.findOne(
      and(eq(assets.qrToken, qrToken), eq(assets.farmId, farmId)),
    );
  }

  private async findOne(where: SQL | undefined) {
    const [asset] = await this.databaseService.db
      .select({
        asset: assets,
        itemCode: items.code,
        itemName: items.name,
        locationCode: locations.code,
        locationName: locations.name,
      })
      .from(assets)
      .innerJoin(items, eq(assets.itemId, items.id))
      .leftJoin(locations, eq(assets.currentLocationId, locations.id))
      .where(where)
      .limit(1);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }
}

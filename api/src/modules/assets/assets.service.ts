import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { assets, assetStatus, items, locations } from '../../db/schema';

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
  constructor(private readonly databaseService: DatabaseService) {}

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

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assetAssignments,
  assets,
  assetStatus,
  auditLogs,
  farmMembers,
  inventoryBalances,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  users,
  warehouses,
} from '../../db/schema';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';

type AssetStatus = (typeof assetStatus.enumValues)[number];

export interface AssetListFilters extends PaginationParams {
  farmId: string;
  search?: string;
  status?: AssetStatus;
  itemId?: string;
  locationId?: string;
  warehouseId?: string;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async returnAsset(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: ReturnAssetDto,
  ) {
    const memberId = await this.warehousesService.assertFarmAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const [actor] = await this.databaseService.db
      .select({ userId: users.id })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(
        and(
          eq(farmMembers.id, memberId),
          eq(farmMembers.farmId, farmId),
          eq(farmMembers.status, 'ACTIVE'),
          eq(users.authProviderUserId, clerkUserId),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!actor)
      throw new ConflictException('Active farm membership is required');
    return this.databaseService.db.transaction(async (tx) => {
      const [preliminaryAsset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .limit(1);
      if (!preliminaryAsset) throw new NotFoundException('Asset not found');

      const [receivingWarehouse] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, input.warehouseId),
            eq(warehouses.farmId, farmId),
            eq(warehouses.status, 'ACTIVE'),
          ),
        );
      if (!receivingWarehouse)
        throw new ConflictException('Warehouse must exist and be ACTIVE');

      // Lock the shared balance before the asset, matching issue confirmation.
      await tx
        .insert(inventoryBalances)
        .values({
          farmId,
          warehouseId: input.warehouseId,
          itemId: preliminaryAsset.itemId,
          lotId: null,
        })
        .onConflictDoNothing({
          target: [
            inventoryBalances.itemId,
            inventoryBalances.lotId,
            inventoryBalances.warehouseId,
          ],
        });
      const [balance] = await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.farmId, farmId),
            eq(inventoryBalances.warehouseId, input.warehouseId),
            eq(inventoryBalances.itemId, preliminaryAsset.itemId),
            isNull(inventoryBalances.lotId),
          ),
        )
        .for('update')
        .limit(1);
      if (!balance)
        throw new ConflictException(
          'Receiving inventory balance is unavailable',
        );

      const [asset] = await tx
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.itemId !== preliminaryAsset.itemId)
        throw new ConflictException('Asset item changed during return');
      if (!['IN_USE', 'ASSIGNED'].includes(asset.status))
        throw new ConflictException(
          'Only assigned or in-use assets can be returned',
        );
      const [activeMaintenance] = await tx
        .select({ id: maintenanceRecords.id })
        .from(maintenanceRecords)
        .where(
          and(
            eq(maintenanceRecords.farmId, farmId),
            eq(maintenanceRecords.assetId, id),
            inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']),
          ),
        )
        .limit(1);
      if (activeMaintenance)
        throw new ConflictException(
          'Complete or cancel active maintenance before returning this asset',
        );

      const [warehouse] = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, input.warehouseId),
            eq(warehouses.farmId, farmId),
            eq(warehouses.status, 'ACTIVE'),
          ),
        )
        .for('share')
        .limit(1);
      if (!warehouse)
        throw new ConflictException('Warehouse must exist and be ACTIVE');

      const receivingLocationId = input.locationId ?? asset.currentLocationId;
      if (!receivingLocationId)
        throw new ConflictException(
          'An active receiving location in the selected warehouse is required',
        );
      const [location] = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(
          and(
            eq(locations.id, receivingLocationId),
            eq(locations.farmId, farmId),
            eq(locations.warehouseId, input.warehouseId),
            eq(locations.status, 'ACTIVE'),
          ),
        )
        .for('share')
        .limit(1);
      if (!location)
        throw new ConflictException(
          'Receiving location must be active in the selected warehouse',
        );

      const now = new Date().toISOString();
      await tx
        .update(assetAssignments)
        .set({ status: 'RETURNED', returnedAt: now, updatedAt: now })
        .where(
          and(
            eq(assetAssignments.assetId, id),
            eq(assetAssignments.farmId, farmId),
            eq(assetAssignments.status, 'ACTIVE'),
          ),
        );
      const [updatedAsset] = await tx
        .update(assets)
        .set({
          status: 'AVAILABLE',
          currentLocationId: location.id,
          updatedAt: now,
        })
        .where(and(eq(assets.id, id), eq(assets.farmId, farmId)))
        .returning();
      await tx
        .update(inventoryBalances)
        .set({
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} + 1`,
          updatedAt: now,
        })
        .where(eq(inventoryBalances.id, balance.id));
      await tx.insert(inventoryTransactions).values({
        farmId,
        warehouseId: input.warehouseId,
        itemId: preliminaryAsset.itemId,
        assetId: id,
        transactionType: 'RETURN_IN',
        quantityChange: '1',
        sourceType: 'ASSET_RETURN',
        sourceId: id,
        performedByMemberId: memberId,
        reason: input.note ?? null,
      });
      await tx.insert(auditLogs).values({
        farmId,
        userId: actor.userId,
        action: 'ASSET_RETURNED',
        entityType: 'ASSET',
        entityId: id,
        oldData: { status: asset.status, locationId: asset.currentLocationId },
        newData: {
          status: 'AVAILABLE',
          locationId: location.id,
          summary: `Đã nhận lại tài sản tại vị trí ${location.id}`,
        },
      });
      return updatedAsset;
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
    if (filters.warehouseId) {
      predicates.push(eq(locations.warehouseId, filters.warehouseId));
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
          locationWarehouseId: locations.warehouseId,
        })
        .from(assets)
        .innerJoin(items, eq(assets.itemId, items.id))
        .leftJoin(
          locations,
          and(
            eq(assets.currentLocationId, locations.id),
            eq(locations.farmId, assets.farmId),
          ),
        )
        .where(where)
        .orderBy(asc(assets.assetCode))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(assets)
        .innerJoin(items, eq(assets.itemId, items.id))
        .leftJoin(
          locations,
          and(
            eq(assets.currentLocationId, locations.id),
            eq(locations.farmId, assets.farmId),
          ),
        )
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
        locationWarehouseId: locations.warehouseId,
      })
      .from(assets)
      .innerJoin(items, eq(assets.itemId, items.id))
      .leftJoin(
        locations,
        and(
          eq(assets.currentLocationId, locations.id),
          eq(locations.farmId, assets.farmId),
        ),
      )
      .where(where)
      .limit(1);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }
}

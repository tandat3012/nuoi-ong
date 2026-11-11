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
  eq,
  ilike,
  inArray,
  ne,
  notInArray,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { qrSvg, scanUrl } from '../../common/qr';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  auditLogs,
  categories,
  itemType,
  items,
  locations,
  recordStatus,
  suppliers,
  trackingMode,
  units,
  warehouses,
} from '../../db/schema';
import {
  equipmentItemTypes,
  type CreateEquipmentItemDto,
  type UpdateEquipmentItemDto,
} from './dto/catalog.dto';
import type {
  CreateCategoryDto,
  CreateLocationDto,
  CreateSupplierDto,
  CreateUnitDto,
  UpdateCategoryDto,
  UpdateLocationDto,
  UpdateSupplierDto,
  UpdateUnitDto,
} from './dto/catalog.dto';

type ItemType = (typeof itemType.enumValues)[number];
type TrackingMode = (typeof trackingMode.enumValues)[number];
type RecordStatus = (typeof recordStatus.enumValues)[number];

export interface ItemListFilters extends PaginationParams {
  farmId: string;
  search?: string;
  itemTypes?: ItemType[];
  trackingMode?: TrackingMode;
  status?: RecordStatus;
  categoryId?: string;
  excludeTrackingMode?: TrackingMode;
}

export interface FarmLookupFilters extends PaginationParams {
  farmId: string;
  search?: string;
  status?: RecordStatus;
}

export interface LocationListFilters extends FarmLookupFilters {
  warehouseId?: string;
}

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

/** Who created or changed an item template, and how, in the same transaction (NV07). */
export async function auditItem(
  tx: Transaction,
  clerkUserId: string,
  action: 'ITEM_CREATED' | 'ITEM_UPDATED',
  before: object | null,
  after: { id: string; farmId: string; [field: string]: unknown },
) {
  await tx.insert(auditLogs).values({
    farmId: after.farmId,
    userId: sql`(SELECT id FROM users WHERE auth_provider_user_id = ${clerkUserId})`,
    action,
    entityType: 'ITEM',
    entityId: after.id,
    oldData: before,
    newData: after,
  });
}

@Injectable()
export class CatalogService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listCategories() {
    return this.databaseService.db
      .select()
      .from(categories)
      .orderBy(asc(categories.name));
  }

  async listUnits() {
    return this.databaseService.db
      .select()
      .from(units)
      .orderBy(asc(units.name));
  }

  async listItems(filters: ItemListFilters) {
    const predicates: SQL[] = [eq(items.farmId, filters.farmId)];

    if (filters.search) {
      predicates.push(
        or(
          ilike(items.code, `%${filters.search}%`),
          ilike(items.name, `%${filters.search}%`),
          ilike(items.barcode, `%${filters.search}%`),
        )!,
      );
    }
    if (filters.itemTypes?.length) {
      predicates.push(inArray(items.itemType, filters.itemTypes));
    }
    if (filters.trackingMode) {
      predicates.push(eq(items.trackingMode, filters.trackingMode));
    }
    if (filters.status) {
      predicates.push(eq(items.status, filters.status));
    }
    if (filters.categoryId) {
      predicates.push(eq(items.categoryId, filters.categoryId));
    }
    if (filters.excludeTrackingMode) {
      predicates.push(ne(items.trackingMode, filters.excludeTrackingMode));
    }

    const where = and(...predicates);
    const [data, totalRows] = await Promise.all([
      this.databaseService.db
        .select({
          item: items,
          categoryName: categories.name,
          unitName: units.name,
          unitSymbol: units.symbol,
        })
        .from(items)
        .innerJoin(categories, eq(items.categoryId, categories.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .where(where)
        .orderBy(asc(items.name))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(items)
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

  async listSuppliers(filters: FarmLookupFilters) {
    const predicates: SQL[] = [eq(suppliers.farmId, filters.farmId)];
    if (filters.status) predicates.push(eq(suppliers.status, filters.status));
    if (filters.search) {
      predicates.push(
        or(
          ilike(suppliers.code, `%${filters.search}%`),
          ilike(suppliers.name, `%${filters.search}%`),
        )!,
      );
    }

    const where = and(...predicates);
    const [data, totalRows] = await Promise.all([
      this.databaseService.db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(asc(suppliers.name))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(suppliers)
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

  async getSupplier(id: string, farmId: string) {
    const [supplier] = await this.databaseService.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.farmId, farmId)))
      .limit(1);
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async listLocations(filters: LocationListFilters) {
    const predicates: SQL[] = [eq(locations.farmId, filters.farmId)];
    if (filters.warehouseId)
      predicates.push(eq(locations.warehouseId, filters.warehouseId));
    if (filters.status) predicates.push(eq(locations.status, filters.status));
    if (filters.search) {
      predicates.push(
        or(
          ilike(locations.code, `%${filters.search}%`),
          ilike(locations.name, `%${filters.search}%`),
        )!,
      );
    }

    const where = and(...predicates);
    const [data, totalRows] = await Promise.all([
      this.databaseService.db
        .select()
        .from(locations)
        .where(where)
        .orderBy(asc(locations.name))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(locations)
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

  async getLocation(id: string, farmId: string) {
    const [location] = await this.databaseService.db
      .select()
      .from(locations)
      .where(and(eq(locations.id, id), eq(locations.farmId, farmId)))
      .limit(1);
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async getItemQr(id: string, farmId: string) {
    const { item } = await this.getItem(id, farmId);
    const qrUrl = scanUrl(`item/${item.id}`);
    const svg = await qrSvg(qrUrl);
    return {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemImageUrl: item.imageUrl,
      qrUrl,
      format: 'svg',
      imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
    };
  }

  async getItem(id: string, farmId: string) {
    const [item] = await this.databaseService.db
      .select({
        item: items,
        categoryName: categories.name,
        unitName: units.name,
        unitSymbol: units.symbol,
      })
      .from(items)
      .innerJoin(categories, eq(items.categoryId, categories.id))
      .innerJoin(units, eq(items.unitId, units.id))
      .where(and(eq(items.id, id), eq(items.farmId, farmId)))
      .limit(1);

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  createCategory(input: CreateCategoryDto) {
    return this.unique('Category code already exists', async () => {
      const [row] = await this.databaseService.db
        .insert(categories)
        .values(input)
        .returning();
      return row;
    });
  }

  updateCategory(id: string, input: UpdateCategoryDto) {
    this.assertChanges(input);
    return this.unique('Category code already exists', async () => {
      const [row] = await this.databaseService.db
        .update(categories)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(categories.id, id))
        .returning();
      if (!row) throw new NotFoundException('Category not found');
      return row;
    });
  }

  createUnit(input: CreateUnitDto) {
    return this.unique('Unit code already exists', async () => {
      const [row] = await this.databaseService.db
        .insert(units)
        .values(input)
        .returning();
      return row;
    });
  }

  updateUnit(id: string, input: UpdateUnitDto) {
    this.assertChanges(input);
    return this.unique('Unit code already exists', async () => {
      const [row] = await this.databaseService.db
        .update(units)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(units.id, id))
        .returning();
      if (!row) throw new NotFoundException('Unit not found');
      return row;
    });
  }

  createSupplier(farmId: string, input: CreateSupplierDto) {
    return this.unique('Supplier code already exists', async () => {
      const [row] = await this.databaseService.db
        .insert(suppliers)
        .values({ ...input, farmId })
        .returning();
      return row;
    });
  }

  updateSupplier(id: string, farmId: string, input: UpdateSupplierDto) {
    this.assertChanges(input);
    return this.unique('Supplier code already exists', async () => {
      const [row] = await this.databaseService.db
        .update(suppliers)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(and(eq(suppliers.id, id), eq(suppliers.farmId, farmId)))
        .returning();
      if (!row) throw new NotFoundException('Supplier not found');
      return row;
    });
  }

  async createLocation(farmId: string, input: CreateLocationDto) {
    await this.assertWarehouse(farmId, input.warehouseId);
    return this.unique('Location code already exists', async () => {
      const [row] = await this.databaseService.db
        .insert(locations)
        .values({ ...input, farmId })
        .returning();
      return row;
    });
  }

  async updateLocation(id: string, farmId: string, input: UpdateLocationDto) {
    this.assertChanges(input);
    await this.assertWarehouse(farmId, input.warehouseId);
    return this.unique('Location code already exists', () =>
      this.databaseService.db.transaction(async (tx) => {
        const where = and(eq(locations.id, id), eq(locations.farmId, farmId));
        // FOR UPDATE waits for asset moves, which hold the location FOR SHARE.
        const [current] = await tx
          .select({ warehouseId: locations.warehouseId })
          .from(locations)
          .where(where)
          .for('update');
        if (!current) throw new NotFoundException('Location not found');
        const movesWarehouse =
          input.warehouseId !== undefined &&
          input.warehouseId !== current.warehouseId;
        if (movesWarehouse || input.status === 'INACTIVE') {
          // Asset stock sits in the location's warehouse; it must move with each asset.
          const [held] = await tx
            .select({ id: assets.id })
            .from(assets)
            .where(
              and(
                eq(assets.currentLocationId, id),
                notInArray(assets.status, ['LOST', 'RETIRED']),
              ),
            )
            .limit(1);
          if (held)
            throw new ConflictException(
              'Location still holds assets; transfer them to another location first',
            );
        }
        const [row] = await tx
          .update(locations)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(where)
          .returning();
        return row;
      }),
    );
  }

  // A template holds no stock: units arrive through receipts (NV01) or recorded assets.
  async createItem(
    farmId: string,
    clerkUserId: string,
    input: CreateEquipmentItemDto,
  ) {
    await this.assertActiveReferences(input.categoryId, input.unitId);
    return this.unique('Item code already exists', () =>
      this.databaseService.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(items)
          .values({ ...input, farmId })
          .returning();
        await auditItem(tx, clerkUserId, 'ITEM_CREATED', null, row);
        return row;
      }),
    );
  }

  async updateItem(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateEquipmentItemDto,
  ) {
    this.assertChanges(input);
    return this.unique('Item code already exists', () =>
      this.databaseService.db.transaction(async (tx) => {
        const where = and(
          eq(items.id, id),
          eq(items.farmId, farmId),
          inArray(items.itemType, [...equipmentItemTypes]),
        );
        // FOR UPDATE waits for writers that FK key-share lock the item (lines, balances, assets).
        const [current] = await tx
          .select()
          .from(items)
          .where(where)
          .for('update');
        if (!current)
          throw new NotFoundException('Equipment or tool item not found');
        await this.assertActiveReferences(
          input.categoryId === current.categoryId
            ? undefined
            : input.categoryId,
          input.unitId === current.unitId ? undefined : input.unitId,
        );
        if (input.trackingMode && input.trackingMode !== current.trackingMode) {
          // Document lines count too: a confirm reads the tracking mode unlocked, but
          // its lines were committed earlier, so they are visible here.
          const used = await tx.execute(
            sql`SELECT 1 FROM inventory_balances WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM assets WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM inventory_transactions WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM inventory_adjustments WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM stock_receipt_items WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM stock_issue_items WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM stock_transfer_items WHERE item_id = ${id}
                UNION ALL SELECT 1 FROM stock_count_items WHERE item_id = ${id}
                LIMIT 1`,
          );
          if (used.rows.length)
            throw new ConflictException(
              'Tracking mode cannot change after inventory data or stock documents exist',
            );
        }
        const [row] = await tx
          .update(items)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(where)
          .returning();
        await auditItem(tx, clerkUserId, 'ITEM_UPDATED', current, row);
        return row;
      }),
    );
  }

  private async assertActiveReferences(
    categoryId?: string | null,
    unitId?: string | null,
  ) {
    const db = this.databaseService.db;
    const active = async (
      table: typeof categories | typeof units,
      value?: string | null,
    ) =>
      !value ||
      (
        await db
          .select({ id: table.id })
          .from(table)
          .where(and(eq(table.id, value), eq(table.status, 'ACTIVE')))
          .limit(1)
      ).length > 0;
    if (!(await active(categories, categoryId)))
      throw new BadRequestException('Category does not exist or is inactive');
    if (!(await active(units, unitId)))
      throw new BadRequestException('Unit does not exist or is inactive');
  }

  private assertChanges(input: object) {
    if (!Object.values(input).some((value) => value !== undefined))
      throw new BadRequestException('At least one field must be provided');
  }

  private async assertWarehouse(farmId: string, warehouseId?: string | null) {
    if (!warehouseId) return;
    const [row] = await this.databaseService.db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, warehouseId),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!row)
      throw new BadRequestException(
        'warehouseId must be an ACTIVE warehouse of this farm',
      );
  }

  private async unique<T>(message: string, write: () => Promise<T>) {
    try {
      return await write();
    } catch (error) {
      const failure = error as {
        code?: string;
        cause?: { code?: string; message?: string };
      };
      const code = failure.code ?? failure.cause?.code;
      if (code === '23505') throw new ConflictException(message);
      // PATCH DTOs accept null for every field; required columns reject it here.
      if (code === '23502')
        throw new BadRequestException('Required fields cannot be empty');
      // Business checks/triggers, e.g. a storefront variant pinning the item's unit.
      if (code === '23514' || code === 'P0001')
        throw new BadRequestException(
          failure.cause?.message ?? 'Data violates a business rule',
        );
      throw error;
    }
  }
}

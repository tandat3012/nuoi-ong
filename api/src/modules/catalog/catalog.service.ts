import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  categories,
  itemType,
  items,
  locations,
  recordStatus,
  suppliers,
  trackingMode,
  units,
} from '../../db/schema';

type ItemType = (typeof itemType.enumValues)[number];
type TrackingMode = (typeof trackingMode.enumValues)[number];
type RecordStatus = (typeof recordStatus.enumValues)[number];

export interface ItemListFilters extends PaginationParams {
  farmId: string;
  search?: string;
  itemType?: ItemType;
  trackingMode?: TrackingMode;
  status?: RecordStatus;
}

export interface FarmLookupFilters extends PaginationParams {
  farmId: string;
  search?: string;
  status?: RecordStatus;
}

export interface LocationListFilters extends FarmLookupFilters {
  warehouseId?: string;
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
    if (filters.itemType) {
      predicates.push(eq(items.itemType, filters.itemType));
    }
    if (filters.trackingMode) {
      predicates.push(eq(items.trackingMode, filters.trackingMode));
    }
    if (filters.status) {
      predicates.push(eq(items.status, filters.status));
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
}

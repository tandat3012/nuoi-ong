import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  categories,
  itemType,
  items,
  recordStatus,
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

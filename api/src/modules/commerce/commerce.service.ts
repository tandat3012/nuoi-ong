import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  farms,
  inventoryBalances,
  inventoryLots,
  items,
  locations,
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductVariants,
  storeSettings,
  units,
  warehouses,
} from '../../db/schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  SQL,
} from 'drizzle-orm';

export interface ProductListFilters {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc';
}

type StoreWarehouse = {
  warehouseId: string;
  farmId: string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  price: string;
};

type ProductExtras = {
  inStock: boolean;
  image?: {
    src: string;
    alt: string;
  };
};

@Injectable()
export class CommerceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProducts(
    pagination: PaginationParams,
    filters: ProductListFilters = {},
  ) {
    this.assertPagination(pagination);
    const { category, minPrice, maxPrice, sort } = filters;
    const keyword = filters.q?.trim();

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }

    const warehouse = await this.getStoreWarehouse();
    const catalog = this.productCatalog(warehouse);
    const conditions: SQL[] = [];

    if (category) conditions.push(eq(catalog.categorySlug, category));

    if (keyword) {
      conditions.push(
        sql`strpos(lower(${catalog.name}), lower(${keyword})) > 0`,
      );
    }

    if (minPrice !== undefined) {
      conditions.push(gte(catalog.price, String(minPrice)));
    }
    if (maxPrice !== undefined) {
      conditions.push(lte(catalog.price, String(maxPrice)));
    }

    const where = and(...conditions);
    const orderBy =
      sort === 'price_asc'
        ? [asc(catalog.price), asc(catalog.id)]
        : sort === 'price_desc'
          ? [desc(catalog.price), asc(catalog.id)]
          : [asc(catalog.name), asc(catalog.id)];

    const db = this.databaseService.db;
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(catalog)
        .where(where)
        .orderBy(...orderBy)
        .limit(pagination.pageSize)
        .offset(pagination.offset),
      db.select({ value: count() }).from(catalog).where(where),
    ]);
    const extras = await this.loadProductExtras(
      rows.map((row) => row.id),
      warehouse,
    );

    return {
      data: rows.map((row) => this.toProduct(row, extras.get(row.id))),
      page: this.pageInfo(pagination, total.value),
    };
  }

  async getProduct(slug: string) {
    const warehouse = await this.getStoreWarehouse();
    const catalog = this.productCatalog(warehouse);
    const [row] = await this.databaseService.db
      .select()
      .from(catalog)
      .where(eq(catalog.slug, slug))
      .limit(1);

    if (!row) throw new NotFoundException('Product not found');

    const extras = await this.loadProductExtras([row.id], warehouse);
    const variants = await this.databaseService.db
      .select({
        id: storeProductVariants.id,
        name: storeProductVariants.name,
        price: storeProductVariants.price,
        inStock: this.variantInStock(warehouse).as('in_stock'),
      })
      .from(storeProductVariants)
      .innerJoin(items, eq(items.id, storeProductVariants.itemId))
      .innerJoin(units, eq(units.id, items.unitId))
      .where(
        and(
          eq(storeProductVariants.productId, row.id),
          this.eligibleVariantConditions(warehouse.farmId),
        ),
      )
      .orderBy(asc(storeProductVariants.id));

    return {
      ...this.toProduct(row, extras.get(row.id)),
      variants: variants.map((variant) => ({
        ...variant,
        price: this.toPrice(variant.price),
      })),
    };
  }

  async listCategories(pagination: PaginationParams) {
    this.assertPagination(pagination);
    const db = this.databaseService.db;
    const [data, [total]] = await Promise.all([
      db
        .select({
          id: storeCategories.id,
          name: storeCategories.name,
          slug: storeCategories.slug,
        })
        .from(storeCategories)
        .orderBy(asc(storeCategories.name), asc(storeCategories.id))
        .limit(pagination.pageSize)
        .offset(pagination.offset),
      db.select({ value: count() }).from(storeCategories),
    ]);

    return { data, page: this.pageInfo(pagination, total.value) };
  }

  private async getStoreWarehouse(): Promise<StoreWarehouse> {
    const [warehouse] = await this.databaseService.db
      .select({ warehouseId: warehouses.id, farmId: warehouses.farmId })
      .from(storeSettings)
      .innerJoin(warehouses, eq(warehouses.id, storeSettings.warehouseId))
      .innerJoin(farms, eq(farms.id, warehouses.farmId))
      .where(
        and(
          eq(storeSettings.id, 1),
          eq(warehouses.status, 'ACTIVE'),
          eq(farms.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!warehouse) {
      throw new ServiceUnavailableException(
        'No active warehouse found for the store',
      );
    }
    return warehouse;
  }

  private variantInStock({ warehouseId, farmId }: StoreWarehouse) {
    const today = new Date().toISOString().slice(0, 10);

    return sql<boolean>`
    CASE ${items.trackingMode}
      WHEN 'QUANTITY' THEN (
        SELECT COALESCE(SUM(b.quantity_on_hand), 0)
               >= ${storeProductVariants.quantityStep}
        FROM ${inventoryBalances} b
        WHERE b.item_id = ${items.id}
          AND b.farm_id = ${farmId}
          AND b.warehouse_id = ${warehouseId}
          AND b.lot_id IS NULL
      )

      WHEN 'LOT' THEN (
        SELECT COALESCE(SUM(b.quantity_on_hand), 0)
               >= ${storeProductVariants.quantityStep}
        FROM ${inventoryBalances} b
        JOIN ${inventoryLots} l
          ON l.id = b.lot_id
          AND l.item_id = b.item_id
          AND l.farm_id = b.farm_id
        WHERE b.item_id = ${items.id}
          AND b.farm_id = ${farmId}
          AND b.warehouse_id = ${warehouseId}
          AND (
            l.expiry_date IS NULL
            OR l.expiry_date >= ${today}::date
          )
      )

      WHEN 'ASSET' THEN
        EXISTS (
          SELECT 1
          FROM ${inventoryBalances} b
          WHERE b.item_id = ${items.id}
            AND b.farm_id = ${farmId}
            AND b.warehouse_id = ${warehouseId}
            AND b.lot_id IS NULL
            AND b.quantity_on_hand >= ${storeProductVariants.quantityStep}
        )
        AND EXISTS (
          SELECT 1
          FROM ${assets} a
          JOIN ${locations} l ON l.id = a.current_location_id
          WHERE a.item_id = ${items.id}
            AND a.farm_id = ${farmId}
            AND a.status = 'AVAILABLE'
            AND l.farm_id = ${farmId}
            AND l.warehouse_id = ${warehouseId}
        )

      ELSE FALSE
    END
  `;
  }

  private eligibleVariantConditions(farmId: string) {
    return and(
      eq(storeProductVariants.active, true),
      eq(items.farmId, farmId),
      eq(items.status, 'ACTIVE'),
      eq(units.status, 'ACTIVE'),
    );
  }

  private productCatalog(warehouse: StoreWarehouse) {
    const db = this.databaseService.db;

    const variants = db
      .select({
        productId: storeProductVariants.productId,
        price: sql<string>`MIN(${storeProductVariants.price})`.as('price'),
      })
      .from(storeProductVariants)
      .innerJoin(items, eq(items.id, storeProductVariants.itemId))
      .innerJoin(units, eq(units.id, items.unitId))
      .where(this.eligibleVariantConditions(warehouse.farmId))
      .groupBy(storeProductVariants.productId)
      .as('variant_summary');

    return db
      .select({
        id: storeProducts.id,
        name: storeProducts.name,
        slug: storeProducts.slug,
        description: storeProducts.description,
        categoryId: sql<string>`${storeCategories.id}`.as('category_id'),
        categoryName: sql<string>`${storeCategories.name}`.as('category_name'),
        categorySlug: sql<string>`${storeCategories.slug}`.as('category_slug'),
        price: variants.price,
      })
      .from(storeProducts)
      .innerJoin(
        storeCategories,
        eq(storeCategories.id, storeProducts.categoryId),
      )
      .innerJoin(variants, eq(variants.productId, storeProducts.id))
      .where(eq(storeProducts.status, 'PUBLISHED'))
      .as('catalog');
  }

  private async loadProductExtras(
    productIds: string[],
    warehouse: StoreWarehouse,
  ): Promise<Map<string, ProductExtras>> {
    const extras = new Map<string, ProductExtras>();
    if (productIds.length === 0) return extras;

    const db = this.databaseService.db;
    const [images, availability] = await Promise.all([
      db
        .selectDistinctOn([storeProductImages.productId], {
          productId: storeProductImages.productId,
          src: storeProductImages.url,
          alt: storeProductImages.alt,
        })
        .from(storeProductImages)
        .where(inArray(storeProductImages.productId, productIds))
        .orderBy(
          asc(storeProductImages.productId),
          asc(storeProductImages.position),
        ),
      db
        .select({
          productId: storeProductVariants.productId,
          inStock: sql<boolean>`BOOL_OR(${this.variantInStock(warehouse)})`.as(
            'in_stock',
          ),
        })
        .from(storeProductVariants)
        .innerJoin(items, eq(items.id, storeProductVariants.itemId))
        .innerJoin(units, eq(units.id, items.unitId))
        .where(
          and(
            this.eligibleVariantConditions(warehouse.farmId),
            inArray(storeProductVariants.productId, productIds),
          ),
        )
        .groupBy(storeProductVariants.productId),
    ]);

    const imageByProduct = new Map(
      images.map(({ productId, src, alt }) => [productId, { src, alt }]),
    );
    const stockByProduct = new Map(
      availability.map(({ productId, inStock }) => [productId, inStock]),
    );

    for (const id of productIds) {
      const image = imageByProduct.get(id);
      extras.set(id, {
        inStock: stockByProduct.get(id) ?? false,
        ...(image ? { image } : {}),
      });
    }

    return extras;
  }

  private toProduct(row: ProductRow, extras: ProductExtras | undefined) {
    const price = this.toPrice(row.price);

    const { categoryId, categoryName, categorySlug, ...product } = row;

    return {
      ...product,
      price,
      category: {
        id: categoryId,
        name: categoryName,
        slug: categorySlug,
      },
      ...(extras ?? { inStock: false }),
    };
  }

  private toPrice(value: string) {
    const price = Number(value);
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new InternalServerErrorException(
        'Product price is outside the supported range',
      );
    }
    return price;
  }

  private assertPagination({ page, pageSize, offset }: PaginationParams) {
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(offset + pageSize)
    ) {
      throw new BadRequestException(
        'page exceeds the supported pagination range',
      );
    }
  }

  private pageInfo(pagination: PaginationParams, totalItems: number) {
    return {
      number: pagination.page,
      size: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }
}

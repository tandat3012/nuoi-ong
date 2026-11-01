import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
  maintenanceRecords,
  stockIssueItems,
  stockIssues,
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductVariants,
  storeRegion,
  storeSettings,
  storeVariantItems,
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
  SQLWrapper,
} from 'drizzle-orm';

export interface ProductListFilters {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc';
}

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

/** A farm's sales warehouse; values or SQL columns of the row being checked. */
export type StoreWarehouse = {
  warehouseId: string | SQL | SQLWrapper;
  farmId: string | SQL | SQLWrapper;
};

export type SalesWarehouse = { warehouseId: string; farmId: string };

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

    const catalog = this.productCatalog();
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
    const extras = await this.loadProductExtras(rows.map((row) => row.id));

    return {
      data: rows.map((row) => this.toProduct(row, extras.get(row.id))),
      page: this.pageInfo(pagination, total.value),
    };
  }

  async getProduct(slug: string) {
    const catalog = this.productCatalog();
    const [row] = await this.databaseService.db
      .select()
      .from(catalog)
      .where(eq(catalog.slug, slug))
      .limit(1);

    if (!row) throw new NotFoundException('Product not found');

    const extras = await this.loadProductExtras([row.id]);

    const images = await this.databaseService.db
      .select({ src: storeProductImages.url, alt: storeProductImages.alt })
      .from(storeProductImages)
      .where(eq(storeProductImages.productId, row.id))
      .orderBy(asc(storeProductImages.position));
    const variants = await this.databaseService.db
      .select({
        id: storeProductVariants.id,
        name: storeProductVariants.name,
        price: storeProductVariants.price,
        inStock: this.variantInStock().as('in_stock'),
      })
      .from(storeProductVariants)
      .innerJoin(units, eq(units.id, storeProductVariants.unitId))
      .where(
        and(
          eq(storeProductVariants.productId, row.id),
          this.eligibleVariantConditions(),
        ),
      )
      .orderBy(asc(storeProductVariants.id));

    return {
      ...this.toProduct(row, extras.get(row.id)),
      images,
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

  /**
   * Sales warehouses serving `region`, in a stable order for picking one.
   * Share-locks their settings rows until the transaction ends, so an owner
   * cannot switch the warehouse while an order is being placed in it.
   */
  async salesWarehouses(
    tx: Transaction,
    region: (typeof storeRegion.enumValues)[number],
  ): Promise<SalesWarehouse[]> {
    return tx
      .select({ warehouseId: warehouses.id, farmId: warehouses.farmId })
      .from(storeSettings)
      .innerJoin(warehouses, eq(warehouses.id, storeSettings.salesWarehouseId))
      .innerJoin(farms, eq(farms.id, storeSettings.farmId))
      .where(
        and(
          this.sellingConditions(),
          sql`${region}::store_region = ANY(${storeSettings.regions})`,
        ),
      )
      .orderBy(asc(farms.code), asc(farms.id))
      .for('share', { of: storeSettings });
  }

  /** The store_settings row belongs to a farm that currently sells online. */
  sellingConditions() {
    return and(
      eq(storeSettings.salesEnabled, true),
      sql`EXISTS (
        SELECT 1 FROM ${warehouses}
        WHERE ${warehouses.id} = ${storeSettings.salesWarehouseId}
          AND ${warehouses.status} = 'ACTIVE'
      )`,
      sql`EXISTS (
        SELECT 1 FROM ${farms}
        WHERE ${farms.id} = ${storeSettings.farmId}
          AND ${farms.status} = 'ACTIVE'
      )`,
    )!;
  }

  /**
   * Whether ONE sales warehouse alone can supply `required` of the current
   * variant row. Stock of several warehouses is never added up: an order is
   * shipped from a single warehouse.
   */
  variantInStock(
    required: SQL = sql`${storeProductVariants.quantityStep}`,
    warehouse?: SalesWarehouse,
  ) {
    return this.soldBy(
      and(
        warehouse && eq(storeSettings.salesWarehouseId, warehouse.warehouseId),
        this.itemStock(
          {
            warehouseId: storeSettings.salesWarehouseId,
            farmId: storeSettings.farmId,
          },
          required,
        ),
      ),
    );
  }

  /** EXISTS a selling farm whose active item is mapped to the current variant row. */
  private soldBy(extra?: SQL) {
    return sql<boolean>`EXISTS (
      SELECT 1 FROM ${storeVariantItems}
      JOIN ${storeSettings} ON ${storeSettings.farmId} = ${storeVariantItems.farmId}
      JOIN ${items} ON ${items.id} = ${storeVariantItems.itemId}
      WHERE ${storeVariantItems.variantId} = ${storeProductVariants.id}
        AND ${items.status} = 'ACTIVE'
        AND ${this.sellingConditions()}
        ${extra ? sql`AND ${extra}` : sql``}
    )`;
  }

  /** Stock of the `items` row in scope at one warehouse, for each tracking mode. */
  private itemStock({ warehouseId, farmId }: StoreWarehouse, required: SQL) {
    const today = new Date().toISOString().slice(0, 10);

    return sql<boolean>`
    CASE ${items.trackingMode}
      WHEN 'QUANTITY' THEN (
        SELECT COALESCE(SUM(b.quantity_on_hand), 0)
               >= ${required}
        FROM ${inventoryBalances} b
        WHERE b.item_id = ${items.id}
          AND b.farm_id = ${farmId}
          AND b.warehouse_id = ${warehouseId}
          AND b.lot_id IS NULL
      )

      WHEN 'LOT' THEN (
        SELECT COALESCE(SUM(b.quantity_on_hand), 0)
               >= ${required}
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
            AND b.quantity_on_hand >= ${required}
        )
        AND (
          SELECT COUNT(*) FROM ${assets}
          JOIN ${locations} ON ${locations.id} = ${assets.currentLocationId}
          WHERE ${assets.itemId} = ${items.id}
            AND ${this.saleableAssetConditions({ warehouseId, farmId })}
        ) >= ${required}

      ELSE FALSE
    END
  `;
  }

  saleableAssetConditions({ warehouseId, farmId }: StoreWarehouse) {
    return and(
      eq(assets.farmId, farmId),
      eq(assets.status, 'AVAILABLE'),
      eq(locations.farmId, farmId),
      eq(locations.warehouseId, warehouseId),
      eq(locations.status, 'ACTIVE'),
      sql`NOT EXISTS (
        SELECT 1 FROM ${maintenanceRecords}
        WHERE ${maintenanceRecords.assetId} = ${assets.id}
          AND ${maintenanceRecords.farmId} = ${farmId}
          AND ${maintenanceRecords.status} IN ('SCHEDULED', 'IN_PROGRESS')
      )`,
      // Already picked by another unapproved issue (e.g. a confirmed order).
      sql`NOT EXISTS (
        SELECT 1 FROM ${stockIssueItems}
        JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
        WHERE ${stockIssueItems.assetId} = ${assets.id}
          AND ${stockIssues.status} IN ('DRAFT', 'PENDING_APPROVAL')
      )`,
    );
  }

  /** Active variant with an active unit that at least one selling farm can supply. */
  eligibleVariantConditions() {
    return and(
      eq(storeProductVariants.active, true),
      eq(units.status, 'ACTIVE'),
      this.soldBy(),
    );
  }

  private productCatalog() {
    const db = this.databaseService.db;

    const variants = db
      .select({
        productId: storeProductVariants.productId,
        price: sql<string>`MIN(${storeProductVariants.price})`.as('price'),
      })
      .from(storeProductVariants)
      .innerJoin(units, eq(units.id, storeProductVariants.unitId))
      .where(this.eligibleVariantConditions())
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
          inStock: sql<boolean>`BOOL_OR(${this.variantInStock()})`.as(
            'in_stock',
          ),
        })
        .from(storeProductVariants)
        .innerJoin(units, eq(units.id, storeProductVariants.unitId))
        .where(
          and(
            this.eligibleVariantConditions(),
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

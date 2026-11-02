import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { activeMaintenanceCondition } from '../maintenance/maintenance-state';
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
  storeSourceWarehouses,
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

export type StoreRegion = (typeof storeRegion.enumValues)[number];

/** Label shown to customers instead of stock numbers. */
export type Availability =
  | 'REGION_REQUIRED'
  | 'AVAILABLE'
  | 'INSUFFICIENT_IN_REGION'
  | 'OUT_IN_REGION'
  | 'REGION_NOT_SUPPORTED'
  | 'OUT_OF_STOCK';

type AvailabilityFlags = {
  anywhere: boolean;
  served: boolean;
  regionStep: boolean;
  regionQty: boolean;
};

export interface ProductListFilters {
  region?: StoreRegion;
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
  availability: Availability;
  image?: {
    src: string;
    alt: string;
  };
};

const NO_STOCK: AvailabilityFlags = {
  anywhere: false,
  served: false,
  regionStep: false,
  regionQty: false,
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
    const extras = await this.loadProductExtras(
      rows.map((row) => row.id),
      filters.region,
    );

    return {
      data: rows.map((row) => this.toProduct(row, extras.get(row.id))),
      page: this.pageInfo(pagination, total.value),
    };
  }

  async getProduct(slug: string, region?: StoreRegion, quantity = 1) {
    const catalog = this.productCatalog();
    const [row] = await this.databaseService.db
      .select()
      .from(catalog)
      .where(eq(catalog.slug, slug))
      .limit(1);

    if (!row) throw new NotFoundException('Product not found');

    const extras = await this.loadProductExtras([row.id], region, quantity);

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
        ...this.availabilityFlags(region, quantity),
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
      variants: variants.map(
        ({ anywhere, served, regionStep, regionQty, ...variant }) => ({
          ...variant,
          price: this.toPrice(variant.price),
          ...this.toAvailability(
            { anywhere, served, regionStep, regionQty },
            region,
          ),
        }),
      ),
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
    region: StoreRegion,
  ): Promise<SalesWarehouse[]> {
    return tx
      .select({ warehouseId: warehouses.id, farmId: warehouses.farmId })
      .from(storeSettings)
      .innerJoin(warehouses, eq(warehouses.id, storeSettings.salesWarehouseId))
      .innerJoin(farms, eq(farms.id, storeSettings.farmId))
      .where(and(this.sellingConditions(), this.servesRegion(region)))
      .orderBy(asc(farms.code), asc(farms.id))
      .for('share', { of: storeSettings });
  }

  /**
   * For each line, the item every candidate warehouse would ship it from, when
   * that warehouse alone has enough stock. Callers decide whether one warehouse
   * covers the whole cart.
   */
  async cartCoverage(
    tx: Transaction,
    region: StoreRegion,
    lines: { variantId: string; quantity: number }[],
  ) {
    const candidates = await this.salesWarehouses(tx, region);
    const coverage: {
      warehouse: SalesWarehouse;
      items: Map<string, string>;
    }[] = [];
    for (const warehouse of candidates) {
      const covered = new Map<string, string>();
      for (const line of lines) {
        const [row] = await tx
          .select({
            itemId: storeVariantItems.itemId,
            inStock: this.variantInStock(
              sql`${storeProductVariants.quantityStep} * ${line.quantity}::numeric`,
              eq(storeSettings.salesWarehouseId, warehouse.warehouseId),
            ).as('in_stock'),
          })
          .from(storeVariantItems)
          .innerJoin(
            storeProductVariants,
            eq(storeProductVariants.id, storeVariantItems.variantId),
          )
          .innerJoin(
            storeProducts,
            eq(storeProducts.id, storeProductVariants.productId),
          )
          .innerJoin(units, eq(units.id, storeProductVariants.unitId))
          .where(
            and(
              eq(storeVariantItems.variantId, line.variantId),
              eq(storeVariantItems.farmId, warehouse.farmId),
              this.orderableVariantConditions(),
            ),
          )
          .limit(1);
        if (row?.inStock) covered.set(line.variantId, row.itemId);
      }
      coverage.push({ warehouse, items: covered });
    }
    return coverage;
  }

  /**
   * Whether one warehouse of `region` can ship the whole cart, the label of
   * each line, and otherwise groups of lines that could each be one order.
   */
  async cartAvailability(
    region: StoreRegion,
    lines: { variantId: string; quantity: number }[],
  ) {
    return this.databaseService.db.transaction(async (tx) => {
      const coverage = await this.cartCoverage(tx, region, lines);
      const statuses = await Promise.all(
        lines.map(async ({ variantId, quantity }) => {
          const [flags] = await tx
            .select(this.availabilityFlags(region, quantity))
            .from(storeProductVariants)
            .innerJoin(
              storeProducts,
              eq(storeProducts.id, storeProductVariants.productId),
            )
            .innerJoin(units, eq(units.id, storeProductVariants.unitId))
            .where(
              and(
                eq(storeProductVariants.id, variantId),
                this.orderableVariantConditions(),
              ),
            );
          return {
            variantId,
            availability: flags
              ? this.toAvailability(flags, region).availability
              : ('OUT_OF_STOCK' as const),
          };
        }),
      );
      const canOrder = coverage.some(
        ({ items }) => items.size === lines.length,
      );

      return {
        canOrder,
        lines: statuses,
        groups: canOrder ? [] : this.splitGroups(coverage),
      };
    });
  }

  /**
   * Groups of variant ids that one warehouse could each ship as one order.
   * Greedy: the warehouse covering most remaining lines makes each group.
   */
  splitGroups(coverage: { items: Map<string, string> }[]) {
    const groups: string[][] = [];
    const remaining = new Set(
      coverage.flatMap(({ items }) => [...items.keys()]),
    );
    while (remaining.size > 0) {
      const best = coverage
        .map(({ items }) => [...items.keys()].filter((id) => remaining.has(id)))
        .reduce((a, b) => (b.length > a.length ? b : a));
      groups.push(best);
      for (const id of best) remaining.delete(id);
    }

    return groups;
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
    scope?: SQL,
  ) {
    return this.soldBy(
      and(
        scope,
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

  private servesRegion(region: StoreRegion) {
    return sql`${region}::store_region = ANY(${storeSettings.regions})`;
  }

  /**
   * Booleans of the current variant row that decide its availability label;
   * `aggregate` ORs them over the variants of a product.
   */
  private availabilityFlags(
    region?: StoreRegion,
    quantity = 1,
    aggregate = false,
  ) {
    const step = sql`${storeProductVariants.quantityStep}`;
    const inRegion = region && this.servesRegion(region);
    const flags: Record<keyof AvailabilityFlags, SQL> = {
      anywhere: this.variantInStock(),
      served: inRegion ? this.soldBy(inRegion) : sql`false`,
      regionStep: inRegion ? this.variantInStock(step, inRegion) : sql`false`,
      regionQty: inRegion
        ? this.variantInStock(sql`${step} * ${quantity}::numeric`, inRegion)
        : sql`false`,
    };
    return Object.fromEntries(
      Object.entries(flags).map(([key, flag]) => [
        key,
        sql<boolean>`${aggregate ? sql`BOOL_OR(${flag})` : flag}`.as(key),
      ]),
    ) as Record<keyof AvailabilityFlags, SQL.Aliased<boolean>>;
  }

  private toAvailability(
    { anywhere, served, regionStep, regionQty }: AvailabilityFlags,
    region?: StoreRegion,
  ): { inStock: boolean; availability: Availability } {
    if (!region)
      return {
        inStock: anywhere,
        availability: anywhere ? 'REGION_REQUIRED' : 'OUT_OF_STOCK',
      };
    const availability: Availability = regionQty
      ? 'AVAILABLE'
      : regionStep
        ? 'INSUFFICIENT_IN_REGION'
        : !served
          ? 'REGION_NOT_SUPPORTED'
          : anywhere
            ? 'OUT_IN_REGION'
            : 'OUT_OF_STOCK';
    return { inStock: regionStep, availability };
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

  /**
   * Stock of the `items` row in scope that a farm's sales warehouse can sell:
   * its own plus the farm's active source warehouses, which top it up by
   * transfer when an order is confirmed. Assets cannot be transferred that
   * way, so they count only in the sales warehouse.
   */
  private itemStock({ warehouseId, farmId }: StoreWarehouse, required: SQL) {
    const today = new Date().toISOString().slice(0, 10);
    const pool = sql`(b.warehouse_id = ${warehouseId} OR b.warehouse_id IN (
      SELECT ${storeSourceWarehouses.warehouseId}
      FROM ${storeSourceWarehouses}
      JOIN ${warehouses} sw ON sw.id = ${storeSourceWarehouses.warehouseId}
      WHERE ${storeSourceWarehouses.farmId} = ${farmId} AND sw.status = 'ACTIVE'
    ))`;

    return sql<boolean>`
    CASE ${items.trackingMode}
      WHEN 'QUANTITY' THEN (
        SELECT COALESCE(SUM(b.quantity_on_hand), 0)
               >= ${required}
        FROM ${inventoryBalances} b
        WHERE b.item_id = ${items.id}
          AND b.farm_id = ${farmId}
          AND ${pool}
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
          AND ${pool}
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
          AND ${activeMaintenanceCondition}
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

  /** What order creation accepts; needs store_products and units joined. */
  orderableVariantConditions() {
    return and(
      eq(storeProducts.status, 'PUBLISHED'),
      this.eligibleVariantConditions(),
    )!;
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
    region?: StoreRegion,
    quantity = 1,
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
          ...this.availabilityFlags(region, quantity, true),
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
      availability.map(({ productId, ...flags }) => [
        productId,
        this.toAvailability(flags, region),
      ]),
    );

    for (const id of productIds) {
      const image = imageByProduct.get(id);
      extras.set(id, {
        ...(stockByProduct.get(id) ?? this.toAvailability(NO_STOCK, region)),
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
      ...(extras ?? { inStock: false, availability: 'OUT_OF_STOCK' }),
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

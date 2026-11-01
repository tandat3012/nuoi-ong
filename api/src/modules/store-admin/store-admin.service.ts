import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { DatabaseService } from '../../db/database.service';
import {
  inventoryBalances,
  items,
  stockIssueItems,
  stockIssues,
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductStatus,
  storeProductVariants,
  storeOrders,
  storeSettings,
  storeSourceWarehouses,
  storeVariantItems,
  units,
  warehouses,
} from '../../db/schema';
import { UpdateStoreSettingsDto } from './dto/store-settings.dto';
import {
  CreateStoreCategoryDto,
  UpdateStoreCategoryDto,
} from './dto/store-category.dto';
import {
  CreateStoreProductDto,
  UpdateStoreProductDto,
} from './dto/store-product.dto';
import {
  CreateStoreVariantDto,
  UpdateStoreVariantDto,
} from './dto/store-variant.dto';

type StoreProductStatus = (typeof storeProductStatus.enumValues)[number];

export interface StoreProductListFilters extends PaginationParams {
  search?: string;
  status?: StoreProductStatus;
  categoryId?: string;
}

export const STORE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const STORE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const imageColumns = {
  id: storeProductImages.id,
  url: storeProductImages.url,
  alt: storeProductImages.alt,
  position: storeProductImages.position,
};

const variantColumns = {
  id: storeProductVariants.id,
  unitId: storeProductVariants.unitId,
  name: storeProductVariants.name,
  price: storeProductVariants.price,
  quantityStep: storeProductVariants.quantityStep,
  active: storeProductVariants.active,
};

@Injectable()
export class StoreAdminService {
  private readonly logger = new Logger(StoreAdminService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /** Online sales settings of one farm; null fields until the owner sets them up. */
  async getSettings(farmId: string) {
    const [settings] = await this.databaseService.db
      .select({
        salesEnabled: storeSettings.salesEnabled,
        regions: storeSettings.regions,
        salesWarehouse: {
          id: warehouses.id,
          code: warehouses.code,
          name: warehouses.name,
          status: warehouses.status,
        },
      })
      .from(storeSettings)
      .leftJoin(warehouses, eq(warehouses.id, storeSettings.salesWarehouseId))
      .where(eq(storeSettings.farmId, farmId))
      .limit(1);
    const sourceWarehouses = await this.databaseService.db
      .select({
        id: warehouses.id,
        code: warehouses.code,
        name: warehouses.name,
        status: warehouses.status,
      })
      .from(storeSourceWarehouses)
      .innerJoin(
        warehouses,
        eq(warehouses.id, storeSourceWarehouses.warehouseId),
      )
      .where(eq(storeSourceWarehouses.farmId, farmId))
      .orderBy(asc(warehouses.code));
    return {
      ...(settings ?? {
        salesEnabled: false,
        regions: [],
        salesWarehouse: null,
      }),
      sourceWarehouses,
    };
  }

  /**
   * Physical stock of every variant this farm sells, at its sales warehouse,
   * with what unapproved stock issues (e.g. confirmed orders) already hold.
   * shortcut: not paginated, one row per mapped variant; paginate if a farm maps hundreds.
   */
  async salesStock(farmId: string) {
    const settings = await this.getSettings(farmId);
    const warehouseId = settings.salesWarehouse?.id;
    if (!warehouseId) return { ...settings, rows: [] };

    const onHand = sql<string>`(
      SELECT COALESCE(SUM(${inventoryBalances.quantityOnHand}), 0)
      FROM ${inventoryBalances}
      WHERE ${inventoryBalances.itemId} = ${items.id}
        AND ${inventoryBalances.warehouseId} = ${warehouseId}
    )`;
    // Shown to staff only; source stock reaches customers by transfer.
    const sourceOnHand = sql<string>`(
      SELECT COALESCE(SUM(${inventoryBalances.quantityOnHand}), 0)
      FROM ${inventoryBalances}
      JOIN ${storeSourceWarehouses}
        ON ${storeSourceWarehouses.warehouseId} = ${inventoryBalances.warehouseId}
      JOIN ${warehouses} sw ON sw.id = ${inventoryBalances.warehouseId}
      WHERE ${inventoryBalances.itemId} = ${items.id}
        AND ${storeSourceWarehouses.farmId} = ${farmId}
        AND sw.status = 'ACTIVE'
        AND ${inventoryBalances.warehouseId} <> ${warehouseId}
    )`;
    const held = sql<string>`(
      SELECT COALESCE(SUM(${stockIssueItems.quantity}), 0)
      FROM ${stockIssueItems}
      JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
      WHERE ${stockIssueItems.itemId} = ${items.id}
        AND ${stockIssues.warehouseId} = ${warehouseId}
        AND ${stockIssues.status} IN ('DRAFT', 'PENDING_APPROVAL')
    )`;
    const rows = await this.databaseService.db
      .select({
        productId: storeProducts.id,
        productName: storeProducts.name,
        productStatus: storeProducts.status,
        variantId: storeProductVariants.id,
        variantName: storeProductVariants.name,
        variantActive: storeProductVariants.active,
        itemId: items.id,
        itemCode: items.code,
        itemName: items.name,
        itemStatus: items.status,
        unitSymbol: units.symbol,
        unitStatus: units.status,
        onHand: sql<string>`${onHand}::text`,
        held: sql<string>`${held}::text`,
        available: sql<string>`GREATEST(${onHand} - ${held}, 0)::text`,
        sourceOnHand: sql<string>`${sourceOnHand}::text`,
      })
      .from(storeVariantItems)
      .innerJoin(items, eq(items.id, storeVariantItems.itemId))
      .innerJoin(
        storeProductVariants,
        eq(storeProductVariants.id, storeVariantItems.variantId),
      )
      .innerJoin(
        storeProducts,
        eq(storeProducts.id, storeProductVariants.productId),
      )
      .innerJoin(units, eq(units.id, storeProductVariants.unitId))
      .where(eq(storeVariantItems.farmId, farmId))
      .orderBy(asc(storeProducts.name), asc(storeProductVariants.name));

    return {
      ...settings,
      rows: rows.map(({ unitStatus, ...row }) => ({
        ...row,
        // Mirrors CommerceService.eligibleVariantConditions().
        saleable:
          unitStatus === 'ACTIVE' &&
          settings.salesEnabled &&
          settings.salesWarehouse?.status === 'ACTIVE' &&
          row.productStatus === 'PUBLISHED' &&
          row.variantActive &&
          row.itemStatus === 'ACTIVE',
      })),
    };
  }

  async updateSettings(farmId: string, input: UpdateStoreSettingsDto) {
    await this.databaseService.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ salesWarehouseId: storeSettings.salesWarehouseId })
        .from(storeSettings)
        .where(eq(storeSettings.farmId, farmId))
        .for('update');
      if (input.salesWarehouseId) {
        const [warehouse] = await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(
            and(
              eq(warehouses.id, input.salesWarehouseId),
              eq(warehouses.farmId, farmId),
              eq(warehouses.status, 'ACTIVE'),
            ),
          )
          .limit(1);
        if (!warehouse)
          throw new BadRequestException(
            'Sales warehouse must be an active warehouse of this farm',
          );
      }
      const oldWarehouseId = current?.salesWarehouseId;
      if (oldWarehouseId && oldWarehouseId !== input.salesWarehouseId) {
        // Open orders hold or will hold stock in the old warehouse (spec §2.2).
        const [open] = await tx
          .select({ id: storeOrders.id })
          .from(storeOrders)
          .where(
            and(
              eq(storeOrders.warehouseId, oldWarehouseId),
              inArray(storeOrders.status, [
                'PENDING',
                'PREPARING',
                'CONFIRMED',
                'SHIPPING',
              ]),
            ),
          )
          .limit(1);
        if (open)
          throw new ConflictException({
            code: 'SALES_WAREHOUSE_IN_USE',
            message:
              'Kho bán hiện tại còn đơn chưa hoàn tất; xử lý xong mới được đổi kho.',
          });
      }
      const values = {
        salesWarehouseId: input.salesWarehouseId ?? null,
        salesEnabled: input.salesEnabled,
        regions: [...new Set(input.regions)],
        updatedAt: new Date().toISOString(),
      };
      await this.mapDatabaseError(
        tx
          .insert(storeSettings)
          .values({ farmId, ...values })
          .onConflictDoUpdate({ target: storeSettings.farmId, set: values }),
      );
      // A warehouse that becomes the sales warehouse stops being its own source.
      if (input.salesWarehouseId)
        await tx
          .delete(storeSourceWarehouses)
          .where(eq(storeSourceWarehouses.warehouseId, input.salesWarehouseId));
      const sources = input.sourceWarehouseIds;
      if (!sources) return;
      if (sources.includes(input.salesWarehouseId ?? ''))
        throw new BadRequestException(
          'The sales warehouse cannot also be a source warehouse',
        );
      if (sources.length > 0) {
        const valid = await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(
            and(
              inArray(warehouses.id, sources),
              eq(warehouses.farmId, farmId),
              eq(warehouses.status, 'ACTIVE'),
            ),
          );
        if (valid.length !== sources.length)
          throw new BadRequestException(
            'Source warehouses must be active warehouses of this farm',
          );
      }
      await tx
        .delete(storeSourceWarehouses)
        .where(eq(storeSourceWarehouses.farmId, farmId));
      if (sources.length > 0)
        await tx
          .insert(storeSourceWarehouses)
          .values(sources.map((warehouseId) => ({ warehouseId, farmId })));
    });
    return this.getSettings(farmId);
  }

  async listProducts(filters: StoreProductListFilters) {
    const conditions: SQL[] = [];
    if (filters.status)
      conditions.push(eq(storeProducts.status, filters.status));
    if (filters.categoryId) {
      conditions.push(eq(storeProducts.categoryId, filters.categoryId));
    }
    if (filters.search) {
      conditions.push(
        sql`strpos(lower(${storeProducts.name}), lower(${filters.search})) > 0`,
      );
    }
    const where = and(...conditions);
    const db = this.databaseService.db;

    const [data, [total]] = await Promise.all([
      db
        .select({
          id: storeProducts.id,
          name: storeProducts.name,
          slug: storeProducts.slug,
          status: storeProducts.status,
          category: { id: storeCategories.id, name: storeCategories.name },
          variantCount: sql<number>`(
            SELECT count(*)::int FROM ${storeProductVariants} v
            WHERE v.product_id = ${storeProducts.id}
          )`,
          imageUrl: sql<string | null>`(
            SELECT i.url FROM ${storeProductImages} i
            WHERE i.product_id = ${storeProducts.id}
            ORDER BY i.position LIMIT 1
          )`,
          updatedAt: storeProducts.updatedAt,
        })
        .from(storeProducts)
        .innerJoin(
          storeCategories,
          eq(storeCategories.id, storeProducts.categoryId),
        )
        .where(where)
        .orderBy(desc(storeProducts.updatedAt), asc(storeProducts.id))
        .limit(filters.pageSize)
        .offset(filters.offset),
      db.select({ value: count() }).from(storeProducts).where(where),
    ]);

    return {
      data,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems: total.value,
        totalPages: Math.ceil(total.value / filters.pageSize),
      },
    };
  }

  async getProduct(farmId: string, id: string) {
    const db = this.databaseService.db;
    const [product] = await db
      .select({
        id: storeProducts.id,
        categoryId: storeProducts.categoryId,
        name: storeProducts.name,
        slug: storeProducts.slug,
        description: storeProducts.description,
        status: storeProducts.status,
        createdAt: storeProducts.createdAt,
        updatedAt: storeProducts.updatedAt,
      })
      .from(storeProducts)
      .where(eq(storeProducts.id, id))
      .limit(1);

    if (!product) throw new NotFoundException('Store product not found');

    const [variants, images] = await Promise.all([
      db
        .select({
          ...variantColumns,
          // The item this farm sells for the variant; null until mapped.
          item: {
            id: items.id,
            code: items.code,
            name: items.name,
            trackingMode: items.trackingMode,
          },
          farmCount: sql<number>`(
            SELECT count(*)::int FROM ${storeVariantItems} m
            WHERE m.variant_id = ${storeProductVariants.id}
          )`,
          unit: { name: units.name, symbol: units.symbol },
        })
        .from(storeProductVariants)
        .innerJoin(units, eq(units.id, storeProductVariants.unitId))
        .leftJoin(
          storeVariantItems,
          and(
            eq(storeVariantItems.variantId, storeProductVariants.id),
            eq(storeVariantItems.farmId, farmId),
          ),
        )
        .leftJoin(items, eq(items.id, storeVariantItems.itemId))
        .where(eq(storeProductVariants.productId, id))
        .orderBy(
          asc(storeProductVariants.createdAt),
          asc(storeProductVariants.id),
        ),
      db
        .select(imageColumns)
        .from(storeProductImages)
        .where(eq(storeProductImages.productId, id))
        .orderBy(asc(storeProductImages.position)),
    ]);

    return { ...product, variants, images };
  }

  async createProduct(farmId: string, input: CreateStoreProductDto) {
    const [product] = await this.mapDatabaseError(
      this.databaseService.db
        .insert(storeProducts)
        .values(input)
        .returning({ id: storeProducts.id }),
    );
    return this.getProduct(farmId, product.id);
  }

  async updateProduct(
    farmId: string,
    id: string,
    input: UpdateStoreProductDto,
  ) {
    this.assertHasValue(input);
    const updated = await this.mapDatabaseError(
      this.databaseService.db
        .update(storeProducts)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(storeProducts.id, id))
        .returning({ id: storeProducts.id }),
    );
    if (updated.length === 0) {
      throw new NotFoundException('Store product not found');
    }
    return this.getProduct(farmId, id);
  }

  async updateProductStatus(
    farmId: string,
    id: string,
    status: StoreProductStatus,
  ) {
    await this.databaseService.db.transaction(async (transaction) => {
      const [product] = await transaction
        .select({ id: storeProducts.id })
        .from(storeProducts)
        .where(eq(storeProducts.id, id))
        .for('update');
      if (!product) throw new NotFoundException('Store product not found');

      if (status === 'PUBLISHED') {
        // Same eligibility as the public catalog in CommerceService, minus farm sales settings.
        const [eligible] = await transaction
          .select({ id: storeProductVariants.id })
          .from(storeProductVariants)
          .innerJoin(units, eq(units.id, storeProductVariants.unitId))
          .where(
            and(
              eq(storeProductVariants.productId, id),
              eq(storeProductVariants.active, true),
              eq(units.status, 'ACTIVE'),
              sql`EXISTS (
                SELECT 1 FROM ${storeVariantItems}
                JOIN ${items} ON ${items.id} = ${storeVariantItems.itemId}
                WHERE ${storeVariantItems.variantId} = ${storeProductVariants.id}
                  AND ${items.status} = 'ACTIVE'
              )`,
            ),
          )
          .limit(1);
        if (!eligible) {
          throw new BadRequestException(
            'Product needs at least one active variant with an active item before publishing',
          );
        }
      }

      await transaction
        .update(storeProducts)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(storeProducts.id, id));
    });
    return this.getProduct(farmId, id);
  }

  async createVariant(
    farmId: string,
    productId: string,
    input: CreateStoreVariantDto,
  ) {
    await this.requireProduct(productId);
    const [item] = await this.databaseService.db
      .select({ unitId: items.unitId })
      .from(items)
      .where(and(eq(items.id, input.itemId), eq(items.farmId, farmId)))
      .limit(1);
    if (!item) {
      throw new BadRequestException('Item does not exist in this farm');
    }

    // The first item fixes the variant's unit and becomes this farm's mapping.
    const { itemId, ...values } = input;
    return this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const [variant] = await tx
          .insert(storeProductVariants)
          .values({ ...values, productId, unitId: item.unitId })
          .returning(variantColumns);
        await tx
          .insert(storeVariantItems)
          .values({ variantId: variant.id, farmId, itemId });
        return variant;
      }),
    );
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateStoreVariantDto,
  ) {
    this.assertHasValue(input);
    const [variant] = await this.mapDatabaseError(
      this.databaseService.db
        .update(storeProductVariants)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(storeProductVariants.id, variantId),
            eq(storeProductVariants.productId, productId),
          ),
        )
        .returning(variantColumns),
    );
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  /** Sets which item of this farm fulfils the variant. */
  async setVariantItem(
    farmId: string,
    productId: string,
    variantId: string,
    itemId: string,
  ) {
    const [variant] = await this.databaseService.db
      .select({ unitId: storeProductVariants.unitId })
      .from(storeProductVariants)
      .where(
        and(
          eq(storeProductVariants.id, variantId),
          eq(storeProductVariants.productId, productId),
        ),
      )
      .limit(1);
    if (!variant) throw new NotFoundException('Variant not found');
    const [item] = await this.databaseService.db
      .select({ unitId: items.unitId })
      .from(items)
      .where(
        and(
          eq(items.id, itemId),
          eq(items.farmId, farmId),
          eq(items.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!item)
      throw new BadRequestException('Item is not an active item of this farm');
    // The variant price is per unit, so every farm must sell it in that unit.
    if (item.unitId !== variant.unitId)
      throw new BadRequestException(
        'Item unit must match the unit of the variant',
      );
    const now = new Date().toISOString();
    await this.mapDatabaseError(
      this.databaseService.db
        .insert(storeVariantItems)
        .values({ variantId, farmId, itemId })
        .onConflictDoUpdate({
          target: [storeVariantItems.variantId, storeVariantItems.farmId],
          set: { itemId, updatedAt: now },
        }),
    );
    return this.getProduct(farmId, productId);
  }

  /** Stops this farm from supplying the variant; other farms keep selling it. */
  async removeVariantItem(
    farmId: string,
    productId: string,
    variantId: string,
  ) {
    const removed = await this.databaseService.db
      .delete(storeVariantItems)
      .where(
        and(
          eq(storeVariantItems.variantId, variantId),
          eq(storeVariantItems.farmId, farmId),
          sql`EXISTS (
            SELECT 1 FROM ${storeProductVariants}
            WHERE ${storeProductVariants.id} = ${variantId}
              AND ${storeProductVariants.productId} = ${productId}
          )`,
        ),
      )
      .returning({ variantId: storeVariantItems.variantId });
    if (removed.length === 0)
      throw new NotFoundException('Variant is not mapped for this farm');
  }

  async addImage(
    productId: string,
    file: Express.Multer.File | undefined,
    alt = '',
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!STORE_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('file must be a JPEG, PNG or WebP image');
    }
    if (alt.length > 500) {
      throw new BadRequestException('alt must be at most 500 characters');
    }
    await this.requireProduct(productId);

    // Cloudinary re-checks the real content: the client MIME type is untrusted.
    const uploaded = await this.cloudinaryService.uploadFile(file.buffer, {
      folder: 'nuoi-ong/products',
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'webp'],
      // Store a capped WebP instead of the original phone photo.
      transformation: [
        { width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' },
      ],
      format: 'webp',
    });

    try {
      const [image] = await this.mapDatabaseError(
        this.databaseService.db
          .insert(storeProductImages)
          .values({
            productId,
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            alt: alt.trim(),
            position: sql`(
              SELECT COALESCE(MAX(position) + 1, 0)
              FROM ${storeProductImages}
              WHERE product_id = ${productId}
            )`,
          })
          .returning(imageColumns),
      );
      return image;
    } catch (error) {
      await this.deleteRemoteImage(uploaded.public_id);
      throw error;
    }
  }

  async updateImage(productId: string, imageId: string, alt: string) {
    const [image] = await this.databaseService.db
      .update(storeProductImages)
      .set({ alt, updatedAt: new Date().toISOString() })
      .where(this.imageCondition(productId, imageId))
      .returning(imageColumns);
    if (!image) throw new NotFoundException('Image not found');
    return image;
  }

  async reorderImages(productId: string, imageIds: string[]) {
    return this.databaseService.db.transaction(async (transaction) => {
      const current = await transaction
        .select({
          id: storeProductImages.id,
          position: storeProductImages.position,
        })
        .from(storeProductImages)
        .where(eq(storeProductImages.productId, productId))
        .for('update');

      const currentIds = new Set(current.map((image) => image.id));
      if (
        imageIds.length !== currentIds.size ||
        imageIds.some((id) => !currentIds.has(id))
      ) {
        throw new BadRequestException(
          'imageIds must list every image of the product exactly once',
        );
      }

      // Move out of the way first: (product_id, position) is unique and must stay >= 0.
      const offset = Math.max(-1, ...current.map((i) => i.position)) + 1;
      await transaction
        .update(storeProductImages)
        .set({ position: sql`${storeProductImages.position} + ${offset}` })
        .where(eq(storeProductImages.productId, productId));

      const now = new Date().toISOString();
      for (const [position, id] of imageIds.entries()) {
        await transaction
          .update(storeProductImages)
          .set({ position, updatedAt: now })
          .where(eq(storeProductImages.id, id));
      }

      return transaction
        .select(imageColumns)
        .from(storeProductImages)
        .where(eq(storeProductImages.productId, productId))
        .orderBy(asc(storeProductImages.position));
    });
  }

  async deleteImage(productId: string, imageId: string) {
    const [deleted] = await this.databaseService.db
      .delete(storeProductImages)
      .where(this.imageCondition(productId, imageId))
      .returning({ publicId: storeProductImages.publicId });
    if (!deleted) throw new NotFoundException('Image not found');
    // The row is gone either way; a failed remote delete only leaves an orphan file.
    if (deleted.publicId) await this.deleteRemoteImage(deleted.publicId);
  }

  /** Item picker for variants: display fields only, no cost, location or stock history. */
  async lookupItems(farmId: string, search?: string) {
    const conditions = [eq(items.farmId, farmId), eq(items.status, 'ACTIVE')];
    if (search)
      conditions.push(
        or(ilike(items.code, `%${search}%`), ilike(items.name, `%${search}%`))!,
      );
    const rows = await this.databaseService.db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        trackingMode: items.trackingMode,
        unitName: units.name,
        unitSymbol: units.symbol,
      })
      .from(items)
      .innerJoin(units, eq(units.id, items.unitId))
      .where(and(...conditions))
      .orderBy(asc(items.name), asc(items.id))
      .limit(20);
    return {
      data: rows.map(({ unitName, unitSymbol, ...item }) => ({
        item,
        unitName,
        unitSymbol,
      })),
    };
  }

  async listCategories() {
    const data = await this.databaseService.db
      .select({
        id: storeCategories.id,
        name: storeCategories.name,
        slug: storeCategories.slug,
      })
      .from(storeCategories)
      .orderBy(asc(storeCategories.name), asc(storeCategories.id));
    return { data };
  }

  async createCategory(input: CreateStoreCategoryDto) {
    const [category] = await this.mapDatabaseError(
      this.databaseService.db.insert(storeCategories).values(input).returning({
        id: storeCategories.id,
        name: storeCategories.name,
        slug: storeCategories.slug,
      }),
    );
    return category;
  }

  async updateCategory(id: string, input: UpdateStoreCategoryDto) {
    this.assertHasValue(input);
    const [category] = await this.mapDatabaseError(
      this.databaseService.db
        .update(storeCategories)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(storeCategories.id, id))
        .returning({
          id: storeCategories.id,
          name: storeCategories.name,
          slug: storeCategories.slug,
        }),
    );
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async requireProduct(id: string) {
    const [product] = await this.databaseService.db
      .select({ id: storeProducts.id })
      .from(storeProducts)
      .where(eq(storeProducts.id, id))
      .limit(1);
    if (!product) throw new NotFoundException('Store product not found');
  }

  private imageCondition(productId: string, imageId: string) {
    return and(
      eq(storeProductImages.id, imageId),
      eq(storeProductImages.productId, productId),
    );
  }

  private async deleteRemoteImage(publicId: string) {
    try {
      await this.cloudinaryService.deleteFile(publicId, 'image');
    } catch (error) {
      this.logger.warn(`Orphan Cloudinary image ${publicId}`, error);
    }
  }

  private assertHasValue(input: object) {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }
  }

  private async mapDatabaseError<T>(query: PromiseLike<T>): Promise<T> {
    try {
      return await query;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const databaseError = this.unwrapDatabaseError(error);
      if (databaseError?.code === '23505') {
        throw new ConflictException({
          code: 'DUPLICATE_STORE_DATA',
          message: 'Slug, item or image position already exists',
          constraint: databaseError.constraint,
        });
      }
      if (
        databaseError?.code === '23503' ||
        databaseError?.code === '23514' ||
        databaseError?.code === 'P0001'
      ) {
        throw new BadRequestException({
          code: 'INVALID_STORE_DATA',
          message: databaseError.message ?? 'Store data is invalid',
          constraint: databaseError.constraint,
        });
      }
      throw error;
    }
  }

  private unwrapDatabaseError(
    error: unknown,
  ): { code?: string; constraint?: string; message?: string } | undefined {
    let current: unknown = error;
    while (current && typeof current === 'object') {
      const candidate = current as {
        code?: string;
        constraint?: string;
        message?: string;
        cause?: unknown;
      };
      if (candidate.code) return candidate;
      current = candidate.cause;
    }
    return undefined;
  }
}

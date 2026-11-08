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
  auditLogs,
  inventoryBalances,
  items,
  stockIssueItems,
  stockIssues,
  stockTransferItems,
  stockTransfers,
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductStatus,
  storeProductVariants,
  storeOrders,
  storeRegion,
  storeSettings,
  storeShippingFees,
  storeVariantItems,
  units,
  warehouses,
} from '../../db/schema';
import {
  UpdateStoreSettingsDto,
  UpdateStoreShippingFeesDto,
} from './dto/store-settings.dto';
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
type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];
/** NV10-F01: who changes the store and from which farm; the controller always passes it. */
export type StoreActor = { farmId: string; clerkUserId: string };

export interface StoreProductListFilters extends PaginationParams {
  search?: string;
  status?: StoreProductStatus;
  categoryId?: string;
}

export const STORE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const STORE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** True when the bytes are a JPEG, PNG or WebP file, whatever MIME type the client sent. */
export function isStoreImage(file: Buffer) {
  const head = file.toString('latin1', 0, 12);
  return (
    head.startsWith('\xff\xd8\xff') ||
    head.startsWith('\x89PNG\r\n\x1a\n') ||
    (head.startsWith('RIFF') && head.slice(8) === 'WEBP')
  );
}

const imageColumns = {
  id: storeProductImages.id,
  url: storeProductImages.url,
  alt: storeProductImages.alt,
  position: storeProductImages.position,
};

const categoryColumns = {
  id: storeCategories.id,
  name: storeCategories.name,
  slug: storeCategories.slug,
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

  /**
   * Replaces the store-wide delivery fees; placed orders keep the fee they were
   * created with. The change is audited on the farm the admin acted from.
   */
  async updateShippingFees(
    farmId: string,
    clerkUserId: string,
    input: UpdateStoreShippingFeesDto,
  ) {
    return this.databaseService.db.transaction(async (tx) => {
      const fees = (rows: { region: string; fee: string }[]) =>
        Object.fromEntries(rows.map(({ region, fee }) => [region, fee]));
      // Row locks miss regions without a row yet; a table lock serialises saves
      // (checkout's plain reads still go through) so the audit's old fees are right.
      await tx.execute(
        sql`LOCK TABLE ${storeShippingFees} IN SHARE ROW EXCLUSIVE MODE`,
      );
      const before = fees(
        await tx
          .select({
            region: storeShippingFees.region,
            fee: storeShippingFees.fee,
          })
          .from(storeShippingFees),
      );
      const updatedAt = new Date().toISOString();
      const after = fees(
        await tx
          .insert(storeShippingFees)
          .values(
            storeRegion.enumValues.map((region) => ({
              region,
              fee: input[region],
              updatedAt,
            })),
          )
          .onConflictDoUpdate({
            target: storeShippingFees.region,
            set: { fee: sql`excluded.fee`, updatedAt },
          })
          .returning({
            region: storeShippingFees.region,
            fee: storeShippingFees.fee,
          }),
      );
      await tx.insert(auditLogs).values({
        farmId,
        userId: sql`(SELECT id FROM users WHERE auth_provider_user_id = ${clerkUserId})`,
        action: 'SHIPPING_FEES_UPDATED',
        entityType: 'STORE_SHIPPING_FEES',
        oldData: before,
        newData: after,
      });
      return after;
    });
  }

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
    return (
      settings ?? {
        salesEnabled: false,
        regions: [],
        salesWarehouse: null,
      }
    );
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
    // Unapproved issues and outgoing transfers, as order confirmation counts them.
    const held = sql<string>`((
      SELECT COALESCE(SUM(${stockIssueItems.quantity}), 0)
      FROM ${stockIssueItems}
      JOIN ${stockIssues} ON ${stockIssues.id} = ${stockIssueItems.stockIssueId}
      WHERE ${stockIssueItems.itemId} = ${items.id}
        AND ${stockIssues.warehouseId} = ${warehouseId}
        AND ${stockIssues.status} IN ('DRAFT', 'PENDING_APPROVAL')
    ) + (
      SELECT COALESCE(SUM(${stockTransferItems.quantity}), 0)
      FROM ${stockTransferItems}
      JOIN ${stockTransfers} ON ${stockTransfers.id} = ${stockTransferItems.stockTransferId}
      WHERE ${stockTransferItems.itemId} = ${items.id}
        AND ${stockTransfers.fromWarehouseId} = ${warehouseId}
        AND ${stockTransfers.status} IN ('DRAFT', 'PENDING_APPROVAL')
    ))`;
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

  async updateSettings(
    farmId: string,
    input: UpdateStoreSettingsDto,
    actor?: StoreActor,
  ) {
    await this.databaseService.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          salesWarehouseId: storeSettings.salesWarehouseId,
          salesEnabled: storeSettings.salesEnabled,
          regions: storeSettings.regions,
        })
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
      await this.audit(
        tx,
        actor,
        'STORE_SETTINGS_UPDATED',
        'STORE_SETTINGS',
        farmId,
        current ?? null,
        {
          salesWarehouseId: values.salesWarehouseId,
          salesEnabled: values.salesEnabled,
          regions: values.regions,
        },
      );
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

  async createProduct(
    farmId: string,
    input: CreateStoreProductDto,
    actor?: StoreActor,
  ) {
    const product = await this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(storeProducts)
          .values(input)
          .returning();
        await this.audit(
          tx,
          actor,
          'PRODUCT_CREATED',
          'STORE_PRODUCT',
          created.id,
          null,
          created,
        );
        return created;
      }),
    );
    return this.getProduct(farmId, product.id);
  }

  async updateProduct(
    farmId: string,
    id: string,
    input: UpdateStoreProductDto,
    actor?: StoreActor,
  ) {
    this.assertHasValue(input);
    await this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(storeProducts)
          .where(eq(storeProducts.id, id))
          .for('update');
        if (!before) throw new NotFoundException('Store product not found');
        const [after] = await tx
          .update(storeProducts)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(eq(storeProducts.id, id))
          .returning();
        await this.audit(
          tx,
          actor,
          'PRODUCT_UPDATED',
          'STORE_PRODUCT',
          id,
          before,
          after,
        );
      }),
    );
    return this.getProduct(farmId, id);
  }

  async updateProductStatus(
    farmId: string,
    id: string,
    status: StoreProductStatus,
    actor?: StoreActor,
  ) {
    await this.databaseService.db.transaction(async (transaction) => {
      const [product] = await transaction
        .select({ id: storeProducts.id, status: storeProducts.status })
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
      if (product.status !== status)
        await this.audit(
          transaction,
          actor,
          'PRODUCT_STATUS_CHANGED',
          'STORE_PRODUCT',
          id,
          { status: product.status },
          { status },
        );
    });
    return this.getProduct(farmId, id);
  }

  async createVariant(
    farmId: string,
    productId: string,
    input: CreateStoreVariantDto,
    actor?: StoreActor,
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
        await this.audit(
          tx,
          actor,
          'VARIANT_CREATED',
          'STORE_PRODUCT',
          productId,
          null,
          {
            ...variant,
            variantId: variant.id,
            // The first mapping belongs to this farm only.
            farmItem: { farmId, itemId },
          },
        );
        return variant;
      }),
    );
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateStoreVariantDto,
    actor?: StoreActor,
  ) {
    this.assertHasValue(input);
    return this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const condition = and(
          eq(storeProductVariants.id, variantId),
          eq(storeProductVariants.productId, productId),
        );
        const [before] = await tx
          .select(variantColumns)
          .from(storeProductVariants)
          .where(condition)
          .for('update');
        if (!before) throw new NotFoundException('Variant not found');
        // Placed orders keep their own price snapshot; only new orders see the change.
        const [variant] = await tx
          .update(storeProductVariants)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(condition)
          .returning(variantColumns);
        await this.audit(
          tx,
          actor,
          before.price !== variant.price
            ? 'VARIANT_PRICE_CHANGED'
            : 'VARIANT_UPDATED',
          'STORE_PRODUCT',
          productId,
          { ...before, variantId },
          { ...variant, variantId },
        );
        return variant;
      }),
    );
  }

  /** Sets which item of this farm fulfils the variant. */
  async setVariantItem(
    farmId: string,
    productId: string,
    variantId: string,
    itemId: string,
    actor?: StoreActor,
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
      this.databaseService.db.transaction(async (tx) => {
        const [before] = await tx
          .select({ itemId: storeVariantItems.itemId })
          .from(storeVariantItems)
          .where(
            and(
              eq(storeVariantItems.variantId, variantId),
              eq(storeVariantItems.farmId, farmId),
            ),
          )
          .for('update');
        await tx
          .insert(storeVariantItems)
          .values({ variantId, farmId, itemId })
          .onConflictDoUpdate({
            target: [storeVariantItems.variantId, storeVariantItems.farmId],
            set: { itemId, updatedAt: now },
          });
        if (before?.itemId !== itemId)
          await this.audit(
            tx,
            actor,
            'VARIANT_ITEM_SET',
            'STORE_PRODUCT',
            productId,
            before ? { variantId, farmId, itemId: before.itemId } : null,
            { variantId, farmId, itemId },
          );
      }),
    );
    return this.getProduct(farmId, productId);
  }

  /** Stops this farm from supplying the variant; other farms keep selling it. */
  async removeVariantItem(
    farmId: string,
    productId: string,
    variantId: string,
    actor?: StoreActor,
  ) {
    await this.databaseService.db.transaction(async (tx) => {
      const removed = await tx
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
        .returning({ itemId: storeVariantItems.itemId });
      if (removed.length === 0)
        throw new NotFoundException('Variant is not mapped for this farm');
      await this.audit(
        tx,
        actor,
        'VARIANT_ITEM_REMOVED',
        'STORE_PRODUCT',
        productId,
        { variantId, farmId, itemId: removed[0].itemId },
        null,
      );
    });
  }

  async addImage(
    productId: string,
    file: Express.Multer.File | undefined,
    alt = '',
    actor?: StoreActor,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (
      !STORE_IMAGE_TYPES.includes(file.mimetype) ||
      !isStoreImage(file.buffer)
    ) {
      throw new BadRequestException('file must be a JPEG, PNG or WebP image');
    }
    if (alt.length > 500) {
      throw new BadRequestException('alt must be at most 500 characters');
    }
    await this.requireProduct(productId);

    const uploaded = await this.cloudinaryService.uploadFile(file.buffer, {
      folder: 'nuoi-ong/products',
      resource_type: 'image',
      // No allowed_formats: Cloudinary then skips `format` for allowed inputs
      // and keeps PNGs as PNG. The format is checked above instead.
      // Store a capped WebP instead of the original phone photo.
      transformation: [
        { width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' },
      ],
      format: 'webp',
    });

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const [image] = await this.mapDatabaseError(
          tx
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
        await this.audit(
          tx,
          actor,
          'IMAGE_ADDED',
          'STORE_PRODUCT',
          productId,
          null,
          this.imageAudit(image),
        );
        return image;
      });
    } catch (error) {
      await this.deleteRemoteImage(uploaded.public_id);
      throw error;
    }
  }

  async updateImage(
    productId: string,
    imageId: string,
    alt: string,
    actor?: StoreActor,
  ) {
    return this.databaseService.db.transaction(async (tx) => {
      const [before] = await tx
        .select(imageColumns)
        .from(storeProductImages)
        .where(this.imageCondition(productId, imageId))
        .for('update');
      if (!before) throw new NotFoundException('Image not found');
      const [image] = await tx
        .update(storeProductImages)
        .set({ alt, updatedAt: new Date().toISOString() })
        .where(this.imageCondition(productId, imageId))
        .returning(imageColumns);
      await this.audit(
        tx,
        actor,
        'IMAGE_UPDATED',
        'STORE_PRODUCT',
        productId,
        this.imageAudit(before),
        this.imageAudit(image),
      );
      return image;
    });
  }

  async reorderImages(
    productId: string,
    imageIds: string[],
    actor?: StoreActor,
  ) {
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

      const before = [...current]
        .sort((a, b) => a.position - b.position)
        .map((image) => image.id);
      if (before.join() !== imageIds.join())
        await this.audit(
          transaction,
          actor,
          'IMAGES_REORDERED',
          'STORE_PRODUCT',
          productId,
          { imageIds: before },
          { imageIds },
        );
      return transaction
        .select(imageColumns)
        .from(storeProductImages)
        .where(eq(storeProductImages.productId, productId))
        .orderBy(asc(storeProductImages.position));
    });
  }

  async deleteImage(productId: string, imageId: string, actor?: StoreActor) {
    const deleted = await this.databaseService.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(storeProductImages)
        .where(this.imageCondition(productId, imageId))
        .returning({ ...imageColumns, publicId: storeProductImages.publicId });
      if (!row) throw new NotFoundException('Image not found');
      await this.audit(
        tx,
        actor,
        'IMAGE_DELETED',
        'STORE_PRODUCT',
        productId,
        this.imageAudit(row),
        null,
      );
      return row;
    });
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

  async createCategory(input: CreateStoreCategoryDto, actor?: StoreActor) {
    return this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const [category] = await tx
          .insert(storeCategories)
          .values(input)
          .returning(categoryColumns);
        await this.audit(
          tx,
          actor,
          'CATEGORY_CREATED',
          'STORE_CATEGORY',
          category.id,
          null,
          category,
        );
        return category;
      }),
    );
  }

  async updateCategory(
    id: string,
    input: UpdateStoreCategoryDto,
    actor?: StoreActor,
  ) {
    this.assertHasValue(input);
    return this.mapDatabaseError(
      this.databaseService.db.transaction(async (tx) => {
        const [before] = await tx
          .select(categoryColumns)
          .from(storeCategories)
          .where(eq(storeCategories.id, id))
          .for('update');
        if (!before) throw new NotFoundException('Category not found');
        const [category] = await tx
          .update(storeCategories)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(eq(storeCategories.id, id))
          .returning(categoryColumns);
        await this.audit(
          tx,
          actor,
          'CATEGORY_UPDATED',
          'STORE_CATEGORY',
          id,
          before,
          category,
        );
        return category;
      }),
    );
  }

  /** NV10-F01: one audit row per catalog or sales-settings change, in its transaction. */
  private async audit(
    tx: Transaction,
    actor: StoreActor | undefined,
    action: string,
    entityType: 'STORE_PRODUCT' | 'STORE_CATEGORY' | 'STORE_SETTINGS',
    entityId: string,
    before: object | null,
    after: object | null,
  ) {
    await tx.insert(auditLogs).values({
      farmId: actor?.farmId ?? null,
      userId: actor
        ? sql`(SELECT id FROM users WHERE auth_provider_user_id = ${actor.clerkUserId})`
        : null,
      action,
      entityType,
      entityId,
      oldData: before,
      newData: after,
    });
  }

  /** Image audit data without the file URL or storage id. */
  private imageAudit(image: { id: string; alt: string; position: number }) {
    return { imageId: image.id, alt: image.alt, position: image.position };
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, sql, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { DatabaseService } from '../../db/database.service';
import {
  items,
  storeCategories,
  storeProductImages,
  storeProducts,
  storeProductStatus,
  storeProductVariants,
  storeSettings,
  units,
  warehouses,
} from '../../db/schema';
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
  itemId: storeProductVariants.itemId,
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

  /** Store data has no farm column; it belongs to the farm of the selling warehouse. */
  async assertStoreFarm(farmId: string): Promise<void> {
    const [store] = await this.databaseService.db
      .select({ farmId: warehouses.farmId })
      .from(storeSettings)
      .innerJoin(warehouses, eq(warehouses.id, storeSettings.warehouseId))
      .where(eq(storeSettings.id, 1))
      .limit(1);

    if (!store) {
      throw new ServiceUnavailableException(
        'Store warehouse is not configured',
      );
    }
    if (store.farmId !== farmId) {
      throw new ForbiddenException('Store belongs to another farm');
    }
  }

  async listProducts(farmId: string, filters: StoreProductListFilters) {
    await this.assertStoreFarm(farmId);
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
    await this.assertStoreFarm(farmId);
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
          item: {
            code: items.code,
            name: items.name,
            trackingMode: items.trackingMode,
          },
          unit: { name: units.name, symbol: units.symbol },
        })
        .from(storeProductVariants)
        .innerJoin(items, eq(items.id, storeProductVariants.itemId))
        .innerJoin(units, eq(units.id, items.unitId))
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
    await this.assertStoreFarm(farmId);
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
    await this.assertStoreFarm(farmId);
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
    await this.assertStoreFarm(farmId);
    await this.databaseService.db.transaction(async (transaction) => {
      const [product] = await transaction
        .select({ id: storeProducts.id })
        .from(storeProducts)
        .where(eq(storeProducts.id, id))
        .for('update');
      if (!product) throw new NotFoundException('Store product not found');

      if (status === 'PUBLISHED') {
        // Same eligibility as the public catalog in CommerceService.
        const [eligible] = await transaction
          .select({ id: storeProductVariants.id })
          .from(storeProductVariants)
          .innerJoin(items, eq(items.id, storeProductVariants.itemId))
          .innerJoin(units, eq(units.id, items.unitId))
          .where(
            and(
              eq(storeProductVariants.productId, id),
              eq(storeProductVariants.active, true),
              eq(items.farmId, farmId),
              eq(items.status, 'ACTIVE'),
              eq(units.status, 'ACTIVE'),
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
    await this.assertStoreFarm(farmId);
    await this.requireProduct(productId);
    const [item] = await this.databaseService.db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, input.itemId), eq(items.farmId, farmId)))
      .limit(1);
    if (!item) {
      throw new BadRequestException('Item does not exist in the store farm');
    }

    const [variant] = await this.mapDatabaseError(
      this.databaseService.db
        .insert(storeProductVariants)
        .values({ ...input, productId })
        .returning(variantColumns),
    );
    return variant;
  }

  async updateVariant(
    farmId: string,
    productId: string,
    variantId: string,
    input: UpdateStoreVariantDto,
  ) {
    this.assertHasValue(input);
    await this.assertStoreFarm(farmId);
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

  async addImage(
    farmId: string,
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
    await this.assertStoreFarm(farmId);
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

  async updateImage(
    farmId: string,
    productId: string,
    imageId: string,
    alt: string,
  ) {
    await this.assertStoreFarm(farmId);
    const [image] = await this.databaseService.db
      .update(storeProductImages)
      .set({ alt, updatedAt: new Date().toISOString() })
      .where(this.imageCondition(productId, imageId))
      .returning(imageColumns);
    if (!image) throw new NotFoundException('Image not found');
    return image;
  }

  async reorderImages(farmId: string, productId: string, imageIds: string[]) {
    await this.assertStoreFarm(farmId);
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

  async deleteImage(farmId: string, productId: string, imageId: string) {
    await this.assertStoreFarm(farmId);
    const [deleted] = await this.databaseService.db
      .delete(storeProductImages)
      .where(this.imageCondition(productId, imageId))
      .returning({ publicId: storeProductImages.publicId });
    if (!deleted) throw new NotFoundException('Image not found');
    // The row is gone either way; a failed remote delete only leaves an orphan file.
    if (deleted.publicId) await this.deleteRemoteImage(deleted.publicId);
  }

  async listCategories(farmId: string) {
    await this.assertStoreFarm(farmId);
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

  async createCategory(farmId: string, input: CreateStoreCategoryDto) {
    await this.assertStoreFarm(farmId);
    const [category] = await this.mapDatabaseError(
      this.databaseService.db.insert(storeCategories).values(input).returning({
        id: storeCategories.id,
        name: storeCategories.name,
        slug: storeCategories.slug,
      }),
    );
    return category;
  }

  async updateCategory(
    farmId: string,
    id: string,
    input: UpdateStoreCategoryDto,
  ) {
    this.assertHasValue(input);
    await this.assertStoreFarm(farmId);
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

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { CommerceService } from '../src/modules/commerce/commerce.service';
import { StoreAdminService } from '../src/modules/store-admin/store-admin.service';

type Db = NodePgDatabase<typeof schema>;

describe('Store admin (migrated PostgreSQL)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const db = drizzle({ client: pool, schema });
  const ROLLBACK = new Error('rollback');
  const ids = {
    farm: randomUUID(),
    otherFarm: randomUUID(),
    warehouse: randomUUID(),
    category: randomUUID(),
    unit: randomUUID(),
    item: randomUUID(),
    foreignItem: randomUUID(),
    storeCategory: randomUUID(),
  };
  const cloudinary = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };
  const file = (mimetype = 'image/png') =>
    ({ buffer: Buffer.from('png'), mimetype }) as Express.Multer.File;

  const service = (tx: Db) =>
    new StoreAdminService(
      { db: tx } as unknown as DatabaseService,
      cloudinary as unknown as CloudinaryService,
    );

  // Each test runs in one transaction that is always rolled back; the service's
  // own transactions become savepoints.
  const inRollback = (fn: (tx: Db) => Promise<void>) =>
    expect(
      db.transaction(async (tx) => {
        await seed(tx);
        await fn(tx);
        throw ROLLBACK;
      }),
    ).rejects.toBe(ROLLBACK);

  // Expected database errors abort the transaction, so isolate them in a savepoint.
  const inSavepoint = <T>(tx: Db, fn: (sp: Db) => Promise<T>) =>
    tx.transaction((sp) => fn(sp as unknown as Db));

  async function seed(tx: Db) {
    await tx.insert(schema.farms).values([
      { id: ids.farm, code: ids.farm, name: 'Store admin test' },
      { id: ids.otherFarm, code: ids.otherFarm, name: 'Other farm' },
    ]);
    await tx.insert(schema.warehouses).values({
      id: ids.warehouse,
      farmId: ids.farm,
      code: 'SALES',
      name: 'Sales',
    });
    await tx.insert(schema.categories).values({
      id: ids.category,
      code: ids.category,
      name: 'Internal',
    });
    await tx.insert(schema.units).values({
      id: ids.unit,
      code: `SA-${ids.unit.slice(0, 8)}`,
      name: 'Unit',
      symbol: 'u',
    });
    await tx.insert(schema.items).values(
      [
        [ids.item, ids.farm],
        [ids.foreignItem, ids.otherFarm],
      ].map(([id, farmId]) => ({
        id,
        farmId,
        categoryId: ids.category,
        unitId: ids.unit,
        code: id,
        name: 'Mật ong',
        itemType: 'MATERIAL' as const,
        trackingMode: 'QUANTITY' as const,
      })),
    );
    await tx.insert(schema.storeCategories).values({
      id: ids.storeCategory,
      name: 'Store admin test',
      slug: ids.storeCategory,
    });
    await tx
      .insert(schema.storeSettings)
      .values({ id: 1, warehouseId: ids.warehouse })
      .onConflictDoUpdate({
        target: schema.storeSettings.id,
        set: { warehouseId: ids.warehouse },
      });
  }

  const createProduct = (tx: Db, slug = `sp-${ids.farm.slice(0, 8)}`) =>
    service(tx).createProduct(ids.farm, {
      categoryId: ids.storeCategory,
      name: 'Mật ong hoa nhãn',
      slug,
    });

  beforeAll(() => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  });

  beforeEach(() => {
    jest.resetAllMocks();
    let upload = 0;
    cloudinary.uploadFile.mockImplementation(() => {
      upload++;
      return Promise.resolve({
        secure_url: `https://res.cloudinary.com/demo/image/upload/p${upload}.png`,
        public_id: `nuoi-ong/products/p${upload}`,
      });
    });
    cloudinary.deleteFile.mockResolvedValue({ result: 'ok' });
  });

  afterAll(() => pool.end());

  it('rejects farms that do not own the store warehouse', () =>
    inRollback(async (tx) => {
      await expect(
        service(tx).listProducts(ids.otherFarm, {
          page: 1,
          pageSize: 20,
          offset: 0,
        }),
      ).rejects.toMatchObject({ status: 403 });
    }));

  it('creates, validates variants and publishes a product', () =>
    inRollback(async (tx) => {
      const product = await createProduct(tx);
      expect(product).toMatchObject({ status: 'DRAFT', variants: [] });

      await expect(
        service(tx).updateProductStatus(ids.farm, product.id, 'PUBLISHED'),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service(tx).createVariant(ids.farm, product.id, {
          itemId: ids.foreignItem,
          name: 'Chai',
          price: '1000',
        }),
      ).rejects.toMatchObject({ status: 400 });

      const variant = await service(tx).createVariant(ids.farm, product.id, {
        itemId: ids.item,
        name: 'Chai 500ml',
        price: '150000',
        quantityStep: '1',
      });
      expect(variant).toMatchObject({ price: '150000', active: true });
      await expect(
        inSavepoint(tx, (sp) =>
          service(sp).createVariant(ids.farm, product.id, {
            itemId: ids.item,
            name: 'Trùng item',
            price: '1',
          }),
        ),
      ).rejects.toMatchObject({ status: 409 });

      const published = await service(tx).updateProductStatus(
        ids.farm,
        product.id,
        'PUBLISHED',
      );
      expect(published.status).toBe('PUBLISHED');

      await expect(
        inSavepoint(tx, (sp) => createProduct(sp)),
      ).rejects.toMatchObject({ status: 409 });
    }));

  it('uploads, reorders and deletes images', () =>
    inRollback(async (tx) => {
      const product = await createProduct(tx);
      await expect(
        service(tx).addImage(ids.farm, product.id, file('image/gif')),
      ).rejects.toMatchObject({ status: 400 });
      expect(cloudinary.uploadFile).not.toHaveBeenCalled();

      const first = await service(tx).addImage(
        ids.farm,
        product.id,
        file(),
        ' Bìa ',
      );
      const second = await service(tx).addImage(ids.farm, product.id, file());
      expect(first).toMatchObject({ position: 0, alt: 'Bìa' });
      expect(second.position).toBe(1);
      expect(cloudinary.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          resource_type: 'image',
          format: 'webp',
          transformation: [
            expect.objectContaining({ width: 2000, crop: 'limit' }),
          ],
        }),
      );

      await expect(
        service(tx).reorderImages(ids.farm, product.id, [second.id]),
      ).rejects.toMatchObject({ status: 400 });
      const reordered = await service(tx).reorderImages(ids.farm, product.id, [
        second.id,
        first.id,
      ]);
      expect(reordered.map((image) => [image.id, image.position])).toEqual([
        [second.id, 0],
        [first.id, 1],
      ]);

      await service(tx).deleteImage(ids.farm, product.id, second.id);
      expect(cloudinary.deleteFile).toHaveBeenCalledWith(
        'nuoi-ong/products/p2',
        'image',
      );
      const [row] = await tx
        .select({ publicId: schema.storeProductImages.publicId })
        .from(schema.storeProductImages)
        .where(eq(schema.storeProductImages.id, first.id));
      expect(row.publicId).toBe('nuoi-ong/products/p1');
    }));

  it('removes the uploaded file when saving the image row fails', () =>
    inRollback(async (tx) => {
      const product = await createProduct(tx);
      const admin = service(tx);
      jest
        .spyOn(
          admin as unknown as { mapDatabaseError: () => Promise<never> },
          'mapDatabaseError',
        )
        .mockRejectedValueOnce(new Error('insert failed'));

      await expect(
        admin.addImage(ids.farm, product.id, file()),
      ).rejects.toThrow('insert failed');
      expect(cloudinary.deleteFile).toHaveBeenCalledWith(
        'nuoi-ong/products/p1',
        'image',
      );
    }));

  it('returns the ordered gallery on the public product detail', () =>
    inRollback(async (tx) => {
      const product = await createProduct(tx);
      await service(tx).createVariant(ids.farm, product.id, {
        itemId: ids.item,
        name: 'Chai',
        price: '1000',
      });
      await service(tx).updateProductStatus(ids.farm, product.id, 'PUBLISHED');
      const first = await service(tx).addImage(
        ids.farm,
        product.id,
        file(),
        'A',
      );
      const second = await service(tx).addImage(
        ids.farm,
        product.id,
        file(),
        'B',
      );
      await service(tx).reorderImages(ids.farm, product.id, [
        second.id,
        first.id,
      ]);

      const detail = await new CommerceService({
        db: tx,
      } as unknown as DatabaseService).getProduct(product.slug);
      expect(detail.images).toEqual([
        { src: second.url, alt: 'B' },
        { src: first.url, alt: 'A' },
      ]);
      expect(detail.image).toEqual({ src: second.url, alt: 'B' });
    }));
});

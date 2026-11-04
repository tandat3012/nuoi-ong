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
    otherWarehouse: randomUUID(),
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
  const file = (
    mimetype = 'image/png',
    buffer = Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
  ) => ({ buffer, mimetype }) as Express.Multer.File;

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
    await tx.insert(schema.warehouses).values([
      { id: ids.warehouse, farmId: ids.farm, code: 'SALES', name: 'Sales' },
      {
        id: ids.otherWarehouse,
        farmId: ids.otherFarm,
        code: 'SALES',
        name: 'Other sales',
      },
    ]);
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
    await tx.insert(schema.storeSettings).values({
      farmId: ids.farm,
      salesWarehouseId: ids.warehouse,
      salesEnabled: true,
      regions: ['NORTH'],
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

  it('keeps one sales warehouse of the farm and blocks switching it under open orders', () =>
    inRollback(async (tx) => {
      const admin = service(tx);
      await expect(
        admin.updateSettings(ids.farm, {
          salesWarehouseId: ids.otherWarehouse,
          salesEnabled: true,
          regions: ['NORTH'],
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        inSavepoint(tx, (sp) =>
          service(sp).updateSettings(ids.otherFarm, {
            salesEnabled: true,
            regions: ['SOUTH'],
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(
        await admin.updateSettings(ids.otherFarm, {
          salesWarehouseId: ids.otherWarehouse,
          salesEnabled: true,
          regions: ['SOUTH', 'SOUTH', 'CENTRAL'],
        }),
      ).toMatchObject({
        salesEnabled: true,
        regions: ['SOUTH', 'CENTRAL'],
        salesWarehouse: { id: ids.otherWarehouse },
      });

      const userId = randomUUID();
      await tx.insert(schema.users).values({
        id: userId,
        authProviderUserId: userId,
        email: `${userId}@store-admin.test`,
      });
      await tx.insert(schema.storeOrders).values({
        userId,
        farmId: ids.otherFarm,
        warehouseId: ids.otherWarehouse,
        recipientName: 'Khách',
        phone: '0900000000',
        address: 'Địa chỉ',
        paymentMethod: 'COD',
        subtotal: '0',
        total: '0',
        idempotencyKey: randomUUID(),
        requestFingerprint: 'x',
        // Waiting for top-up transfers into this warehouse still counts as open.
        status: 'PREPARING',
      });
      await expect(
        admin.updateSettings(ids.otherFarm, {
          salesEnabled: false,
          regions: [],
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await admin.updateSettings(ids.otherFarm, {
          salesWarehouseId: ids.otherWarehouse,
          salesEnabled: false,
          regions: [],
        }),
      ).toMatchObject({ salesEnabled: false });
    }));

  it('keeps source warehouses inside the farm and apart from the sales warehouse', () =>
    inRollback(async (tx) => {
      const admin = service(tx);
      const working = randomUUID();
      await tx.insert(schema.warehouses).values({
        id: working,
        farmId: ids.farm,
        code: 'WORK',
        name: 'Working',
      });
      const save = (
        sourceWarehouseIds: string[],
        salesWarehouseId = ids.warehouse,
      ) =>
        inSavepoint(tx, (sp) =>
          service(sp).updateSettings(ids.farm, {
            salesWarehouseId,
            salesEnabled: true,
            regions: ['NORTH'],
            sourceWarehouseIds,
          }),
        );
      await expect(save([ids.warehouse])).rejects.toMatchObject({
        status: 400,
      });
      await expect(save([ids.otherWarehouse])).rejects.toMatchObject({
        status: 400,
      });
      expect((await save([working])).sourceWarehouses).toEqual([
        expect.objectContaining({ id: working }),
      ]);
      // Omitting the list keeps it.
      expect(
        (
          await admin.updateSettings(ids.farm, {
            salesWarehouseId: ids.warehouse,
            salesEnabled: true,
            regions: ['NORTH'],
          })
        ).sourceWarehouses,
      ).toHaveLength(1);
      // The new sales warehouse stops being a source.
      expect(
        (
          await admin.updateSettings(ids.farm, {
            salesWarehouseId: working,
            salesEnabled: true,
            regions: ['NORTH'],
          })
        ).sourceWarehouses,
      ).toEqual([]);
    }));

  it('shows physical, held and available stock of the sales warehouse only', () =>
    inRollback(async (tx) => {
      const admin = service(tx);
      const product = await createProduct(tx);
      await admin.createVariant(ids.farm, product.id, {
        name: 'Chai',
        price: '100000',
        itemId: ids.item,
      });
      const internal = randomUUID();
      await tx.insert(schema.warehouses).values({
        id: internal,
        farmId: ids.farm,
        code: 'INTERNAL',
        name: 'Internal',
      });
      await tx.insert(schema.inventoryBalances).values([
        {
          farmId: ids.farm,
          warehouseId: ids.warehouse,
          itemId: ids.item,
          quantityOnHand: '10',
        },
        {
          farmId: ids.farm,
          warehouseId: internal,
          itemId: ids.item,
          quantityOnHand: '50',
        },
      ]);
      const userId = randomUUID();
      const memberId = randomUUID();
      await tx.insert(schema.users).values({
        id: userId,
        authProviderUserId: userId,
        email: `${userId}@store-admin.test`,
      });
      await tx
        .insert(schema.farmMembers)
        .values({ id: memberId, farmId: ids.farm, userId });
      // A draft holds stock; an approved issue has already left the balance.
      for (const [status, quantity] of [
        ['DRAFT', '3'],
        ['CONFIRMED', '4'],
      ] as const) {
        const [issue] = await tx
          .insert(schema.stockIssues)
          .values({
            farmId: ids.farm,
            warehouseId: ids.warehouse,
            status,
            createdByMemberId: memberId,
            ...(status === 'CONFIRMED' && {
              issueCode: `XK-${randomUUID()}`,
              confirmedByMemberId: memberId,
              confirmedAt: new Date().toISOString(),
            }),
          })
          .returning();
        await tx
          .insert(schema.stockIssueItems)
          .values({ stockIssueId: issue.id, itemId: ids.item, quantity });
      }

      const stock = await admin.salesStock(ids.farm);
      expect(stock.salesWarehouse?.id).toBe(ids.warehouse);
      expect(stock.rows).toEqual([
        expect.objectContaining({
          productId: product.id,
          itemId: ids.item,
          onHand: '10.000',
          held: '3.000',
          available: '7.000',
          // Not a source warehouse yet.
          sourceOnHand: '0',
          // Still a draft product.
          saleable: false,
        }),
      ]);
      await tx
        .insert(schema.storeSourceWarehouses)
        .values({ warehouseId: internal, farmId: ids.farm });
      expect((await admin.salesStock(ids.farm)).rows[0].sourceOnHand).toBe(
        '50.000',
      );
      await admin.updateProductStatus(ids.farm, product.id, 'PUBLISHED');
      expect((await admin.salesStock(ids.farm)).rows[0].saleable).toBe(true);
      // Customers cannot see a variant whose unit is inactive.
      await tx
        .update(schema.units)
        .set({ status: 'INACTIVE' })
        .where(eq(schema.units.id, ids.unit));
      expect((await admin.salesStock(ids.farm)).rows[0].saleable).toBe(false);
      expect((await admin.salesStock(ids.otherFarm)).rows).toEqual([]);
    }));

  it('lets each farm map its own item of the same unit to a shared variant', () =>
    inRollback(async (tx) => {
      const product = await createProduct(tx);
      const variant = await service(tx).createVariant(ids.farm, product.id, {
        itemId: ids.item,
        name: 'Chai',
        price: '1000',
      });
      expect(variant.unitId).toBe(ids.unit);
      await expect(
        service(tx).setVariantItem(
          ids.otherFarm,
          product.id,
          variant.id,
          ids.item,
        ),
      ).rejects.toMatchObject({ status: 400 });

      const otherUnit = randomUUID();
      const otherUnitItem = randomUUID();
      await tx.insert(schema.units).values({
        id: otherUnit,
        code: `SB-${otherUnit.slice(0, 8)}`,
        name: 'Other unit',
      });
      await tx.insert(schema.items).values({
        id: otherUnitItem,
        farmId: ids.otherFarm,
        categoryId: ids.category,
        unitId: otherUnit,
        code: otherUnitItem,
        name: 'Mật ong lít',
        itemType: 'MATERIAL',
        trackingMode: 'QUANTITY',
      });
      await expect(
        service(tx).setVariantItem(
          ids.otherFarm,
          product.id,
          variant.id,
          otherUnitItem,
        ),
      ).rejects.toMatchObject({ status: 400 });

      const mapped = await service(tx).setVariantItem(
        ids.otherFarm,
        product.id,
        variant.id,
        ids.foreignItem,
      );
      expect(mapped.variants[0]).toMatchObject({
        item: { id: ids.foreignItem },
        farmCount: 2,
      });
      expect(
        (await service(tx).getProduct(ids.farm, product.id)).variants[0].item,
      ).toMatchObject({ id: ids.item });

      await service(tx).removeVariantItem(
        ids.otherFarm,
        product.id,
        variant.id,
      );
      expect(
        (await service(tx).getProduct(ids.otherFarm, product.id)).variants[0],
      ).toMatchObject({ item: null, farmCount: 1 });
      await expect(
        service(tx).removeVariantItem(ids.otherFarm, product.id, variant.id),
      ).rejects.toMatchObject({ status: 404 });
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
        service(tx).addImage(product.id, file('image/gif')),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service(tx).addImage(
          product.id,
          file('image/png', Buffer.from('GIF89a')),
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(cloudinary.uploadFile).not.toHaveBeenCalled();

      const first = await service(tx).addImage(product.id, file(), ' Bìa ');
      const second = await service(tx).addImage(product.id, file());
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
        service(tx).reorderImages(product.id, [second.id]),
      ).rejects.toMatchObject({ status: 400 });
      const reordered = await service(tx).reorderImages(product.id, [
        second.id,
        first.id,
      ]);
      expect(reordered.map((image) => [image.id, image.position])).toEqual([
        [second.id, 0],
        [first.id, 1],
      ]);

      await service(tx).deleteImage(product.id, second.id);
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

      await expect(admin.addImage(product.id, file())).rejects.toThrow(
        'insert failed',
      );
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
      const first = await service(tx).addImage(product.id, file(), 'A');
      const second = await service(tx).addImage(product.id, file(), 'B');
      await service(tx).reorderImages(product.id, [second.id, first.id]);

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

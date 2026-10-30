import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { CommerceService } from '../src/modules/commerce/commerce.service';

describe('Commerce products (migrated PostgreSQL)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const ids = {
    farm: randomUUID(),
    otherFarm: randomUUID(),
    warehouse: randomUUID(),
    otherWarehouse: randomUUID(),
    category: randomUUID(),
    unit: randomUUID(),
    storeCategory: randomUUID(),
  };
  const queries: { text: string; params: unknown[] }[] = [];
  const pagination = { page: 1, pageSize: 20, offset: 0 };
  let client: PoolClient;
  let db: NodePgDatabase<typeof schema>;
  let service: CommerceService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    client = await pool.connect();
    db = drizzle({
      client,
      schema,
      logger: {
        logQuery(text, params) {
          queries.push({ text, params });
        },
      },
    });
    service = new CommerceService({ db } as unknown as DatabaseService);
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await db.insert(schema.farms).values([
      { id: ids.farm, code: ids.farm, name: 'Commerce test' },
      { id: ids.otherFarm, code: ids.otherFarm, name: 'Other farm' },
    ]);
    await db.insert(schema.warehouses).values([
      { id: ids.warehouse, farmId: ids.farm, code: 'SALES', name: 'Sales' },
      {
        id: ids.otherWarehouse,
        farmId: ids.farm,
        code: 'OTHER',
        name: 'Other',
      },
    ]);
    await db.insert(schema.categories).values({
      id: ids.category,
      code: ids.category,
      name: 'Internal',
    });
    await db.insert(schema.units).values({
      id: ids.unit,
      code: `CT-${ids.unit.slice(0, 8)}`,
      name: 'Unit',
      symbol: 'u',
    });
    await db.insert(schema.storeCategories).values({
      id: ids.storeCategory,
      name: 'Commerce test',
      slug: ids.storeCategory,
    });
    await db
      .insert(schema.storeSettings)
      .values({ id: 1, warehouseId: ids.warehouse })
      .onConflictDoUpdate({
        target: schema.storeSettings.id,
        set: { warehouseId: ids.warehouse },
      });
    queries.length = 0;
  });

  afterEach(async () => {
    await client?.query('ROLLBACK');
  });

  afterAll(async () => {
    client?.release();
    await pool.end();
  });

  async function createProduct(
    name: string,
    price = '100000',
    trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' = 'QUANTITY',
  ) {
    const id = randomUUID();
    const itemId = randomUUID();
    await db.insert(schema.items).values({
      id: itemId,
      farmId: ids.farm,
      categoryId: ids.category,
      unitId: ids.unit,
      code: itemId,
      name,
      itemType: trackingMode === 'ASSET' ? 'EQUIPMENT' : 'MATERIAL',
      trackingMode,
    });
    await db.insert(schema.storeProducts).values({
      id,
      categoryId: ids.storeCategory,
      name,
      slug: id,
      status: 'PUBLISHED',
    });
    await db.insert(schema.storeProductVariants).values({
      productId: id,
      itemId,
      name: 'Default',
      price,
    });
    return { id, itemId };
  }

  it.each(['price_asc', 'price_desc'] as const)(
    'combines filters and keeps stable totals across pages: %s',
    async (sort) => {
      const products: Awaited<ReturnType<typeof createProduct>>[] = [];
      for (let index = 0; index < 25; index++) {
        products.push(await createProduct('Mật ong kiểm thử'));
      }
      await createProduct('Đường', '100000');
      await createProduct('Mật ong rẻ', '99999');
      await createProduct('Mật ong đắt', '100001');
      const filters = {
        category: ids.storeCategory,
        q: '  MẬT ONG  ',
        minPrice: 100000,
        maxPrice: 100000,
        sort,
      };
      const first = await service.listProducts(pagination, filters);
      const second = await service.listProducts(
        { page: 2, pageSize: 20, offset: 20 },
        filters,
      );
      const third = await service.listProducts(
        { page: 3, pageSize: 20, offset: 40 },
        filters,
      );
      const expected = products.map(({ id }) => id).sort();
      expect(first.data.map(({ id }) => id)).toEqual(expected.slice(0, 20));
      expect(second.data.map(({ id }) => id)).toEqual(expected.slice(20));
      expect(first.page).toEqual({
        number: 1,
        size: 20,
        totalItems: 25,
        totalPages: 2,
      });
      expect(second.page.totalItems).toBe(25);
      expect(third).toEqual({
        data: [],
        page: { number: 3, size: 20, totalItems: 25, totalPages: 2 },
      });
    },
  );

  it('groups variants, selects the first image and filters on the displayed price', async () => {
    const product = await createProduct('A product');
    const second = await createProduct('B variant', '200000');
    await db
      .update(schema.storeProductVariants)
      .set({ productId: product.id })
      .where(eq(schema.storeProductVariants.itemId, second.itemId));
    await db.insert(schema.storeProductImages).values([
      { productId: product.id, url: '/second.jpg', position: 1 },
      { productId: product.id, url: '/cover.jpg', alt: 'Cover', position: 0 },
    ]);
    await db.insert(schema.inventoryBalances).values({
      farmId: ids.farm,
      warehouseId: ids.warehouse,
      itemId: second.itemId,
      quantityOnHand: '1',
    });
    const result = await service.listProducts(pagination);
    expect(result.page.totalItems).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: product.id,
      price: 100000,
      inStock: true,
      category: { id: ids.storeCategory, slug: ids.storeCategory },
      image: { src: '/cover.jpg', alt: 'Cover' },
    });
    const detail = await service.getProduct(product.id);
    expect(detail).toMatchObject(result.data[0]);
    expect(detail.variants).toHaveLength(2);
    expect(new Set(detail.variants.map((variant) => variant.id)).size).toBe(2);
    expect(
      detail.variants.every((variant) => typeof variant.id === 'string'),
    ).toBe(true);
    expect(detail.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ price: 100000, inStock: false }),
        expect.objectContaining({ price: 200000, inStock: true }),
      ]),
    );
    expect(
      (await service.listProducts(pagination, { minPrice: 150000 })).data,
    ).toEqual([]);
  });

  it.each(['%', '_', '\\', '100%_\\'])(
    'matches literal keyword %j',
    async (q) => {
      const product = await createProduct('Bộ 100%_\\ nguyên chất');
      await createProduct('Bộ thông thường');
      const result = await service.listProducts(pagination, { q });
      expect(result.data.map(({ id }) => id)).toEqual([product.id]);
    },
  );

  it('preserves accent sensitivity, zero price and numeric price ordering', async () => {
    const free = await createProduct('Mật ong miễn phí', '0');
    const cheap = await createProduct('Mật ong rẻ', '9');
    const expensive = await createProduct('Mật ong đắt', '100');
    const result = await service.listProducts(pagination, {
      sort: 'price_asc',
    });
    expect(result.data.map(({ id }) => id)).toEqual([
      free.id,
      cheap.id,
      expensive.id,
    ]);
    const descending = await service.listProducts(pagination, {
      sort: 'price_desc',
    });
    expect(descending.data.map(({ id }) => id)).toEqual([
      expensive.id,
      cheap.id,
      free.id,
    ]);
    const zero = await service.listProducts(pagination, {
      minPrice: 0,
      maxPrice: 0,
    });
    expect(zero.data).toMatchObject([{ id: free.id, price: 0 }]);
    expect(
      (await service.listProducts(pagination, { q: 'mat ong' })).data,
    ).toEqual([]);
    expect(
      (await service.listProducts(pagination, { q: '   ' })).page.totalItems,
    ).toBe(3);
    expect(
      (await service.listProducts(pagination, { category: 'unknown' })).data,
    ).toEqual([]);
  });

  it.each(['draft', 'archived', 'variant', 'item', 'unit', 'farm'] as const)(
    'hides an ineligible product: %s',
    async (reason) => {
      const product = await createProduct('Hidden');
      if (reason === 'draft' || reason === 'archived') {
        await db
          .update(schema.storeProducts)
          .set({ status: reason === 'draft' ? 'DRAFT' : 'ARCHIVED' })
          .where(eq(schema.storeProducts.id, product.id));
      } else if (reason === 'variant') {
        await db
          .update(schema.storeProductVariants)
          .set({ active: false })
          .where(eq(schema.storeProductVariants.itemId, product.itemId));
      } else if (reason === 'item' || reason === 'farm') {
        await db
          .update(schema.items)
          .set(
            reason === 'item'
              ? { status: 'INACTIVE' }
              : { farmId: ids.otherFarm },
          )
          .where(eq(schema.items.id, product.itemId));
      } else {
        await db
          .update(schema.units)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.units.id, ids.unit));
      }
      expect((await service.listProducts(pagination)).data).toEqual([]);
      await expect(service.getProduct(product.id)).rejects.toMatchObject({
        status: 404,
      });
    },
  );

  it('requires enough quantity in the sales warehouse for one quantity step', async () => {
    const product = await createProduct('Quantity');
    await db
      .update(schema.storeProductVariants)
      .set({ quantityStep: '0.5' })
      .where(eq(schema.storeProductVariants.itemId, product.itemId));
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: ids.farm,
        warehouseId: ids.warehouse,
        itemId: product.itemId,
        quantityOnHand: '0.49',
      },
      {
        farmId: ids.farm,
        warehouseId: ids.otherWarehouse,
        itemId: product.itemId,
        quantityOnHand: '100',
      },
    ]);
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: false,
    });
    await db
      .update(schema.inventoryBalances)
      .set({ quantityOnHand: '0.5' })
      .where(eq(schema.inventoryBalances.warehouseId, ids.warehouse));
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: true,
    });
  });

  it('excludes expired lots and includes lots expiring today', async () => {
    const product = await createProduct('Lot', '100000', 'LOT');
    const expired = randomUUID();
    const current = randomUUID();
    await db.insert(schema.inventoryLots).values([
      {
        id: expired,
        farmId: ids.farm,
        itemId: product.itemId,
        lotNumber: 'EXPIRED',
        initialQuantity: '10',
        expiryDate: '2000-01-01',
      },
      {
        id: current,
        farmId: ids.farm,
        itemId: product.itemId,
        lotNumber: 'CURRENT',
        initialQuantity: '10',
        expiryDate: new Date().toISOString().slice(0, 10),
      },
    ]);
    await db.insert(schema.inventoryBalances).values([
      {
        farmId: ids.farm,
        warehouseId: ids.warehouse,
        itemId: product.itemId,
        lotId: expired,
        quantityOnHand: '10',
      },
      {
        farmId: ids.farm,
        warehouseId: ids.warehouse,
        itemId: product.itemId,
        lotId: current,
        quantityOnHand: '0.5',
      },
    ]);
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: false,
    });
    await db
      .update(schema.inventoryBalances)
      .set({ quantityOnHand: '1' })
      .where(eq(schema.inventoryBalances.lotId, current));
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: true,
    });
  });

  it('requires an AVAILABLE asset in the sales warehouse and a matching balance', async () => {
    const product = await createProduct('Asset', '100000', 'ASSET');
    const location = randomUUID();
    const asset = randomUUID();
    await db.insert(schema.inventoryBalances).values({
      farmId: ids.farm,
      warehouseId: ids.warehouse,
      itemId: product.itemId,
      quantityOnHand: '1',
    });
    await db.insert(schema.locations).values({
      id: location,
      farmId: ids.farm,
      warehouseId: ids.otherWarehouse,
      code: location,
      name: 'Asset location',
      type: 'WAREHOUSE',
    });
    await db.insert(schema.assets).values({
      id: asset,
      farmId: ids.farm,
      itemId: product.itemId,
      currentLocationId: location,
      assetCode: asset,
    });
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: false,
    });
    await db
      .update(schema.locations)
      .set({ warehouseId: ids.warehouse })
      .where(eq(schema.locations.id, location));
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: true,
    });
    await db
      .update(schema.assets)
      .set({ status: 'MAINTENANCE' })
      .where(eq(schema.assets.id, asset));
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: false,
    });
    await db
      .update(schema.assets)
      .set({ status: 'AVAILABLE', currentLocationId: null })
      .where(eq(schema.assets.id, asset));
    expect(await service.getProduct(product.id)).toMatchObject({
      inStock: false,
    });
  });

  it('limits extras to page IDs, skips them on empty pages and keeps count lightweight', async () => {
    const first = await createProduct('A');
    const second = await createProduct('B');
    queries.length = 0;
    const result = await service.listProducts({
      page: 1,
      pageSize: 1,
      offset: 0,
    });
    expect(result.data.map(({ id }) => id)).toEqual([first.id]);
    const countQuery = queries.find(({ text }) => text.includes('count(*)'));
    expect(countQuery?.text).not.toMatch(
      /store_product_images|inventory_balances|BOOL_OR/,
    );
    const extras = queries.filter(
      ({ text }) =>
        text.includes('select distinct on') || text.includes('BOOL_OR'),
    );
    expect(extras).toHaveLength(2);
    for (const query of extras) {
      expect(query.params).toContain(first.id);
      expect(query.params).not.toContain(second.id);
    }
    queries.length = 0;
    const empty = await service.listProducts({
      page: 3,
      pageSize: 1,
      offset: 2,
    });
    expect(empty.data).toEqual([]);
    expect(empty.page.totalItems).toBe(2);
    expect(queries).toHaveLength(3);
  });

  it.each(['missing', 'warehouse', 'farm'] as const)(
    'rejects an unavailable sales configuration: %s',
    async (reason) => {
      if (reason === 'missing') await db.delete(schema.storeSettings);
      if (reason === 'warehouse') {
        await db
          .update(schema.warehouses)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.warehouses.id, ids.warehouse));
      }
      if (reason === 'farm') {
        await db
          .update(schema.farms)
          .set({ status: 'INACTIVE' })
          .where(eq(schema.farms.id, ids.farm));
      }
      await expect(service.listProducts(pagination)).rejects.toMatchObject({
        status: 503,
      });
    },
  );

  it('rejects unsafe prices and invalid pagination before issuing queries', async () => {
    const product = await createProduct('Unsafe', '9007199254740992');
    await expect(service.getProduct(product.id)).rejects.toMatchObject({
      status: 500,
    });
    queries.length = 0;
    await expect(
      service.listProducts({
        page: 1e308,
        pageSize: 20,
        offset: Infinity,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.listProducts(pagination, { minPrice: 2, maxPrice: 1 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(queries).toEqual([]);
    await expect(service.getProduct('missing')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('reads and paginates storefront categories from the database', async () => {
    const [total] = await db
      .select({ value: count() })
      .from(schema.storeCategories);
    const result = await service.listCategories({
      page: 1,
      pageSize: 1,
      offset: 0,
    });
    expect(result.data).toHaveLength(1);
    expect(Object.keys(result.data[0]).sort()).toEqual(['id', 'name', 'slug']);
    expect(result.page.totalItems).toBe(total.value);
  });
});

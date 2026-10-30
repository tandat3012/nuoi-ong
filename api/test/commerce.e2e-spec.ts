import {
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/db/database.service';
import { CLERK_CLIENT } from '../src/modules/auth/clerk/clerk-client.provider';
import { CommerceService } from '../src/modules/commerce/commerce.service';

describe('Commerce HTTP contract', () => {
  let app: INestApplication<App>;
  const originalAuthorizedParties = process.env.CLERK_AUTHORIZED_PARTIES;
  const database = { db: { select: jest.fn() } };
  const service = {
    listProducts: jest.fn(),
    getProduct: jest.fn(),
    listCategories: jest.fn(),
  };
  const clerkClient = {
    authenticateRequest: jest
      .fn()
      .mockResolvedValue({ isAuthenticated: false }),
  };
  const product = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Mật ong',
    slug: 'mat-ong',
    description: 'Mật ong nguyên chất',
    category: { id: 'category', name: 'Mật ong', slug: 'mat-ong' },
    price: 185000,
    inStock: false,
  };
  const detail = {
    ...product,
    variants: [{ id: 'variant', name: '500ml', price: 185000, inStock: false }],
  };
  const page = { number: 1, size: 20, totalItems: 1, totalPages: 1 };

  beforeAll(async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(database)
      .overrideProvider(CommerceService)
      .useValue(service)
      .overrideProvider(CLERK_CLIENT)
      .useValue(clerkClient)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.listProducts.mockResolvedValue({ data: [product], page });
    service.getProduct.mockResolvedValue(detail);
    service.listCategories.mockResolvedValue({
      data: [product.category],
      page,
    });
  });

  afterEach(() => expect(database.db.select).not.toHaveBeenCalled());

  afterAll(async () => {
    await app?.close();
    if (originalAuthorizedParties === undefined) {
      delete process.env.CLERK_AUTHORIZED_PARTIES;
    } else {
      process.env.CLERK_AUTHORIZED_PARTIES = originalAuthorizedParties;
    }
  });

  it.each(['products', 'categories'])(
    'returns public %s with the default pagination',
    async (resource) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/store/${resource}`)
        .expect(200);
      expect(response.body).toEqual({
        data: resource === 'products' ? [product] : [product.category],
        page,
      });
      if (resource === 'products') {
        expect(service.listProducts).toHaveBeenCalledWith(
          { page: 1, pageSize: 20, offset: 0 },
          expect.any(Object),
        );
      } else {
        expect(service.listCategories).toHaveBeenCalledWith({
          page: 1,
          pageSize: 20,
          offset: 0,
        });
      }
      expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
    },
  );

  it('passes all validated filters and pagination to the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/store/products')
      .query({
        page: 2,
        pageSize: 5,
        category: 'mat-ong',
        q: '  MẬT ONG  ',
        minPrice: 0,
        maxPrice: 200000,
        sort: 'price_desc',
      })
      .expect(200);
    expect(service.listProducts).toHaveBeenCalledWith(
      { page: 2, pageSize: 5, offset: 5 },
      {
        category: 'mat-ong',
        q: 'MẬT ONG',
        minPrice: 0,
        maxPrice: 200000,
        sort: 'price_desc',
      },
    );
  });

  it('caps page size and accepts the maximum safe price bound', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/store/products?pageSize=1000&maxPrice=9007199254740991')
      .expect(200);
    expect(service.listProducts).toHaveBeenCalledWith(
      { page: 1, pageSize: 100, offset: 0 },
      expect.objectContaining({ maxPrice: Number.MAX_SAFE_INTEGER }),
    );
  });

  it.each(['products', 'categories'])(
    'rejects invalid pagination for %s',
    async (resource) => {
      for (const query of [
        'page=0',
        'page=-1',
        'page=one',
        'page=1.5',
        'pageSize=0',
        'pageSize=-1',
        'pageSize=one',
        'pageSize=1.5',
        'pageSize=Infinity',
        'page=1&page=2',
        'pageSize=1&pageSize=2',
      ]) {
        await request(app.getHttpServer())
          .get(`/api/v1/store/${resource}?${query}`)
          .expect(400);
      }
      expect(service.listProducts).not.toHaveBeenCalled();
      expect(service.listCategories).not.toHaveBeenCalled();
    },
  );

  it.each([
    'category=',
    'category=MAT-ONG',
    'category=mat%20ong',
    'category=mat--ong',
    'category=mat-ong&category=vat-tu',
    `category=${'a'.repeat(101)}`,
    'sort=popular',
    'sort=newest',
    'sort=PRICE_ASC',
    'sort=',
    'sort=price_asc&sort=price_desc',
    'q=one&q=two',
    `q=${'a'.repeat(101)}`,
  ])('rejects invalid filters: %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/store/products?${query}`)
      .expect(400);
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it.each(['minPrice', 'maxPrice'])(
    'rejects invalid %s values',
    async (field) => {
      for (const value of [
        '',
        ' ',
        '-1',
        '1.5',
        '1.0',
        'NaN',
        'Infinity',
        '-Infinity',
        '1e309',
        '1e5',
        'abc',
        '0x10',
        '9007199254740992',
      ]) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/store/products')
          .query({ [field]: value })
          .expect(400);
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: `${field} must be a non-negative safe integer in VND`,
        });
      }
      await request(app.getHttpServer())
        .get(`/api/v1/store/products?${field}=1&${field}=2`)
        .expect(400);
      expect(service.listProducts).not.toHaveBeenCalled();
    },
  );

  it('rejects reversed bounds before calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/store/products?minPrice=2&maxPrice=1')
      .expect(400);
    expect(response.body).toMatchObject({
      message: 'minPrice must not exceed maxPrice',
    });
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it('awaits product details and preserves the response envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/store/products/mat-ong')
      .expect(200);
    expect(response.body).toEqual({ data: detail });
    expect(service.getProduct).toHaveBeenCalledWith('mat-ong');
    expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
  });

  it('propagates missing products and unavailable warehouse errors', async () => {
    service.getProduct.mockRejectedValueOnce(
      new NotFoundException('Product not found'),
    );
    await request(app.getHttpServer())
      .get('/api/v1/store/products/missing')
      .expect(404);
    service.listProducts.mockRejectedValueOnce(
      new ServiceUnavailableException(),
    );
    await request(app.getHttpServer())
      .get('/api/v1/store/products')
      .expect(503);
  });

  it.each(['categories', 'items', 'warehouses'])(
    'keeps the internal /%s API protected',
    async (resource) => {
      await request(app.getHttpServer()).get(`/api/v1/${resource}`).expect(401);
      expect(clerkClient.authenticateRequest).toHaveBeenCalledTimes(1);
    },
  );
});

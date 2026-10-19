import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/db/database.service';
import { CLERK_CLIENT } from '../src/modules/auth/clerk-client.provider';

describe('Commerce API (e2e)', () => {
  let app: INestApplication<App>;
  const originalAuthorizedParties = process.env.CLERK_AUTHORIZED_PARTIES;
  const database = { db: { select: jest.fn() } };
  const clerkClient = {
    authenticateRequest: jest
      .fn()
      .mockResolvedValue({ isAuthenticated: false }),
  };

  beforeAll(async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(database)
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

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => expect(database.db.select).not.toHaveBeenCalled());

  afterAll(async () => {
    await app?.close();
    if (originalAuthorizedParties === undefined) {
      delete process.env.CLERK_AUTHORIZED_PARTIES;
    } else {
      process.env.CLERK_AUTHORIZED_PARTIES = originalAuthorizedParties;
    }
  });

  describe.each(['products', 'categories'])('%s', (resource) => {
    const path = `/api/v1/store/${resource}`;

    it('is public and uses the default page size', async () => {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.body).toHaveProperty('data.length', 4);
      expect(response.body).toMatchObject({
        page: { number: 1, size: 20, totalItems: 4, totalPages: 1 },
      });
      expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
    });

    it('returns separate pages with consistent totals', async () => {
      const first = await request(app.getHttpServer())
        .get(`${path}?page=1&pageSize=2`)
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`${path}?page=2&pageSize=2`)
        .expect(200);

      expect(first.body).toHaveProperty('data.length', 2);
      expect(second.body).toHaveProperty('data.length', 2);
      expect(second.body).toMatchObject({
        page: { number: 2, size: 2, totalItems: 4, totalPages: 2 },
      });
      const firstPage = first.body as { data: { id: string }[] };
      const secondPage = second.body as { data: { id: string }[] };
      const ids = [...firstPage.data, ...secondPage.data].map(
        (item) => item.id,
      );
      expect(new Set(ids).size).toBe(4);
    });

    it('caps the requested page size at 100', async () => {
      const response = await request(app.getHttpServer())
        .get(`${path}?pageSize=1000`)
        .expect(200);
      expect(response.body).toMatchObject({ page: { size: 100 } });
    });

    it('returns an empty page beyond the available records', async () => {
      const response = await request(app.getHttpServer())
        .get(`${path}?page=3&pageSize=2`)
        .expect(200);
      expect(response.body).toEqual({
        data: [],
        page: { number: 3, size: 2, totalItems: 4, totalPages: 2 },
      });
    });

    it.each([
      'page=0',
      'page=-1',
      'page=one',
      'page=1.5',
      'page=1e308',
      'pageSize=0',
      'pageSize=-1',
      'pageSize=one',
      'pageSize=1.5',
      'pageSize=Infinity',
      'page=1&page=2',
      'pageSize=1&pageSize=2',
    ])('rejects invalid pagination: %s', async (query) => {
      await request(app.getHttpServer()).get(`${path}?${query}`).expect(400);
    });
  });

  it('filters by category before pagination and calculates filtered totals', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/store/products?category=vat-tu&pageSize=1')
      .expect(200);
    expect(first.body).toMatchObject({
      data: [{ category: { slug: 'vat-tu' } }],
      page: { number: 1, size: 1, totalItems: 1, totalPages: 1 },
    });
    expect(first.body).toHaveProperty('data.length', 1);

    const second = await request(app.getHttpServer())
      .get('/api/v1/store/products?category=vat-tu&page=2&pageSize=1')
      .expect(200);
    expect(second.body).toEqual({
      data: [],
      page: { number: 2, size: 1, totalItems: 1, totalPages: 1 },
    });
    expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
  });

  it('returns an empty list for an unknown category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/store/products?category=unknown-category')
      .expect(200);
    expect(response.body).toEqual({
      data: [],
      page: { number: 1, size: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it.each([
    'category=',
    'category=MAT-ONG',
    'category=mat%20ong',
    'category=mat--ong',
    'category=mat-ong&category=vat-tu',
    `category=${'a'.repeat(101)}`,
  ])('rejects invalid category filters: %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/store/products?${query}`)
      .expect(400);
  });

  it('returns a public product by slug without authenticating', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/store/products/mat-ong-hoa-ca-phe-nguyen-chat')
      .expect(200);
    expect(response.body).toMatchObject({
      data: {
        id: 'prod-mat-ong-hoa-ca-phe',
        slug: 'mat-ong-hoa-ca-phe-nguyen-chat',
        name: 'Mật ong hoa cà phê nguyên chất',
        description: 'Sản phẩm mẫu: mật ong hoa cà phê đóng chai.',
        price: 185000,
        category: {
          id: 'mat-ong',
          name: 'Mật ong',
          slug: 'mat-ong',
        },
        inStock: true,
      },
    });
    expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown product', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/store/products/missing-product')
      .expect(404);
    expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
  });

  it('returns details for an out-of-stock product', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/store/products/duong-ong-tinh-luyen-cao-cap')
      .expect(200);
    expect(response.body).toMatchObject({
      data: {
        slug: 'duong-ong-tinh-luyen-cao-cap',
        description: 'Sản phẩm mẫu: đường tinh luyện dùng làm thức ăn cho ong.',
        inStock: false,
      },
    });
    expect(clerkClient.authenticateRequest).not.toHaveBeenCalled();
  });

  it.each(['categories', 'items', 'warehouses'])(
    'keeps the existing /%s API protected',
    async (resource) => {
      await request(app.getHttpServer()).get(`/api/v1/${resource}`).expect(401);
      expect(clerkClient.authenticateRequest).toHaveBeenCalledTimes(1);
    },
  );
});

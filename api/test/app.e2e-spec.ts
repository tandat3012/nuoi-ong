import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_e2e';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_e2e';
    process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health/database (GET) reports a healthy database', () => {
    return request(app.getHttpServer())
      .get('/health/database')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('rejects protected warehouse requests without a Clerk token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/warehouses?farmId=6a8ac800-8daa-4e25-9ef8-57af547f8784')
      .expect(401);
  });

  it('requires authentication before processing protected resource filters', () => {
    return request(app.getHttpServer())
      .get('/api/v1/inventory?farmId=not-a-uuid')
      .expect(401);
  });

  afterEach(async () => {
    await app?.close();
  });
});

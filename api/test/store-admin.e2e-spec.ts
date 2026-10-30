import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { StoreAdminController } from '../src/modules/store-admin/store-admin.controller';
import { StoreAdminService } from '../src/modules/store-admin/store-admin.service';

describe('Store admin HTTP contract', () => {
  let app: INestApplication<App>;
  const farmId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const service = { addImage: jest.fn(), reorderImages: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StoreAdminController],
      providers: [{ provide: StoreAdminService, useValue: service }],
    })
      .overrideGuard(FarmAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service.addImage.mockResolvedValue({ id: 'image' });
  });

  afterAll(() => app.close());

  it('passes the multipart file and alt to the service', async () => {
    await request(app.getHttpServer())
      .post(`/store-admin/products/${productId}/images`)
      .query({ farmId })
      .field('alt', 'Bìa')
      .attach('file', Buffer.from('png'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(201, { data: { id: 'image' } });

    expect(service.addImage).toHaveBeenCalledWith(
      farmId,
      productId,
      expect.objectContaining({ mimetype: 'image/png', size: 3 }),
      'Bìa',
    );
  });

  it('rejects files over 10MB before calling the service', async () => {
    await request(app.getHttpServer())
      .post(`/store-admin/products/${productId}/images`)
      .query({ farmId })
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(service.addImage).not.toHaveBeenCalled();
  });

  it('validates reorder payloads', async () => {
    await request(app.getHttpServer())
      .put(`/store-admin/products/${productId}/images/order`)
      .query({ farmId })
      .send({ imageIds: ['not-a-uuid'] })
      .expect(400);
    expect(service.reorderImages).not.toHaveBeenCalled();
  });
});

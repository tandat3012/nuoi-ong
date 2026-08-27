import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './db/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const databaseService = {
    ping: jest.fn(),
  };

  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  it('confirms database connectivity', async () => {
    databaseService.ping.mockResolvedValueOnce(undefined);

    await expect(healthController.checkDatabase()).resolves.toEqual({
      status: 'ok',
    });
    expect(databaseService.ping).toHaveBeenCalledTimes(1);
  });
});

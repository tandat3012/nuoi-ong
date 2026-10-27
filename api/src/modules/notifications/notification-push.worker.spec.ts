import { Logger } from '@nestjs/common';
import { NotificationPushWorker } from './notification-push.worker';
import { PushOutboxRepository } from './push-outbox.repository';
import { ExpoPushClient } from './expo-push.client';
import { pushWorkerOptions } from './push-worker.options';

describe('push worker lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not schedule a worker when the flag is disabled', async () => {
    const repository = { recoverExpired: jest.fn(), claimDue: jest.fn() };
    const worker = new NotificationPushWorker(
      repository as unknown as PushOutboxRepository,
      {} as ExpoPushClient,
      pushWorkerOptions({}),
    );
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(repository.recoverExpired).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('polls after bootstrap and cancels future work on application shutdown', async () => {
    const repository = {
      recoverExpired: jest.fn(() => Promise.resolve()),
      claimDue: jest.fn(() => Promise.resolve([])),
    };
    const worker = new NotificationPushWorker(
      repository as unknown as PushOutboxRepository,
      {} as ExpoPushClient,
      pushWorkerOptions({ PUSH_WORKER_ENABLED: 'true' }),
    );
    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(repository.claimDue).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(repository.claimDue).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(repository.claimDue).toHaveBeenCalledTimes(2);
  });
});

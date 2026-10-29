import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ExpoPushClient,
  ExpoPushFailure,
  type ExpoPushMessage,
} from './expo-push.client';
import {
  PushOutboxRepository,
  type PushClaim,
  type PushContext,
  type PushOutcome,
} from './push-outbox.repository';
import {
  PUSH_WORKER_OPTIONS,
  type PushWorkerOptions,
} from './push-worker.options';

@Injectable()
export class NotificationPushWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationPushWorker.name);
  private readonly shutdown = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly repository: PushOutboxRepository,
    private readonly expo: ExpoPushClient,
    @Inject(PUSH_WORKER_OPTIONS) private readonly options: PushWorkerOptions,
  ) {}

  onApplicationBootstrap() {
    if (!this.options.enabled) {
      this.logger.log('Push worker disabled (PUSH_WORKER_ENABLED=false)');
      return;
    }
    this.logger.log('Push worker enabled');
    this.schedule(0);
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.runOnce()
        .catch(() =>
          this.logger.error(
            'Push worker database cycle failed; retrying next cycle',
          ),
        )
        .finally(() => this.schedule(this.options.pollMs));
    }, delay);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.shutdown.abort();
    await this.running?.catch(() => undefined);
  }

  runOnce() {
    if (this.stopped) return Promise.resolve();
    this.running ??= this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async drain() {
    await this.repository.recoverExpired();
    const claims = await this.repository.claimDue();
    let cursor = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(claims.length, this.options.concurrency) },
        async () => {
          while (!this.stopped && cursor < claims.length) {
            const claim = claims[cursor++];
            try {
              await this.deliver(claim);
            } catch {
              this.logger.error(
                `Push job ${claim.id}: database update failed; lease will recover`,
              );
            }
          }
        },
      ),
    );
  }

  private sendRetry(row: PushContext, code: string): PushOutcome {
    return row.attemptCount >= this.options.maxSendAttempts
      ? { status: 'FAILED', code }
      : {
          status: 'PENDING',
          code,
          ticketId: null,
          delayMs: Math.round(
            Math.min(
              300_000,
              this.options.retryBaseMs * 2 ** (row.attemptCount - 1),
            ) *
              (0.8 + Math.random() * 0.4),
          ),
        };
  }

  private message(row: PushContext): ExpoPushMessage {
    return {
      to: row.expoPushToken,
      title: Array.from(row.title).slice(0, 80).join(''),
      body: Array.from(row.body).slice(0, 320).join(''),
      sound: 'default',
      priority: 'high',
      channelId: 'stock-documents',
      tag: row.notificationId,
      expiration:
        Math.floor(Date.parse(row.notificationCreatedAt) / 1000) + 86400,
      data: {
        version: 1,
        notificationId: row.notificationId,
        recipientUserId: row.userId,
        farmId: row.farmId!,
        entityType: row.entityType!,
        entityId: row.entityId!,
        type: row.type,
      },
    };
  }

  private async deliver(claim: PushClaim) {
    const row = await this.repository.prepare(claim);
    if (!row || this.stopped) return;
    let outcome: PushOutcome;
    try {
      if (row.ticketId) {
        const receipt = await this.expo.receipt(
          row.ticketId,
          this.shutdown.signal,
        );
        if (!receipt)
          outcome = {
            status: 'AWAITING_RECEIPT',
            code: 'EXPO_RECEIPT_NOT_READY',
            delayMs: this.options.receiptPollMs,
          };
        else if (receipt.status === 'ok') outcome = { status: 'SUCCEEDED' };
        else outcome = this.providerError(row, receipt.code);
      } else {
        const ticket = await this.expo.send(
          this.message(row),
          this.shutdown.signal,
        );
        outcome =
          ticket.status === 'ok'
            ? {
                status: 'AWAITING_RECEIPT',
                ticketId: ticket.id,
                delayMs: this.options.receiptDelayMs,
              }
            : this.providerError(row, ticket.code);
      }
    } catch (error: unknown) {
      const failure =
        error instanceof ExpoPushFailure
          ? error
          : new ExpoPushFailure('EXPO_UNEXPECTED_FAILURE', true);
      outcome = !failure.retryable
        ? { status: 'FAILED', code: failure.code }
        : row.ticketId
          ? {
              status: 'AWAITING_RECEIPT',
              code: failure.code,
              delayMs:
                claim.previousError &&
                claim.previousError !== 'EXPO_RECEIPT_NOT_READY'
                  ? Math.min(
                      900_000,
                      Math.max(
                        this.options.receiptPollMs,
                        claim.previousDelayMs * 2,
                      ),
                    )
                  : this.options.receiptPollMs,
            }
          : this.sendRetry(row, failure.code);
    }
    if (await this.repository.finish(claim, row, outcome)) {
      this.logger.log(
        `Push job ${claim.id}: ${outcome.status}${outcome.code ? ` (${outcome.code})` : ''}`,
      );
    }
  }

  private providerError(row: PushContext, code: string): PushOutcome {
    if (code === 'MessageRateExceeded') return this.sendRetry(row, code);
    return {
      status: 'FAILED',
      code,
      disableDevice: code === 'DeviceNotRegistered',
    };
  }
}

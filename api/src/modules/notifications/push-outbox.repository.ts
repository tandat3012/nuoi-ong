import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  devicePushTokens,
  notifications,
  notificationPushOutbox,
} from '../../db/schema';
import {
  documentPushEligibility,
  lockPushUsers,
} from './notification-push-outbox';
import {
  PUSH_WORKER_OPTIONS,
  type PushWorkerOptions,
} from './push-worker.options';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type PushClaim = {
  id: string;
  lockId: string;
  ticketId: string | null;
  previousError: string | null;
  previousDelayMs: number;
};
export type PushOutcome = {
  status: 'PENDING' | 'AWAITING_RECEIPT' | 'SUCCEEDED' | 'FAILED';
  code?: string;
  delayMs?: number;
  ticketId?: string | null;
  disableDevice?: boolean;
};

@Injectable()
export class PushOutboxRepository {
  constructor(
    private readonly database: DatabaseService,
    @Inject(PUSH_WORKER_OPTIONS) private readonly options: PushWorkerOptions,
  ) {}

  private ownedClaim(claim: PushClaim) {
    return and(
      eq(notificationPushOutbox.id, claim.id),
      eq(notificationPushOutbox.lockId, claim.lockId),
      eq(notificationPushOutbox.status, 'PROCESSING'),
      sql`${notificationPushOutbox.lockedAt} >= statement_timestamp() - ${this.options.leaseMs} * interval '1 millisecond'`,
    );
  }

  private context(tx: Db | Transaction, claim: PushClaim, lock = false) {
    const query = tx
      .select({
        jobId: notificationPushOutbox.id,
        attemptCount: notificationPushOutbox.attemptCount,
        ticketId: notificationPushOutbox.expoTicketId,
        deviceId: devicePushTokens.id,
        installationId: devicePushTokens.installationId,
        expoPushToken: devicePushTokens.expoPushToken,
        deviceUpdatedAt: devicePushTokens.updatedAt,
        ownerId: devicePushTokens.userId,
        isActive: devicePushTokens.isActive,
        userId: notifications.userId,
        notificationId: notifications.id,
        farmId: notifications.farmId,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        notificationCreatedAt: notifications.createdAt,
        unread: sql<boolean>`${notifications.readAt} IS NULL`,
        fresh: sql<boolean>`${notifications.createdAt} >= statement_timestamp() - interval '24 hours' AND ${notifications.createdAt} <= statement_timestamp()`,
        receiptFresh: sql<boolean>`${notificationPushOutbox.createdAt} >= statement_timestamp() - interval '24 hours'`,
        eligible: sql<boolean>`${documentPushEligibility()}`,
      })
      .from(notificationPushOutbox)
      .innerJoin(
        notifications,
        eq(notifications.id, notificationPushOutbox.notificationId),
      )
      .innerJoin(
        devicePushTokens,
        eq(devicePushTokens.id, notificationPushOutbox.devicePushTokenId),
      )
      .where(this.ownedClaim(claim))
      .limit(1);
    return lock ? query.for('update', { of: notificationPushOutbox }) : query;
  }

  private invalidReason(row: PushContext) {
    if (!row.isActive) return 'DEVICE_INACTIVE';
    if (row.ownerId !== row.userId) return 'DEVICE_OWNER_CHANGED';
    if (!row.unread) return 'NOTIFICATION_READ';
    if (!row.fresh) return 'NOTIFICATION_EXPIRED';
    if (!row.eligible || !row.farmId || !row.entityId || !row.entityType)
      return 'ACCESS_OR_DOCUMENT_CHANGED';
    return null;
  }

  private async cancel(tx: Transaction, claim: PushClaim, reason: string) {
    await tx
      .update(notificationPushOutbox)
      .set({
        status: 'CANCELLED',
        lastError: reason,
        lockedAt: null,
        lockId: null,
        updatedAt: sql`statement_timestamp()`,
      })
      .where(this.ownedClaim(claim));
  }

  async recoverExpired() {
    await this.database.db.transaction(async (tx) => {
      const expired = await tx
        .select({ id: notificationPushOutbox.id })
        .from(notificationPushOutbox)
        .where(
          and(
            eq(notificationPushOutbox.status, 'PROCESSING'),
            sql`${notificationPushOutbox.lockedAt} < statement_timestamp() - ${this.options.leaseMs} * interval '1 millisecond'`,
          ),
        )
        .orderBy(
          asc(notificationPushOutbox.lockedAt),
          asc(notificationPushOutbox.id),
        )
        .limit(this.options.batchSize)
        .for('update', { skipLocked: true });
      if (!expired.length) return;
      await tx
        .update(notificationPushOutbox)
        .set({
          status: sql`CASE WHEN ${notificationPushOutbox.expoTicketId} IS NULL THEN 'PENDING' ELSE 'AWAITING_RECEIPT' END`,
          lockedAt: null,
          lockId: null,
          lastError: 'WORKER_LEASE_EXPIRED',
          nextAttemptAt: sql`statement_timestamp()`,
          updatedAt: sql`statement_timestamp()`,
        })
        .where(
          inArray(
            notificationPushOutbox.id,
            expired.map(({ id }) => id),
          ),
        );
    });
  }

  async claimDue(): Promise<PushClaim[]> {
    return this.database.db.transaction(async (tx) => {
      const due = await tx
        .select({
          id: notificationPushOutbox.id,
          previousError: notificationPushOutbox.lastError,
          previousDelayMs: sql<number>`greatest(0, extract(epoch from (${notificationPushOutbox.nextAttemptAt} - ${notificationPushOutbox.updatedAt})) * 1000)::double precision`,
        })
        .from(notificationPushOutbox)
        .where(
          and(
            or(
              eq(notificationPushOutbox.status, 'PENDING'),
              eq(notificationPushOutbox.status, 'AWAITING_RECEIPT'),
            ),
            lte(
              notificationPushOutbox.nextAttemptAt,
              sql`statement_timestamp()`,
            ),
          ),
        )
        .orderBy(
          asc(notificationPushOutbox.nextAttemptAt),
          asc(notificationPushOutbox.id),
        )
        .limit(this.options.batchSize)
        .for('update', { skipLocked: true });
      if (!due.length) return [];
      const lockId = randomUUID();
      const rows = await tx
        .update(notificationPushOutbox)
        .set({
          status: 'PROCESSING',
          lockId,
          lockedAt: sql`statement_timestamp()`,
          updatedAt: sql`statement_timestamp()`,
        })
        .where(
          inArray(
            notificationPushOutbox.id,
            due.map(({ id }) => id),
          ),
        )
        .returning({
          id: notificationPushOutbox.id,
          ticketId: notificationPushOutbox.expoTicketId,
        });
      return rows.map((row) => ({
        ...row,
        lockId,
        previousError: due.find((item) => item.id === row.id)!.previousError,
        previousDelayMs: due.find((item) => item.id === row.id)!
          .previousDelayMs,
      }));
    });
  }

  async prepare(claim: PushClaim) {
    return this.database.db.transaction(async (tx) => {
      const [row] = await this.context(tx, claim, true);
      if (!row) return null;
      const invalid = this.invalidReason(row);
      if (invalid) {
        await this.cancel(tx, claim, invalid);
        return null;
      }
      const failure = row.ticketId
        ? !row.receiptFresh
          ? 'RECEIPT_EXPIRED'
          : null
        : row.attemptCount >= this.options.maxSendAttempts
          ? 'SEND_ATTEMPTS_EXHAUSTED'
          : null;
      if (failure) {
        await tx
          .update(notificationPushOutbox)
          .set({
            status: 'FAILED',
            lastError: failure,
            lockId: null,
            lockedAt: null,
            updatedAt: sql`statement_timestamp()`,
          })
          .where(this.ownedClaim(claim));
        return null;
      }
      if (!row.ticketId) {
        const [attempt] = await tx
          .update(notificationPushOutbox)
          .set({
            attemptCount: sql`${notificationPushOutbox.attemptCount} + 1`,
          })
          .where(this.ownedClaim(claim))
          .returning({ count: notificationPushOutbox.attemptCount });
        row.attemptCount = attempt.count;
      }
      return row;
    });
  }

  async finish(claim: PushClaim, snapshot: PushContext, outcome: PushOutcome) {
    return this.database.db.transaction(async (tx) => {
      // Registration and invalid-token retirement use the same lock order.
      await lockPushUsers(tx, [snapshot.userId]);
      const [current] = await this.context(tx, claim, true);
      if (!current) return false;
      const invalid = this.invalidReason(current);
      const sameBinding =
        current.ownerId === snapshot.ownerId &&
        current.installationId === snapshot.installationId &&
        current.expoPushToken === snapshot.expoPushToken;
      if (invalid || !sameBinding) {
        await this.cancel(tx, claim, invalid ?? 'DEVICE_REGISTRATION_CHANGED');
        return false;
      }
      if (outcome.disableDevice) {
        const retired = await tx
          .update(devicePushTokens)
          .set({ isActive: false, updatedAt: sql`statement_timestamp()` })
          .where(
            and(
              eq(devicePushTokens.id, snapshot.deviceId),
              eq(devicePushTokens.userId, snapshot.userId),
              eq(devicePushTokens.installationId, snapshot.installationId),
              eq(devicePushTokens.expoPushToken, snapshot.expoPushToken),
              eq(devicePushTokens.updatedAt, snapshot.deviceUpdatedAt),
              eq(devicePushTokens.isActive, true),
            ),
          )
          .returning({ id: devicePushTokens.id });
        if (retired.length) {
          await tx
            .update(notificationPushOutbox)
            .set({
              status: 'CANCELLED',
              lastError: 'DEVICE_NOT_REGISTERED',
              lockId: null,
              lockedAt: null,
              updatedAt: sql`statement_timestamp()`,
            })
            .where(
              and(
                eq(notificationPushOutbox.devicePushTokenId, snapshot.deviceId),
                inArray(notificationPushOutbox.status, [
                  'PENDING',
                  'PROCESSING',
                  'AWAITING_RECEIPT',
                ]),
                sql`${notificationPushOutbox.id} <> ${claim.id}::uuid`,
              ),
            );
        }
      }
      await tx
        .update(notificationPushOutbox)
        .set({
          status: outcome.status,
          lastError: outcome.code ?? null,
          expoTicketId:
            outcome.ticketId === undefined
              ? current.ticketId
              : outcome.ticketId,
          nextAttemptAt: sql`statement_timestamp() + ${outcome.delayMs ?? 0} * interval '1 millisecond'`,
          lockId: null,
          lockedAt: null,
          updatedAt: sql`statement_timestamp()`,
        })
        .where(this.ownedClaim(claim));
      return true;
    });
  }
}

export type PushContext = NonNullable<
  Awaited<ReturnType<PushOutboxRepository['prepare']>>
>;

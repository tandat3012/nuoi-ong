import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  devicePushTokens,
  notificationPushOutbox,
  users,
} from '../../db/schema';
import type { RegisterNotificationDeviceDto } from './dto/register-notification-device.dto';
import {
  enqueueDeviceCatchUp,
  lockPushUsers,
} from './notification-push-outbox';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

// Neither responses nor device lookups expose the token used to address a phone.
const deviceFields = {
  id: devicePushTokens.id,
  userId: devicePushTokens.userId,
  installationId: devicePushTokens.installationId,
  platform: devicePushTokens.platform,
  isActive: devicePushTokens.isActive,
  lastSeenAt: devicePushTokens.lastSeenAt,
  createdAt: devicePushTokens.createdAt,
  updatedAt: devicePushTokens.updatedAt,
};

@Injectable()
export class NotificationDevicesService {
  constructor(private readonly database: DatabaseService) {}

  private async activeUserId(db: Db | Transaction, clerkUserId: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.authProviderUserId, clerkUserId),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!user) throw new ForbiddenException('Active user account is required');
    return user.id;
  }

  private async lockRegistration(
    tx: Transaction,
    installationId: string,
    expoPushToken?: string,
  ) {
    const keys = [`notification-device:installation:${installationId}`];
    if (expoPushToken) keys.push(`notification-device:token:${expoPushToken}`);
    // Transaction locks also serialize first registrations, before a row exists.
    for (const key of keys.sort()) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
      );
    }
  }

  private async cancelUnfinished(
    tx: Transaction,
    devicePushTokenId: string,
    reason: string,
    now: string,
  ) {
    await tx
      .update(notificationPushOutbox)
      .set({
        status: 'CANCELLED',
        lockedAt: null,
        lockId: null,
        lastError: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationPushOutbox.devicePushTokenId, devicePushTokenId),
          inArray(notificationPushOutbox.status, [
            'PENDING',
            'PROCESSING',
            'AWAITING_RECEIPT',
          ]),
        ),
      );
  }

  async register(
    clerkUserId: string,
    installationId: string,
    input: RegisterNotificationDeviceDto,
  ) {
    const normalizedInstallationId = installationId.toLowerCase();
    try {
      return await this.database.db.transaction(async (tx) => {
        const userId = await this.activeUserId(tx, clerkUserId);
        await this.lockRegistration(
          tx,
          normalizedInstallationId,
          input.expoPushToken,
        );
        const matchingRegistration = or(
          eq(devicePushTokens.installationId, normalizedInstallationId),
          eq(devicePushTokens.expoPushToken, input.expoPushToken),
        );
        const owners = await tx
          .select({ userId: devicePushTokens.userId })
          .from(devicePushTokens)
          .where(matchingRegistration);
        const lockedUsers = new Set([
          userId,
          ...owners.map((row) => row.userId),
        ]);
        await lockPushUsers(tx, [...lockedUsers]);
        const matches = await tx
          .select()
          .from(devicePushTokens)
          .where(matchingRegistration)
          .orderBy(asc(devicePushTokens.id))
          .for('update');
        if (matches.some((row) => !lockedUsers.has(row.userId))) {
          throw new ConflictException(
            'Device registration changed concurrently; register again',
          );
        }
        const installation = matches.find(
          (row) => row.installationId === normalizedInstallationId,
        );
        const token = matches.find(
          (row) => row.expoPushToken === input.expoPushToken,
        );
        if (installation && token && installation.id !== token.id) {
          throw new ConflictException(
            'Installation and Expo Push Token belong to different registrations',
          );
        }
        const existing = installation ?? token;
        const now = new Date().toISOString();
        const values = {
          userId,
          installationId: normalizedInstallationId,
          expoPushToken: input.expoPushToken,
          platform: input.platform,
          isActive: true,
          lastSeenAt: now,
          updatedAt: now,
        };
        if (!existing) {
          const [device] = await tx
            .insert(devicePushTokens)
            .values(values)
            .returning(deviceFields);
          await enqueueDeviceCatchUp(tx, device.id, userId);
          return { data: device };
        }

        const bindingChanged =
          existing.userId !== userId ||
          existing.installationId !== normalizedInstallationId ||
          existing.expoPushToken !== input.expoPushToken ||
          existing.platform !== input.platform;
        if (bindingChanged || !existing.isActive) {
          await this.cancelUnfinished(
            tx,
            existing.id,
            'DEVICE_REGISTRATION_CHANGED',
            now,
          );
        }
        const [device] = await tx
          .update(devicePushTokens)
          .set(values)
          .where(eq(devicePushTokens.id, existing.id))
          .returning(deviceFields);
        if (bindingChanged || !existing.isActive) {
          await enqueueDeviceCatchUp(tx, device.id, userId);
        }
        return { data: device };
      });
    } catch (error: unknown) {
      const databaseError = error as {
        code?: string;
        constraint?: string;
        cause?: { code?: string; constraint?: string };
      };
      const code = databaseError.cause?.code ?? databaseError.code;
      const constraint =
        databaseError.cause?.constraint ?? databaseError.constraint;
      if (
        code === '23505' &&
        constraint?.startsWith('uq_device_push_tokens_')
      ) {
        throw new ConflictException(
          'Device registration changed concurrently; register again',
        );
      }
      throw error;
    }
  }

  async get(clerkUserId: string, installationId: string) {
    const userId = await this.activeUserId(this.database.db, clerkUserId);
    const [device] = await this.database.db
      .select(deviceFields)
      .from(devicePushTokens)
      .where(
        and(
          eq(devicePushTokens.installationId, installationId.toLowerCase()),
          eq(devicePushTokens.userId, userId),
        ),
      )
      .limit(1);
    if (!device) throw new NotFoundException('Device registration not found');
    return { data: device };
  }

  async unregister(clerkUserId: string, installationId: string) {
    const normalizedInstallationId = installationId.toLowerCase();
    return this.database.db.transaction(async (tx) => {
      const userId = await this.activeUserId(tx, clerkUserId);
      await this.lockRegistration(tx, normalizedInstallationId);
      await lockPushUsers(tx, [userId]);
      const [existing] = await tx
        .select({ id: devicePushTokens.id })
        .from(devicePushTokens)
        .where(
          and(
            eq(devicePushTokens.installationId, normalizedInstallationId),
            eq(devicePushTokens.userId, userId),
          ),
        )
        .for('update')
        .limit(1);
      if (!existing) {
        throw new NotFoundException('Device registration not found');
      }
      const now = new Date().toISOString();
      await this.cancelUnfinished(tx, existing.id, 'DEVICE_UNREGISTERED', now);
      const [device] = await tx
        .update(devicePushTokens)
        .set({ isActive: false, updatedAt: now })
        .where(eq(devicePushTokens.id, existing.id))
        .returning(deviceFields);
      return { data: device };
    });
  }
}

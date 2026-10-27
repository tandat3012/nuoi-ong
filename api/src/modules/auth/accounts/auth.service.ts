import type { ClerkClient } from '@clerk/backend';
import {
  ForbiddenException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../../db/database.service';
import {
  farmMemberRoles,
  farmMembers,
  farms,
  roles,
  users,
  credentialActionLimits,
  storeSettings,
  warehouses,
} from '../../../db/schema';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto';
import { throwClerkError } from '../clerk/clerk-errors';
import { CLERK_CLIENT } from '../clerk/clerk-client.provider';
import { and } from 'drizzle-orm';
import { asc } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {}

  async getOrCreateUser(clerkUserId: string) {
    const [existingUser] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.authProviderUserId, clerkUserId))
      .limit(1);

    if (existingUser) {
      return existingUser;
    }

    const clerkUser = await this.clerkClient.users.getUser(clerkUserId);
    const userEmail = clerkUser.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
      throw new ServiceUnavailableException('Clerk user has no primary email');
    }

    const fullName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      null;

    const [newUser] = await this.databaseService.db
      .insert(users)
      .values({
        authProvider: 'CLERK',
        authProviderUserId: clerkUserId,
        email: userEmail,
        fullName: fullName,
        avatarUrl: clerkUser.imageUrl,
      })
      .onConflictDoUpdate({
        target: users.authProviderUserId,
        set: {
          email: userEmail,
          fullName,
          avatarUrl: clerkUser.imageUrl,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return newUser;
  }

  async getAuthContext(clerkUserId: string) {
    const user = await this.getOrCreateUser(clerkUserId);

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('User account is inactive or not found');
    }

    const rows = await this.databaseService.db
      .select({
        memberId: farmMembers.id,
        farmId: farms.id,
        farmCode: farms.code,
        farmName: farms.name,
        roleCode: roles.code,
      })
      .from(farmMembers)
      .innerJoin(farms, eq(farmMembers.farmId, farms.id))
      .leftJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(
        and(
          eq(farmMembers.userId, user.id),
          eq(farmMembers.status, 'ACTIVE'),
          eq(farms.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(farms.name), asc(farms.id));

    const memberShipMap = new Map<
      string,
      {
        memberId: string;
        farm: {
          id: string;
          code: string;
          name: string;
        };
        roles: string[];
      }
    >();

    for (const row of rows) {
      const membership = memberShipMap.get(row.memberId) ?? {
        memberId: row.memberId,
        farm: {
          id: row.farmId,
          code: row.farmCode,
          name: row.farmName,
        },
        roles: [],
      };

      if (row.roleCode && !membership.roles.includes(row.roleCode)) {
        membership.roles.push(row.roleCode);
      }

      memberShipMap.set(row.memberId, membership);
    }

    const memberships = [...memberShipMap.values()];
    // Lets the back office hide store screens on farms that do not own the store.
    const [storeFarm] = memberships.length
      ? await this.databaseService.db
          .select({ id: farms.id, name: farms.name })
          .from(storeSettings)
          .innerJoin(warehouses, eq(warehouses.id, storeSettings.warehouseId))
          .innerJoin(farms, eq(farms.id, warehouses.farmId))
          .where(eq(storeSettings.id, 1))
          .limit(1)
      : [];

    return {
      user: {
        id: user.id,
        clerkUserId: user.authProviderUserId,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        mustChangePassword: user.mustChangePassword,
      },
      memberships,
      defaultFarmId: memberships[0]?.farm.id ?? null,
      storeFarm: storeFarm ?? null,
    };
  }

  async limitCredentialAction(
    userId: string,
    action: 'CREATE_ACCOUNT' | 'ADD_ACCOUNT' | 'CHANGE_PASSWORD',
  ) {
    const [bucket] = await this.databaseService.db
      .insert(credentialActionLimits)
      .values({ userId, action })
      .onConflictDoUpdate({
        target: [credentialActionLimits.userId, credentialActionLimits.action],
        set: {
          attempts: sql`CASE WHEN ${credentialActionLimits.windowStartedAt} <= now() - interval '1 minute' THEN 1 ELSE ${credentialActionLimits.attempts} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${credentialActionLimits.windowStartedAt} <= now() - interval '1 minute' THEN now() ELSE ${credentialActionLimits.windowStartedAt} END`,
        },
      })
      .returning();
    if (bucket.attempts > 10)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again in a minute.',
        },
        429,
      );
  }

  async changeInitialPassword(
    clerkUserId: string,
    input: ChangeInitialPasswordDto,
  ) {
    const user = await this.getOrCreateUser(clerkUserId);
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('User account is inactive');
    await this.limitCredentialAction(user.id, 'CHANGE_PASSWORD');
    if (input.currentPassword === input.newPassword)
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'Choose a different password.',
      });
    await this.databaseService.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');
      if (current.status !== 'ACTIVE')
        throw new ForbiddenException('User account is inactive');
      if (!current.mustChangePassword)
        throw new BadRequestException({
          code: 'PASSWORD_CHANGE_NOT_REQUIRED',
          message: 'An initial password change is not required.',
        });
      const result = await this.clerkClient.users
        .verifyPassword({
          userId: clerkUserId,
          password: input.currentPassword,
        })
        .catch(throwClerkError);
      if (!result.verified)
        throw new BadRequestException('Current password is incorrect');
      await this.clerkClient.users
        .updateUser(clerkUserId, {
          password: input.newPassword,
          signOutOfOtherSessions: true,
        })
        .catch(throwClerkError);
      await tx
        .update(users)
        .set({ mustChangePassword: false, updatedAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
    });
    return {
      message: 'Password changed. Sign in again.',
      requiresSignIn: true,
    };
  }
}

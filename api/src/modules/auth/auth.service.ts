import type { ClerkClient } from '@clerk/backend';
import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { farmMemberRoles, farmMembers, farms, roles, users } from '../../db/schema';
import { CLERK_CLIENT } from './clerk-client.provider';
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
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

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
      .leftJoin(farmMemberRoles, eq(farmMemberRoles.farmMemberId, farmMembers.id))
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

    return {
      user: {
        id: user.id,
        clerkUserId: user.authProviderUserId,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      memberships,
      defaultFarmId: memberships[0]?.farm.id ?? null,
    };
  }
}

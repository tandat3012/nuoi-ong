import type { ClerkClient } from '@clerk/backend';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import {
  farmMemberRoles,
  farmMembers,
  farms,
  roles,
  users,
} from '../../db/schema';
import { CLERK_CLIENT } from './clerk-client.provider';

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

  async getUserFarms(userId: string) {
    const memberships = await this.databaseService.db
      .select({
        farmId: farms.id,
        farmCode: farms.code,
        farmName: farms.name,
        farmStatus: farms.status,
        memberStatus: farmMembers.status,
        roleCode: roles.code,
        roleName: roles.name,
      })
      .from(farmMembers)
      .innerJoin(farms, eq(farms.id, farmMembers.farmId))
      .leftJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(eq(farmMembers.userId, userId));

    const grouped = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        status: string;
        roles: Array<{ code: string; name: string }>;
      }
    >();

    for (const membership of memberships) {
      if (membership.memberStatus !== 'ACTIVE' || membership.farmStatus !== 'ACTIVE') {
        continue;
      }

      const farm = grouped.get(membership.farmId) ?? {
        id: membership.farmId,
        code: membership.farmCode,
        name: membership.farmName,
        status: membership.farmStatus,
        roles: [],
      };

      if (membership.roleCode && !farm.roles.some((role) => role.code === membership.roleCode)) {
        farm.roles.push({
          code: membership.roleCode,
          name: membership.roleName ?? membership.roleCode,
        });
      }
      grouped.set(membership.farmId, farm);
    }

    return [...grouped.values()].map((farm) => ({
      ...farm,
      role:
        farm.roles.find((role) => ['ADMIN', 'FARM_OWNER'].includes(role.code))?.code ??
        farm.roles[0]?.code ??
        null,
    }));
  }
}

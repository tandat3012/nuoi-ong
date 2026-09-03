import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Reflector } from '@nestjs/core';
import { requireUuid } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { farmMemberRoles, farmMembers, roles, users } from '../../db/schema';
import { FARM_ROLES_KEY } from './farm-access.decorator';
import type { AuthRequest } from './types/auth-request.type';

@Injectable()
export class FarmAccessGuard implements CanActivate {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const farmId = requireUuid(
      typeof request.query.farmId === 'string'
        ? request.query.farmId
        : undefined,
      'farmId',
    );

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      FARM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const membershipRows = await this.databaseService.db
      .select({
        memberStatus: farmMembers.status,
        userStatus: users.status,
        roleCode: roles.code,
      })
      .from(users)
      .innerJoin(
        farmMembers,
        and(eq(farmMembers.userId, users.id), eq(farmMembers.farmId, farmId)),
      )
      .leftJoin(
        farmMemberRoles,
        eq(farmMemberRoles.farmMemberId, farmMembers.id),
      )
      .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
      .where(eq(users.authProviderUserId, request.auth.clerkUserId));

    const activeRoles = membershipRows
      .filter(
        (row) => row.userStatus === 'ACTIVE' && row.memberStatus === 'ACTIVE',
      )
      .map((row) => row.roleCode)
      .filter((roleCode): roleCode is string => roleCode !== null);

    if (activeRoles.length === 0) {
      throw new ForbiddenException('User is not an active member of this farm');
    }

    if (
      requiredRoles?.length &&
      !requiredRoles.some((role) => activeRoles.includes(role))
    ) {
      throw new ForbiddenException('User does not have the required farm role');
    }

    return true;
  }
}

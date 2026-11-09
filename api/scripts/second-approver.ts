import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';

/**
 * Another active ADMIN/FARM_OWNER of the farm to approve what `requester`
 * asked for (P0-01: nobody approves their own stock change); null when the
 * farm has none, and the request then stays pending.
 */
export async function secondApprover(
  db: DatabaseService['db'],
  farmId: string,
  requester: string,
) {
  const [approver] = await db
    .select({ clerkUserId: schema.users.authProviderUserId })
    .from(schema.farmMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.farmMembers.userId))
    .innerJoin(
      schema.farmMemberRoles,
      eq(schema.farmMemberRoles.farmMemberId, schema.farmMembers.id),
    )
    .innerJoin(schema.roles, eq(schema.roles.id, schema.farmMemberRoles.roleId))
    .where(
      and(
        eq(schema.farmMembers.farmId, farmId),
        eq(schema.farmMembers.status, 'ACTIVE'),
        eq(schema.users.status, 'ACTIVE'),
        inArray(schema.roles.code, ['FARM_OWNER', 'ADMIN']),
        ne(schema.users.authProviderUserId, requester),
      ),
    )
    .orderBy(asc(schema.farmMembers.createdAt))
    .limit(1);
  return approver?.clerkUserId ?? null;
}

import type { ClerkClient } from '@clerk/backend';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database.service';
import { users } from '../../db/schema';
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
}

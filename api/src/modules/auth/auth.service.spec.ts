import type { ClerkClient } from '@clerk/backend';
import type { DatabaseService } from '../../db/database.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const database = {
    select: jest.fn(),
    insert: jest.fn(),
  };
  const databaseService = { db: database } as unknown as DatabaseService;
  const getUser = jest.fn();
  const clerkClient = {
    users: { getUser },
  } as unknown as ClerkClient;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(databaseService, clerkClient);
  });

  it('returns the existing local user without calling Clerk', async () => {
    const user = { id: 'local-user-id', authProviderUserId: 'user_123' };
    database.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: jest.fn().mockResolvedValue([user]),
        }),
      }),
    });

    await expect(service.getOrCreateUser('user_123')).resolves.toBe(user);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('upserts a Clerk user that is not yet in PostgreSQL', async () => {
    const createdUser = { id: 'local-user-id', authProviderUserId: 'user_123' };
    const returning = jest.fn().mockResolvedValue([createdUser]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning });

    database.select.mockReturnValue({
      from: () => ({
        where: () => ({ limit: jest.fn().mockResolvedValue([]) }),
      }),
    });
    database.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({ onConflictDoUpdate }),
    });
    getUser.mockResolvedValue({
      id: 'user_123',
      firstName: 'Bee',
      lastName: null,
      imageUrl: 'https://example.com/avatar.png',
      primaryEmailAddress: { emailAddress: 'beekeeper@example.com' },
    });

    await expect(service.getOrCreateUser('user_123')).resolves.toBe(
      createdUser,
    );
    expect(database.insert).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});

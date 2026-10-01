import type { ClerkClient } from '@clerk/backend';
import type { DatabaseService } from '../../db/database.service';
import { AuthService } from './auth.service';
import { ForbiddenException } from '@nestjs/common';
import { farmMembers } from '../../db/schema';

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

  function contextRows(rows: unknown[], status = 'ACTIVE') {
    database.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'local-user',
              authProviderUserId: 'user_123',
              status,
              email: 'user@example.com',
              fullName: null,
              avatarUrl: null,
              systemRoleId: 'private-role-id',
            },
          ],
        }),
      }),
    });
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn().mockResolvedValue(rows),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    database.select.mockReturnValueOnce(query);
  }

  it('returns null default farm when the user has no memberships', async () => {
    contextRows([]);
    await expect(service.getAuthContext('user_123')).resolves.toEqual({
      user: {
        id: 'local-user',
        clerkUserId: 'user_123',
        email: 'user@example.com',
        fullName: null,
        avatarUrl: null,
      },
      memberships: [],
      defaultFarmId: null,
    });
  });

  it('keeps farms and their roles separate and deduplicates roles', async () => {
    const first = {
      memberId: 'membership-a',
      farmId: 'farm-a',
      farmCode: 'A',
      farmName: 'A',
      roleCode: 'EMPLOYEE',
    };
    contextRows([
      first,
      first,
      {
        ...first,
        memberId: 'membership-b',
        farmId: 'farm-b',
        roleCode: 'FARM_OWNER',
      },
    ]);
    const context = await service.getAuthContext('user_123');
    expect(database.select).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ memberId: farmMembers.id }),
    );
    expect(context.memberships).toHaveLength(2);
    expect(context.memberships[0].roles).toEqual(['EMPLOYEE']);
    expect(context.memberships[1].roles).toEqual(['FARM_OWNER']);
    expect(context.defaultFarmId).toBe('farm-a');
  });

  it('rejects inactive users before loading memberships', async () => {
    contextRows([], 'INACTIVE');
    await expect(service.getAuthContext('user_123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(database.select).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    jest.resetAllMocks();
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

import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController', () => {
  it('returns the safe local user profile for the current Clerk user', async () => {
    const authService = {
      getOrCreateUser: jest.fn().mockResolvedValue({
        id: 'local-user-id',
        authProviderUserId: 'user_123',
        email: 'beekeeper@example.com',
        fullName: 'Bee Keeper',
        avatarUrl: null,
      }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(
      controller.getMe({ clerkUserId: 'user_123' }),
    ).resolves.toEqual({
      user: {
        id: 'local-user-id',
        clerkUserId: 'user_123',
        email: 'beekeeper@example.com',
        fullName: 'Bee Keeper',
        avatarUrl: null,
      },
    });
  });
});

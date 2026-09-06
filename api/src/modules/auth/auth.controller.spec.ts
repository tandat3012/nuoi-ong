import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController', () => {
  it('uses the verified identity and returns the application context', async () => {
    const context = {
      user: { id: 'local-user' },
      memberships: [],
      defaultFarmId: null,
    };
    const getAuthContext = jest.fn().mockResolvedValue(context);
    const controller = new AuthController({
      getAuthContext,
    } as unknown as AuthService);
    await expect(
      controller.getMe({ clerkUserId: 'user_123' }),
    ).resolves.toEqual(context);
    expect(getAuthContext).toHaveBeenCalledWith('user_123');
  });
});

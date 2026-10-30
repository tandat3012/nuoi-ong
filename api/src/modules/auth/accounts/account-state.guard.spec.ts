import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AccountStateGuard } from './account-state.guard';
import type { AuthService } from './auth.service';
import { ALLOW_INITIAL_PASSWORD } from './initial-password.decorator';
import { IS_PUBLIC_KEY } from '../clerk/public.decorator';

describe('AccountStateGuard', () => {
  const getOrCreateUser = jest.fn();
  const authService = { getOrCreateUser } as unknown as AuthService;
  const metadata: Record<string, boolean | undefined> = {};
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ auth: { clerkUserId: 'user_123' } }),
    }),
  } as unknown as ExecutionContext;
  const guard = new AccountStateGuard(authService, reflector);

  beforeEach(() => {
    jest.resetAllMocks();
    delete metadata[IS_PUBLIC_KEY];
    delete metadata[ALLOW_INITIAL_PASSWORD];
  });

  it('skips public routes without loading the user', async () => {
    metadata[IS_PUBLIC_KEY] = true;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getOrCreateUser).not.toHaveBeenCalled();
  });

  it('allows active users who do not need a password change', async () => {
    getOrCreateUser.mockResolvedValue({
      status: 'ACTIVE',
      mustChangePassword: false,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getOrCreateUser).toHaveBeenCalledWith('user_123');
  });

  it('rejects inactive accounts', async () => {
    getOrCreateUser.mockResolvedValue({ status: 'INACTIVE' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'ACCOUNT_INACTIVE' },
    });
  });

  it('blocks users with an initial password outside allowed routes', async () => {
    getOrCreateUser.mockResolvedValue({
      status: 'ACTIVE',
      mustChangePassword: true,
    });
    const result = guard.canActivate(context);
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toMatchObject({
      response: { code: 'PASSWORD_CHANGE_REQUIRED' },
    });

    metadata[ALLOW_INITIAL_PASSWORD] = true;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

import type { ClerkClient } from '@clerk/backend';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard';

describe('ClerkAuthGuard', () => {
  const getAllAndOverride = jest.fn();
  const authenticateRequest = jest.fn();
  const reflector = {
    getAllAndOverride,
  } as unknown as Reflector;
  const clerkClient = {
    authenticateRequest,
  } as unknown as ClerkClient;
  const request = {
    headers: { authorization: 'Bearer session-token' },
    protocol: 'http',
    method: 'GET',
    originalUrl: '/auth/me',
    get: jest.fn().mockReturnValue('localhost:5050'),
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  let guard: ClerkAuthGuard;

  beforeEach(() => {
    process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
    jest.clearAllMocks();
    guard = new ClerkAuthGuard(reflector, clerkClient);
  });

  it('skips Clerk verification for public endpoints', async () => {
    getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it('attaches a verified Clerk session to the request', async () => {
    getAllAndOverride.mockReturnValue(false);
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({
        tokenType: 'session_token',
        userId: 'user_123',
        sessionId: 'sess_123',
      }),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({
      auth: { clerkUserId: 'user_123', sessionId: 'sess_123' },
    });
  });

  it('rejects unauthenticated requests', async () => {
    getAllAndOverride.mockReturnValue(false);
    authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails safely when allowed frontend origins are not configured', async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = '';
    getAllAndOverride.mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
});

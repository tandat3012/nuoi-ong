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
  const request: {
    headers: { authorization?: string; cookie?: string };
    [key: string]: unknown;
  } = {
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
    request.headers = { authorization: 'Bearer session-token' };
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

  it('rejects a non-session token or token without a user ID', async () => {
    getAllAndOverride.mockReturnValue(false);
    authenticateRequest.mockResolvedValueOnce({
      isAuthenticated: true,
      toAuth: () => ({
        tokenType: 'oauth_token',
        userId: 'user_123',
        sessionId: null,
      }),
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    authenticateRequest.mockResolvedValueOnce({
      isAuthenticated: true,
      toAuth: () => ({
        tokenType: 'session_token',
        userId: null,
        sessionId: 'sess_123',
      }),
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('converts Clerk verification failures into Unauthorized', async () => {
    getAllAndOverride.mockReturnValue(false);
    authenticateRequest.mockRejectedValue(new Error('invalid token'));

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

  describe('authorized parties', () => {
    const jwt = (claims: object) =>
      `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
    const optionsFor = async (headers: typeof request.headers) => {
      request.headers = headers;
      getAllAndOverride.mockReturnValue(false);
      authenticateRequest.mockResolvedValue({
        isAuthenticated: true,
        toAuth: () => ({
          tokenType: 'session_token',
          userId: 'user_123',
          sessionId: 'sess_123',
        }),
      });
      await guard.canActivate(context);
      const [[, options]] = authenticateRequest.mock.calls as [
        [unknown, { authorizedParties?: string[] }],
      ];
      return options;
    };
    const checked = { authorizedParties: ['http://localhost:3000'] };

    it('checks a web token that carries azp', async () => {
      await expect(
        optionsFor({
          authorization: `Bearer ${jwt({ azp: 'http://localhost:3000' })}`,
        }),
      ).resolves.toMatchObject(checked);
    });

    it('still checks a token with a foreign azp sent without Origin', async () => {
      await expect(
        optionsFor({
          authorization: `Bearer ${jwt({ azp: 'https://evil.example' })}`,
        }),
      ).resolves.toMatchObject(checked);
    });

    it('lets a native bearer token without azp through to Clerk verification', async () => {
      const options = await optionsFor({
        authorization: `Bearer ${jwt({ sub: 'user_123' })}`,
      });
      expect(options).not.toHaveProperty('authorizedParties');
    });

    it('checks cookie sessions and headers Clerk would not read as a bearer token', async () => {
      await expect(
        optionsFor({ cookie: '__session=abc' }),
      ).resolves.toMatchObject(checked);
      authenticateRequest.mockClear();
      await expect(
        optionsFor({
          authorization: `bearer ${jwt({ sub: 'user_123' })}`,
          cookie: '__session=abc',
        }),
      ).resolves.toMatchObject(checked);
      authenticateRequest.mockClear();
      await expect(
        optionsFor({ authorization: 'Bearer not-a-jwt' }),
      ).resolves.toMatchObject(checked);
    });
  });
});

import type { ClerkClient } from '@clerk/backend';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CLERK_CLIENT } from './clerk-client.provider';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { Request as ExpressRequest } from 'express';
import type { AuthRequest } from './types/auth-request.type';

type ClerkRequestState = {
  isAuthenticated: boolean;
  toAuth(): {
    sessionId: string | null;
    tokenType: string | null;
    userId: string | null;
  };
};

// Native (Expo) session tokens have no `azp`, and Clerk rejects a missing `azp`
// whenever authorizedParties is set. Only such header tokens skip the check; a
// token carrying any `azp`, and every cookie session, is still checked. The header
// is parsed exactly as Clerk does, so Clerk verifies this same token (signature,
// expiry, issuer) and never falls back to the cookie.
function isBearerWithoutAzp(authorization: string | undefined): boolean {
  const [scheme, token] = (authorization ?? '').split(' ', 2);
  if (scheme !== 'Bearer' || !token) return false;
  try {
    const payload = Buffer.from(token.split('.')[1] ?? '', 'base64url');
    const claims = JSON.parse(payload.toString('utf8')) as { azp?: unknown };
    return claims.azp === undefined;
  } catch {
    return false;
  }
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!isDevelopment && authorizedParties.length === 0) {
      throw new ServiceUnavailableException(
        'CLERK_AUTHORIZED_PARTIES is not configured',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<ExpressRequest>() as AuthRequest;
    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      } else if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      }
    }

    const host = request.get('host') ?? 'localhost';
    const clerkRequest = new Request(
      `${request.protocol}://${host}${request.originalUrl}`,
      {
        method: request.method,
        headers,
      },
    );

    let requestState: ClerkRequestState;
    try {
      requestState = (await this.clerkClient.authenticateRequest(clerkRequest, {
        acceptsToken: 'session_token',
        ...(isDevelopment || isBearerWithoutAzp(request.headers.authorization)
          ? {}
          : { authorizedParties }),
      })) as unknown as ClerkRequestState;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
    if (!requestState.isAuthenticated) {
      throw new UnauthorizedException('Unauthorized');
    }
    const auth = requestState.toAuth();

    if (auth.tokenType !== 'session_token' || !auth.userId) {
      throw new UnauthorizedException('Invalid authentication type');
    }
    request.auth = {
      clerkUserId: auth.userId,
      sessionId: auth.sessionId,
    };
    return true;
  }
}

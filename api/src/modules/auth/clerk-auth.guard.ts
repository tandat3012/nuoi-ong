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
  reason?: string | null;
  message?: string | null;
  status?: string;
  toAuth(): {
    sessionId: string | null;
    tokenType: string | null;
    userId: string | null;
  };
};

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

    const request = context
      .switchToHttp()
      .getRequest<ExpressRequest>() as AuthRequest;
    const hasBearerToken = /^Bearer\s+\S+/i.test(
      request.headers.authorization ?? '',
    );
    // Native clients send explicit bearer tokens, not browser cookies; they have no
    // web origin to compare with the session token's optional `azp` claim.
    const isNativeBearerRequest = hasBearerToken && !request.headers.origin;
    const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!isNativeBearerRequest && authorizedParties.length === 0) {
      throw new ServiceUnavailableException(
        'CLERK_AUTHORIZED_PARTIES is not configured',
      );
    }

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

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      try {
        const payload = token?.split('.')[1];
        const claims = payload
          ? (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
              azp?: unknown;
              iss?: unknown;
            })
          : {};
        console.info('[auth-debug] azp:', claims.azp ?? '<missing>');
        console.info('[auth-debug] iss:', claims.iss ?? '<missing>');
      } catch {
        console.info('[auth-debug] Could not decode token claims');
      }
      console.info(
        '[auth-debug] auth mode:',
        isNativeBearerRequest ? 'native-bearer' : 'origin-validated',
      );
      if (!isNativeBearerRequest) {
        console.info('[auth-debug] authorizedParties:', authorizedParties);
      }
    }

    let requestState: ClerkRequestState;
    try {
      requestState = (await this.clerkClient.authenticateRequest(clerkRequest, {
        acceptsToken: 'session_token',
        ...(isNativeBearerRequest ? {} : { authorizedParties }),
      })) as unknown as ClerkRequestState;
    } catch (error) {
      if (isDevelopment) {
        console.error(
          '[auth-debug] Clerk authenticateRequest failed:',
          error instanceof Error ? error.message : String(error),
        );
      }
      throw new UnauthorizedException('Unauthorized');
    }
    if (!requestState.isAuthenticated) {
      if (isDevelopment) {
        console.error('[auth-debug] Clerk authentication result:', {
          status: requestState.status,
          reason: requestState.reason,
          message: requestState.message,
        });
      }
      throw new UnauthorizedException('Unauthorized');
    }
    const auth = requestState.toAuth();

    if (auth.tokenType !== 'session_token' || !auth.userId) {
      if (isDevelopment) {
        console.error('[auth-debug] Invalid authenticated token metadata:', {
          tokenType: auth.tokenType,
          hasUserId: Boolean(auth.userId),
        });
      }
      throw new UnauthorizedException('Invalid authentication type');
    }
    request.auth = {
      clerkUserId: auth.userId,
      sessionId: auth.sessionId,
    };
    return true;
  }
}

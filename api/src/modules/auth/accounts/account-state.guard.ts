import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { ALLOW_INITIAL_PASSWORD } from './initial-password.decorator';
import { IS_PUBLIC_KEY } from '../clerk/public.decorator';
import type { AuthRequest } from '../clerk/types/auth-request.type';

@Injectable()
export class AccountStateGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const handlers = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, handlers))
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = await this.authService.getOrCreateUser(
      request.auth.clerkUserId,
    );
    if (!user || user.status !== 'ACTIVE')
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is inactive.',
      });
    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(
        ALLOW_INITIAL_PASSWORD,
        handlers,
      )
    )
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your initial password before continuing.',
      });
    return true;
  }
}

import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentAuth } from './current-auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getMe(@CurrentAuth() auth: { clerkUserId: string }) {
    return this.authService.getAuthContext(auth.clerkUserId);
  }
}

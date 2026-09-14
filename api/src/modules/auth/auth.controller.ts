import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentAuth } from './current-auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async getMe(@CurrentAuth() auth: { clerkUserId: string }) {
    const user = await this.authService.getOrCreateUser(auth.clerkUserId);
    const farms = await this.authService.getUserFarms(user.id);

    return {
      user: {
        id: user.id,
        clerkUserId: user.authProviderUserId,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      memberships: farms.map(({ roles, ...farm }) => ({
        farm,
        roles: roles.map((role) => role.code),
      })),
    };
  }
}

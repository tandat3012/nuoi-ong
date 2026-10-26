import { Module } from '@nestjs/common';
import { AuthService } from './accounts/auth.service';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './accounts/auth.controller';
import {
  CLERK_CLIENT,
  clerkClientProvider,
} from './clerk/clerk-client.provider';
import { ClerkAuthGuard } from './clerk/clerk-auth.guard';
import { FarmAccessGuard } from './farm-access/farm-access.guard';
import { AccountStateGuard } from './accounts/account-state.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    FarmAccessGuard,
    clerkClientProvider,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    { provide: APP_GUARD, useClass: AccountStateGuard },
  ],
  exports: [FarmAccessGuard, AuthService, CLERK_CLIENT],
})
export class AuthModule {}

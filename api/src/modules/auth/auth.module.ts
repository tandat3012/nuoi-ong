import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { clerkClientProvider } from './clerk-client.provider';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { FarmAccessGuard } from './farm-access.guard';

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
  ],
  exports: [FarmAccessGuard],
})
export class AuthModule {}

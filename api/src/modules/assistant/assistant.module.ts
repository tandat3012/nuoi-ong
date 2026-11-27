import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [AuthModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

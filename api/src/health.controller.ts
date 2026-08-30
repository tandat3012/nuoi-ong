import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './db/database.service';
import { Public } from './modules/auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('database')
  async checkDatabase(): Promise<{ status: 'ok' }> {
    await this.databaseService.ping();

    return { status: 'ok' };
  }
}

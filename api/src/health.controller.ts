import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseService } from './db/database.service';
import { Public } from './modules/auth/public.decorator';

@Public()
@Controller('health')
@ApiTags('Tình trạng dịch vụ')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('database')
  @ApiOperation({
    summary: 'Kiểm tra kết nối cơ sở dữ liệu',
    description: 'Thực hiện truy vấn ping đến PostgreSQL.',
  })
  @ApiOkResponse({
    description: 'Cơ sở dữ liệu phản hồi.',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'DATABASE_URL chưa được cấu hình.',
  })
  async checkDatabase(): Promise<{ status: 'ok' }> {
    await this.databaseService.ping();

    return { status: 'ok' };
  }
}

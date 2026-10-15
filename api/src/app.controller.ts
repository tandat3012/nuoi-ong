import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './modules/auth/public.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
@ApiTags('Tổng quan')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra API đang hoạt động' })
  @ApiOkResponse({
    description: 'Thông điệp chào dạng văn bản thuần.',
    content: {
      'text/html': { schema: { type: 'string', example: 'Hello World!' } },
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}

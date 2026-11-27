import {
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiFarmIdQuery } from '../../common/swagger-docs';
import { FarmAccessGuard } from '../auth/farm-access/farm-access.guard';
import { FarmRoles } from '../auth/farm-access/farm-access.decorator';
import { WAREHOUSE_MANAGE_ROLES } from '../auth/farm-access/farm-role-groups';
import type { AuthRequest } from '../auth/clerk/types/auth-request.type';
import { AssistantService } from './assistant.service';
import { QUESTIONS_PER_MINUTE, QuestionLimiter } from './question-limiter';
import { ReportQuestionDto } from './report-question.dto';

@ApiTags('Assistant')
@Controller('assistant')
@ApiBearerAuth('clerk-jwt')
export class AssistantController {
  private readonly limiter = new QuestionLimiter();

  constructor(private readonly assistantService: AssistantService) {}

  @Post('report-filters')
  @HttpCode(200)
  // Same roles as the stock report: whoever cannot read it never reaches the model.
  @UseGuards(FarmAccessGuard)
  @FarmRoles(...WAREHOUSE_MANAGE_ROLES)
  @ApiOperation({
    summary: 'Chuyển câu hỏi tiếng Việt thành bộ lọc báo cáo nhập – xuất – tồn',
  })
  @ApiFarmIdQuery()
  @ApiOkResponse({
    description:
      'Chỉ trả bộ lọc, không trả số liệu. warehouse/item là cụm từ người dùng gõ, Web tự đối chiếu với danh mục rồi gọi /dashboard/stock-report. dateFrom/dateTo cùng null khi câu không nói kỳ hoặc kỳ không hợp lệ (quá 366 ngày, ngày không tồn tại).',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            metric: { type: 'string', enum: ['STOCK_MOVEMENT', 'UNSUPPORTED'] },
            warehouse: { type: 'string', nullable: true },
            item: { type: 'string', nullable: true },
            dateFrom: { type: 'string', nullable: true, example: '2026-11-01' },
            dateTo: { type: 'string', nullable: true, example: '2026-11-27' },
          },
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Chỉ quản trị viên, chủ trang trại hoặc quản lý kho.',
  })
  @ApiTooManyRequestsResponse({
    description: `AI_RATE_LIMITED: quá ${QUESTIONS_PER_MINUTE} câu mỗi phút cho một người trong một trại; retryAfterSeconds.`,
  })
  @ApiServiceUnavailableResponse({
    description:
      'AI_UNAVAILABLE: chưa cấu hình, quá thời gian hoặc lỗi Gemini.',
  })
  async reportFilters(
    @Req() request: AuthRequest,
    @Query('farmId') farmId: string,
    @Body() dto: ReportQuestionDto,
  ) {
    // farmId is already checked by FarmAccessGuard.
    // Lowercased: Postgres accepts either case of the same UUID.
    this.limiter.take(`${request.auth.clerkUserId}:${farmId.toLowerCase()}`);
    return { data: await this.assistantService.reportFilters(dto.question) };
  }
}

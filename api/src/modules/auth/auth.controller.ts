import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentAuth } from './current-auth.decorator';

@Controller('auth')
@ApiTags('Tài khoản')
@ApiBearerAuth('clerk-jwt')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Lấy tài khoản và các trang trại được truy cập',
    description:
      'Dùng Clerk session JWT đang đăng nhập; không có endpoint cấp token riêng trong API.',
  })
  @ApiOkResponse({
    description:
      'Thông tin người dùng, membership đang hoạt động và trang trại mặc định.',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            clerkUserId: { type: 'string', example: 'user_2abc123' },
            email: {
              type: 'string',
              format: 'email',
              example: 'owner@example.com',
            },
            fullName: { type: 'string', nullable: true, example: 'Nguyen An' },
            avatarUrl: { type: 'string', nullable: true, format: 'uri' },
          },
        },
        memberships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              memberId: { type: 'string', format: 'uuid' },
              farm: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  code: { type: 'string', example: 'FARM-001' },
                  name: { type: 'string', example: 'Trang trại Mùa Xuân' },
                },
              },
              roles: {
                type: 'array',
                items: { type: 'string' },
                example: ['FARM_OWNER'],
              },
            },
          },
        },
        defaultFarmId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Thiếu hoặc không hợp lệ Clerk session JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Tài khoản không hoạt động hoặc không còn tồn tại.',
  })
  getMe(@CurrentAuth() auth: { clerkUserId: string }) {
    return this.authService.getAuthContext(auth.clerkUserId);
  }
}

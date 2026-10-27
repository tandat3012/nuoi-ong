import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { requireUuid } from '../../common/query-params';
import { CurrentAuth } from '../auth/current-auth.decorator';
import {
  NotificationDeviceResponseDto,
  RegisterNotificationDeviceDto,
} from './dto/register-notification-device.dto';
import { NotificationDevicesService } from './notification-devices.service';

@Controller('notifications/devices')
@ApiTags('Thiết bị nhận thông báo')
@ApiBearerAuth('clerk-jwt')
@ApiParam({
  name: 'installationId',
  format: 'uuid',
  description: 'UUID ổn định của lượt cài app, lưu riêng với phiên đăng nhập.',
})
@ApiUnauthorizedResponse({ description: 'Cần phiên Clerk hợp lệ.' })
@ApiForbiddenResponse({
  description: 'Tài khoản DB không tồn tại hoặc bị khóa.',
})
@ApiBadRequestResponse({
  description: 'UUID, platform hoặc Expo token không hợp lệ.',
})
export class NotificationDevicesController {
  constructor(private readonly devices: NotificationDevicesService) {}

  @Put(':installationId')
  @ApiOperation({
    summary: 'Đăng ký hoặc cập nhật thiết bị cho tài khoản đang đăng nhập',
    description:
      'Không truyền userId hoặc farmId. User lấy từ Clerk. Đổi chủ/token sẽ hủy job chưa hoàn tất của liên kết cũ trong cùng transaction. Khi tạo hoặc đổi liên kết, xếp hàng tối đa 5 thông báo chưa đọc mới nhất trong 24 giờ, còn quyền và còn đúng trạng thái phiếu. Không khôi phục job đã hủy. Chưa gửi push trực tiếp.',
  })
  @ApiOkResponse({ type: NotificationDeviceResponseDto })
  @ApiConflictResponse({
    description:
      'Token và installation đang thuộc hai đăng ký khác nhau hoặc có xung đột đồng thời.',
  })
  register(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('installationId') installationId: string,
    @Body() body: RegisterNotificationDeviceDto,
  ) {
    return this.devices.register(
      auth.clerkUserId,
      requireUuid(installationId, 'installationId'),
      body,
    );
  }

  @Get(':installationId')
  @ApiOperation({
    summary: 'Xem đăng ký thiết bị của chính tài khoản, không trả Expo token',
  })
  @ApiOkResponse({ type: NotificationDeviceResponseDto })
  @ApiNotFoundResponse({
    description: 'Thiết bị không tồn tại hoặc thuộc tài khoản khác.',
  })
  get(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('installationId') installationId: string,
  ) {
    return this.devices.get(
      auth.clerkUserId,
      requireUuid(installationId, 'installationId'),
    );
  }

  @Delete(':installationId')
  @ApiOperation({
    summary: 'Hủy đăng ký thiết bị của chính tài khoản khi đăng xuất',
    description:
      'Vô hiệu hóa thiết bị và hủy các job chưa hoàn tất, giữ nguyên thông báo và các thiết bị khác. Gọi lại khi thiết bị đã bị vô hiệu hóa vẫn thành công.',
  })
  @ApiOkResponse({ type: NotificationDeviceResponseDto })
  @ApiNotFoundResponse({
    description: 'Thiết bị không tồn tại hoặc thuộc tài khoản khác.',
  })
  unregister(
    @CurrentAuth() auth: { clerkUserId: string },
    @Param('installationId') installationId: string,
  ) {
    return this.devices.unregister(
      auth.clerkUserId,
      requireUuid(installationId, 'installationId'),
    );
  }
}

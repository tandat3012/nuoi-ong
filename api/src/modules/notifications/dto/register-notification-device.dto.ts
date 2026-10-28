import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterNotificationDeviceDto {
  @ApiProperty({
    description: 'Expo Push Token của lượt cài app, không phải JWT Clerk.',
    example: 'ExponentPushToken[stage1_test_token]',
    maxLength: 512,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(512)
  @Matches(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/, {
    message: 'expoPushToken must be a valid Expo Push Token',
  })
  expoPushToken!: string;

  @ApiProperty({ enum: ['ANDROID', 'IOS'], example: 'ANDROID' })
  @IsIn(['ANDROID', 'IOS'])
  platform!: 'ANDROID' | 'IOS';
}

export class NotificationDeviceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'ID user DB từ phiên Clerk.' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  installationId!: string;

  @ApiProperty({ enum: ['ANDROID', 'IOS'] })
  platform!: 'ANDROID' | 'IOS';

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class NotificationDeviceResponseDto {
  @ApiProperty({ type: NotificationDeviceDto })
  data!: NotificationDeviceDto;
}

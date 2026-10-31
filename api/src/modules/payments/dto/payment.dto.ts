import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsVndAmount } from '../../../common/money';

/**
 * SePay "biến động số dư" webhook body. Every documented field is declared so
 * the global forbidNonWhitelisted pipe accepts real deliveries.
 */
export class SepayWebhookDto {
  @ApiProperty({ example: 92704 })
  @IsInt()
  @Min(1)
  id!: number;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiProperty({
    example: '2026-10-31 14:02:37',
    description: 'Giờ Việt Nam, định dạng YYYY-MM-DD HH:mm:ss.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  transactionDate!: string;

  @ApiProperty({ example: '0011001234567' })
  @IsString()
  @Length(1, 50)
  accountNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiProperty({ example: 'DH000123' })
  @IsString()
  @Length(0, 1000)
  content!: string;

  @ApiProperty({ enum: ['in', 'out'] })
  @IsIn(['in', 'out'])
  transferType!: 'in' | 'out';

  @ApiProperty({ example: 150000 })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  transferAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  accumulated?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

/** A bank transfer as the bank would report it; it never names the order directly. */
export class SimulatePaymentDto {
  @ApiProperty({ example: '150000' })
  @IsVndAmount()
  amount!: string;

  @ApiProperty({ example: 'DH000123' })
  @IsString()
  @Length(0, 1000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Mặc định là tài khoản nhận tiền của cửa hàng.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Gửi lại mã giao dịch cũ để thử chống trùng.',
  })
  @IsOptional()
  @Matches(/^sim-[0-9a-f-]{36}$/)
  providerTxId?: string;
}

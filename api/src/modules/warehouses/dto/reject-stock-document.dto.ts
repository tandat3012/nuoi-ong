import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectStockDocumentDto {
  @ApiProperty({ example: 'Số lượng không khớp chứng từ.', maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  rejectionReason!: string;
}

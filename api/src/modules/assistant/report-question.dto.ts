import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportQuestionDto {
  @ApiProperty({
    example: 'Từ đầu tháng đến nay kho Cà Phê nhập và xuất bao nhiêu mật ong?',
    maxLength: 300,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question!: string;
}

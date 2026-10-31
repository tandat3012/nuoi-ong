import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/** Owner-only numbering options shared by stock document create/update bodies. */
export class DocumentNumberingOptionsDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    description:
      'Farm owner only. Paper document reference; does not change the permanent code.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalReference?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 50,
    example: 'PN-2026-000123',
    description:
      'Farm owner only. Permanent code to use at confirmation if still free (stored trimmed and uppercased); null clears it.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/\S/)
  requestedCode?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    description: 'Farm owner only. Required together with requestedCode.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  requestedCodeReason?: string | null;
}

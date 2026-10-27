import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectStockDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  rejectionReason!: string;
}

import { IsString, Length } from 'class-validator';

export class ChangeInitialPasswordDto {
  @IsString()
  @Length(1, 1024)
  currentPassword!: string;

  @IsString()
  @Length(8, 1024)
  newPassword!: string;
}

import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const personnelRoleCodes = [
  'FARM_OWNER',
  'WAREHOUSE_MANAGER',
  'STORE_MANAGER',
  'EMPLOYEE',
  'GUEST',
] as const;
const nullableText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class WorkProfileDto {
  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(100)
  jobTitle?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}

export class PersonnelRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(personnelRoleCodes, { each: true })
  roleCodes!: string[];
}

export class PersonnelWarehousesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  warehouseIds!: string[];
}

export class AddExistingAccountDto extends WorkProfileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(personnelRoleCodes, { each: true })
  roleCodes: string[] = ['EMPLOYEE'];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  warehouseIds: string[] = [];
}

export class CreatePersonnelAccountDto extends AddExistingAccountDto {
  @IsUUID()
  requestId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 255)
  fullName!: string;

  @IsString()
  @Length(8, 1024)
  initialPassword!: string;
}

export class PersonnelStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @Transform(nullableText)
  @IsString()
  @MaxLength(1000)
  reason?: string | null;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(personnelRoleCodes, { each: true })
  roleCodes?: string[];

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  warehouseIds?: string[];
}

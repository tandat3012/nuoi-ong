import { SetMetadata } from '@nestjs/common';

export const FARM_ROLES_KEY = 'farmRoles';

export const FarmRoles = (...roles: string[]) =>
  SetMetadata(FARM_ROLES_KEY, roles);

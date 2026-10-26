import { SetMetadata } from '@nestjs/common';

export const ALLOW_INITIAL_PASSWORD = 'allowInitialPassword';
export const AllowInitialPassword = () =>
  SetMetadata(ALLOW_INITIAL_PASSWORD, true);

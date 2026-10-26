import {
  BadRequestException,
  ConflictException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

// Clerk exceptions may contain credential requests; expose only our fixed messages/codes.
export function throwClerkError(error: unknown): never {
  const failure = error as { status?: number; errors?: { code?: string }[] };
  const codes = Array.isArray(failure?.errors)
    ? failure.errors.map((item) => item?.code ?? '')
    : [];
  if (failure?.status === 429)
    throw new HttpException(
      { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
      429,
    );
  if (
    codes.some((code) =>
      [
        'form_identifier_exists',
        'form_param_unique',
        'identifier_already_exists',
      ].includes(code),
    )
  )
    throw new ConflictException({
      code: 'ACCOUNT_ALREADY_EXISTS',
      message:
        'An account already uses this email. Add the existing account instead.',
    });
  if (failure?.status === 400 || failure?.status === 422)
    throw new BadRequestException({
      code: 'INVALID_CREDENTIALS',
      message:
        'Check the email and password. The password must meet the sign-in security requirements.',
    });
  throw new ServiceUnavailableException({
    code: 'IDENTITY_UNAVAILABLE',
    message: 'The identity service is unavailable. Retry the same request.',
  });
}

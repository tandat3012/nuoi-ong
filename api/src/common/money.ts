import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_MONEY = BigInt(Number.MAX_SAFE_INTEGER);

export function isVndAmount(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9]\d{0,15})$/.test(value) &&
    BigInt(value) <= MAX_MONEY
  );
}

export function IsVndAmount(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isVndAmount',
      validator: {
        validate: isVndAmount,
        defaultMessage: () =>
          'Amount must be whole VND between 0 and 9007199254740991',
      },
    },
    options,
  );
}

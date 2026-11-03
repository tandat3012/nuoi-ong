import { BadRequestException } from '@nestjs/common';

export function parseDateRange(from?: string, to?: string) {
  for (const [label, value] of [
    ['dateFrom', from],
    ['dateTo', to],
  ] as const) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new BadRequestException(
        `${label} must be a valid date (YYYY-MM-DD)`,
      );
  }
  if (from && to && from > to)
    throw new BadRequestException('dateFrom must not be after dateTo');
  return { dateFrom: from || undefined, dateTo: to || undefined };
}

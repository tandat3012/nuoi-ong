import { BadRequestException } from '@nestjs/common';

export function orderDateRange(from?: string, to?: string) {
  for (const [name, value] of [
    ['from', from],
    ['to', to],
  ]) {
    if (
      value !== undefined &&
      (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith('0000-') ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new BadRequestException(`${name} must be a valid YYYY-MM-DD date`);
  }
  if (from && to && from > to)
    throw new BadRequestException('from must not exceed to');
  return { from, to };
}

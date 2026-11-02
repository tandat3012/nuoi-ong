import { BadRequestException } from '@nestjs/common';
import { parseDateRange } from './date-range';

describe('parseDateRange', () => {
  it('allows open bounds and validates calendar dates and ordering', () => {
    expect(parseDateRange('2028-02-29')).toEqual({
      dateFrom: '2028-02-29',
      dateTo: undefined,
    });
    expect(parseDateRange(undefined, '2026-11-02')).toEqual({
      dateFrom: undefined,
      dateTo: '2026-11-02',
    });
    expect(() => parseDateRange('2026-02-29')).toThrow(BadRequestException);
    expect(() => parseDateRange('2026-11-03', '2026-11-02')).toThrow(
      BadRequestException,
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  normalizeSearch,
  parseBoundedPositiveInteger,
  parseOptionalEnum,
  parsePagination,
  requireUuid,
} from './query-params';

describe('query params', () => {
  it('applies pagination defaults and maximum page size', () => {
    expect(parsePagination()).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(parsePagination('2', '500')).toEqual({
      page: 2,
      pageSize: 100,
      offset: 100,
    });
  });

  it('parses bounded positive integer options', () => {
    expect(parseBoundedPositiveInteger(undefined, 30, 365, 'days')).toBe(30);
    expect(parseBoundedPositiveInteger('500', 30, 365, 'days')).toBe(365);
    expect(() => parseBoundedPositiveInteger('0', 30, 365, 'days')).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid pagination values', () => {
    expect(() => parsePagination('0')).toThrow(BadRequestException);
    expect(() => parsePagination('one')).toThrow(BadRequestException);
  });

  it('validates UUID and enum query values', () => {
    const id = '6a8ac800-8daa-4e25-9ef8-57af547f8784';

    expect(requireUuid(id, 'farmId')).toBe(id);
    expect(() => requireUuid('not-a-uuid', 'farmId')).toThrow(
      BadRequestException,
    );
    expect(parseOptionalEnum('ASSET', ['ASSET', 'LOT'], 'trackingMode')).toBe(
      'ASSET',
    );
    expect(() =>
      parseOptionalEnum('UNKNOWN', ['ASSET', 'LOT'], 'trackingMode'),
    ).toThrow(BadRequestException);
  });

  it('normalizes empty and long search values', () => {
    expect(normalizeSearch('   ')).toBeUndefined();
    expect(normalizeSearch(`  ${'a'.repeat(120)}  `)).toHaveLength(100);
  });
});

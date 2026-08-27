import { BadRequestException } from '@nestjs/common';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  field: string,
): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }

  return parsed;
}

export function parsePagination(
  pageValue?: string,
  pageSizeValue?: string,
): PaginationParams {
  const page = parsePositiveInteger(pageValue, 1, 'page');
  const requestedPageSize = parsePositiveInteger(pageSizeValue, 20, 'pageSize');
  const pageSize = Math.min(requestedPageSize, 100);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function parseBoundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
  field: string,
): number {
  return Math.min(parsePositiveInteger(value, fallback, field), maximum);
}

export function requireUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }

  return value;
}

export function parseOptionalEnum<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  field: string,
): T | undefined {
  if (!value) {
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    throw new BadRequestException(
      `${field} must be one of: ${allowedValues.join(', ')}`,
    );
  }

  return value as T;
}

export function normalizeSearch(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 100) : undefined;
}

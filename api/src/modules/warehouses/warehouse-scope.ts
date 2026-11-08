import { ForbiddenException } from '@nestjs/common';
import { inArray, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Warehouse ids the caller works in; null = every warehouse of the farm. */
export type WarehouseScope = string[] | null;

/** WHERE condition limiting `column` to the scope; undefined when there is no limit. */
export function scopeCondition(
  column: AnyPgColumn | SQL,
  scope: WarehouseScope,
): SQL | undefined {
  if (scope === null) return undefined;
  if (!scope.length) return sql`false`;
  return inArray(column as AnyPgColumn, scope);
}

export function inScope(scope: WarehouseScope, warehouseId?: string | null) {
  return scope === null || (!!warehouseId && scope.includes(warehouseId));
}

/** 403 unless at least one of the warehouses is in scope (a transfer passes with either end). */
export function assertInScope(
  scope: WarehouseScope,
  ...warehouseIds: (string | null | undefined)[]
) {
  if (!warehouseIds.some((id) => inScope(scope, id)))
    throw new ForbiddenException(
      'This warehouse is not one of your assigned warehouses',
    );
}

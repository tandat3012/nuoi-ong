import { TransformFnParams } from 'class-transformer';

export const materialTrackingModes = ['QUANTITY', 'LOT'] as const;

export function trimText({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function normalizeCode({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

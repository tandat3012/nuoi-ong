import { describe, expect, it } from '@jest/globals';
import { formatQuantity } from './format-quantity';

describe('formatQuantity', () => {
  it.each([
    ['2.000', '2'],
    ['2000.000', '2000'],
    ['2.050', '2,05'],
    ['0.125', '0,125'],
    ['-12.000', '-12'],
  ])('renders %s as %s without an ambiguous decimal suffix', (input, expected) => {
    expect(formatQuantity(input)).toBe(expected);
  });
});

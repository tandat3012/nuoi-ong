import { describe, expect, it } from '@jest/globals';
import { quantityInputNumber, validateQuantityInput } from './quantity-input';

describe('stock quantity input', () => {
  it('accepts the API decimal shape and Vietnamese decimal comma', () => {
    expect(validateQuantityInput('12.345')).toBeNull();
    expect(validateQuantityInput('0,5')).toBeNull();
    expect(quantityInputNumber('0,5')).toBe(0.5);
    expect(validateQuantityInput('999999999999999.999')).toBeNull();
  });

  it('rejects blank, zero for movements, negative and excessive precision', () => {
    for (const value of ['', '0', '-1', '1.2345', '1 000', '1000000000000000']) {
      expect(validateQuantityInput(value)).not.toBeNull();
    }
    expect(validateQuantityInput('0', { allowZero: true })).toBeNull();
  });

  it('enforces the selected stock limit without restricting stock counts', () => {
    expect(validateQuantityInput('2,5', { max: 2.5 })).toBeNull();
    expect(validateQuantityInput('2,501', { max: 2.5 })).toContain('2,5');
    expect(validateQuantityInput('3', { allowZero: true })).toBeNull();
  });
});

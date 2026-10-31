import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  caretAfterDigits,
  digitsToIso,
  formatDigits,
  isoToText,
  maskDigits,
  pastedIsoDigits,
} from './date-input.ts';

test('types day-first digits into a fixed dd/mm/yyyy mask', () => {
  let text = '';
  for (const key of '30122005') text = formatDigits(maskDigits(text + key, 'date'));
  assert.equal(text, '30/12/2005');
  // Extra digits never grow the year past four digits.
  assert.equal(formatDigits(maskDigits('301220059', 'date')), '30/12/2005');
  assert.equal(formatDigits(maskDigits('3012', 'date')), '30/12');
  assert.equal(formatDigits(maskDigits('301220051430', 'datetime')), '30/12/2005 14:30');
});

test('emits ISO only for complete real dates and times', () => {
  assert.equal(digitsToIso('30122005', 'date'), '2005-12-30');
  assert.equal(digitsToIso('29022024', 'date'), '2024-02-29');
  for (const digits of ['3012200', '29022023', '31042026', '00012026', '01132026', '01010999'])
    assert.equal(digitsToIso(digits, 'date'), null, digits);
  assert.equal(digitsToIso('301220051430', 'datetime'), '2005-12-30T14:30');
  assert.equal(digitsToIso('301220052430', 'datetime'), null);
  assert.equal(digitsToIso('301220051460', 'datetime'), null);
});

test('round-trips ISO values and pasted ISO text', () => {
  assert.equal(isoToText('2005-12-30', 'date'), '30/12/2005');
  assert.equal(isoToText('2005-12-30T14:30', 'datetime'), '30/12/2005 14:30');
  assert.equal(isoToText('', 'date'), '');
  assert.equal(pastedIsoDigits(' 2005-12-30 ', 'date'), '30122005');
  assert.equal(pastedIsoDigits('30/12/2005', 'date'), null);
});

test('places the caret after the n-th digit', () => {
  assert.equal(caretAfterDigits('30/12/2005', 2), 2);
  assert.equal(caretAfterDigits('30/12/2005', 3), 4);
  assert.equal(caretAfterDigits('30/12/2005', 0), 0);
  assert.equal(caretAfterDigits('30/1', 9), 4);
});

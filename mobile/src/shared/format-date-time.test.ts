import { describe, expect, it } from '@jest/globals';
import { formatApiDateTime, normalizeApiTimestamp } from './format-date-time';

describe('API timestamps on mobile', () => {
  it('converts the actual PostgreSQL seed timestamp to an ISO Date input', () => {
    expect(normalizeApiTimestamp('2026-08-15 08:00:00+00')).toBe('2026-08-15T08:00:00+00:00');
    expect(formatApiDateTime('2026-08-15 08:00:00+00'))
      .toBe(formatApiDateTime('2026-08-15T08:00:00Z'));
    expect(formatApiDateTime('2026-08-15 08:00:00+00')).not.toBe('Chưa có thời gian');
  });

  it('preserves timezone offsets and makes microseconds safe for Hermes', () => {
    expect(normalizeApiTimestamp('2026-10-27 15:49:04.64608+00'))
      .toBe('2026-10-27T15:49:04.646+00:00');
    expect(normalizeApiTimestamp('2026-10-27 22:49:04+07'))
      .toBe('2026-10-27T22:49:04+07:00');
    expect(normalizeApiTimestamp('2026-10-27T22:49:04+0700'))
      .toBe('2026-10-27T22:49:04+07:00');
    expect(normalizeApiTimestamp('2026-10-27T15:49:04.646Z'))
      .toBe('2026-10-27T15:49:04.646Z');
  });

  it('keeps missing or invalid values distinct from real event times', () => {
    expect(formatApiDateTime(undefined)).toBe('Chưa có thời gian');
    expect(formatApiDateTime('')).toBe('Chưa có thời gian');
    expect(formatApiDateTime('invalid')).toBe('Chưa có thời gian');
    expect(formatApiDateTime('invalid', 'invalid')).toBe('invalid');
  });
});

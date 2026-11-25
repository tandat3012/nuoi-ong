import { bucketOf } from './dashboard.service';

describe('bucketOf', () => {
  it('keeps days and starts months on the 1st', () => {
    expect(bucketOf('2026-11-19', 'day')).toBe('2026-11-19');
    expect(bucketOf('2026-11-19', 'month')).toBe('2026-11-01');
  });

  it('starts weeks on Monday, across months and years', () => {
    expect(bucketOf('2026-11-23', 'week')).toBe('2026-11-23'); // Monday
    expect(bucketOf('2026-11-22', 'week')).toBe('2026-11-16'); // Sunday
    expect(bucketOf('2026-03-01', 'week')).toBe('2026-02-23');
    expect(bucketOf('2027-01-01', 'week')).toBe('2026-12-28');
  });
});

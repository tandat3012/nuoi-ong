// PostgreSQL timestamptz strings are not portable Date inputs on Hermes.
// Keep the stored offset and trim microseconds to ISO millisecond precision.
export function normalizeApiTimestamp(value: string): string {
  const timestamp = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(timestamp);
  if (!match) return timestamp;
  const [, day, time, fraction, offset] = match;
  const milliseconds = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
  const zone = offset === 'Z' ? offset
    : offset.length === 3 ? `${offset}:00`
    : offset.length === 5 ? `${offset.slice(0, 3)}:${offset.slice(3)}` : offset;
  return `${day}T${time}${milliseconds}${zone}`;
}

export function formatApiDateTime(value: string | null | undefined, fallback = 'Chưa có thời gian'): string {
  if (!value?.trim()) return fallback;
  const date = new Date(normalizeApiTimestamp(value));
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/** Stock document dates are DATE columns, so send the Vietnam calendar day only. */
export function formatVietnamDateOnly(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

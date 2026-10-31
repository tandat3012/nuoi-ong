// Masked dd/mm/yyyy [hh:mm] typing, independent of the browser's native date widget.

export type DateInputMode = 'date' | 'datetime';

const DIGITS: Record<DateInputMode, number> = { date: 8, datetime: 12 };
// Separator inserted before the digit at this index.
const SEPARATORS: [number, string][] = [
  [2, '/'],
  [4, '/'],
  [8, ' '],
  [10, ':'],
];

export function maskDigits(text: string, mode: DateInputMode) {
  return text.replace(/\D/g, '').slice(0, DIGITS[mode]);
}

export function formatDigits(digits: string) {
  let out = '';
  for (const [index, digit] of [...digits].entries()) {
    const separator = SEPARATORS.find(([at]) => at === index)?.[1];
    if (separator) out += separator;
    out += digit;
  }
  return out;
}

/** Caret index in `formatted` just after its `count`-th digit. */
export function caretAfterDigits(formatted: string, count: number) {
  if (count <= 0) return 0;
  let seen = 0;
  for (const [index, char] of [...formatted].entries()) {
    if (/\d/.test(char) && ++seen === count) return index + 1;
  }
  return formatted.length;
}

/** ISO value (`yyyy-mm-dd` or `yyyy-mm-ddThh:mm`) for complete, real dates; otherwise null. */
export function digitsToIso(digits: string, mode: DateInputMode) {
  if (digits.length !== DIGITS[mode]) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const date = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  if (mode === 'date') return date;
  const hours = Number(digits.slice(8, 10));
  const minutes = Number(digits.slice(10, 12));
  if (hours > 23 || minutes > 59) return null;
  return `${date}T${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;

/** Display text for an ISO value; blank for empty or unparseable values. */
export function isoToText(value: string | undefined | null, mode: DateInputMode) {
  const match = value ? ISO.exec(value) : null;
  if (!match) return '';
  const [, year, month, day, hours = '00', minutes = '00'] = match;
  return formatDigits(
    `${day}${month}${year}${mode === 'datetime' ? `${hours}${minutes}` : ''}`,
  );
}

/** Pasted ISO text is read as ISO, not as day-first digits. */
export function pastedIsoDigits(text: string, mode: DateInputMode) {
  const iso = text.trim();
  return ISO.test(iso) ? maskDigits(isoToText(iso, mode), mode) : null;
}

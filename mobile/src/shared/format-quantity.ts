/**
 * Format DB/API quantity values consistently on Mobile.
 * Numeric columns often arrive as strings such as "2.000"; parsing first
 * removes insignificant trailing decimal zeroes. Grouping is disabled so a
 * quantity of 2000 is shown as "2000", not "2.000" (which looks like 2.000 kg).
 */
export function formatQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '0';
  const normalized = typeof value === 'string' && value.includes(',') && !value.includes('.')
    ? value.replace(',', '.')
    : value;
  const quantity = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(quantity)) return String(value).trim();
  return quantity.toLocaleString('vi-VN', {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

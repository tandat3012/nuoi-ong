export type StockDateRange = { dateFrom?: string; dateTo?: string };

export function formatStockDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function toDisplayDate(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function parseStockDateRange(fromText: string, toText: string): { range?: StockDateRange; error?: string } {
  function parse(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (!match) throw new Error(`${label} phải có dạng dd/mm/yyyy.`);
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) {
      throw new Error(`${label} không hợp lệ.`);
    }
    return `${year}-${month}-${day}`;
  }

  try {
    const dateFrom = parse(fromText, 'Từ ngày');
    const dateTo = parse(toText, 'Đến ngày');
    if (dateFrom && dateTo && dateFrom > dateTo) return { error: 'Từ ngày không được sau đến ngày.' };
    return { range: { dateFrom, dateTo } };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Ngày không hợp lệ.' };
  }
}

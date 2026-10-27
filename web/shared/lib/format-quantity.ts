export function formatQuantity(value: string): string {
  const normalized = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return value;

  return normalized
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
}

export function farmSelectionHref(
  previousFarmId: string | null,
  nextFarmId: string | null,
  href: string,
): string | null {
  if (previousFarmId === null || previousFarmId === nextFarmId) return null;
  const url = new URL(href);
  if (!['/receipts', '/transfers', '/counts', '/requests'].includes(url.pathname) ||
    !url.searchParams.has('id')) return null;
  url.searchParams.delete('id');
  return `${url.pathname}${url.search}${url.hash}`;
}

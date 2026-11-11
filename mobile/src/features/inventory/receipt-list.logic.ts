export type ReceiptListFilter = 'COUNT' | 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'MAINTENANCE';

const VALID_FILTERS = new Set<ReceiptListFilter>([
  'COUNT',
  'RECEIPT',
  'ISSUE',
  'TRANSFER',
  'MAINTENANCE',
]);

export function firstRouteParam(value?: string | string[] | null): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeReceiptListFilter(
  tab?: string | string[] | null,
  maintenanceAssetId?: string | string[] | null,
): ReceiptListFilter {
  const normalizedTab = firstRouteParam(tab)?.toUpperCase();
  if (normalizedTab && VALID_FILTERS.has(normalizedTab as ReceiptListFilter)) {
    return normalizedTab as ReceiptListFilter;
  }
  if (firstRouteParam(maintenanceAssetId)) {
    return 'MAINTENANCE';
  }
  return 'RECEIPT';
}

export function isReceiptDocumentEditable(
  loading: boolean,
  error: string | null | undefined,
  status: string,
): boolean {
  return !loading && !error && status === 'DRAFT';
}

export function isStockCountEditable(
  loading: boolean,
  error: string | null | undefined,
  status: string,
): boolean {
  return !loading && !error && (status === 'DRAFT' || status === 'COUNTING');
}

export function shouldNavigateBackToReceiptList(
  routes?: ReadonlyArray<{ name?: string | null }> | null,
): boolean {
  return Boolean(routes?.some((route) => route.name === 'receipts/index'));
}

export function navigateToReceiptList(
  router: { navigate: (href: never) => void; replace: (href: never) => void },
  navigation: { getState?: () => { routes?: ReadonlyArray<{ name?: string | null }> } | undefined } | null | undefined,
  tab: ReceiptListFilter,
): void {
  const target = `/receipts?tab=${tab}` as never;
  const routes = navigation?.getState?.()?.routes;
  if (shouldNavigateBackToReceiptList(routes)) {
    router.navigate(target);
  } else {
    router.replace(target);
  }
}

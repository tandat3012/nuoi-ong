export type RecentDocumentKind = 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'COUNT' | 'MAINTENANCE';

export function recentDocumentRoute(kind: RecentDocumentKind, id?: string | null): string | null {
  const normalizedId = id?.trim();
  if (!normalizedId) return null;
  const encodedId = encodeURIComponent(normalizedId);
  if (kind === 'RECEIPT') return `/receipts/${encodedId}?type=receipt`;
  if (kind === 'ISSUE') return `/receipts/${encodedId}?type=issue`;
  if (kind === 'TRANSFER') return `/transfers/${encodedId}`;
  if (kind === 'COUNT') return `/counts/${encodedId}`;
  return `/maintenance/requests/${encodedId}`;
}

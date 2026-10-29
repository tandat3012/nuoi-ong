import type { PaginatedResponse } from '@/shared/api/contracts';
import { matchesSearch } from '@/shared/lib/search';
import type { AuthenticatedRequest } from '@/features/warehouses/api/warehouses.api';
import type { CatalogRecord, CatalogResource } from '../types/catalog';

/** Shared lists return every row; farm lists are paginated and searchable. */
export async function getCatalogRecords(
  request: AuthenticatedRequest,
  resource: CatalogResource,
  farmId: string,
  page: number,
  search: string,
): Promise<PaginatedResponse<CatalogRecord>> {
  if (resource.shared) {
    const { data } = await request<{ data: CatalogRecord[] }>(resource.path);
    const rows = data.filter((row) => matchesSearch(`${row.code} ${row.name}`, search));
    return { data: rows, page: { number: 1, size: rows.length, totalItems: rows.length, totalPages: 1 } };
  }
  return request<PaginatedResponse<CatalogRecord>>(resource.path, {
    params: { farmId, page, pageSize: 20, search: search.trim() || undefined },
  });
}

export function saveCatalogRecord(
  request: AuthenticatedRequest,
  resource: CatalogResource,
  farmId: string,
  id: string | null,
  data: Record<string, string | null>,
) {
  return request<{ data: CatalogRecord }>(id ? `${resource.path}/${id}` : resource.path, {
    method: id ? 'PATCH' : 'POST',
    params: { farmId },
    data,
  });
}

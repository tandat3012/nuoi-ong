import type { PaginatedResponse } from '@/shared/api/contracts';
import { matchesSearch } from '@/shared/lib/search';
import type { AuthenticatedRequest } from '@/features/warehouses/api/warehouses.api';
import { flattenCatalogItem } from '../catalog.logic';
import type { CatalogItemRow, CatalogRecord, CatalogResource } from '../types/catalog';

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
  const params = { ...resource.query, farmId, page, pageSize: 20, search: search.trim() || undefined };
  if (resource.key !== 'items') return request<PaginatedResponse<CatalogRecord>>(resource.path, { params });
  const response = await request<PaginatedResponse<CatalogItemRow>>(resource.path, { params });
  return { ...response, data: response.data.map(flattenCatalogItem) };
}

export function saveCatalogRecord(
  request: AuthenticatedRequest,
  resource: CatalogResource,
  farmId: string,
  id: string | null,
  data: Record<string, string | number | null>,
) {
  return request<{ data: CatalogRecord }>(id ? `${resource.path}/${id}` : resource.path, {
    method: id ? 'PATCH' : 'POST',
    params: { farmId },
    data,
  });
}

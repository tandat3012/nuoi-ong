import type { PaginatedResponse } from '@/shared/api/contracts';
import { API_CONFIG } from '@/shared/config/api';
import type { StorefrontCategory } from '../types/category';

export async function getCategoriesStore(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<StorefrontCategory>> {
  const baseUrl = process.env.API_INTERNAL_URL ?? API_CONFIG.BASE_URL;
  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/categories?page=${page}&pageSize=${pageSize}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error(`Không tải được danh mục: HTTP ${response.status}`);
  }

  return (await response.json()) as PaginatedResponse<StorefrontCategory>;
}

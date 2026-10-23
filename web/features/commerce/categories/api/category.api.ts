import type { PaginatedResponse } from '@/shared/api/contracts';
import { API_CONFIG } from '@/shared/config/api';
import type { StorefrontCategory } from '../types/category';

export async function getCategoriesStore(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<StorefrontCategory>> {
  const baseUrl =
    process.env.API_INTERNAL_URL ?? process.env.API_URL ?? API_CONFIG.BASE_URL;
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

export async function getAllCategoriesStore(): Promise<StorefrontCategory[]> {
  const first = await getCategoriesStore(1, 100);
  const categories = [...first.data];

  for (let page = 2; page <= first.page.totalPages; page++) {
    const result = await getCategoriesStore(page, 100);
    categories.push(...result.data);
  }

  return categories;
}

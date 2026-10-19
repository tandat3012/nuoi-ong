import type { PaginatedResponse } from '@/shared/api/contracts';
import type { StorefrontProduct, StorefrontProductDetail } from '../types/product';
import { API_CONFIG } from '@/shared/config/api';

export async function getProductsStore(
  page = 1,
  pageSize = 20,
  category?: string,
): Promise<PaginatedResponse<StorefrontProduct>> {
  const baseUrl = process.env.API_INTERNAL_URL ?? process.env.API_URL ?? API_CONFIG.BASE_URL;
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (category) query.set('category', category);

  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/products?${query}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error(`Không tải được sản phẩm: HTTP ${response.status}`);
  }

  return (await response.json()) as PaginatedResponse<StorefrontProduct>;
}

export async function getProductStore(
  slug: string,
): Promise<{ data: StorefrontProductDetail } | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  const baseUrl = process.env.API_INTERNAL_URL ?? process.env.API_URL ?? API_CONFIG.BASE_URL;
  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/products/${encodeURIComponent(slug)}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Không tải được chi tiết sản phẩm: HTTP ${response.status}`);
  }

  return (await response.json()) as { data: StorefrontProductDetail };
}

import type { PaginatedResponse } from '@/shared/api/contracts';
import type { StorefrontProduct, StorefrontProductDetail } from '../types/product';
import { API_CONFIG } from '@/shared/config/api';
import type { StoreRegion } from '../../orders/types/order';
import type { Availability } from '../../region/region.logic';

export interface StoreProductsQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc';
  inStock?: boolean;
  region?: StoreRegion | null;
}

export async function getProductsStore(
  query?: StoreProductsQuery,
): Promise<PaginatedResponse<StorefrontProduct>>;

export async function getProductsStore(
  page?: number,
  pageSize?: number,
  category?: string,
): Promise<PaginatedResponse<StorefrontProduct>>;
export async function getProductsStore(
  param1?: number | StoreProductsQuery,
  pageSize = 20,
  category?: string,
): Promise<PaginatedResponse<StorefrontProduct>> {
  let queryObj: StoreProductsQuery;
  if (typeof param1 === 'object' && param1 !== null) {
    queryObj = param1;
  } else {
    queryObj = {
      page: param1 ?? 1,
      pageSize,
      category,
    };
  }

  const page = queryObj.page ?? 1;
  const size = queryObj.pageSize ?? 20;

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(size),
  });

  if (queryObj.category) {
    query.set('category', queryObj.category);
  }

  if (queryObj.q !== undefined && queryObj.q.trim().length > 0) {
    query.set('q', queryObj.q.trim());
  }

  if (queryObj.minPrice !== undefined && queryObj.minPrice !== null) {
    query.set('minPrice', String(queryObj.minPrice));
  }

  if (queryObj.maxPrice !== undefined && queryObj.maxPrice !== null) {
    query.set('maxPrice', String(queryObj.maxPrice));
  }

  if (queryObj.sort === 'price_asc' || queryObj.sort === 'price_desc') {
    query.set('sort', queryObj.sort);
  }

  if (queryObj.inStock === true) {
    query.set('inStock', 'true');
  }

  if (queryObj.region) query.set('region', queryObj.region);

  const baseUrl = process.env.API_INTERNAL_URL ?? API_CONFIG.BASE_URL;
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

export interface StoreProductOptions {
  region?: StoreRegion | null;
  /** Steps the customer wants; decides AVAILABLE vs INSUFFICIENT_IN_REGION. */
  quantity?: number;
}

async function fetchProductStore(
  slug: string,
  { region, quantity }: StoreProductOptions,
): Promise<{ data: StorefrontProductDetail } | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  const query = new URLSearchParams();
  if (region) query.set('region', region);
  if (quantity && quantity > 1) query.set('quantity', String(quantity));
  const baseUrl = process.env.API_INTERNAL_URL ?? API_CONFIG.BASE_URL;
  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/products/${encodeURIComponent(slug)}?${query}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Không tải được chi tiết sản phẩm: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: StorefrontProductDetail };
  const detail = payload?.data;

  if (!detail || typeof detail.id !== 'string' || detail.slug !== slug ||
    typeof detail.name !== 'string' ||
    (detail.variants !== undefined && (!Array.isArray(detail.variants) ||
      !detail.variants.every((variant) => variant && typeof variant.id === 'string' && variant.id.trim() &&
        typeof variant.name === 'string' && Number.isSafeInteger(variant.price) && variant.price >= 0 &&
        typeof variant.inStock === 'boolean')))) {
    throw new Error('Thông tin quy cách sản phẩm không hợp lệ');
  }
  return { data: detail };
}

const pendingDetails = new Map<string, Promise<{ data: StorefrontProductDetail } | null>>();

export function getProductStore(
  slug: string,
  options: StoreProductOptions = {},
): Promise<{ data: StorefrontProductDetail } | null> {
  const key = `${slug}|${options.region ?? ''}|${options.quantity ?? 1}`;
  const pending = pendingDetails.get(key);

  if (pending) return pending;

  const request = fetchProductStore(slug, options).finally(() => pendingDetails.delete(key));
  pendingDetails.set(key, request);
  return request;
}

export interface CartAvailability {
  canOrder: boolean;
  lines: { variantId: string; availability: Availability }[];
  /** Variant ids that one warehouse could ship together, when canOrder is false. */
  groups: string[][];
}

export async function getCartAvailability(
  region: StoreRegion,
  items: { variantId: string; quantity: number }[],
): Promise<CartAvailability> {
  const response = await fetch(
    `${API_CONFIG.BASE_URL}${API_CONFIG.VERSION}/store/cart/availability`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, items }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    throw new Error(`Không kiểm tra được giỏ hàng: HTTP ${response.status}`);
  }
  return ((await response.json()) as { data: CartAvailability }).data;
}

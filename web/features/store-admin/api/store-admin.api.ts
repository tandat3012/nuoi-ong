import type { PaginatedResponse } from "@/shared/api/contracts";
import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { ReceiptItemReference } from "@/features/receipts/types/receipt";
import type {
  StoreCategory,
  StoreImage,
  StoreProduct,
  StoreProductFilters,
  StoreProductInput,
  StoreProductRow,
  StoreProductStatus,
  StoreVariant,
  StoreVariantInput,
} from "../types/store-admin";

const product = (id: string) => `/store-admin/products/${encodeURIComponent(id)}`;

export function getStoreProducts(
  request: AuthenticatedRequest,
  farmId: string,
  filters: StoreProductFilters,
) {
  return request<PaginatedResponse<StoreProductRow>>("/store-admin/products", {
    params: { ...filters, search: filters.search?.trim() || undefined, farmId },
  });
}

export function getStoreProduct(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: StoreProduct }>(product(id), { params: { farmId } });
}

export function createStoreProduct(
  request: AuthenticatedRequest,
  farmId: string,
  input: StoreProductInput,
) {
  return request<{ data: StoreProduct }>("/store-admin/products", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function updateStoreProduct(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  input: StoreProductInput,
) {
  return request<{ data: StoreProduct }>(product(id), {
    method: "PATCH",
    params: { farmId },
    data: input,
  });
}

export function updateStoreProductStatus(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  status: StoreProductStatus,
) {
  return request<{ data: StoreProduct }>(`${product(id)}/status`, {
    method: "PATCH",
    params: { farmId },
    data: { status },
  });
}

export function saveStoreVariant(
  request: AuthenticatedRequest,
  farmId: string,
  productId: string,
  input: StoreVariantInput,
  variantId?: string,
) {
  return request<{ data: StoreVariant }>(
    variantId
      ? `${product(productId)}/variants/${encodeURIComponent(variantId)}`
      : `${product(productId)}/variants`,
    { method: variantId ? "PATCH" : "POST", params: { farmId }, data: input },
  );
}

export function uploadStoreImage(
  request: AuthenticatedRequest,
  farmId: string,
  productId: string,
  file: File,
  alt: string,
) {
  const data = new FormData();
  data.append("file", file);
  data.append("alt", alt);
  return request<{ data: StoreImage }>(`${product(productId)}/images`, {
    method: "POST",
    params: { farmId },
    data,
    // Let the browser set the multipart boundary; uploads outlast the 10s default.
    headers: { "Content-Type": undefined },
    timeout: 60000,
  });
}

export function updateStoreImage(
  request: AuthenticatedRequest,
  farmId: string,
  productId: string,
  imageId: string,
  alt: string,
) {
  return request<{ data: StoreImage }>(
    `${product(productId)}/images/${encodeURIComponent(imageId)}`,
    { method: "PATCH", params: { farmId }, data: { alt } },
  );
}

export function reorderStoreImages(
  request: AuthenticatedRequest,
  farmId: string,
  productId: string,
  imageIds: string[],
) {
  return request<{ data: StoreImage[] }>(`${product(productId)}/images/order`, {
    method: "PUT",
    params: { farmId },
    data: { imageIds },
  });
}

export function deleteStoreImage(
  request: AuthenticatedRequest,
  farmId: string,
  productId: string,
  imageId: string,
) {
  return request<void>(
    `${product(productId)}/images/${encodeURIComponent(imageId)}`,
    { method: "DELETE", params: { farmId } },
  );
}

export function getStoreCategories(
  request: AuthenticatedRequest,
  farmId: string,
) {
  return request<{ data: StoreCategory[] }>("/store-admin/categories", {
    params: { farmId },
  });
}

export function createStoreCategory(
  request: AuthenticatedRequest,
  farmId: string,
  input: Omit<StoreCategory, "id">,
) {
  return request<{ data: StoreCategory }>("/store-admin/categories", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function searchStoreItems(
  request: AuthenticatedRequest,
  farmId: string,
  search: string,
) {
  // Restricted lookup: store-only managers have no access to /items.
  return request<{ data: ReceiptItemReference[] }>("/store-admin/items", {
    params: { farmId, search: search.trim() || undefined },
  });
}

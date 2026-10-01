import type { ApiRequestOptions } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import type {
  Receipt,
  ReceiptFilters,
  ReceiptDetail,
  ReceiptItemReference,
  CreateReceiptInput,
  ReceiptLocationReference,
  UpdateReceiptInput,
  ReceiptSupplierReference,
} from '../types/receipt';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function createReceipt(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateReceiptInput,
) {
  return request<{ data: ReceiptDetail }>('/stock-receipts', {
    method: 'POST',
    params: { farmId },
    data: input,
  });
}

export function updateReceipt(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  input: UpdateReceiptInput,
) {
  return request<{ data: ReceiptDetail }>(`/stock-receipts/${id}`, {
    method: 'PATCH',
    params: { farmId },
    data: input,
  });
}

export function cancelReceipt(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptDetail }>(`/stock-receipts/${id}/cancel`, {
    method: 'POST',
    params: { farmId },
  });
}

export function confirmReceipt(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptDetail }>(`/stock-receipts/${id}/confirm`, {
    method: 'POST',
    params: { farmId },
  });
}

export function getReceipts(
  request: AuthenticatedRequest,
  farmId: string,
  filters: ReceiptFilters,
) {
  return request<PaginatedResponse<Receipt>>('/stock-receipts', {
    params: {
      farmId,
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
      warehouseId: filters.warehouseId,
    },
  });
}

export function getReceiptById(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptDetail }>(`/stock-receipts/${id}`, {
    params: { farmId },
  });
}

export function getReceiptItem(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptItemReference }>(`/items/${id}`, {
    params: { farmId },
  });
}

export function getReceiptCatalogItems(
  request: AuthenticatedRequest,
  farmId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    itemType?: 'EQUIPMENT' | 'TOOL' | 'MATERIAL';
    trackingMode?: 'QUANTITY' | 'LOT' | 'ASSET';
  },
) {
  return request<
    PaginatedResponse<{
      item: ReceiptItemReference['item'];
      unitName: string;
      unitSymbol: string | null;
    }>
  >('/items', {
    params: {
      farmId,
      ...filters,
      status: 'ACTIVE',
      search: filters.search?.trim() || undefined,
    },
  });
}

export function getReceiptSuppliers(
  request: AuthenticatedRequest,
  farmId: string,
  filters: { page: number; pageSize: number; search?: string },
) {
  return request<PaginatedResponse<ReceiptSupplierReference>>('/suppliers', {
    params: {
      farmId,
      ...filters,
      status: 'ACTIVE',
      search: filters.search?.trim() || undefined,
    },
  });
}

export function getReceiptSupplier(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptSupplierReference }>(`/suppliers/${id}`, {
    params: { farmId },
  });
}

export function getReceiptLocations(
  request: AuthenticatedRequest,
  farmId: string,
  filters: {
    page: number;
    pageSize: number;
    search?: string;
    warehouseId: string;
  },
) {
  return request<PaginatedResponse<ReceiptLocationReference>>('/locations', {
    params: {
      farmId,
      ...filters,
      status: 'ACTIVE',
      search: filters.search?.trim() || undefined,
    },
  });
}

export function getReceiptLocation(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: ReceiptLocationReference }>(`/locations/${id}`, {
    params: { farmId },
  });
}

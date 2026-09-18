import type { ApiRequestOptions } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  Warehouse,
  WarehouseFilterParams,
} from '../types/warehouse';

export type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function getWarehouses(
  request: AuthenticatedRequest,
  params: WarehouseFilterParams & { farmId: string },
) {
  return request<PaginatedResponse<Warehouse>>('/warehouses', {
    params: { ...params, search: params.search?.trim() || undefined },
  });
}

export function getWarehouseById(
  request: AuthenticatedRequest,
  id: string,
  farmId: string,
) {
  return request<{ data: Warehouse }>(`/warehouses/${id}`, {
    params: { farmId },
  });
}

export function createWarehouse(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateWarehouseInput,
) {
  return request<{ data: Warehouse }>('/warehouses', {
    method: 'POST',
    params: { farmId },
    data: input,
  });
}

export function updateWarehouse(
  request: AuthenticatedRequest,
  id: string,
  farmId: string,
  input: UpdateWarehouseInput,
) {
  return request<{ data: Warehouse }>(`/warehouses/${id}`, {
    method: 'PATCH',
    params: { farmId },
    data: input,
  });
}

export function deactivateWarehouse(
  request: AuthenticatedRequest,
  id: string,
  farmId: string,
) {
  return request<{ data: Warehouse }>(`/warehouses/${id}`, {
    method: 'DELETE',
    params: { farmId },
  });
}

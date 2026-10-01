import type { ApiRequestOptions } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/contracts';
import type {
  CategoryReference,
  CreateMaterialInput,
  MaterialDetail,
  MaterialFilterParams,
  MaterialListRow,
  UnitReference,
  UpdateMaterialInput,
} from '../types/material';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

// Các hàm này chỉ mô tả endpoint. Token và lỗi HTTP do client dùng chung xử lý.
export function getMaterials(
  request: AuthenticatedRequest,
  params: MaterialFilterParams & { farmId: string },
) {
  return request<PaginatedResponse<MaterialListRow>>('/materials', {
    params: { ...params, search: params.search?.trim() || undefined },
  });
}

export function getMaterialById(
  request: AuthenticatedRequest,
  id: string,
  farmId: string,
) {
  return request<{ data: MaterialDetail }>(`/materials/${id}`, {
    params: { farmId },
  });
}

export function createMaterial(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreateMaterialInput,
) {
  return request<{ data: MaterialDetail }>('/materials', {
    method: 'POST',
    params: { farmId },
    data: input,
  });
}

export function updateMaterial(
  request: AuthenticatedRequest,
  id: string,
  farmId: string,
  input: UpdateMaterialInput,
) {
  return request<{ data: MaterialDetail }>(`/materials/${id}`, {
    method: 'PATCH',
    params: { farmId },
    data: input,
  });
}

export function getCategories(request: AuthenticatedRequest) {
  return request<{ data: CategoryReference[] }>('/categories');
}

export function getUnits(request: AuthenticatedRequest) {
  return request<{ data: UnitReference[] }>('/units');
}

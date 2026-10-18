import type { PageInfo } from '@/shared/api/contracts';

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export const WAREHOUSE_STATUS_LABELS: Record<WarehouseStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export interface Warehouse {
  id: string;
  farmId: string;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
  status: WarehouseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseListResponse {
  data: Warehouse[];
  page: PageInfo;
}

export interface WarehouseFilterParams {
  search?: string;
  status?: WarehouseStatus;
  page: number;
  pageSize: number;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  address?: string | null;
  description?: string | null;
}

export interface UpdateWarehouseInput {
  code?: string;
  name?: string;
  address?: string | null;
  description?: string | null;
}

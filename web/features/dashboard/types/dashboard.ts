export type FarmSummary = {
  stockValue: string;
  unpricedItems: number;
  belowMinimum: number;
  expiringLots: number;
  expiredLots: number;
  assetsInMaintenance: number;
  pendingAdjustments: number;
};

export type StoreSummary = {
  ordersToday: number;
  ordersPending: number;
};

// The API nulls the figures of an area the caller's roles do not cover.
export type DashboardSummary = (FarmSummary | { [K in keyof FarmSummary]: null }) &
  (StoreSummary | { [K in keyof StoreSummary]: null });

export type RoleLabel = {
  code: string;
  label: string;
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên hệ thống',
  FARM_OWNER: 'Chủ trang trại',
  WAREHOUSE_MANAGER: 'Quản lý kho',
  STORE_MANAGER: 'Quản lý cửa hàng',
  EMPLOYEE: 'Nhân viên vận hành',
  MAINTENANCE_STAFF: 'Kỹ thuật bảo trì',
  DELIVERY_STAFF: 'Nhân viên giao nhận',
  GUEST: 'Khách',
};

export function formatRoleName(roleCode?: string): string {
  if (!roleCode) return 'Nhân viên';
  return ROLE_LABELS[roleCode] ?? roleCode;
}


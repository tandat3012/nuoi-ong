export type Workplace = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};
export type PersonnelSummary = {
  memberId: string;
  fullName: string | null;
  email: string;
  employeeCode: string | null;
  jobTitle: string | null;
  roleCodes: string[];
  membershipStatus: "ACTIVE" | "INACTIVE";
  accountStatus: "ACTIVE" | "INACTIVE";
  warehouses: Workplace[];
};
export type CustomerAccount = {
  id: string;
  fullName: string | null;
  email: string;
  accountStatus: "ACTIVE" | "INACTIVE";
  createdAt: string;
};
export type WorkProfile = {
  employeeCode: string | null;
  jobTitle: string | null;
  phone: string | null;
  note: string | null;
};
export type PersonnelDetail = PersonnelSummary &
  WorkProfile & { joinedAt: string; heldAssetCount: number };
export type PersonnelFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  role?: string;
  warehouseId?: string;
};
export type CreatePersonnelInput = WorkProfile & {
  requestId: string;
  fullName: string;
  email: string;
  initialPassword: string;
  roleCodes: string[];
  warehouseIds: string[];
};
export type HeldAsset = {
  id: string;
  assetCode: string;
  itemName: string;
  status: string;
  assignedAt: string;
};
export type PersonnelHistory = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
};
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  FARM_OWNER: "Chủ trại",
  WAREHOUSE_MANAGER: "Quản lý kho",
  STORE_MANAGER: "Quản lý cửa hàng",
  EMPLOYEE: "Nhân viên",
  GUEST: "Khách",
};

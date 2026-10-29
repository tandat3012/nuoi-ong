export const ASSET_STATUS_LABELS = {
  AVAILABLE: "Sẵn sàng",
  ASSIGNED: "Đã cấp phát",
  IN_USE: "Đang sử dụng",
  MAINTENANCE: "Đang bảo trì",
  LOST: "Thất lạc",
  RETIRED: "Ngừng sử dụng",
  TRANSFER_PENDING: "Chờ chuyển",
} as const;

export type AssetStatus = keyof typeof ASSET_STATUS_LABELS;

export const ASSET_HISTORY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang giữ",
  RETURNED: "Đã trả",
  CANCELLED: "Đã hủy",
  OPEN: "Mới báo",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Hoàn tất",
};

export interface Asset {
  id: string;
  farmId: string;
  itemId: string;
  sourceReceiptItemId: string | null;
  currentLocationId: string | null;
  assetCode: string;
  serialNumber: string | null;
  qrToken: string;
  status: AssetStatus;
  purchaseDate: string | null;
  purchasePrice: string | null;
  warrantyExpiryDate: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetView {
  asset: Asset;
  itemCode: string;
  itemName: string;
  locationCode: string | null;
  locationName: string | null;
  locationWarehouseId: string | null;
}

export interface AssetFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: AssetStatus;
  itemId?: string;
  warehouseId?: string;
  locationId?: string;
}

export interface ReturnAssetInput {
  warehouseId: string;
  locationId?: string;
  note?: string | null;
}

export type AssetLookupKind = "item" | "warehouse" | "location" | "member";
export type AssetChoice = { id: string; label: string };

export type AssetHolder = {
  id: string;
  assignedToMemberId: string;
  memberName: string;
  assignedAt: string;
  expectedReturnAt: string | null;
  note: string | null;
};

export const HISTORY_KINDS = {
  movements: "Nhập / xuất",
  assignments: "Cấp phát",
  incidents: "Sự cố",
  maintenance: "Bảo trì",
  changes: "Chỉnh sửa",
} as const;
export type AssetHistoryKind = keyof typeof HISTORY_KINDS;
export type AssetHistoryEntry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  status: string | null;
  referenceId: string | null;
};

export type AssetMetadataInput = {
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  warrantyExpiryDate: string | null;
  nextMaintenanceDate: string | null;
  note: string | null;
};
export type CreateAssetInput = AssetMetadataInput & {
  itemId: string;
  warehouseId: string;
  locationId: string;
  assetCode: string;
};

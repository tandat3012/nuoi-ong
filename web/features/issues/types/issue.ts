export type IssueStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type IssueDraftTrackingMode = "QUANTITY" | "LOT" | "ASSET";
export type IssueType =
  "CONSUMPTION" | "DAMAGE" | "DISPOSAL" | "OTHER" | "MAINTENANCE";

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
};
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  CONSUMPTION: "Xuất sử dụng",
  DAMAGE: "Hư hỏng",
  DISPOSAL: "Thanh lý / loại bỏ",
  OTHER: "Khác",
  MAINTENANCE: "Bảo trì",
};

export interface Issue {
  id: string;
  farmId: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  issueCode: string;
  issueDate: string;
  issueType: IssueType;
  maintenanceRecordId: string | null;
  status: IssueStatus;
  reason: string | null;
  note: string | null;
  createdByMemberId: string;
  confirmedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface IssueLine {
  id: string;
  stockIssueId: string;
  itemId: string;
  quantity: string;
  lotId: string | null;
  assetId: string | null;
  note: string | null;
  createdAt: string;
  itemCode: string | null;
  itemName: string | null;
  trackingMode: "QUANTITY" | "LOT" | "ASSET" | null;
  unitName: string | null;
  unitSymbol: string | null;
  lotNumber: string | null;
  lotExpiryDate: string | null;
  assetCode: string | null;
  serialNumber: string | null;
}

export interface IssueDetail {
  issue: Issue;
  items: IssueLine[];
}
export interface IssueFilters {
  page: number;
  pageSize: number;
  status?: IssueStatus;
}

export interface CreateIssueInput {
  warehouseId: string;
  issueCode: string;
  issueDate?: string;
  issueType: IssueType;
  maintenanceRecordId?: string | null;
  reason?: string | null;
  note?: string | null;
  items: {
    itemId: string;
    quantity: string;
    note?: string | null;
    lotId?: string | null;
    assetId?: string | null;
  }[];
}

export interface IssueItemReference {
  item: {
    id: string;
    code: string;
    name: string;
    trackingMode: "QUANTITY" | "LOT" | "ASSET";
  };
  unitName: string;
  unitSymbol: string | null;
}

export interface IssueLotSuggestion {
  lot: {
    id: string;
    farmId: string;
    itemId: string;
    lotNumber: string;
    expiryDate: string | null;
  };
  balance: {
    farmId: string;
    warehouseId: string;
    itemId: string;
    lotId: string | null;
    quantityOnHand: string;
  };
}

export interface IssueAssetReference {
  asset: {
    id: string;
    farmId: string;
    itemId: string;
    assetCode: string;
    serialNumber: string | null;
    status: string;
    currentLocationId: string | null;
  };
  locationCode: string | null;
  locationName: string | null;
  locationWarehouseId: string | null;
}

export interface IssueMaintenanceReference {
  id: string;
  farmId: string;
  assetId: string;
  assetCode: string | null;
  serialNumber: string | null;
  maintenanceType: "INSPECTION" | "PREVENTIVE" | "CORRECTIVE";
  scheduledAt: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  description: string | null;
}

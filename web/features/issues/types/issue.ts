import type { NumberingOptions } from "@/features/stock-documents";
export type IssueStatus = "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "REJECTED" | "CANCELLED";
export type IssueDraftTrackingMode = "QUANTITY" | "LOT" | "ASSET";
export type IssueType =
  "CONSUMPTION" | "DAMAGE" | "DISPOSAL" | "OTHER" | "MAINTENANCE" | "SALE";

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  CONSUMPTION: "Xuất sử dụng",
  DAMAGE: "Hư hỏng",
  DISPOSAL: "Thanh lý / loại bỏ",
  OTHER: "Khác",
  MAINTENANCE: "Bảo trì",
  SALE: "Bán hàng",
};

export interface Issue {
  id: string;
  farmId: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  issueCode: string | null;
  externalReference?: string | null;
  requestedCode?: string | null;
  requestedCodeReason?: string | null;
  codeSource?: 'AUTO' | 'MANUAL' | null;
  issueDate: string;
  issueType: IssueType;
  maintenanceRecordId: string | null;
  orderId: string | null;
  status: IssueStatus;
  reason: string | null;
  note: string | null;
  createdByMemberId: string;
  confirmedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  rejectionReason?: string | null;
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
  lotCode: string | null;
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

export interface CreateIssueInput extends NumberingOptions {
  warehouseId: string;
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
    lotCode: string;
    supplierLotNumber: string | null;
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

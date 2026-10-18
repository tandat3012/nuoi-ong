export type MaterialKind =
  | "FEED"
  | "TREATMENT"
  | "PACKAGING"
  | "MAINTENANCE_SUPPLY"
  | "CONSUMABLE"
  | "OTHER";

export type MaterialTrackingMode = "QUANTITY" | "LOT";

export type RecordStatus = "ACTIVE" | "INACTIVE";

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  FEED: "Thức ăn",
  TREATMENT: "Thuốc & trị liệu",
  PACKAGING: "Bao bì & đóng gói",
  MAINTENANCE_SUPPLY: "Vật tư bảo dưỡng",
  CONSUMABLE: "Vật tư tiêu hao",
  OTHER: "Khác",
};

export const MATERIAL_TRACKING_MODE_LABELS: Record<
  MaterialTrackingMode,
  string
> = {
  QUANTITY: "Theo số lượng",
  LOT: "Theo lô (Lot)",
};

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
};

export interface MaterialItem {
  id: string;
  farmId: string;
  categoryId: string;
  unitId: string;
  code: string;
  name: string;
  description: string | null;
  itemType: "MATERIAL";
  trackingMode: MaterialTrackingMode;
  minStockLevel: string;
  maintenanceIntervalDays?: number | null;
  barcode: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  surveyedAt?: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialProfile {
  id: string;
  farmId: string;
  itemId: string;
  kind: MaterialKind;
  requiresExpiryTracking: boolean;
  expiryWarningDays: number;
  defaultShelfLifeDays: number | null;
  storageInstructions: string | null;
  safetyNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialListRow {
  item: MaterialItem;
  profile: MaterialProfile | null;
  categoryName: string | null;
  unitName: string | null;
  unitSymbol: string | null;
  quantityOnHand: string;
}

export interface MaterialDetail {
  item: MaterialItem;
  profile: MaterialProfile | null;
  categoryName: string | null;
  unitName: string | null;
  unitSymbol: string | null;
}

export interface CategoryReference {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
}

export interface UnitReference {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  status: RecordStatus;
}

export interface MaterialFilterParams {
  search?: string;
  status?: RecordStatus;
  kind?: MaterialKind;
  trackingMode?: MaterialTrackingMode;
  categoryId?: string;
  page: number;
  pageSize: number;
}

export interface CreateMaterialInput {
  categoryId: string;
  unitId: string;
  code: string;
  name: string;
  description?: string | null;
  trackingMode: MaterialTrackingMode;
  minStockLevel?: string;
  barcode?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  kind: MaterialKind;
  requiresExpiryTracking?: boolean;
  expiryWarningDays?: number;
  defaultShelfLifeDays?: number | null;
  storageInstructions?: string | null;
  safetyNotes?: string | null;
}

export interface UpdateMaterialInput {
  categoryId?: string;
  unitId?: string;
  code?: string;
  name?: string;
  description?: string | null;
  trackingMode?: MaterialTrackingMode;
  minStockLevel?: string;
  barcode?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  status?: RecordStatus;
  kind?: MaterialKind;
  requiresExpiryTracking?: boolean;
  expiryWarningDays?: number;
  defaultShelfLifeDays?: number | null;
  storageInstructions?: string | null;
  safetyNotes?: string | null;
}

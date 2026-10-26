import type { PaginatedResponse } from "@/shared/api/contracts";

export type InventoryTrackingMode = "QUANTITY" | "LOT" | "ASSET";

export interface InventoryBalance {
  id: string;
  quantityOnHand: string;
  updatedAt: string;
  item: {
    id: string;
    code: string;
    name: string;
    trackingMode: InventoryTrackingMode;
    unit: { id: string; name: string; symbol: string | null };
  };
  warehouse: { id: string; code: string; name: string };
  lot: { id: string; lotNumber: string; expiryDate: string | null } | null;
}

export interface InventoryFilters {
  warehouseId?: string;
  itemId?: string;
  lotId?: string;
  page: number;
  pageSize: number;
}

export type InventoryTransactionType =
  | "RECEIPT"
  | "ISSUE"
  | "MAINTENANCE_ISSUE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN_IN"
  | "ASSIGNMENT_OUT";

export interface InventoryLedgerFilters {
  warehouseId?: string;
  itemId?: string;
  transactionType?: InventoryTransactionType;
  page: number;
  pageSize: number;
}

export interface InventoryTransaction {
  id: string;
  transactionType: string;
  quantityChange: string;
  reason: string | null;
  createdAt: string;
  item: {
    id: string;
    code: string;
    name: string;
    unit: { id: string; name: string; symbol: string | null };
  };
  warehouse: { id: string; code: string; name: string };
  lot: { id: string; lotNumber: string; expiryDate: string | null } | null;
  asset: {
    id: string;
    assetCode: string;
    serialNumber: string | null;
  } | null;
  performer: { id: string; displayName: string } | null;
  source: { type: string; id: string; code: string | null };
}

export type InventoryLedgerResponse = PaginatedResponse<InventoryTransaction>;

export type InventoryListResponse = PaginatedResponse<InventoryBalance>;

export interface InventoryItemOption {
  item: {
    id: string;
    code: string;
    name: string;
    trackingMode: InventoryTrackingMode;
    status: "ACTIVE" | "INACTIVE";
  };
  unitName: string;
  unitSymbol: string | null;
}

export type InventoryAdjustmentReasonCode =
  | "STOCK_COUNT"
  | "SHRINKAGE"
  | "DAMAGE"
  | "EXPIRED"
  | "DATA_ENTRY_ERROR"
  | "OTHER";

export type InventoryAdjustmentStatus =
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "REJECTED";

export interface CreateInventoryAdjustmentInput {
  idempotencyKey: string;
  warehouseId: string;
  itemId: string;
  lotId?: string;
  quantityChange: string;
  reasonCode: InventoryAdjustmentReasonCode;
  note?: string;
}

export interface InventoryAdjustmentListItem {
  id: string;
  status: InventoryAdjustmentStatus;
  quantityChange: string;
  reasonCode: InventoryAdjustmentReasonCode;
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  item: { id: string; code: string; name: string };
  unit: { name: string; symbol: string | null };
  warehouse: { id: string; code: string; name: string };
  lot: { id: string; lotNumber: string | null } | null;
  requester: { id: string; displayName: string | null };
  reviewer: { id: string; displayName: string | null } | null;
}

export type InventoryAdjustmentListResponse =
  PaginatedResponse<InventoryAdjustmentListItem>;

export interface InventoryAdjustmentRecord {
  id: string;
  farmId: string;
  warehouseId: string;
  itemId: string;
  lotId: string | null;
  assetId: string | null;
  transactionType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  quantityChange: string;
  reason: string;
  sourceType: "INVENTORY_ADJUSTMENT";
  sourceId: string;
  movementGroupId: string | null;
  performedByMemberId: string | null;
  createdAt: string;
}

export interface InventoryAdjustmentResponse {
  adjustment: { id: string; status: InventoryAdjustmentStatus };
  /** null while the adjustment waits for approval or after rejection. */
  transaction: InventoryAdjustmentRecord | null;
}

export interface InventoryLotOption {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
}

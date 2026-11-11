export type RequestType = "maintenance" | "transfer";
export type RequestStatus =
  "PENDING_APPROVAL" | "IN_TRANSIT" | "DISCREPANCY" | "CONFIRMED" | "REJECTED";
export type RequestStatusFilter = RequestStatus | "ALL";
export type RequestedMaintenanceType = "CORRECTIVE" | "INSPECTION";

export interface RequestRecord {
  id: string;
  farmId: string;
  assetId: string;
  requestedByMemberId: string;
  status: RequestStatus;
  rejectionReason: string | null;
  reviewedByMemberId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RequestPeople {
  requestedByName: string | null;
  requestedByEmail: string | null;
  reviewedByName: string | null;
  reviewedByEmail: string | null;
}

export interface MaintenanceRequestRecord extends RequestRecord {
  maintenanceType: RequestedMaintenanceType;
  description: string;
  maintenanceRecordId: string | null;
}

export interface TransferRequestRecord extends RequestRecord {
  fromLocationId: string;
  toWarehouseId: string;
  toLocationId: string;
  note: string | null;
  /** P1-02: set when the destination warehouse counted the asset in. */
  receivedByMemberId?: string | null;
  receivedAt?: string | null;
  receivedCondition?: "GOOD" | "DAMAGED" | null;
  receiveNote?: string | null;
  /** A2: a DAMAGED arrival stays DISCREPANCY until the owner/admin records how it was handled. */
  resolvedByMemberId?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

// shortcut: list omits people; require these fields when the API returns the joins.
export interface MaintenanceRequestRow
  extends MaintenanceRequestRecord, Partial<RequestPeople> {
  assetCode: string;
  itemName: string;
  maintenanceScheduledAt?: string | null;
  maintenanceRecordStatus?: string | null;
  maintenanceStartedAt?: string | null;
  maintenanceReceivedAt?: string | null;
  maintenanceCompletedAt?: string | null;
  maintenanceResultNote?: string | null;
  maintenanceReturnStatus?: string | null;
  maintenanceReturnRejectionReason?: string | null;
  maintenanceFinalDecision?: string | null;
  maintenanceFinalDecisionNote?: string | null;
  maintenanceNextDueDate?: string | null;
}

export type MaintenanceRequestDetail = MaintenanceRequestRow & RequestPeople & {
};

export interface TransferRequestRow extends TransferRequestRecord, RequestPeople {
  assetCode: string;
  itemName: string;
  fromLocationCode: string | null;
  fromLocationName: string | null;
  toLocationCode: string | null;
  toLocationName: string | null;
  toWarehouseCode: string | null;
  toWarehouseName: string | null;
}

export type RequestRow = MaintenanceRequestRow | TransferRequestRow;
export type RequestDetail = MaintenanceRequestDetail | TransferRequestRow;

export interface RequestsQuery {
  type: RequestType;
  status: RequestStatusFilter;
  page: number;
  id?: string;
}

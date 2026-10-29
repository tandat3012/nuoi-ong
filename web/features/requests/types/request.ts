export type RequestType = "maintenance" | "transfer";
export type RequestStatus = "PENDING_APPROVAL" | "CONFIRMED" | "REJECTED";
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
}

// shortcut: list omits people; require these fields when the API returns the joins.
export interface MaintenanceRequestRow
  extends MaintenanceRequestRecord, Partial<RequestPeople> {
  assetCode: string;
  itemName: string;
}

export type MaintenanceRequestDetail = MaintenanceRequestRow & RequestPeople & {
  maintenanceScheduledAt: string | null;
  maintenanceRecordStatus: string | null;
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

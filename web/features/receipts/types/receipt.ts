export type ReceiptStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

export interface Receipt {
  id: string;
  farmId: string;
  warehouseId: string;
  supplierId: string | null;
  receiptCode: string | null;
  receiptDate: string;
  status: ReceiptStatus;
  note: string | null;
  createdByMemberId: string;
  confirmedByMemberId: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  warehouseCode?: string;
  warehouseName?: string;
  supplierCode?: string | null;
  supplierName?: string | null;
}

export interface ReceiptFilters {
  page: number;
  pageSize: number;
  status?: ReceiptStatus;
  warehouseId?: string;
}

export interface CreateReceiptInput {
  warehouseId: string;
  supplierId?: string | null;
  receiptDate?: string;
  note?: string | null;
  items: {
    itemId: string;
    quantity: string;
    unitPrice?: string;
    lotId?: string;
    lotNumber?: string;
    manufacturedDate?: string;
    expiryDate?: string;
    assetCode?: string;
    serialNumber?: string;
    locationId?: string;
    note?: string | null;
  }[];
}

export type UpdateReceiptInput = CreateReceiptInput;

export interface ReceiptLine {
  id: string;
  stockReceiptId: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  lotId: string | null;
  lotNumber: string | null;
  manufacturedDate: string | null;
  expiryDate: string | null;
  locationId: string | null;
  assetId: string | null;
  assetCode: string | null;
  serialNumber: string | null;
  note: string | null;
  createdAt: string;
  // Joined by the detail endpoint; null when the referenced row is missing.
  itemCode: string | null;
  itemName: string | null;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | null;
  unitName: string | null;
  unitSymbol: string | null;
  lotNumberFromLot: string | null;
  lotManufacturedDate: string | null;
  lotExpiryDate: string | null;
  assetCodeFromAsset: string | null;
  assetSerialNumber: string | null;
  locationCode: string | null;
  locationName: string | null;
}

export interface ReceiptDetail {
  receipt: Receipt;
  items: ReceiptLine[];
}

export interface ReceiptItemReference {
  item: {
    id: string;
    code: string;
    name: string;
    trackingMode: 'QUANTITY' | 'LOT' | 'ASSET';
  };
  unitName: string;
  unitSymbol: string;
}

export interface ReceiptDraftInitial {
  detail: ReceiptDetail;
  warehouseLabel?: string;
  supplierLabel?: string;
}

export interface ReceiptLotReference {
  id: string;
  lotNumber: string;
  manufacturedDate: string | null;
  expiryDate: string | null;
}

export interface ReceiptSupplierReference {
  id: string;
  farmId: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ReceiptLocationReference {
  id: string;
  farmId: string;
  warehouseId: string | null;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};

export interface Receipt {
  id: string;
  farmId: string;
  warehouseId: string;
  supplierId: string | null;
  receiptCode: string;
  receiptDate: string;
  status: ReceiptStatus;
  note: string | null;
  createdByMemberId: string;
  confirmedByMemberId: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
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
  receiptCode: string;
  receiptDate?: string;
  note?: string | null;
  items: {
    itemId: string;
    quantity: string;
    unitPrice?: string;
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
  references?: Record<string, ReceiptItemReference>;
  supplierLabel?: string;
  locationLabels?: Record<string, string>;
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

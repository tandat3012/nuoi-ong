import type {
  InventoryFilters,
  InventoryLedgerFilters,
  InventoryTransactionType,
} from "./types/inventory";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADJUSTMENT_DECIMAL =
  /^(?:[+-]?(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?)(?![\s\S])/;

export function isValidInventoryAdjustmentQuantity(value: string) {
  if (!ADJUSTMENT_DECIMAL.test(value)) return false;
  return /[1-9]/.test(value.replace(/^[+-]/, ""));
}

export function parseInitialInventoryFilters(params: {
  warehouseId?: string | string[];
  itemId?: string | string[];
}) {
  const oneUuid = (value?: string | string[]) =>
    typeof value === "string" && UUID_PATTERN.test(value)
      ? value.toLowerCase()
      : undefined;
  return {
    warehouseId: oneUuid(params.warehouseId),
    itemId: oneUuid(params.itemId),
  };
}

export function changeInventoryWarehouse(
  filters: InventoryFilters,
  warehouseId?: string,
): InventoryFilters {
  return { ...filters, warehouseId, page: 1 };
}

export function changeInventoryItem(
  filters: InventoryFilters,
  itemId?: string,
): InventoryFilters {
  return { ...filters, itemId, lotId: undefined, page: 1 };
}

export function changeInventoryLot(
  filters: InventoryFilters,
  lotId?: string,
): InventoryFilters {
  return { ...filters, lotId, page: 1 };
}

export function changeInventoryLedgerWarehouse(
  filters: InventoryLedgerFilters,
  warehouseId?: string,
): InventoryLedgerFilters {
  return { ...filters, warehouseId, page: 1 };
}

export function changeInventoryLedgerItem(
  filters: InventoryLedgerFilters,
  itemId?: string,
): InventoryLedgerFilters {
  return { ...filters, itemId, page: 1 };
}

export function changeInventoryLedgerType(
  filters: InventoryLedgerFilters,
  transactionType?: InventoryTransactionType,
): InventoryLedgerFilters {
  return { ...filters, transactionType, page: 1 };
}

export function formatInventoryQuantity(value: string) {
  const [whole, fraction] = value.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatInventoryMovement(value: string) {
  const formatted = formatInventoryQuantity(value);
  if (formatted === "0" || formatted.startsWith("-")) return formatted;
  return `+${formatted}`;
}

const TRANSACTION_LABELS: Record<string, string> = {
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất kho",
  MAINTENANCE_ISSUE: "Xuất bảo trì",
  TRANSFER_OUT: "Chuyển kho đi",
  TRANSFER_IN: "Chuyển kho đến",
  ADJUSTMENT_IN: "Điều chỉnh tăng",
  ADJUSTMENT_OUT: "Điều chỉnh giảm",
  RETURN_IN: "Trả tài sản",
  ASSIGNMENT_OUT: "Bàn giao tài sản",
};

export function inventoryTransactionLabel(value: string) {
  return TRANSACTION_LABELS[value] ?? value.replace(/_/g, " ");
}

const SOURCE_LABELS: Record<string, string> = {
  STOCK_RECEIPT: "Phiếu nhập",
  STOCK_ISSUE: "Phiếu xuất",
  STOCK_TRANSFER: "Phiếu chuyển kho",
  STOCK_COUNT: "Phiếu kiểm kê",
  ASSET_RETURN: "Trả tài sản",
  INVENTORY_ADJUSTMENT: "Điều chỉnh thủ công",
};

export function inventorySourceLabel(type: string, code: string | null) {
  if (code) return code;
  return SOURCE_LABELS[type] ?? "Giao dịch kho";
}

export function formatInventoryDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function inventoryUnitLabel(symbol: string | null, name: string) {
  return symbol ?? name;
}

export function formatInventoryExpiry(value: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

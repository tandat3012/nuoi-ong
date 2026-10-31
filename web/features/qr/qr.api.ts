import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";

export interface ItemQr {
  itemId: string;
  itemCode: string;
  itemName: string;
  qrUrl: string;
  imageDataUrl: string;
}

export interface BalanceQr {
  balanceId: string;
  qrUrl: string;
  imageDataUrl: string;
  balance: { itemId: string; warehouseId: string; lotId: string | null };
  itemName: string;
  warehouseName: string;
  lotCode: string | null;
}

export function getItemQr(request: AuthenticatedRequest, farmId: string, itemId: string) {
  return request<{ data: ItemQr }>(`/items/${itemId}/qr`, { params: { farmId } });
}

export function getBalanceQr(request: AuthenticatedRequest, farmId: string, balanceId: string) {
  return request<{ data: BalanceQr }>(`/inventory/${balanceId}/qr`, { params: { farmId } });
}

export function qrErrorMessage(error: unknown, notFound: string) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return notFound;
  if (status === 403) return "Bạn không có quyền xem dữ liệu này trong trang trại đang chọn.";
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return "Không tải được dữ liệu QR. Vui lòng thử lại.";
}

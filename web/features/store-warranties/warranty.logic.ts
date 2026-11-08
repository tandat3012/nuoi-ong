export type WarrantyStatus =
  | "RECEIVED"
  | "AT_PARTNER"
  | "AWAITING_CUSTOMER"
  | "IN_REPAIR"
  | "BACK_FROM_PARTNER"
  | "EXCHANGING"
  | "CLOSED"
  | "CANCELLED";
export type WarrantyKind = "WARRANTY" | "PAID_REPAIR";
export type WarrantyAction =
  | "send"
  | "quote"
  | "decide"
  | "start-repair"
  | "back"
  | "return"
  | "exchange"
  | "close"
  | "cancel";

export interface WarrantyRequest {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  orderItemId: string;
  /** Asset-tracked lines: the claimed unit. */
  assetId?: string | null;
  assetCode?: string | null;
  assetSerialNumber?: string | null;
  productName: string;
  variantName: string;
  quantity: number;
  purchased?: number;
  kind: WarrantyKind;
  status: WarrantyStatus;
  issueDescription: string;
  intakeNote: string | null;
  receivedAt: string;
  completedAt?: string | null;
  warrantyMonths?: number | null;
  partnerName: string | null;
  quoteAmount: string | null;
  customerApproved: boolean | null;
  customerDecisionNote: string | null;
  result: string | null;
  actualCost: string | null;
  resolution: "RETURN" | "EXCHANGE" | null;
  cancelReason: string | null;
  closedAt: string | null;
  exchangeIssue: { id: string; issueCode: string | null; status: string } | null;
}

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  RECEIVED: "Đã tiếp nhận",
  AT_PARTNER: "Đang ở đối tác",
  AWAITING_CUSTOMER: "Chờ khách đồng ý phí",
  IN_REPAIR: "Đang sửa",
  BACK_FROM_PARTNER: "Đối tác đã trả về",
  EXCHANGING: "Chờ kho xuất hàng đổi",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const WARRANTY_KIND_LABELS: Record<WarrantyKind, string> = {
  WARRANTY: "Bảo hành",
  PAID_REPAIR: "Sửa có phí",
};

/** Field the step asks for; the API enforces the same rules. */
export type ActionField = "partnerName" | "quoteAmount" | "approved" | "result" | "actualCost" | "note";

export interface ActionStep {
  action: WarrantyAction;
  label: string;
  fields: ActionField[];
}

/** Steps staff can take now, mirroring StoreWarrantiesService.act. */
export function nextSteps(request: Pick<WarrantyRequest, "status" | "kind" | "customerApproved" | "exchangeIssue">): ActionStep[] {
  const repairAllowed = request.kind === "WARRANTY" || request.customerApproved === true;
  switch (request.status) {
    case "RECEIVED":
      return [
        { action: "send", label: "Gửi đối tác", fields: ["partnerName"] },
        { action: "exchange", label: "Đổi hàng mới", fields: [] },
        { action: "return", label: "Trả lại khách", fields: [] },
        { action: "cancel", label: "Hủy yêu cầu", fields: ["note"] },
      ];
    case "AT_PARTNER":
      return [
        ...(repairAllowed ? [{ action: "start-repair" as const, label: "Bắt đầu sửa", fields: [] }] : []),
        { action: "quote", label: "Ghi báo giá cho khách", fields: ["quoteAmount"] },
        { action: "back", label: "Đối tác trả về", fields: ["result"] },
      ];
    case "AWAITING_CUSTOMER":
      return [{ action: "decide", label: "Ghi quyết định của khách", fields: ["approved", "note"] }];
    case "IN_REPAIR":
      return [{
        action: "back",
        label: "Đối tác trả về",
        fields: request.kind === "PAID_REPAIR" ? ["result", "actualCost"] : ["result"],
      }];
    case "BACK_FROM_PARTNER":
      return [
        { action: "return", label: "Đã trả khách", fields: [] },
        { action: "exchange", label: "Đổi hàng mới", fields: [] },
      ];
    case "EXCHANGING": {
      const issue = request.exchangeIssue?.status;
      if (issue === "CONFIRMED") return [{ action: "close", label: "Đã giao hàng đổi — đóng", fields: [] }];
      if (issue === "REJECTED" || issue === "CANCELLED")
        return [{ action: "exchange", label: "Tạo lại phiếu xuất đổi", fields: [] }];
      return [];
    }
    default:
      return [];
  }
}

/** Warranty end from delivery; null when the line has no stored policy (staff decide). */
export function warrantyEnd(completedAt: string | null | undefined, months: number | null | undefined) {
  if (!completedAt || months === null || months === undefined) return null;
  if (months === 0) return "none";
  const end = new Date(completedAt);
  end.setMonth(end.getMonth() + months);
  return end;
}

export function warrantyCoverage(
  completedAt: string | null | undefined,
  months: number | null | undefined,
  now = new Date(),
) {
  const end = warrantyEnd(completedAt, months);
  if (end === null) return { inWarranty: true, label: "Đơn trước khi có chính sách bảo hành — nhân viên quyết định" };
  if (end === "none") return { inWarranty: false, label: "Sản phẩm không có bảo hành" };
  const date = end.toLocaleDateString("vi-VN");
  return end.getTime() >= now.getTime()
    ? { inWarranty: true, label: `Còn bảo hành đến ${date}` }
    : { inWarranty: false, label: `Hết bảo hành từ ${date}` };
}

const MESSAGES: Record<string, string> = {
  ORDER_NOT_DELIVERED: "Chỉ nhận bảo hành cho đơn đã giao thành công.",
  WARRANTY_NOT_APPLICABLE: "Vật tư không áp dụng bảo hành hoặc sửa chữa.",
  WARRANTY_QUANTITY_EXCEEDED: "Số lượng vượt số đã mua trừ các yêu cầu đang mở.",
  WARRANTY_EXPIRED: "Đã hết hạn bảo hành: chỉ tạo được yêu cầu sửa có phí.",
  WARRANTY_STEP_NOT_ALLOWED: "Yêu cầu không còn ở bước cho phép thao tác này.",
  CUSTOMER_CONSENT_REQUIRED: "Phải ghi khách đồng ý báo giá trước khi bắt đầu sửa.",
  EXCHANGE_PENDING: "Đã có phiếu xuất đổi hàng đang chờ kho.",
  EXCHANGE_NOT_ISSUED: "Kho chưa xác nhận phiếu xuất hàng đổi.",
  INSUFFICIENT_STOCK: "Kho bán không đủ hàng để đổi.",
  WARRANTY_ASSET_REQUIRED: "Chọn đúng tài sản đã giao; mỗi yêu cầu chỉ cho một tài sản.",
  WARRANTY_ASSET_NOT_DELIVERED: "Tài sản này không thuộc dòng hàng đã giao của đơn.",
  WARRANTY_ASSET_OPEN: "Tài sản này đang có yêu cầu bảo hành chưa đóng.",
};

/** Units of this order line a claim must pick from; empty for quantity goods. */
export function lineAssets<T extends { itemId: string }>(
  delivered: readonly T[] | undefined,
  line: { itemId: string } | undefined,
) {
  return line ? (delivered ?? []).filter((asset) => asset.itemId === line.itemId) : [];
}

export function warrantyErrorMessage(error: unknown) {
  const failure = error as { details?: { code?: string; message?: string | string[] }; message?: string } | null;
  const code = failure?.details?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = failure?.details?.message ?? failure?.message;
  return Array.isArray(message) ? message.join(", ") : message || "Có lỗi xảy ra, vui lòng thử lại.";
}

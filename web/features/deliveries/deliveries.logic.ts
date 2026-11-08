import type {
  DeliveryAction,
  PaymentMethod,
  PaymentStatus,
} from "../commerce/orders/types/order.ts";

type Payment = { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus };

/** An unpaid bank transfer must be recorded before the order can be closed. */
export function canMarkDelivered(order: Payment) {
  return order.paymentMethod === "COD" || order.paymentStatus === "PAID";
}

/** Cash the shipper collects at the door, or null when nothing is due. */
export function cashToCollect(order: Payment & { total: string }) {
  return order.paymentMethod === "COD" && order.paymentStatus === "UNPAID"
    ? order.total
    : null;
}

export const deliveryActionLabels: Record<DeliveryAction, string> = {
  DELIVERY_CLAIM: "Nhận giao",
  DELIVERY_RETURN: "Trả đơn",
  DELIVERY_COMPLETE: "Giao xong",
  PAYMENT_RECONCILE: "Đối soát chuyển khoản",
  COD_REMIT: "Nhận tiền COD",
  REFUND: "Hoàn tiền",
  RETURN_TO_WAREHOUSE: "Trả hàng về kho",
  RETURN_RECEIVED: "Kho đã nhận hàng trả",
  RETURN_REJECTED: "Kho từ chối phiếu trả",
};

export function deliveryErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string } | null;
  const message = failure?.message ?? "";
  if (message.includes("Only the shipper"))
    return "Chỉ người đang giao đơn này hoặc quản lý cửa hàng được thao tác.";
  if (message.includes("Only CONFIRMED orders"))
    return "Đơn đã có người nhận giao hoặc không còn chờ giao. Hãy tải lại danh sách.";
  if (message.includes("tài sản định danh")) return message;
  if (message.includes("Only SHIPPING orders"))
    return "Đơn không còn ở trạng thái đang giao. Hãy tải lại danh sách.";
  if (message.includes("stock issue must be approved"))
    return "Phiếu xuất của đơn chưa được duyệt nên chưa thể nhận giao.";
  if (message.includes("Record the bank transfer"))
    return "Đơn chuyển khoản chưa được ghi nhận thanh toán nên chưa thể giao.";
  if (failure?.status === 403)
    return "Bạn không có quyền giao hàng trong trại đang chọn.";
  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

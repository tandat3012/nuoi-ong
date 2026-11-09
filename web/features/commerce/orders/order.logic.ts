import type {
  CreateOrderInput,
  CustomerOrder,
  Order,
  OrderDetail,
  OrderStatus,
  StoreRegion,
} from "./types/order";

export function canCustomerCancel(order: CustomerOrder) {
  return order.status === "PENDING" && order.paymentStatus === "UNPAID";
}

/** Staff may cancel before the goods leave; a paid order also needs a refund. */
export function canStaffCancel(order: Order) {
  return ["PENDING", "PREPARING", "CONFIRMED"].includes(order.status);
}

/** Paid and not refunded yet: cancelling or closing a return records a refund (D11). */
export function needsRefund(order: Order) {
  return order.paymentStatus === "PAID" && !order.refundedAt;
}

/** A bank transfer staff can still reconcile by hand (D10). */
export function canMarkPaid(order: Order) {
  return (
    order.paymentMethod === "BANK_TRANSFER" &&
    order.paymentStatus === "UNPAID" &&
    ["PENDING", "PREPARING", "CONFIRMED", "SHIPPING"].includes(order.status)
  );
}

/** Delivered COD whose cash no manager has received from the shipper yet. */
export function canRemitCod(order: Order) {
  return (
    order.paymentMethod === "COD" &&
    order.status === "COMPLETED" &&
    !order.codRemittedAt
  );
}

export function canStaffCancelDetail(detail: OrderDetail) {
  return (
    canStaffCancel(detail.order) &&
    (!detail.stockIssue || detail.stockIssue.status === "DRAFT")
  );
}

/** Top-up transfers not yet received by the sales warehouse. */
export function pendingReplenishments(detail: OrderDetail) {
  return detail.replenishments.filter((row) =>
    ["DRAFT", "PENDING_APPROVAL", "IN_TRANSIT"].includes(row.status),
  );
}

/** PENDING, or a legacy PREPARING order whose transfers are all settled. */
export function canConfirmOrder(detail: OrderDetail) {
  return (
    detail.order.status === "PENDING" ||
    (detail.order.status === "PREPARING" &&
      pendingReplenishments(detail).length === 0)
  );
}

export function canShipOrder(detail: OrderDetail) {
  return (
    detail.order.status === "CONFIRMED" &&
    detail.stockIssue?.status === "CONFIRMED" &&
    // An unpaid bank transfer cannot go out (AC18).
    (detail.order.paymentMethod === "COD" ||
      detail.order.paymentStatus === "PAID")
  );
}

export function canCompleteOrder(detail: OrderDetail) {
  return (
    detail.order.status === "SHIPPING" &&
    (detail.order.paymentMethod === "COD" ||
      detail.order.paymentStatus === "PAID")
  );
}

export function isDefiniteOrderFailure(status: number) {
  return [400, 404, 409, 422].includes(status);
}

export function canonicalOrderPayload(
  input: Omit<CreateOrderInput, "idempotencyKey">,
) {
  return JSON.stringify({
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    region: input.region,
    note: input.note?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    expectedShippingFee: input.expectedShippingFee,
    items: [...input.items]
      .map(({ variantId, quantity, expectedUnitPrice }) => ({
        variantId,
        quantity,
        expectedUnitPrice,
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId)),
  });
}

export const storeRegionLabels: Record<StoreRegion, string> = {
  NORTH: "Miền Bắc",
  CENTRAL: "Miền Trung",
  SOUTH: "Miền Nam",
};

export function parseOrderAttemptPayload(
  payload: string,
): Omit<CreateOrderInput, "idempotencyKey"> | null {
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== "object") return null;
    const input = value as Partial<Omit<CreateOrderInput, "idempotencyKey">>;
    if (
      typeof input.recipientName !== "string" ||
      !input.recipientName.trim() ||
      typeof input.phone !== "string" ||
      !input.phone.trim() ||
      typeof input.address !== "string" ||
      !input.address.trim() ||
      !(typeof input.region === "string" && Object.hasOwn(storeRegionLabels, input.region)) ||
      (input.note !== undefined && typeof input.note !== "string") ||
      (input.paymentMethod !== "COD" &&
        input.paymentMethod !== "BANK_TRANSFER") ||
      (input.expectedShippingFee !== undefined &&
        !(typeof input.expectedShippingFee === "string" &&
          /^(?:0|[1-9]\d*)$/.test(input.expectedShippingFee))) ||
      !Array.isArray(input.items) ||
      input.items.length === 0 ||
      !input.items.every(
        (item) =>
          item &&
          typeof item.variantId === "string" &&
          item.variantId.length > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 10000 &&
          typeof item.expectedUnitPrice === "string" &&
          /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item.expectedUnitPrice),
      )
    )
      return null;
    return input as Omit<CreateOrderInput, "idempotencyKey">;
  } catch {
    return null;
  }
}

export type OrderAttempt = {
  key: string;
  payload: string;
  state: "pending" | "failed" | "succeeded";
  orderId?: string;
};

type AttemptStorage = Pick<Storage, "getItem" | "setItem">;

export class OrderAttemptError extends Error {
  readonly code: "UNRESOLVED_ATTEMPT" | "STORAGE_UNAVAILABLE";

  constructor(code: "UNRESOLVED_ATTEMPT" | "STORAGE_UNAVAILABLE") {
    super(code);
    this.code = code;
  }
}

function attemptStorageKey(userId: string) {
  return `store-order-attempt:v1:${encodeURIComponent(userId)}`;
}

function isOrderAttempt(value: unknown): value is OrderAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<OrderAttempt>;
  return (
    typeof attempt.key === "string" &&
    typeof attempt.payload === "string" &&
    ["pending", "failed", "succeeded"].includes(String(attempt.state)) &&
    (attempt.orderId === undefined || typeof attempt.orderId === "string")
  );
}

export function loadOrderAttempt(
  storage: AttemptStorage,
  userId: string,
): OrderAttempt | null {
  try {
    const raw = storage.getItem(attemptStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isOrderAttempt(parsed)) throw new Error("Invalid order attempt");
    return parsed;
  } catch {
    throw new OrderAttemptError("STORAGE_UNAVAILABLE");
  }
}

export function beginOrderAttempt(
  storage: AttemptStorage,
  userId: string,
  payload: string,
  createKey: () => string,
): OrderAttempt {
  const previous = loadOrderAttempt(storage, userId);

  if (previous?.payload === payload && previous.state !== "succeeded")
    return previous;
  if (previous?.state === "pending")
    throw new OrderAttemptError("UNRESOLVED_ATTEMPT");

  const attempt: OrderAttempt = {
    key: createKey(),
    payload,
    state: "pending",
  };
  try {
    storage.setItem(attemptStorageKey(userId), JSON.stringify(attempt));
  } catch {
    throw new OrderAttemptError("STORAGE_UNAVAILABLE");
  }
  return attempt;
}

export function updateOrderAttempt(
  storage: AttemptStorage,
  userId: string,
  attempt: OrderAttempt,
  state: OrderAttempt["state"],
  orderId?: string,
) {
  try {
    storage.setItem(
      attemptStorageKey(userId),
      JSON.stringify({ ...attempt, state, orderId }),
    );
  } catch {
    // Keep the original pending key: retrying its exact payload remains safe.
  }
}

export function formatOrderMoney(amount: string) {
  const match = /^(0|[1-9]\d*)(?:\.0+)?$/.exec(amount);
  if (!match) return "—";
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(BigInt(match[1]));
  } catch {
    return "—";
  }
}

// class-validator messages start with the property path, e.g. "phone must match ...".
const FIELD_ERRORS: [field: string, message: string][] = [
  ["recipientName", "Tên người nhận cần từ 1 đến 255 ký tự."],
  [
    "phone",
    "Số điện thoại cần 8–30 ký tự, chỉ gồm chữ số, khoảng trắng và các ký tự + - ( ).",
  ],
  ["address", "Địa chỉ giao hàng cần từ 5 đến 2.000 ký tự."],
  ["note", "Ghi chú không được quá 2.000 ký tự."],
  ["paymentMethod", "Phương thức thanh toán không hợp lệ."],
  [
    "items",
    "Giỏ hàng có dòng không hợp lệ (mỗi dòng 1–10.000, tối đa 100 sản phẩm). Hãy cập nhật giỏ rồi thử lại.",
  ],
  ["Duplicate variant", "Giỏ hàng có sản phẩm bị lặp. Hãy cập nhật giỏ rồi thử lại."],
  ["expectedShippingFee", "Phí giao hàng không hợp lệ. Hãy tải lại trang thanh toán."],
  ["reason", "Lý do hủy cần từ 1 đến 1.000 ký tự."],
];

export function validationMessage(details: unknown) {
  const raw =
    details && typeof details === "object" && "message" in details
      ? details.message
      : undefined;
  const messages = (Array.isArray(raw) ? raw : [raw]).filter(
    (item): item is string => typeof item === "string",
  );
  const matched = FIELD_ERRORS.filter(([field]) =>
    messages.some((message) => message.startsWith(field)),
  ).map(([, message]) => message);
  return matched.length ? matched.join(" ") : null;
}

/** Staff confirming an order its sales warehouse no longer covers (D03). */
export function confirmErrorMessage(error: unknown) {
  const details = (error as { details?: { code?: string; message?: unknown } } | null)
    ?.details;
  if (details?.code !== "INSUFFICIENT_STOCK") return orderErrorMessage(error);
  const reason =
    typeof details.message === "string" ? details.message : "Kho bán không đủ hàng.";
  return `${reason} Đơn chưa giữ hàng; hãy chuyển kho sang kho bán rồi xác nhận lại.`;
}

export function orderErrorMessage(error: unknown) {
  const failure = error as {
    status?: number;
    message?: string;
    details?: { code?: string };
  } | null;
  const code = failure?.details?.code;
  const messages: Record<string, string> = {
    PRICE_CHANGED:
      "Giá sản phẩm đã thay đổi. Hãy kiểm tra giá mới rồi xác nhận lại.",
    SHIPPING_FEE_CHANGED:
      "Phí giao hàng vừa được cập nhật. Hãy kiểm tra tổng tiền mới rồi đặt hàng lại.",
    INSUFFICIENT_STOCK:
      "Tồn kho không đủ cho một hoặc nhiều sản phẩm trong giỏ.",
    VARIANT_UNAVAILABLE: "Sản phẩm hoặc quy cách không còn bán.",
    REGION_NOT_SUPPORTED: "Chưa hỗ trợ giao hàng đến khu vực này.",
    CART_NOT_FULFILLABLE:
      "Chưa có kho nào giao đủ toàn bộ giỏ hàng. Hãy tách thành nhiều đơn.",
    ORDER_CANCEL_NOT_ALLOWED: "Đơn hàng không còn ở trạng thái được phép hủy.",
    ALREADY_PAID: "Đơn đã được ghi nhận thanh toán.",
    PAYMENT_REFERENCE_USED:
      "Mã giao dịch này đã được dùng để đối soát một đơn khác.",
    COD_ALREADY_REMITTED: "Tiền COD của đơn này đã được xác nhận nhận.",
    REPLENISHMENT_PENDING:
      "Đơn đang chờ kho duyệt phiếu chuyển bổ sung đã tạo trước đây.",
    PAYMENT_REQUIRED:
      "Đơn chuyển khoản phải được ghi nhận thanh toán trước khi giao.",
  };
  if (code && messages[code]) return messages[code];
  const serverMessages: Record<string, string> = {
    "The stock issue must be approved before shipping":
      "Phiếu xuất liên kết cần được xác nhận trước khi chuyển đơn sang đang giao.",
    "An approved stock issue cannot be cancelled with the order":
      "Phiếu xuất đã xác nhận nên không thể hủy đơn từ màn hình này.",
    "Paid orders require a refund workflow before cancellation":
      "Đơn đã thanh toán; cần xử lý hoàn tiền trước khi hủy.",
    "Order cannot be cancelled in its current state":
      "Đơn hàng không còn ở trạng thái được phép hủy.",
    "Only PENDING orders can be confirmed":
      "Chỉ đơn đang chờ xác nhận mới có thể xác nhận.",
    "Only CONFIRMED orders can be shipped":
      "Chỉ đơn đã xác nhận mới có thể chuyển sang đang giao.",
    "Only SHIPPING orders can be completed":
      "Chỉ đơn đang giao mới có thể hoàn tất.",
    "Record the bank transfer before completing the order":
      "Hãy ghi nhận chuyển khoản trước khi hoàn tất đơn.",
    "COD is collected on delivery":
      "Đơn COD được ghi đã thu khi giao xong, không đối soát chuyển khoản.",
    "Returned orders cannot be paid": "Đơn đã trả về kho không thể ghi nhận thanh toán.",
    "Only completed COD orders hand over cash":
      "Chỉ đơn COD đã giao xong mới xác nhận nhận tiền.",
    "Refund amount must be positive and at most the order total":
      "Số tiền hoàn phải lớn hơn 0 và không vượt tổng đơn.",
    "Cancelled orders cannot be paid":
      "Đơn đã hủy không thể ghi nhận thanh toán.",
    "Order warehouse is not active": "Kho gắn với đơn đã ngừng hoạt động.",
    "Store belongs to another farm":
      "Cửa hàng không thuộc trại đang chọn. Hãy chuyển sang trại sở hữu cửa hàng.",
    "Order item no longer exists in the farm":
      "Vật tư của đơn không còn thuộc trại này.",
    "Only customer accounts can place storefront orders":
      "Tài khoản nhân viên trang trại không thể đặt hàng. Hãy đăng nhập bằng tài khoản khách hàng.",
    "Bank transfer is not available":
      "Cửa hàng chưa mở thanh toán chuyển khoản. Vui lòng chọn COD.",
  };
  if (failure?.message && serverMessages[failure.message])
    return serverMessages[failure.message];
  if (failure?.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (failure?.status === 403)
    return "Bạn không có quyền thực hiện thao tác này.";
  if (failure?.status === 404)
    return "Không tìm thấy đơn hàng trong cửa hàng này.";
  if (failure?.status === 409)
    return "Đơn hàng không thể thực hiện thao tác này. Tải lại để kiểm tra trạng thái.";
  if (failure?.status === 400) {
    const fieldMessage = validationMessage(failure.details);
    if (fieldMessage) return fieldMessage;
  }
  if (failure?.status && failure.status > 0 && failure.status < 500)
    return "Yêu cầu chưa được chấp nhận. Hãy kiểm tra thông tin và thử lại.";
  return "Chưa xác nhận được kết quả. Đơn có thể đã được tạo; hãy tải danh sách đơn trước khi tiếp tục.";
}

export function normalizeOrderLookupQuery(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

export function filterOrdersByLookupQuery<
  T extends Pick<CustomerOrder, "id" | "code" | "recipientName" | "phone">,
>(orders: readonly T[], rawQuery: string): T[] {
  const q = normalizeOrderLookupQuery(rawQuery);
  if (!q) return [...orders];
  return orders.filter(
    (order) =>
      order.code.toLowerCase().includes(q) ||
      order.id.toLowerCase() === q ||
      order.recipientName.toLowerCase().includes(q) ||
      order.phone.toLowerCase().includes(q),
  );
}

export function resolveOrderProgressStep(status: OrderStatus): {
  activeStep: number;
  isTerminalAlert: boolean;
  summary: string;
} {
  switch (status) {
    case "PENDING":
    case "PREPARING":
      return {
        activeStep: 1,
        isTerminalAlert: false,
        summary:
          status === "PREPARING"
            ? "Đơn đang được điều chuyển bổ sung tồn kho về kho bán trước khi xác nhận."
            : "Đơn hàng đã được ghi nhận và đang chờ trang trại xác nhận.",
      };
    case "CONFIRMED":
      return {
        activeStep: 2,
        isTerminalAlert: false,
        summary:
          "Trang trại đã xác nhận đơn, lập phiếu xuất kho giữ hàng và đang đóng gói.",
      };
    case "SHIPPING":
      return {
        activeStep: 3,
        isTerminalAlert: false,
        summary: "Đơn hàng đã xuất kho và đang trên đường giao đến địa chỉ của bạn.",
      };
    case "COMPLETED":
      return {
        activeStep: 4,
        isTerminalAlert: false,
        summary: "Đơn hàng đã giao thành công. Chính sách bảo hành thiết bị (nếu có) đã được kích hoạt.",
      };
    case "RETURNING":
      return {
        activeStep: 3,
        isTerminalAlert: true,
        summary: "Giao hàng không thành công; kiện hàng đang được hoàn trả về kho bán.",
      };
    case "RETURNED":
      return {
        activeStep: 3,
        isTerminalAlert: true,
        summary: "Kiện hàng hoàn trả đã được kho bán kiểm nhận lại.",
      };
    case "CANCELLED":
      return {
        activeStep: 0,
        isTerminalAlert: true,
        summary: "Đơn hàng đã bị hủy.",
      };
  }
}

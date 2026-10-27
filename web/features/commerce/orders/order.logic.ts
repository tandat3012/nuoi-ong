import type {
  CreateOrderInput,
  CustomerOrder,
  Order,
  OrderDetail,
} from "./types/order";

export function canCustomerCancel(order: CustomerOrder) {
  return order.status === "PENDING" && order.paymentStatus === "UNPAID";
}

export function canStaffCancel(order: Order) {
  return (
    ["PENDING", "CONFIRMED"].includes(order.status) &&
    order.paymentStatus === "UNPAID"
  );
}

export function canStaffCancelDetail(detail: OrderDetail) {
  return (
    canStaffCancel(detail.order) &&
    (!detail.stockIssue || detail.stockIssue.status === "DRAFT")
  );
}

export function canShipOrder(detail: OrderDetail) {
  return (
    detail.order.status === "CONFIRMED" &&
    detail.stockIssue?.status === "CONFIRMED"
  );
}

export function canEditShippingFee(order: Order) {
  return order.status === "PENDING" && order.paymentStatus === "UNPAID";
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
    note: input.note?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    items: [...input.items]
      .map(({ variantId, quantity, expectedUnitPrice }) => ({
        variantId,
        quantity,
        expectedUnitPrice,
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId)),
  });
}

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
      (input.note !== undefined && typeof input.note !== "string") ||
      (input.paymentMethod !== "COD" &&
        input.paymentMethod !== "BANK_TRANSFER") ||
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
  ["shippingFee", "Phí giao hàng phải là số tiền VNĐ nguyên, không âm."],
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
    INSUFFICIENT_STOCK:
      "Tồn kho không đủ cho một hoặc nhiều sản phẩm trong giỏ.",
    VARIANT_UNAVAILABLE: "Sản phẩm hoặc quy cách không còn bán.",
    ORDER_CANCEL_NOT_ALLOWED: "Đơn hàng không còn ở trạng thái được phép hủy.",
    PAYMENT_REQUIRED:
      "Đơn chuyển khoản phải được ghi nhận thanh toán trước khi hoàn tất.",
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
    "Cancelled orders cannot be paid":
      "Đơn đã hủy không thể ghi nhận thanh toán.",
    "Order warehouse is not active": "Kho gắn với đơn đã ngừng hoạt động.",
    "Shipping fee can only change on PENDING, UNPAID orders":
      "Chỉ có thể cập nhật phí giao hàng cho đơn chờ xác nhận và chưa thanh toán.",
    "Store belongs to another farm":
      "Cửa hàng không thuộc trại đang chọn. Hãy chuyển sang trại sở hữu cửa hàng.",
    "Order item no longer exists in the farm":
      "Vật tư của đơn không còn thuộc trại này.",
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

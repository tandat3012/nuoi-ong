export type OrderStatus =
  "PENDING" | "CONFIRMED" | "SHIPPING" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "COD" | "BANK_TRANSFER";
export type PaymentStatus = "UNPAID" | "PAID";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
};

export interface Order {
  id: string;
  orderNumber: number;
  code: string;
  userId: string;
  farmId: string;
  warehouseId: string;
  recipientName: string;
  phone: string;
  address: string;
  note: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotal: string;
  shippingFee: string;
  total: string;
  stockIssueId: string | null;
  cancelReason: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  paidAt: string | null;
  paidByMemberId: string | null;
  handledByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productId: string;
  itemId: string;
  productName: string;
  variantName: string;
  unitPrice: string;
  quantity: number;
  stockQuantity: string;
  lineTotal: string;
}

/** Fields only staff endpoints return. */
type StaffOrderField =
  | "farmId"
  | "warehouseId"
  | "stockIssueId"
  | "paidByMemberId"
  | "handledByMemberId";
export type CustomerOrder = Omit<Order, StaffOrderField>;
export type CustomerOrderItem = Omit<OrderItem, "itemId">;

export interface OrderCustomer {
  id: string;
  fullName: string | null;
  email: string;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  stockIssue: { id: string; issueCode: string; status: string } | null;
  customer: OrderCustomer;
}

export interface CustomerOrderDetail {
  order: CustomerOrder;
  items: CustomerOrderItem[];
  customer: OrderCustomer;
}

export interface CreateOrderInput {
  idempotencyKey: string;
  recipientName: string;
  phone: string;
  address: string;
  note?: string;
  paymentMethod: PaymentMethod;
  items: { variantId: string; quantity: number; expectedUnitPrice?: string }[];
}

export interface StoreOrderFilters {
  page: number;
  pageSize: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
  q?: string;
  customerId?: string;
}

export interface StoreOrderCustomerProfile {
  customer: OrderCustomer;
  orderCount: number;
  completedCount: number;
  totalSpent: string;
  products: {
    variantId: string;
    productName: string;
    variantName: string;
    quantity: number;
    total: string;
  }[];
}

export interface StoreOrderStats {
  counts: Record<OrderStatus, number>;
  revenue: string;
  shippingFees: string;
  completedOrders: number;
  averageOrderValue: string;
  daily: { date: string; revenue: string }[];
  topProducts: {
    productId: string;
    name: string;
    quantity: number;
    revenue: string;
  }[];
  topCustomers: {
    userId: string;
    name: string | null;
    email: string;
    orderCount: number;
    revenue: string;
  }[];
}

import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StoreRegion,
} from "@/features/commerce/orders/types/order";

export type DeliveryScope = "available" | "mine";

/** What a shipper needs to hand an order over; from GET /store-orders/deliveries. */
export interface DeliveryOrder {
  id: string;
  code: string;
  status: OrderStatus;
  recipientName: string;
  phone: string;
  address: string;
  region: StoreRegion | null;
  note: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  items: { productName: string; variantName: string; quantity: number }[];
}

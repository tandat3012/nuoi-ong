import { Badge } from "@/shared/components/ui/badge";
import { formatOrderMoney } from "../order.logic";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_RESULT_LABELS,
  PAYMENT_STATUS_LABELS,
  type CustomerOrder,
  type PaymentResult,
  type CustomerOrderItem,
  type OrderStatus,
} from "../types/order";
import { formatInventoryQuantity } from "@/features/inventory";

import {
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

const statusVariant = {
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPING: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",
} as const;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const Icon = {
    PENDING: Clock,
    CONFIRMED: ShieldCheck,
    SHIPPING: Truck,
    COMPLETED: CheckCircle2,
    CANCELLED: XCircle,
  }[status];

  return (
    <Badge variant={statusVariant[status]} className="inline-flex items-center gap-1.5 font-medium">
      <Icon className="size-3.5" />
      <span>{ORDER_STATUS_LABELS[status]}</span>
    </Badge>
  );
}

const paymentResultVariant = {
  MATCHED: "success",
  AMOUNT_MISMATCH: "warning",
  ORDER_NOT_FOUND: "warning",
  ORDER_NOT_PAYABLE: "destructive",
  ALREADY_PAID: "info",
  WRONG_ACCOUNT: "destructive",
} as const;

export function PaymentResultBadge({ result }: { result: PaymentResult }) {
  return (
    <Badge variant={paymentResultVariant[result]}>
      {PAYMENT_RESULT_LABELS[result]}
    </Badge>
  );
}

export function PaymentStatusBadge({ order }: { order: CustomerOrder }) {
  const isPaid = order.paymentStatus === "PAID";
  return (
    <Badge
      variant={isPaid ? "success" : "warning"}
      className="inline-flex items-center gap-1.5 font-medium"
    >
      {isPaid ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
      <span>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</span>
    </Badge>
  );
}

export function paymentMethodLabel(method: CustomerOrder["paymentMethod"]) {
  return method === "COD"
    ? "Thanh toán khi nhận hàng (COD)"
    : "Chuyển khoản ngân hàng";
}

/** `showStock` adds the warehouse quantity column for staff. */
export function OrderItems({
  items,
  showStock = false,
}: {
  items: CustomerOrderItem[];
  showStock?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[600px] text-left text-sm">
        <caption className="sr-only">Sản phẩm trong đơn hàng</caption>
        <thead className="border-b bg-muted/50">
          <tr>
            {[
              "Sản phẩm",
              "Đơn giá",
              "Số lượng",
              ...(showStock ? ["Số lượng kho"] : []),
              "Thành tiền",
            ].map((label) => (
              <th key={label} scope="col" className="px-4 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantName}
                </p>
              </td>
              <td className="px-4 py-3">{formatOrderMoney(item.unitPrice)}</td>
              <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
              {showStock && (
                <td className="px-4 py-3 tabular-nums">{formatInventoryQuantity(item.stockQuantity)}</td>
              )}
              <td className="px-4 py-3 font-medium">
                {formatOrderMoney(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderAmounts({ order }: { order: CustomerOrder }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">Tiền sản phẩm</dt>
        <dd>{formatOrderMoney(order.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">
          Phí giao hàng{order.status === "PENDING" ? " (chờ xác nhận)" : ""}
        </dt>
        <dd>{formatOrderMoney(order.shippingFee)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
        <dt>Tổng đơn hàng</dt>
        <dd>{formatOrderMoney(order.total)}</dd>
      </div>
      {order.status === "PENDING" && order.shippingFee === "0" && (
        <p className="text-xs text-muted-foreground">
          Mức phí 0₫ đang lưu trên đơn chưa xác nhận miễn phí giao hàng; cửa
          hàng sẽ xác nhận khi xử lý.
        </p>
      )}
    </dl>
  );
}

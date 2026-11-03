import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { OrderDetail } from "@/features/commerce/orders/types/order";
import type { DeliveryOrder, DeliveryScope } from "./types";

export function getDeliveries(
  request: AuthenticatedRequest,
  farmId: string,
  scope: DeliveryScope,
) {
  return request<{ data: DeliveryOrder[] }>("/store-orders/deliveries", {
    params: { farmId, scope },
  });
}

/** Store managers get the staff detail back; other delivery roles only the delivery view. */
type DeliveryActionResult = { data: OrderDetail | DeliveryOrder };

/** `ship` makes the caller the shipper; `complete` marks it delivered. */
export function runDeliveryAction(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  action: "ship" | "complete",
) {
  return request<DeliveryActionResult>(
    `/store-orders/${encodeURIComponent(id)}/${action}`,
    { method: "POST", params: { farmId } },
  );
}

export function returnDelivery(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  reason: string,
) {
  return request<DeliveryActionResult>(
    `/store-orders/${encodeURIComponent(id)}/return-delivery`,
    { method: "POST", params: { farmId }, data: { reason } },
  );
}

import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  Order,
  OrderDetail,
  StoreOrderCustomerProfile,
  StoreOrderFilters,
  StoreOrderStats,
} from "@/features/commerce/orders/types/order";

export function getStoreOrders(
  request: AuthenticatedRequest,
  farmId: string,
  filters: StoreOrderFilters,
) {
  return request<PaginatedResponse<Order>>("/store-orders", {
    params: { farmId, ...filters, q: filters.q?.trim() || undefined },
  });
}

export function getStoreOrder(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
) {
  return request<{ data: OrderDetail }>(
    `/store-orders/${encodeURIComponent(id)}`,
    { params: { farmId } },
  );
}

export function setStoreOrderShippingFee(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  shippingFee: string,
) {
  return request<{ data: OrderDetail }>(
    `/store-orders/${encodeURIComponent(id)}/shipping-fee`,
    { method: "PATCH", params: { farmId }, data: { shippingFee } },
  );
}

export function runStoreOrderAction(
  request: AuthenticatedRequest,
  farmId: string,
  id: string,
  action: "confirm" | "ship" | "complete" | "mark-paid" | "cancel",
  reason?: string,
) {
  return request<{ data: OrderDetail }>(
    `/store-orders/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      params: { farmId },
      ...(action === "cancel" ? { data: { reason } } : {}),
    },
  );
}

export function getStoreOrderCustomer(
  request: AuthenticatedRequest,
  farmId: string,
  userId: string,
) {
  return request<{ data: StoreOrderCustomerProfile }>(
    `/store-orders/customers/${encodeURIComponent(userId)}`,
    { params: { farmId } },
  );
}

export function getStoreOrderStats(
  request: AuthenticatedRequest,
  farmId: string,
  from: string,
  to: string,
) {
  return request<{ data: StoreOrderStats }>("/store-orders/stats", {
    params: { farmId, from, to },
  });
}

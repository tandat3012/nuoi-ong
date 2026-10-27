import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  CreateOrderInput,
  CustomerOrder,
  CustomerOrderDetail,
} from "./types/order";

export function createCustomerOrder(
  request: AuthenticatedRequest,
  input: CreateOrderInput,
) {
  return request<{ data: CustomerOrderDetail }>("/store/orders", {
    method: "POST",
    data: input,
  });
}

export function getCustomerOrders(request: AuthenticatedRequest, page: number) {
  return request<PaginatedResponse<CustomerOrder>>("/store/orders", {
    params: { page, pageSize: 10 },
  });
}

export function getCustomerOrder(request: AuthenticatedRequest, id: string) {
  return request<{ data: CustomerOrderDetail }>(
    `/store/orders/${encodeURIComponent(id)}`,
  );
}

export function cancelCustomerOrder(
  request: AuthenticatedRequest,
  id: string,
  reason: string,
) {
  return request<{ data: CustomerOrderDetail }>(
    `/store/orders/${encodeURIComponent(id)}/cancel`,
    { method: "POST", data: { reason } },
  );
}

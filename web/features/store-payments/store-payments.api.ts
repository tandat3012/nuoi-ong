import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  PaymentResult,
  PaymentTransaction,
} from "@/features/commerce/orders/types/order";

export interface StorePaymentFilters {
  page: number;
  pageSize: number;
  result?: PaymentResult;
}

export interface SimulatePaymentInput {
  amount: string;
  content: string;
  accountNumber?: string;
  providerTxId?: string;
}

export function getStorePayments(
  request: AuthenticatedRequest,
  farmId: string,
  filters: StorePaymentFilters,
) {
  return request<PaginatedResponse<PaymentTransaction>>("/store-payments", {
    params: { farmId, ...filters },
  });
}

export function getPaymentSimulator(
  request: AuthenticatedRequest,
  farmId: string,
) {
  return request<{ data: { enabled: boolean; accountNumber: string | null } }>(
    "/store-payments/simulator",
    { params: { farmId } },
  );
}

export function simulatePayment(
  request: AuthenticatedRequest,
  farmId: string,
  input: SimulatePaymentInput,
) {
  return request<{
    data: { transaction: PaymentTransaction; duplicate: boolean };
  }>("/store-payments/simulate", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

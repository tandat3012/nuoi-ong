import { API_CONFIG } from "@/shared/config/api";

export interface StorePaymentMethods {
  bankTransfer: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

/** Public store payment options; bank transfer is null until the API has a receiving account. */
export async function getStorePaymentMethods(): Promise<StorePaymentMethods> {
  const baseUrl = process.env.API_INTERNAL_URL ?? API_CONFIG.BASE_URL;
  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/payment-methods`,
    { cache: "no-store", signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok)
    throw new Error(`Không tải được phương thức thanh toán: HTTP ${response.status}`);
  return ((await response.json()) as { data: StorePaymentMethods }).data;
}

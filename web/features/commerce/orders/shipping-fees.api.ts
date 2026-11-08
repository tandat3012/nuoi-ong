import { API_CONFIG } from "@/shared/config/api";
import type { StoreRegion } from "./types/order";

export type StoreShippingFees = Record<StoreRegion, string>;

/** Delivery fee per region (VND strings); the API adds exactly this fee to the order. */
export async function getStoreShippingFees(): Promise<StoreShippingFees> {
  const baseUrl = process.env.API_INTERNAL_URL ?? API_CONFIG.BASE_URL;
  const response = await fetch(
    `${baseUrl}${API_CONFIG.VERSION}/store/shipping-fees`,
    { cache: "no-store", signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok)
    throw new Error(`Không tải được phí giao hàng: HTTP ${response.status}`);
  return ((await response.json()) as { data: StoreShippingFees }).data;
}

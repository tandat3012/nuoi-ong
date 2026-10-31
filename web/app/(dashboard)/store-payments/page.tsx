import type { Metadata } from "next";
import { StorePaymentsScreen } from "@/features/store-payments";

export const metadata: Metadata = { title: "Thanh toán cửa hàng" };

export default function Page() {
  return <StorePaymentsScreen />;
}

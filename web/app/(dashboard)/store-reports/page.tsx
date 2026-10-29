import type { Metadata } from "next";
import { StoreOrderReportsScreen } from "@/features/store-orders";

export const metadata: Metadata = { title: "Báo cáo bán hàng" };

export default function Page() {
  return <StoreOrderReportsScreen />;
}

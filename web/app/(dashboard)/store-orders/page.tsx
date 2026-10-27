import type { Metadata } from "next";
import { StoreOrdersScreen } from "@/features/store-orders";

export const metadata: Metadata = { title: "Đơn hàng cửa hàng" };

export default function Page() {
  return <StoreOrdersScreen />;
}

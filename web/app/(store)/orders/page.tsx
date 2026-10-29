import type { Metadata } from "next";
import { CustomerOrdersScreen } from "@/features/commerce/orders";

export const metadata: Metadata = { title: "Đơn hàng của tôi" };

export default function Page() {
  return <CustomerOrdersScreen />;
}

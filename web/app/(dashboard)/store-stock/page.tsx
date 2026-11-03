import type { Metadata } from "next";
import { StoreSalesStockScreen } from "@/features/store-admin";

export const metadata: Metadata = { title: "Tồn bán hàng" };

export default function Page() {
  return <StoreSalesStockScreen />;
}

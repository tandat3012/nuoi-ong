import type { Metadata } from "next";
import { StoreProductsScreen } from "@/features/store-admin";

export const metadata: Metadata = { title: "Sản phẩm cửa hàng" };

export default function StoreProductsPage() {
  return <StoreProductsScreen />;
}

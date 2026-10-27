import type { Metadata } from "next";
import { StoreProductsScreen } from "@/features/store-admin";

export const metadata: Metadata = { title: "Chi tiết sản phẩm cửa hàng" };

export default async function StoreProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoreProductsScreen id={id} />;
}

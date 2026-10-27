import type { Metadata } from "next";
import { StoreOrderDetailScreen } from "@/features/store-orders";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoreOrderDetailScreen id={id} />;
}

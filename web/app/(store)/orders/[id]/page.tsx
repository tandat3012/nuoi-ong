import type { Metadata } from "next";
import { CustomerOrderDetailScreen } from "@/features/commerce/orders";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerOrderDetailScreen id={id} />;
}

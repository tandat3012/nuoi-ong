import type { Metadata } from "next";
import { StoreOrderCustomerScreen } from "@/features/store-orders";

export const metadata: Metadata = { title: "Lịch sử mua hàng" };

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <StoreOrderCustomerScreen userId={userId} />;
}

"use client";

import { useAuth } from "@clerk/nextjs";
export { CustomerOrderDetail } from "./components/customer-order-detail";
export { CustomerOrders } from "./components/customer-orders";

import { CustomerOrderDetail } from "./components/customer-order-detail";
import { CustomerOrders } from "./components/customer-orders";

export function CustomerOrdersScreen() {
  const { userId } = useAuth();
  return <CustomerOrders key={userId ?? "loading"} />;
}

export function CustomerOrderDetailScreen({ id }: { id: string }) {
  const { userId } = useAuth();
  return <CustomerOrderDetail key={`${userId ?? "loading"}:${id}`} id={id} />;
}

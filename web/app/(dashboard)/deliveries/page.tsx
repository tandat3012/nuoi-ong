import type { Metadata } from "next";
import { DeliveriesScreen } from "@/features/deliveries";

export const metadata: Metadata = { title: "Giao hàng" };

export default function Page() {
  return <DeliveriesScreen />;
}

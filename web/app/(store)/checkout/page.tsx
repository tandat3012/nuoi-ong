import type { Metadata } from "next";
import { CheckoutPage } from "@/features/commerce/checkout/components/checkout-page";

export const metadata: Metadata = { title: "Đặt hàng" };

export default function Page() {
  return <CheckoutPage />;
}

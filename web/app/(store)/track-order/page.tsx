import type { Metadata } from "next";
import { TrackOrderPageContent } from "@/features/commerce/orders/components/track-order-page";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng & Bảo hành",
  description:
    "Tra cứu tiến trình xử lý đơn hàng, vận chuyển 3 miền và trạng thái phiếu bảo hành thiết bị tại Mộc Ong.",
};

export default function TrackOrderPage() {
  return <TrackOrderPageContent />;
}

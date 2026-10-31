import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestsScreen } from "@/features/requests";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export const metadata: Metadata = { title: "Yêu cầu" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải yêu cầu…" />}>
      <RequestsScreen />
    </Suspense>
  );
}

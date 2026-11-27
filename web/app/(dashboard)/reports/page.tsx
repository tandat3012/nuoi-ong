import type { Metadata } from "next";
import { Suspense } from "react";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { ReportsScreen } from "@/features/reports";

export const metadata: Metadata = { title: "Thống kê" };

export default function Page() {
  // ReportsScreen reads the report link from the URL.
  return (
    <Suspense fallback={<BeeLoader label="Đang tải thống kê…" />}>
      <ReportsScreen />
    </Suspense>
  );
}

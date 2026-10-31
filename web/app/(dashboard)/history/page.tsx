import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryScreen } from "@/features/history";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export const metadata: Metadata = { title: "Lịch sử thay đổi" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải lịch sử thay đổi…" />}>
      <HistoryScreen />
    </Suspense>
  );
}

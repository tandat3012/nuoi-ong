import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryScreen } from "@/features/history";

export const metadata: Metadata = { title: "Lịch sử thay đổi" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<p role="status">Đang tải lịch sử thay đổi…</p>}>
      <HistoryScreen />
    </Suspense>
  );
}

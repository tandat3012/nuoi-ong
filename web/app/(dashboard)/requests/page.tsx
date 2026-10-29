import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestsScreen } from "@/features/requests";

export const metadata: Metadata = { title: "Yêu cầu" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<p role="status">Đang tải yêu cầu…</p>}>
      <RequestsScreen />
    </Suspense>
  );
}

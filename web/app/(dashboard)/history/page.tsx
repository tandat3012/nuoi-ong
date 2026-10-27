import type { Metadata } from "next";
import { AuditHistoryPage } from "@/features/audit/audit-history-page";

export const metadata: Metadata = { title: "Lịch sử thao tác" };

export default function HistoryRoutePage() {
  return <AuditHistoryPage />;
}

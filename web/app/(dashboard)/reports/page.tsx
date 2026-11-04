import type { Metadata } from "next";
import { ReportsScreen } from "@/features/reports";

export const metadata: Metadata = { title: "Thống kê" };

export default function Page() {
  return <ReportsScreen />;
}

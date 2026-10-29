import type { Metadata } from "next";
import { IssueDetailRoute } from "@/features/issues";

export const metadata: Metadata = { title: "Chi tiết phiếu xuất" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetailRoute id={id} />;
}

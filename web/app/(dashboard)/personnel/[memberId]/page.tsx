import type { Metadata } from "next";
import { PersonnelScreen } from "@/features/personnel";

export const metadata: Metadata = { title: "Hồ sơ nhân sự" };
export default async function PersonnelDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return <PersonnelScreen memberId={memberId} />;
}

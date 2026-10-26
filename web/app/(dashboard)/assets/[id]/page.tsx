import type { Metadata } from "next";
import { AssetsScreen } from "@/features/assets";

export const metadata: Metadata = { title: "Chi tiết tài sản" };

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetsScreen id={id} />;
}

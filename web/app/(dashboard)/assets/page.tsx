import type { Metadata } from "next";

import { AssetsScreen } from "@/features/assets";

export const metadata: Metadata = { title: "Tài sản" };

export default function AssetsPage() {
  return <AssetsScreen />;
}

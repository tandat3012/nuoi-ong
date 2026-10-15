import type { Metadata } from "next";

import { IssuesPage } from "@/features/issues";

export const metadata: Metadata = { title: "Phiếu xuất" };

export default function Page() {
  return <IssuesPage />;
}

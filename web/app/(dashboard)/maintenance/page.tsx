import type { Metadata } from "next";

import { MaintenanceScreen } from "@/features/maintenance";

export const metadata: Metadata = { title: "Bảo trì" };

export default function MaintenancePage() {
  return <MaintenanceScreen />;
}

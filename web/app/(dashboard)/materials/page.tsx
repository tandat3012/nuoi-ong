import type { Metadata } from "next";
import { MaterialsPage } from "@/features/materials";

export const metadata: Metadata = {
  title: "Quản lý vật tư",
  description: "Quản lý danh sách, hồ sơ và tồn kho vật tư nông trại",
};

export default function MaterialsRoutePage() {
  return <MaterialsPage />;
}

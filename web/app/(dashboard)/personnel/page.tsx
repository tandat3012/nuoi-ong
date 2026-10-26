import type { Metadata } from "next";
import { PersonnelScreen } from "@/features/personnel";

export const metadata: Metadata = { title: "Nhân sự" };
export default function PersonnelPage() {
  return <PersonnelScreen />;
}

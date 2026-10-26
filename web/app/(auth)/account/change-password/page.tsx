import type { Metadata } from "next";
import { ChangeInitialPassword } from "@/features/auth/components/change-initial-password";

export const metadata: Metadata = { title: "Đổi mật khẩu ban đầu" };
export default function ChangePasswordPage() {
  return <ChangeInitialPassword />;
}

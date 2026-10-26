import type { Metadata } from "next";

import { QrScanner } from "@/features/qr";

export const metadata: Metadata = { title: "Tra cứu QR" };

export default function ScanPage() {
  return <QrScanner />;
}

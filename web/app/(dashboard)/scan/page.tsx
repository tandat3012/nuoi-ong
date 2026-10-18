import type { Metadata } from 'next';

import { qrModule } from '@/features/qr';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Tra cứu QR' };

export default function ScanPage() {
  return <ModuleOverview module={qrModule} />;
}

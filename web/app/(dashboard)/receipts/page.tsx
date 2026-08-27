import type { Metadata } from 'next';

import { receiptsModule } from '@/features/receipts';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Phiếu nhập' };

export default function ReceiptsPage() {
  return <ModuleOverview module={receiptsModule} />;
}

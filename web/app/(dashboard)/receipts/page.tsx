import type { Metadata } from 'next';

import { ReceiptsScreen } from '@/features/receipts';

export const metadata: Metadata = { title: 'Phiếu nhập' };

export default function ReceiptsPage() {
  return <ReceiptsScreen />;
}

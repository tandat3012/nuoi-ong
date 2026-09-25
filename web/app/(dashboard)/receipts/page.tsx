import type { Metadata } from 'next';

import { ReceiptsPage } from '@/features/receipts';

export const metadata: Metadata = { title: 'Phiếu nhập' };

export default function Page() {
  return <ReceiptsPage />;
}

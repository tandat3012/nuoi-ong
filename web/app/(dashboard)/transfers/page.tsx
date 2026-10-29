import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TransfersScreen } from '@/features/transfers';

export const metadata: Metadata = { title: 'Điều chuyển kho' };

export default function TransfersPage() {
  return (
    <Suspense fallback={<p role="status">Đang tải phiếu điều chuyển…</p>}>
      <TransfersScreen />
    </Suspense>
  );
}

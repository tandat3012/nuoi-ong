import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TransfersScreen } from '@/features/transfers';
import { BeeLoader } from '@/shared/components/ui/bee-loader';

export const metadata: Metadata = { title: 'Điều chuyển kho' };

export default function TransfersPage() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải phiếu điều chuyển…" />}>
      <TransfersScreen />
    </Suspense>
  );
}

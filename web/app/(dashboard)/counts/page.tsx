import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CountsScreen } from '@/features/counts';
import { BeeLoader } from '@/shared/components/ui/bee-loader';

export const metadata: Metadata = { title: 'Kiểm kê kho' };

export default function CountsPage() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải phiếu kiểm kê…" />}>
      <CountsScreen />
    </Suspense>
  );
}

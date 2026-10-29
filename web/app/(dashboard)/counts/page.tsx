import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CountsScreen } from '@/features/counts';

export const metadata: Metadata = { title: 'Kiểm kê kho' };

export default function CountsPage() {
  return (
    <Suspense fallback={<p role="status">Đang tải phiếu kiểm kê…</p>}>
      <CountsScreen />
    </Suspense>
  );
}

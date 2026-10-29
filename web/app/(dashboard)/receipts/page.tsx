import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ReceiptsPage } from '@/features/receipts';

export const metadata: Metadata = { title: 'Phiếu nhập' };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Đang tải phiếu nhập…</p>}>
      <ReceiptsPage />
    </Suspense>
  );
}

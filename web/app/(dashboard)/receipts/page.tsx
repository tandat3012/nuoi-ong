import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ReceiptsPage } from '@/features/receipts';
import { BeeLoader } from '@/shared/components/ui/bee-loader';

export const metadata: Metadata = { title: 'Phiếu nhập' };

export default function Page() {
  return (
    <Suspense fallback={<BeeLoader label="Đang tải phiếu nhập…" />}>
      <ReceiptsPage />
    </Suspense>
  );
}

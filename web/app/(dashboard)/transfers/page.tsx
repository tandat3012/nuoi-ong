import type { Metadata } from 'next';

import { TransfersScreen } from '@/features/transfers';

export const metadata: Metadata = { title: 'Điều chuyển kho' };

export default function TransfersPage() {
  return <TransfersScreen />;
}

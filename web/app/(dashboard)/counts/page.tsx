import type { Metadata } from 'next';

import { CountsScreen } from '@/features/counts';

export const metadata: Metadata = { title: 'Kiểm kê kho' };

export default function CountsPage() {
  return <CountsScreen />;
}

import type { Metadata } from 'next';

import { IssuesScreen } from '@/features/issues';

export const metadata: Metadata = { title: 'Phiếu xuất' };

export default function IssuesPage() {
  return <IssuesScreen />;
}

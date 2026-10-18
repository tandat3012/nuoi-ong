import type { Metadata } from 'next';

import { DashboardOverview } from '@/features/dashboard';

export const metadata: Metadata = { title: 'Tổng quan' };

export default function DashboardPage() {
  return <DashboardOverview />;
}

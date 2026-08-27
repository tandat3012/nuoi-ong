import type { Metadata } from 'next';

import { issuesModule } from '@/features/issues';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Phiếu xuất' };

export default function IssuesPage() {
  return <ModuleOverview module={issuesModule} />;
}

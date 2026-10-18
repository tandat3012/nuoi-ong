import type { Metadata } from 'next';

import { assetsModule } from '@/features/assets';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Tài sản' };

export default function AssetsPage() {
  return <ModuleOverview module={assetsModule} />;
}

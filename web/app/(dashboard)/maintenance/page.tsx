import type { Metadata } from 'next';

import { maintenanceModule } from '@/features/maintenance';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Bảo trì' };

export default function MaintenancePage() {
  return <ModuleOverview module={maintenanceModule} />;
}

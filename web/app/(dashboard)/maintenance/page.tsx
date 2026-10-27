import type { Metadata } from 'next';

import { MaintenanceScreen } from '@/features/maintenance/components/maintenance-screen';

export const metadata: Metadata = { title: 'Bảo trì' };

export default function MaintenancePage() {
  return <MaintenanceScreen />;
}

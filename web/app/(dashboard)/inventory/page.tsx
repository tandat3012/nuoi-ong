import type { Metadata } from 'next';

import { inventoryModule } from '@/features/inventory';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Tồn kho' };

export default function InventoryPage() {
  return <ModuleOverview module={inventoryModule} />;
}

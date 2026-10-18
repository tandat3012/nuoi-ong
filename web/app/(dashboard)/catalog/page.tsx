import type { Metadata } from 'next';

import { catalogModule } from '@/features/catalog';
import { ModuleOverview } from '@/shared/components/module-overview';

export const metadata: Metadata = { title: 'Danh mục' };

export default function CatalogPage() {
  return <ModuleOverview module={catalogModule} />;
}

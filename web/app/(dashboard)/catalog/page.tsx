import type { Metadata } from 'next';

import { CatalogScreen } from '@/features/catalog';

export const metadata: Metadata = { title: 'Danh mục' };

export default function CatalogPage() {
  return <CatalogScreen />;
}

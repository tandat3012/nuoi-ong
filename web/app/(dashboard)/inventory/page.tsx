import type { Metadata } from 'next';

import { InventoryScreen } from '@/features/inventory';

export const metadata: Metadata = { title: 'Tồn kho' };

export default function InventoryPage() {
  return <InventoryScreen />;
}

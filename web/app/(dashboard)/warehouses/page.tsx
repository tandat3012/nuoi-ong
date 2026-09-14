import type { Metadata } from 'next';

import { WarehousesScreen } from '@/features/warehouses';

export const metadata: Metadata = { title: 'Quản lý kho' };

export default function WarehousesPage() {
  return <WarehousesScreen />;
}

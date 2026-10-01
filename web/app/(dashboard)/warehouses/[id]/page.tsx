import type { Metadata } from 'next';

import { WarehousesPage } from '@/features/warehouses';

export const metadata: Metadata = { title: 'Chi tiết kho' };

export default function WarehouseDetailPage() {
  return <WarehousesPage />;
}

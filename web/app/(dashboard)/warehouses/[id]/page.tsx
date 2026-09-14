import type { Metadata } from 'next';

import { WarehouseDetailScreen } from '@/features/warehouses';

export const metadata: Metadata = { title: 'Chi tiết kho' };

export default function WarehouseDetailPage() {
  return <WarehouseDetailScreen />;
}

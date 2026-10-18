import type { Metadata } from 'next';
import { WarehousesPage } from '@/features/warehouses';

export const metadata: Metadata = {
  title: 'Quản lý kho',
  description: 'Quản lý thông tin kho lưu trữ của trang trại',
};

export default function WarehousesRoutePage() {
  return <WarehousesPage />;
}

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  PackageSearch,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  History,
  Fingerprint,
} from 'lucide-react';

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type NavigationSection = {
  title: string;
  items: readonly NavigationItem[];
};

export const primaryNavigationSections: readonly NavigationSection[] = [
  {
    title: 'Tổng quan',
    items: [
      {
        href: '/dashboard',
        label: 'Tổng quan',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: 'Kho & Tồn kho',
    items: [
      {
        href: '/inventory',
        label: 'Tồn kho',
        icon: PackageSearch,
      },
      {
        href: '/receipts',
        label: 'Phiếu nhập',
        icon: ArrowDownToLine,
      },
      {
        href: '/issues',
        label: 'Phiếu xuất',
        icon: ArrowUpFromLine,
      },
      {
        href: '/transfers',
        label: 'Điều chuyển kho',
        icon: ArrowLeftRight,
      },
      {
        href: '/history',
        label: 'Lịch sử thao tác',
        icon: History,
      },
    ],
  },
  {
    title: 'Quản lý nguồn lực',
    items: [
      {
        href: '/materials',
        label: 'Vật tư',
        icon: Boxes,
      },
      {
        href: '/warehouses',
        label: 'Kho',
        icon: Warehouse,
      },
      {
        href: '/assets',
        label: 'Tài sản định danh',
        icon: Fingerprint,
      },
    ],
  },
];

// Flat list of operational routes for quick lookup or fallback
export const operationalNavigation: readonly NavigationItem[] = primaryNavigationSections.flatMap(
  (section) => section.items,
);

// Route labels for breadcrumbs (including hidden placeholder routes)
export const routeLabels: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/inventory': 'Tồn kho',
  '/receipts': 'Phiếu nhập',
  '/issues': 'Phiếu xuất',
  '/history': 'Lịch sử thao tác',
  '/transfers': 'Điều chuyển kho',
  '/materials': 'Vật tư',
  '/warehouses': 'Kho',
  '/assets': 'Tài sản định danh',
  '/catalog': 'Danh mục',
  '/maintenance': 'Bảo trì',
  '/scan': 'Tra cứu QR',
};

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  PackageSearch,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Warehouse,
  ClipboardCheck,
  ArrowRightLeft,
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
        href: '/counts',
        label: 'Kiểm kê',
        icon: ClipboardCheck,
      },
      {
        href: '/transfers',
        label: 'Điều chuyển',
        icon: ArrowRightLeft,
      },
    ],
  },
  {
    title: 'Quản lý nguồn lực',
    items: [
      { href: '/personnel', label: 'Nhân sự', icon: Users },
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
    ],
  },
];

// Flat list of operational routes for quick lookup or fallback
export const operationalNavigation: readonly NavigationItem[] = primaryNavigationSections.flatMap(
  (section) => section.items,
);

// Route labels for breadcrumbs (including hidden placeholder routes)
export const routeLabels: Record<string, string> = {
  '/personnel': 'Nhân sự',
  '/dashboard': 'Tổng quan',
  '/inventory': 'Tồn kho',
  '/receipts': 'Phiếu nhập',
  '/issues': 'Phiếu xuất',
  '/counts': 'Kiểm kê',
  '/transfers': 'Điều chuyển',
  '/materials': 'Vật tư',
  '/warehouses': 'Kho',
  '/catalog': 'Danh mục',
  '/assets': 'Tài sản',
  '/maintenance': 'Bảo trì',
  '/scan': 'Tra cứu QR',
};

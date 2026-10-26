import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  PackageSearch,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Warehouse,
  ClipboardCheck,
  ArrowRightLeft,
  Wrench,
  ScanLine,
  Users,
} from 'lucide-react';

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Only ADMIN / FARM_OWNER of the selected farm see this item. */
  adminOnly?: boolean;
};

export type NavigationSection = {
  title: string;
  items: readonly NavigationItem[];
};

// Grouped by the manager's daily flow: daily stock movements first, then assets, master data, people.
export const primaryNavigationSections: readonly NavigationSection[] = [
  {
    title: 'Tổng quan',
    items: [{ href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard }],
  },
  {
    title: 'Vận hành kho',
    items: [
      { href: '/inventory', label: 'Tồn kho', icon: PackageSearch, description: 'Số lượng hiện có theo kho, lô và vật tư.' },
      { href: '/receipts', label: 'Phiếu nhập', icon: ArrowDownToLine, description: 'Lập và xác nhận phiếu nhập hàng vào kho.' },
      { href: '/issues', label: 'Phiếu xuất', icon: ArrowUpFromLine, description: 'Xuất vật tư, lô hoặc tài sản ra khỏi kho.' },
      { href: '/transfers', label: 'Điều chuyển', icon: ArrowRightLeft, description: 'Chuyển hàng giữa các kho của trang trại.' },
      { href: '/counts', label: 'Kiểm kê', icon: ClipboardCheck, description: 'Đối chiếu số lượng thực tế với hệ thống.' },
    ],
  },
  {
    title: 'Tài sản & bảo trì',
    items: [
      { href: '/assets', label: 'Tài sản', icon: Package, description: 'Theo dõi thiết bị, người giữ và vòng đời.' },
      { href: '/maintenance', label: 'Bảo trì', icon: Wrench, description: 'Lịch bảo trì, chi phí và kết quả.' },
      { href: '/scan', label: 'Tra cứu QR', icon: ScanLine, description: 'Quét mã QR để mở nhanh hồ sơ tài sản.' },
    ],
  },
  {
    title: 'Danh mục',
    items: [
      { href: '/materials', label: 'Vật tư', icon: Boxes, description: 'Danh mục vật tư, đơn vị và mức tồn tối thiểu.' },
      { href: '/warehouses', label: 'Kho', icon: Warehouse, description: 'Danh sách kho và vị trí lưu trữ.' },
    ],
  },
  {
    title: 'Tổ chức',
    items: [
      { href: '/personnel', label: 'Nhân sự', icon: Users, adminOnly: true, description: 'Tài khoản nhân viên và vai trò.' },
    ],
  },
];

// Route labels for breadcrumbs (including hidden placeholder routes)
export const routeLabels: Record<string, string> = {
  ...Object.fromEntries(
    primaryNavigationSections.flatMap(({ items }) => items.map(({ href, label }) => [href, label])),
  ),
  '/catalog': 'Danh mục',
};

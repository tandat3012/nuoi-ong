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
  ClipboardList,
  ScanLine,
  Users,
  Store,
  ShoppingCart,
  ChartNoAxesCombined,
  Tags,
} from 'lucide-react';

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Only ADMIN / FARM_OWNER of the selected farm see this item. */
  adminOnly?: boolean;
  /** ADMIN, FARM_OWNER, and EMPLOYEE of the selected farm see this item. */
  staffOnly?: boolean;
  /** Only shown while the selected farm owns the store warehouse. */
  storeOnly?: boolean;
};

export type NavigationSection = {
  title: string;
  items: readonly NavigationItem[];
};

// Grouped by the manager's daily flow: daily stock movements first, then assets, master data, sales, people.
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
      { href: '/requests', label: 'Yêu cầu', icon: ClipboardList, description: 'Yêu cầu bảo trì và chuyển tài sản.' },
      { href: '/scan', label: 'Tra cứu QR', icon: ScanLine, description: 'Quét mã QR để mở nhanh hồ sơ tài sản.' },
    ],
  },
  {
    title: 'Danh mục',
    items: [
      { href: '/materials', label: 'Vật tư', icon: Boxes, description: 'Danh mục vật tư, đơn vị và mức tồn tối thiểu.' },
      { href: '/warehouses', label: 'Kho', icon: Warehouse, description: 'Danh sách kho và vị trí lưu trữ.' },
      { href: '/catalog', label: 'Danh mục chung', icon: Tags, description: 'Nhà cung cấp, vị trí, nhóm hàng và đơn vị tính.' },
    ],
  },
  {
    title: 'Cửa hàng',
    items: [
      { href: '/store-products', label: 'Sản phẩm cửa hàng', icon: Store, adminOnly: true, storeOnly: true, description: 'Sản phẩm, biến thể và hình ảnh bán online.' },
      { href: '/store-orders', label: 'Đơn hàng', icon: ShoppingCart, staffOnly: true, storeOnly: true, description: 'Xác nhận đơn, theo dõi giao hàng và thanh toán.' },
      { href: '/store-reports', label: 'Báo cáo bán hàng', icon: ChartNoAxesCombined, adminOnly: true, storeOnly: true, description: 'Doanh thu, sản phẩm và khách hàng.' },
    ],
  },
  {
    title: 'Tổ chức',
    items: [
      { href: '/personnel', label: 'Nhân sự', icon: Users, adminOnly: true, description: 'Tài khoản nhân viên và vai trò.' },
    ],
  },
];

export type NavigationAccess = {
  canManageFarm: boolean;
  canManageOrders: boolean;
  isStoreFarm: boolean;
};

export function isNavigationItemVisible(item: NavigationItem, access: NavigationAccess) {
  return (
    (!item.adminOnly || access.canManageFarm) &&
    (!item.staffOnly || access.canManageOrders) &&
    (!item.storeOnly || access.isStoreFarm)
  );
}

// Route labels for breadcrumbs (including hidden placeholder routes)
export const routeLabels: Record<string, string> = {
  ...Object.fromEntries(
    primaryNavigationSections.flatMap(({ items }) => items.map(({ href, label }) => [href, label])),
  ),
};

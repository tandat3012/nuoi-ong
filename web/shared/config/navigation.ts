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
  Landmark,
  Tags,
  History,
  PackageCheck,
  Truck,
  ChartColumnBig,
  ShieldCheck,
} from 'lucide-react';

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Role-based access the selected farm membership needs; see features/auth/farm-roles.ts. */
  requires?: NavigationRequirement;
  /** Only shown while the selected farm owns the store warehouse. */
  storeOnly?: boolean;
};

type NavigationRequirement = 'manageFarm' | 'manageWarehouse' | 'manageStore' | 'deliver' | 'farmArea' | 'restock' | 'masterData' | 'history';

export type NavigationSection = {
  title: string;
  items: readonly NavigationItem[];
};

// Grouped by the manager's daily flow: daily stock movements first, then assets, master data, sales, people.
export const primaryNavigationSections: readonly NavigationSection[] = [
  {
    title: 'Tổng quan',
    items: [
      { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/reports', label: 'Thống kê', icon: ChartColumnBig, requires: 'manageWarehouse', description: 'Biểu đồ nhập – xuất kho và chi phí theo thời gian.' },
    ],
  },
  {
    title: 'Vận hành kho',
    items: [
      { href: '/inventory', label: 'Tồn kho', icon: PackageSearch, requires: 'farmArea', description: 'Số lượng hiện có theo kho, lô và vật tư.' },
      { href: '/receipts', label: 'Phiếu nhập', icon: ArrowDownToLine, requires: 'restock', description: 'Lập và xác nhận phiếu nhập hàng vào kho.' },
      { href: '/issues', label: 'Phiếu xuất', icon: ArrowUpFromLine, requires: 'farmArea', description: 'Xuất vật tư, lô hoặc tài sản ra khỏi kho.' },
      { href: '/transfers', label: 'Điều chuyển', icon: ArrowRightLeft, requires: 'restock', description: 'Chuyển hàng giữa các kho của trang trại.' },
      { href: '/counts', label: 'Kiểm kê', icon: ClipboardCheck, requires: 'farmArea', description: 'Đối chiếu số lượng thực tế với hệ thống.' },
    ],
  },
  {
    title: 'Tài sản & bảo trì',
    items: [
      { href: '/assets', label: 'Tài sản', icon: Package, requires: 'farmArea', description: 'Theo dõi thiết bị, người giữ và vòng đời.' },
      { href: '/maintenance', label: 'Bảo trì', icon: Wrench, requires: 'farmArea', description: 'Lịch bảo trì, chi phí và kết quả.' },
      { href: '/requests', label: 'Yêu cầu', icon: ClipboardList, requires: 'farmArea', description: 'Yêu cầu bảo trì và chuyển tài sản.' },
      { href: '/scan', label: 'Tra cứu QR', icon: ScanLine, requires: 'farmArea', description: 'Quét nhãn QR tài sản, mặt hàng hoặc tồn kho.' },
    ],
  },
  {
    title: 'Danh mục',
    items: [
      { href: '/materials', label: 'Vật tư', icon: Boxes, requires: 'masterData', description: 'Danh mục vật tư, đơn vị và mức tồn tối thiểu.' },
      { href: '/warehouses', label: 'Kho', icon: Warehouse, requires: 'masterData', description: 'Danh sách kho và vị trí lưu trữ.' },
      { href: '/catalog', label: 'Danh mục chung', icon: Tags, requires: 'masterData', description: 'Nhà cung cấp, vị trí, mẫu thiết bị/dụng cụ, nhóm hàng và đơn vị tính.' },
    ],
  },
  {
    title: 'Cửa hàng',
    items: [
      { href: '/store-products', label: 'Sản phẩm cửa hàng', icon: Store, requires: 'manageStore', description: 'Sản phẩm, quy cách, kho bán và miền phục vụ.' },
      { href: '/store-stock', label: 'Tồn bán hàng', icon: PackageCheck, requires: 'manageStore', storeOnly: true, description: 'Tồn vật lý, đang giữ và khả dụng tại kho bán.' },
      { href: '/store-orders', label: 'Đơn hàng', icon: ShoppingCart, requires: 'manageStore', storeOnly: true, description: 'Xác nhận đơn, theo dõi giao hàng và thanh toán.' },
      { href: '/deliveries', label: 'Giao hàng', icon: Truck, requires: 'deliver', storeOnly: true, description: 'Nhận đơn đã xác nhận, giao cho khách và báo giao xong.' },
      { href: '/store-warranties', label: 'Bảo hành', icon: ShieldCheck, requires: 'manageStore', storeOnly: true, description: 'Tiếp nhận bảo hành, sửa có phí và đổi hàng cho thiết bị khách đã mua.' },
      { href: '/store-payments', label: 'Thanh toán', icon: Landmark, requires: 'manageStore', storeOnly: true, description: 'Giao dịch chuyển khoản VietQR và đối soát đơn.' },
      { href: '/store-reports', label: 'Báo cáo bán hàng', icon: ChartNoAxesCombined, requires: 'manageStore', storeOnly: true, description: 'Doanh thu, sản phẩm và khách hàng.' },
    ],
  },
  {
    title: 'Tổ chức',
    items: [
      { href: '/personnel', label: 'Nhân sự', icon: Users, requires: 'manageFarm', description: 'Tài khoản nhân viên và vai trò.' },
      { href: '/history', label: 'Lịch sử thay đổi', icon: History, requires: 'history', description: 'Người thao tác và dữ liệu thay đổi trong trang trại.' },
    ],
  },
];

export type NavigationAccess = {
  canManageFarm: boolean;
  canManageWarehouse: boolean;
  canManageStore: boolean;
  canDeliver: boolean;
  canAccessFarmArea: boolean;
  canAccessRestock: boolean;
  canAccessMasterData: boolean;
  canViewHistory: boolean;
  isStoreFarm: boolean;
};

const requirementAccess = {
  manageFarm: 'canManageFarm',
  manageWarehouse: 'canManageWarehouse',
  manageStore: 'canManageStore',
  deliver: 'canDeliver',
  farmArea: 'canAccessFarmArea',
  restock: 'canAccessRestock',
  masterData: 'canAccessMasterData',
  history: 'canViewHistory',
} as const satisfies Record<NavigationRequirement, keyof NavigationAccess>;

/** Role check only; the store-farm condition is handled by StoreFarmGate on the page. */
export function isNavigationItemAllowed(item: NavigationItem, access: NavigationAccess) {
  return !item.requires || access[requirementAccess[item.requires]];
}

export function isNavigationItemVisible(item: NavigationItem, access: NavigationAccess) {
  return isNavigationItemAllowed(item, access) && (!item.storeOnly || access.isStoreFarm);
}

/** The navigation item owning a path, e.g. '/receipts/123' → the '/receipts' item. */
export function findNavigationItem(pathname: string) {
  return primaryNavigationSections
    .flatMap(({ items }) => items)
    .find(({ href }) => href !== '/dashboard' && (pathname === href || pathname.startsWith(`${href}/`)));
}

// Route labels for breadcrumbs (including hidden placeholder routes)
export const routeLabels: Record<string, string> = {
  ...Object.fromEntries(
    primaryNavigationSections.flatMap(({ items }) => items.map(({ href, label }) => [href, label])),
  ),
};

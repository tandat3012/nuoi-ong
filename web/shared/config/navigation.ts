export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export const primaryNavigation: readonly NavigationItem[] = [
  { href: '/dashboard', label: 'Tổng quan', shortLabel: 'TQ' },
  { href: '/catalog', label: 'Danh mục', shortLabel: 'DM' },
  { href: '/inventory', label: 'Tồn kho', shortLabel: 'TK' },
  { href: '/receipts', label: 'Phiếu nhập', shortLabel: 'PN' },
  { href: '/issues', label: 'Phiếu xuất', shortLabel: 'PX' },
  { href: '/assets', label: 'Tài sản', shortLabel: 'TS' },
  { href: '/maintenance', label: 'Bảo trì', shortLabel: 'BT' },
  { href: '/scan', label: 'Tra cứu QR', shortLabel: 'QR' },
];

export function notificationHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (!entityId) return null;
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case 'STOCK_RECEIPT': return `/receipts?id=${id}`;
    case 'STOCK_ISSUE': return `/issues/${id}`;
    case 'STOCK_TRANSFER': return `/transfers?id=${id}`;
    case 'STOCK_COUNT': return `/counts?id=${id}`;
    case 'MAINTENANCE_REQUEST': return `/requests?type=maintenance&id=${id}`;
    case 'ASSET_TRANSFER_REQUEST': return `/requests?type=transfer&id=${id}`;
    default: return null;
  }
}

export function notificationBadgeText(unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

export function notificationTargetsCurrentPage(pathname: string, href: string) {
  return pathname === href.split('?')[0];
}

export function notificationErrorMessage(status: number | null, message: string) {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền xem thông báo trong trang trại này.';
  if (status === 404) return 'Thông báo không tồn tại hoặc không thuộc trang trại này.';
  if (status === 409) return `Trạng thái thông báo đã thay đổi: ${message}`;
  if (status === 400) return `Dữ liệu không hợp lệ: ${message}`;
  return 'Không tải được thông báo';
}

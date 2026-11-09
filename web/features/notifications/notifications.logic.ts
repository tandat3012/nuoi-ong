const NOTIFICATION_DOCUMENT_PREFIXES: Record<string, string> = {
  STOCK_RECEIPT: 'PN',
  STOCK_ISSUE: 'PX',
  STOCK_COUNT: 'KK',
  STOCK_TRANSFER: 'CK',
  MAINTENANCE_REQUEST: 'MNT',
  ASSET_TRANSFER_REQUEST: 'ATR',
  MAINTENANCE_RETURN: 'BT',
  MAINTENANCE_RECORD: 'BT',
};

const NOTIFICATION_DOCUMENT_KINDS: Record<string, string> = {
  STOCK_RECEIPT: 'Phiếu nhập kho',
  STOCK_ISSUE: 'Phiếu xuất kho',
  STOCK_COUNT: 'Phiếu kiểm kê kho',
  STOCK_TRANSFER: 'Phiếu chuyển kho',
  MAINTENANCE_REQUEST: 'Yêu cầu bảo trì tài sản',
  ASSET_TRANSFER_REQUEST: 'Yêu cầu chuyển tài sản',
  MAINTENANCE_RETURN: 'Phiếu nhập lại bảo trì',
  MAINTENANCE_RECORD: 'Hồ sơ bảo trì',
};

export function notificationDocumentCode(notification: {
  entityType?: string | null;
  entityId?: string | null;
  data?: unknown;
}): string | null {
  const rawData =
    notification.data &&
    typeof notification.data === 'object' &&
    !Array.isArray(notification.data)
      ? (notification.data as Record<string, unknown>)
      : null;
  const entityType =
    (typeof rawData?.documentType === 'string' ? rawData.documentType : null) ??
    notification.entityType ??
    null;
  const entityId =
    (typeof rawData?.documentId === 'string' ? rawData.documentId : null) ??
    notification.entityId ??
    null;
  // The permanent code (or asset code) wins; only uncoded drafts get prefix + short id.
  const rawCode =
    typeof rawData?.documentCode === 'string' ? rawData.documentCode.trim() : '';
  if (rawCode || !entityId) return rawCode || null;
  const prefix = entityType ? NOTIFICATION_DOCUMENT_PREFIXES[entityType] : undefined;
  return prefix ? `${prefix}-${entityId.slice(0, 8)}` : `#${entityId.slice(0, 8)}`;
}

export function notificationBodyText(notification: {
  type?: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  data?: unknown;
}): string {
  const code = notificationDocumentCode(notification);
  if (!code) return notification.body;
  const rawData =
    notification.data &&
    typeof notification.data === 'object' &&
    !Array.isArray(notification.data)
      ? (notification.data as Record<string, unknown>)
      : null;
  const entityType =
    (typeof rawData?.documentType === 'string' ? rawData.documentType : null) ??
    notification.entityType ??
    null;
  const status =
    (typeof rawData?.status === 'string' ? rawData.status : null) ??
    (entityType && notification.type?.startsWith(`${entityType}_`)
      ? notification.type.slice(entityType.length + 1)
      : null);
  const rejectionReason =
    typeof rawData?.rejectionReason === 'string'
      ? rawData.rejectionReason
      : null;
  const documentKind = entityType
    ? NOTIFICATION_DOCUMENT_KINDS[entityType]
    : undefined;
  if (!documentKind) return notification.body;

  switch (status) {
    case 'PENDING_APPROVAL':
      return `${documentKind} ${code} đang chờ duyệt.`;
    case 'IN_TRANSIT':
      return `${documentKind} ${code} đã xuất, chờ kho nhận xác nhận số thực nhận.`;
    case 'DISCREPANCY':
      return `${documentKind} ${code} đã được nhận nhưng có sai lệch (hỏng/thiếu), chờ chủ trại xử lý.`;
    case 'SCHEDULED':
      return `${documentKind} ${code} đã được lên lịch, chờ chọn đơn vị và ngày hẹn trả.`;
    case 'READY_TO_SEND':
      return `${documentKind} ${code} đã có đơn vị sửa và ngày hẹn trả, chờ kho xác nhận xuất.`;
    case 'IN_PROGRESS':
      return `${documentKind} ${code} đã được kho xác nhận xuất đi sửa, chờ nhận lại thiết bị.`;
    case 'CONFIRMED':
      return `${documentKind} ${code} đã được duyệt.`;
    case 'REJECTED':
      return `${documentKind} ${code} bị từ chối${rejectionReason ? `: ${rejectionReason}` : '.'}`;
    default:
      return notification.body;
  }
}

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
    case 'MAINTENANCE_RETURN':
    case 'MAINTENANCE_RECORD': return `/maintenance?id=${id}`;
    case 'MAINTENANCE_ASSET': return `/assets/${id}`;
    case 'MAINTENANCE_REQUEST': return `/requests?type=maintenance&id=${id}`;
    case 'ASSET_TRANSFER_REQUEST': return `/requests?type=transfer&id=${id}`;
    case 'ASSET': return `/assets/${id}`;
    case 'PERSONNEL': return `/personnel/${id}`;
    case 'STORE_ORDER': return `/store-orders/${id}`;
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

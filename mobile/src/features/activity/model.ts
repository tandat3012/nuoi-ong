import type { AuditLog } from './api';
import { formatQuantity } from '@/src/shared/format-quantity';

export const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới', UPDATE: 'Cập nhật', SUBMIT: 'Gửi duyệt',
  CONFIRM: 'Xác nhận', REJECT: 'Từ chối', CANCEL: 'Hủy', DELETE: 'Xóa', RETURN: 'Trả kho',
};
export const entityLabels: Record<string, string> = {
  STOCK_RECEIPT: 'Phiếu nhập kho', STOCK_ISSUE: 'Phiếu xuất kho', STOCK_COUNT: 'Phiếu kiểm kê',
  STOCK_TRANSFER: 'Phiếu điều chuyển', INVENTORY: 'Tồn kho', ITEM: 'Vật tư', ASSET: 'Tài sản',
  MAINTENANCE: 'Bảo trì',
};
const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp', COUNTING: 'Đang kiểm kê', PENDING_APPROVAL: 'Chờ duyệt', CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy', ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng hoạt động',
  SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành',
  AVAILABLE: 'Sẵn sàng', IN_USE: 'Đang sử dụng', UNDER_MAINTENANCE: 'Đang bảo trì',
};
const fieldLabels: Record<string, string> = {
  id: 'ID', farmId: 'Trang trại', userId: 'Người dùng', status: 'Trạng thái', note: 'Ghi chú',
  reason: 'Lý do', rejectionReason: 'Lý do từ chối', rejectedAt: 'Thời gian từ chối',
  rejectedByMemberId: 'Thành viên từ chối', confirmedAt: 'Thời gian xác nhận',
  confirmedByMemberId: 'Thành viên xác nhận', createdByMemberId: 'Thành viên tạo',
  createdAt: 'Ngày tạo', updatedAt: 'Ngày cập nhật', submittedAt: 'Ngày gửi duyệt',
  code: 'Mã', name: 'Tên', receiptCode: 'Mã phiếu nhập', issueCode: 'Mã phiếu xuất',
  transferCode: 'Mã phiếu điều chuyển', countCode: 'Mã phiếu kiểm kê', assetCode: 'Mã tài sản',
  warehouseId: 'Kho', sourceWarehouseId: 'Kho nguồn', destinationWarehouseId: 'Kho đích',
  fromWarehouseId: 'Kho nguồn', toWarehouseId: 'Kho đích', itemCode: 'Mã vật tư', itemName: 'Tên vật tư',
  itemId: 'Vật tư', lotId: 'Lô', assetId: 'Tài sản', locationId: 'Vị trí',
  quantity: 'Số lượng', actualQuantity: 'Số lượng thực tế', systemQuantity: 'Số lượng hệ thống',
  quantityOnHand: 'Tồn kho', difference: 'Chênh lệch', unitPrice: 'Đơn giá', totalAmount: 'Thành tiền',
  receiptDate: 'Ngày nhập', issueDate: 'Ngày xuất', countDate: 'Ngày kiểm kê', transferDate: 'Ngày chuyển',
  description: 'Mô tả', items: 'Danh sách vật tư', receipt: 'Phiếu nhập', issue: 'Phiếu xuất',
  transfer: 'Phiếu điều chuyển', count: 'Phiếu kiểm kê', asset: 'Tài sản', item: 'Vật tư',
  scheduledAt: 'Lịch bảo trì', startedAt: 'Bắt đầu', completedAt: 'Hoàn thành', resultNote: 'Kết quả',
  maintenanceType: 'Loại bảo trì', trackingMode: 'Cách theo dõi', itemType: 'Loại vật tư',
  lotNumber: 'Mã lô', qrToken: 'Token QR', expiryDate: 'Hạn sử dụng', manufactureDate: 'Ngày sản xuất',
  supplierId: 'Nhà cung cấp', unitId: 'Đơn vị', categoryId: 'Danh mục',
};

export function normalizeEntity(value: string) {
  return value.toUpperCase() === 'MAINTENANCE_RECORD' ? 'MAINTENANCE' : value.toUpperCase();
}
export function actionLabel(value: string) {
  return actionLabels[value.toUpperCase() === 'INSERT' ? 'CREATE' : value.toUpperCase()] ?? value;
}
export function entityLabel(value: string) { return entityLabels[normalizeEntity(value)] ?? value; }
export function statusLabel(value: string | null) { return value ? statusLabels[value] ?? value : 'Đã ghi nhận'; }
export function statusTone(value: string | null): 'success' | 'amber' | 'danger' | 'cream' {
  if (value === 'CONFIRMED' || value === 'COMPLETED') return 'success';
  if (value === 'REJECTED' || value === 'CANCELLED') return 'danger';
  if (value === 'PENDING_APPROVAL' || value === 'DRAFT' || value === 'COUNTING') return 'amber';
  return 'cream';
}
export function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}
function canonicalKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
export function snapshotField(snapshot: unknown, key: string): unknown {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  const direct = Object.entries(snapshot).find(([name]) => canonicalKey(name) === key);
  if (direct) return direct[1];
  for (const wrapper of ['receipt', 'issue', 'count', 'transfer', 'asset', 'item', 'record', 'balance']) {
    const value = snapshotField((snapshot as Record<string, unknown>)[wrapper], key);
    if (value !== undefined) return value;
  }
  return undefined;
}
export function getStatus(snapshot: unknown) {
  const status = snapshotField(snapshot, 'status');
  return typeof status === 'string' ? status : null;
}
export function recordLabel(log: AuditLog) {
  for (const key of ['receiptCode', 'issueCode', 'transferCode', 'countCode', 'assetCode', 'code', 'name']) {
    const value = snapshotField(log.newData, key) ?? snapshotField(log.oldData, key);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return log.entityId ? formatIdentifier(log.entityId) : 'Chưa có mã đối tượng';
}

export function formatIdentifier(value: string) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export type SnapshotEntry = { path: string; label: string; value: unknown };
export function snapshotEntries(snapshot: unknown): SnapshotEntry[] {
  if (snapshot === null || snapshot === undefined) return [];
  if (typeof snapshot === 'object' && Object.keys(snapshot).length === 0) return [];
  const entries: SnapshotEntry[] = [];
  function visit(value: unknown, path: string, label: string) {
    if (value && typeof value === 'object' && Object.keys(value).length) {
      Object.entries(value).forEach(([key, child]) => {
        const normalized = canonicalKey(key);
        const array = Array.isArray(value);
        const rowId = array ? snapshotField(child, 'id') : undefined;
        // Line IDs keep a reordered list from appearing as edits to another product.
        const pathKey = typeof rowId === 'string' ? `@${rowId}` : normalized;
        const itemName = array ? snapshotField(child, 'itemName') : undefined;
        const segment = array ? typeof itemName === 'string' ? itemName : `Mục ${Number(key) + 1}` : fieldLabels[normalized] ?? key;
        visit(child, path ? `${path}.${pathKey}` : pathKey, label ? `${label} / ${segment}` : segment);
      });
    } else entries.push({ path: path || 'value', label: label || 'Giá trị', value });
  }
  visit(snapshot, '', '');
  return entries;
}
export function snapshotChanges(before: unknown, after: unknown) {
  // A missing snapshot is unknown history, not evidence of an added/deleted field.
  if (before == null || after == null) return null;
  const oldEntries = new Map(snapshotEntries(before).map((entry) => [entry.path, entry]));
  const newEntries = new Map(snapshotEntries(after).map((entry) => [entry.path, entry]));
  return [...new Set([...oldEntries.keys(), ...newEntries.keys()])].flatMap((path) => {
    const oldEntry = oldEntries.get(path);
    const newEntry = newEntries.get(path);
    if (oldEntry && newEntry && JSON.stringify(oldEntry.value) === JSON.stringify(newEntry.value)) return [];
    return [{ path, label: newEntry?.label ?? oldEntry!.label, before: oldEntry?.value, after: newEntry?.value }];
  });
}
export function formatValue(value: unknown, path: string, farm?: { id: string; name: string }) {
  if (value === undefined) return 'Không có trường này';
  if (value === null) return 'Chưa có giá trị';
  const field = path.split('.').at(-1);
  if (field === 'farmId' && value === farm?.id) return farm.name;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string') {
    if (value === '') return '(Trống)';
    if (field === 'id') return formatIdentifier(value);
    if (field === 'status') return statusLabel(value);
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return formatDateTime(value);
    if (['quantity', 'actualQuantity', 'systemQuantity', 'quantityOnHand', 'difference'].includes(field ?? '') && Number.isFinite(Number(value))) return formatQuantity(value);
    return value;
  }
  if (typeof value === 'number' && ['quantity', 'actualQuantity', 'systemQuantity', 'quantityOnHand', 'difference'].includes(field ?? '')) return formatQuantity(value);
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

export function relatedRecordRoute(log: AuditLog) {
  if (!log.entityId || log.action.toUpperCase() === 'DELETE') return null;
  const id = encodeURIComponent(log.entityId);
  switch (normalizeEntity(log.entityType)) {
    case 'STOCK_RECEIPT': return `/receipts/${id}?type=receipt`;
    case 'STOCK_ISSUE': return `/receipts/${id}?type=issue`;
    case 'STOCK_COUNT': return `/counts/${id}`;
    case 'ITEM': case 'ASSET': case 'STOCK_TRANSFER': case 'MAINTENANCE': case 'MAINTENANCE_RECORD':
      return `/activity/record?type=${normalizeEntity(log.entityType)}&id=${id}`;
    case 'INVENTORY': {
      const itemId = snapshotField(log.newData, 'itemId') ?? snapshotField(log.oldData, 'itemId');
      const warehouseId = snapshotField(log.newData, 'warehouseId') ?? snapshotField(log.oldData, 'warehouseId');
      const lotId = snapshotField(log.newData, 'lotId') ?? snapshotField(log.oldData, 'lotId');
      return typeof itemId === 'string' ? `/inventory-detail?itemId=${encodeURIComponent(itemId)}${typeof warehouseId === 'string' ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ''}${typeof lotId === 'string' ? `&lotId=${encodeURIComponent(lotId)}` : ''}` : null;
    }
    default: return null;
  }
}

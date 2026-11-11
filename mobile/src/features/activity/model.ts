import type { AuditLog } from './api';
import { formatQuantity } from '@/src/shared/format-quantity';
import { formatApiDateTime } from '@/src/shared/format-date-time';

export const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới', UPDATE: 'Cập nhật', SUBMIT: 'Gửi duyệt',
  CONFIRM: 'Xác nhận', REJECT: 'Từ chối', CANCEL: 'Hủy', DELETE: 'Xóa', RETURN: 'Trả kho', DISPATCH: 'Xuất hàng đi', RECEIVE: 'Nhận hàng',
  RESOLVE: 'Xử lý sai lệch', ACKNOWLEDGE: 'Xác nhận đã nhận',
  WAREHOUSE_CREATED: 'Tạo kho', WAREHOUSE_UPDATED: 'Sửa thông tin kho', WAREHOUSE_DEACTIVATED: 'Ngừng hoạt động kho',
  ITEM_CREATED: 'Tạo vật tư', ITEM_UPDATED: 'Cập nhật vật tư',
  ASSET_CREATED: 'Tạo tài sản', ASSET_METADATA_UPDATED: 'Cập nhật thông tin tài sản', ASSET_ASSIGNED: 'Cấp phát tài sản', ASSET_REASSIGNED: 'Đổi người nhận tài sản',
  ASSET_USE_STARTED: 'Bắt đầu sử dụng tài sản', ASSET_RETURNED: 'Nhận lại tài sản', ASSET_TRANSFERRED: 'Điều chuyển tài sản',
  ASSET_TRANSFER_DISPATCHED: 'Kho nguồn xuất tài sản', ASSET_TRANSFER_RECEIVED: 'Kho đích nhận tài sản', ASSET_COUNTED: 'Kiểm kê tài sản',
  ASSET_RETIRED: 'Ngừng sử dụng tài sản', ASSET_INCIDENT_REPORTED: 'Báo sự cố tài sản', ASSET_INCIDENT_STATUS: 'Cập nhật sự cố', ASSET_RECOVERED: 'Tìm lại tài sản',
  ASSET_MAINTENANCE_SCHEDULED: 'Lên lịch bảo trì', ASSET_MAINTENANCE_STARTED: 'Bắt đầu bảo trì', ASSET_MAINTENANCE_RECEIVED: 'Nhận thiết bị bảo trì',
  ASSET_MAINTENANCE_COMPLETED: 'Hoàn tất bảo trì', ASSET_MAINTENANCE_RETURN_APPROVED: 'Duyệt trả bảo trì', ASSET_MAINTENANCE_RETURN_REJECTED: 'Từ chối trả bảo trì',
  ASSET_MAINTENANCE_FINAL_DECISION: 'Quyết định sau bảo trì', ASSET_MAINTENANCE_CANCELLED: 'Hủy bảo trì',
  DELIVERY_CLAIM: 'Nhận giao đơn', DELIVERY_RETURN: 'Trả đơn giao', DELIVERY_COMPLETE: 'Giao xong đơn', SHIPPING_FEES_UPDATED: 'Sửa phí giao hàng',
  PAYMENT_RECONCILE: 'Đối soát thanh toán', COD_REMIT: 'Nhận tiền COD', REFUND: 'Hoàn tiền đơn',
  RETURN_TO_WAREHOUSE: 'Trả hàng về kho', RETURN_RECEIVED: 'Kho nhận hàng trả', RETURN_REJECTED: 'Kho từ chối hàng trả', PAY: 'Ghi nhận thanh toán',
  PERSONNEL_ADDED: 'Thêm nhân sự', PERSONNEL_PROFILE_CHANGED: 'Cập nhật hồ sơ', PERSONNEL_ROLES_CHANGED: 'Thay đổi quyền',
  PERSONNEL_WORKPLACES_CHANGED: 'Thay đổi nơi làm việc', PERSONNEL_STATUS_CHANGED: 'Đổi trạng thái nhân sự',
};

export const entityLabels: Record<string, string> = {
  STOCK_RECEIPT: 'Phiếu nhập kho', STOCK_ISSUE: 'Phiếu xuất kho', STOCK_COUNT: 'Phiếu kiểm kê',
  STOCK_TRANSFER: 'Phiếu điều chuyển', INVENTORY: 'Tồn kho', ITEM: 'Vật tư', ASSET: 'Tài sản',
  MAINTENANCE: 'Bảo trì', MAINTENANCE_REQUEST: 'Yêu cầu bảo trì', ASSET_TRANSFER_REQUEST: 'Yêu cầu chuyển tài sản',
  PERSONNEL: 'Nhân sự', WAREHOUSE: 'Kho', PAYMENT_TRANSACTION: 'Giao dịch thanh toán',
  STORE_ORDER: 'Đơn hàng', STORE_SHIPPING_FEES: 'Phí giao hàng', STORE_WARRANTY: 'Yêu cầu bảo hành',
  STORE_PRODUCT: 'Sản phẩm cửa hàng', STORE_CATEGORY: 'Danh mục cửa hàng', STORE_SETTINGS: 'Cấu hình bán hàng',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Nháp', COUNTING: 'Đang kiểm kê', PENDING_APPROVAL: 'Chờ duyệt', IN_TRANSIT: 'Đang chuyển', DISCREPANCY: 'Chờ xử lý sai lệch',
  CONFIRMED: 'Đã xác nhận', REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy', ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng hoạt động',
  SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', RECEIVED: 'Đã tiếp nhận', FAILED: 'Không đạt',
  AVAILABLE: 'Sẵn sàng', ASSIGNED: 'Đã cấp phát', IN_USE: 'Đang sử dụng', MAINTENANCE: 'Đang bảo trì', UNDER_MAINTENANCE: 'Đang bảo trì',
  TRANSFER_PENDING: 'Chờ / đang chuyển', LOST: 'Thất lạc', RETIRED: 'Ngừng sử dụng', DAMAGED: 'Hư hỏng', RETURNED: 'Đã trả',
  OPEN: 'Mới báo', RESOLVED: 'Đã giải quyết', PENDING: 'Chờ xử lý', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao',
  PAID: 'Đã thanh toán', UNPAID: 'Chưa thanh toán', PUBLISHED: 'Đang hiển thị', ARCHIVED: 'Đã lưu trữ', CLOSED: 'Đã đóng', GOOD: 'Nguyên vẹn',
};

const fieldLabels: Record<string, string> = {
  id: 'ID', farmId: 'Trang trại', userId: 'Người dùng', status: 'Trạng thái', returnStatus: 'Trạng thái trả sau bảo trì',
  latestMaintenanceStatus: 'Trạng thái bảo trì gần nhất', latestMaintenanceReturnStatus: 'Trạng thái trả bảo trì gần nhất',
  note: 'Ghi chú', reason: 'Lý do', rejectionReason: 'Lý do từ chối', returnRejectionReason: 'Lý do từ chối trả',
  rejectedAt: 'Thời gian từ chối', rejectedByMemberId: 'Người từ chối', confirmedAt: 'Thời gian xác nhận',
  confirmedByMemberId: 'Người xác nhận', createdByMemberId: 'Người tạo', requestedByMemberId: 'Người yêu cầu',
  assignedToMemberId: 'Người được cấp phát', recipientMemberId: 'Người nhận', receivedRecordedByMemberId: 'Người ghi nhận nhận',
  dispatchedAt: 'Thời gian xuất chuyển', dispatchedByMemberId: 'Người xuất chuyển', receivedAt: 'Thời gian nhận',
  receiptNote: 'Ghi chú xác nhận nhận', resolution: 'Hướng xử lý sai lệch', resolutionNote: 'Ghi chú xử lý',
  receivedCondition: 'Tình trạng thực nhận', receiveNote: 'Ghi chú khi nhận', condition: 'Tình trạng', assetCondition: 'Tình trạng tài sản',
  createdAt: 'Ngày tạo', updatedAt: 'Ngày cập nhật', submittedAt: 'Ngày gửi duyệt', cancelledAt: 'Thời gian hủy', paidAt: 'Thời gian thanh toán',
  code: 'Mã', name: 'Tên', receiptCode: 'Mã phiếu nhập', issueCode: 'Mã phiếu xuất',
  transferCode: 'Mã phiếu điều chuyển', countCode: 'Mã phiếu kiểm kê', assetCode: 'Mã tài sản',
  externalReference: 'Số chứng từ giấy', requestedCode: 'Mã phiếu yêu cầu', requestedCodeReason: 'Lý do yêu cầu mã', codeSource: 'Nguồn cấp mã',
  warehouseId: 'Kho', sourceWarehouseId: 'Kho nguồn', destinationWarehouseId: 'Kho đích',
  fromLocationId: 'Vị trí nguồn', toLocationId: 'Vị trí đích', currentLocationId: 'Vị trí hiện tại',
  fromWarehouseId: 'Kho nguồn', toWarehouseId: 'Kho đích', locationWarehouseId: 'Kho quản lý', warehouseIds: 'Kho phụ trách',
  itemCode: 'Mã vật tư', itemName: 'Tên vật tư', itemId: 'Vật tư', lotId: 'Lô', assetId: 'Tài sản', locationId: 'Vị trí',
  issueType: 'Loại phiếu xuất', maintenanceRecordId: 'Hồ sơ bảo trì', referenceId: 'Đối tượng liên quan',
  assignmentId: 'Lượt cấp phát', transferId: 'Yêu cầu điều chuyển', stockCountId: 'Phiếu kiểm kê',
  quantity: 'Số lượng', actualQuantity: 'Số lượng thực tế', systemQuantity: 'Số lượng hệ thống',
  receivedQuantity: 'Số lượng thực nhận', rejectedQuantity: 'Số lượng từ chối', returnedQuantity: 'Số lượng đã trả',
  discrepancyReason: 'Lý do lệch', quantityOnHand: 'Tồn kho', difference: 'Chênh lệch', unitPrice: 'Đơn giá', totalAmount: 'Thành tiền',
  laborCost: 'Chi phí nhân công', materialCost: 'Chi phí vật tư', otherCost: 'Chi phí khác', totalCost: 'Tổng chi phí',
  minStockLevel: 'Mức tồn tối thiểu', barcode: 'Mã vạch', serialNumber: 'Số sê-ri',
  receiptDate: 'Ngày nhập', issueDate: 'Ngày xuất', countDate: 'Ngày kiểm kê', transferDate: 'Ngày chuyển',
  purchaseDate: 'Ngày mua', purchasePrice: 'Giá mua', warrantyExpiryDate: 'Hết hạn bảo hành',
  lastMaintenanceDate: 'Bảo trì gần nhất', nextMaintenanceDate: 'Bảo trì tiếp theo',
  expectedReturnAt: 'Dự kiến hoàn thành', nextDueDate: 'Hạn bảo trì tiếp theo', intervalMonths: 'Chu kỳ bảo trì (tháng)',
  maintenanceIntervalDays: 'Chu kỳ bảo trì (ngày)', warrantyMonths: 'Thời hạn bảo hành (tháng)',
  receivedByMemberId: 'Người tiếp nhận thiết bị', receivedByName: 'Người tiếp nhận thiết bị',
  inspectedByMemberId: 'Người nghiệm thu', inspectedByName: 'Người nghiệm thu',
  performedByMemberId: 'Người thực hiện bảo trì', performedByName: 'Người thực hiện bảo trì',
  performedByStaff: 'Nhân viên bảo trì nội bộ', supplierName: 'Nhà cung cấp',
  returnWarehouseId: 'Kho nhận lại sau bảo trì', returnWarehouseName: 'Kho nhận lại sau bảo trì',
  returnLocationId: 'Vị trí nhận lại sau bảo trì', returnLocationName: 'Vị trí nhận lại sau bảo trì',
  returnCreatedByMemberId: 'Người tạo phiếu trả bảo trì', returnReviewedByMemberId: 'Người duyệt trả bảo trì',
  returnReviewedAt: 'Thời gian duyệt trả bảo trì', finalDecision: 'Quyết định sau bảo trì',
  finalDecisionNote: 'Ghi chú quyết định cuối', finalDecidedByMemberId: 'Người quyết định sau bảo trì',
  finalDecidedAt: 'Thời gian quyết định sau bảo trì', incidentId: 'Sự cố liên quan',
  sourceIssueId: 'Phiếu xuất gốc', resolvedByMemberId: 'Người xử lý sai lệch', resolvedAt: 'Thời gian xử lý sai lệch',
  assetWarehouseName: 'Kho hiện tại của tài sản', assetLocationName: 'Vị trí hiện tại của tài sản',
  categoryName: 'Danh mục', unitName: 'Đơn vị tính', unitSymbol: 'Ký hiệu đơn vị',
  locationCode: 'Mã vị trí', locationName: 'Tên vị trí', materialKind: 'Nhóm vật tư',
  description: 'Mô tả', summary: 'Tóm tắt', items: 'Danh sách vật tư', receipt: 'Phiếu nhập', issue: 'Phiếu xuất',
  transfer: 'Phiếu điều chuyển', count: 'Phiếu kiểm kê', asset: 'Tài sản', item: 'Vật tư',
  scheduledAt: 'Lịch bảo trì', startedAt: 'Bắt đầu', issuedByMemberId: 'Người xác nhận xuất', issuedByName: 'Người xác nhận xuất',
  completedAt: 'Hoàn thành', resultNote: 'Kết quả', maintenanceType: 'Loại bảo trì', trackingMode: 'Cách theo dõi', itemType: 'Loại vật tư',
  imageUrl: 'Ảnh minh họa', sourceUrl: 'Liên kết nguồn', surveyedAt: 'Ngày khảo sát',
  lotCode: 'Mã lô nội bộ', supplierLotNumber: 'Số lô trên hàng', lotSupplierLotNumber: 'Số lô trên hàng',
  legacyLotNumber: 'Số lô cũ (tham khảo)', lotNumber: 'Số lô cũ (tham khảo)', lotExpiryDate: 'Hạn sử dụng lô',
  qrToken: 'Mã QR', expiryDate: 'Hạn sử dụng', manufactureDate: 'Ngày sản xuất',
  supplierId: 'Nhà cung cấp', unitId: 'Đơn vị tính', categoryId: 'Danh mục',
  employeeCode: 'Mã nhân viên', fullName: 'Họ và tên', email: 'Email', jobTitle: 'Chức danh',
  membershipStatus: 'Trạng thái thành viên', roleCodes: 'Vai trò / Quyền',
  provider: 'Cổng thanh toán', providerTxId: 'Mã giao dịch', result: 'Kết quả đối soát', amount: 'Số tiền',
  orderId: 'Đơn hàng', warrantyRequestId: 'Yêu cầu bảo hành',
  NORTH: 'Phí miền Bắc', CENTRAL: 'Phí miền Trung', SOUTH: 'Phí miền Nam', collectedCod: 'Đã thu COD',
  shipperMemberId: 'Nhân viên giao hàng', paidByMemberId: 'Người thu tiền', paymentStatus: 'Trạng thái thanh toán',
  paymentMethod: 'Phương thức thanh toán', shippingFee: 'Phí giao hàng', subtotal: 'Tạm tính', total: 'Tổng cộng',
  recipientName: 'Người nhận', phone: 'Số điện thoại', address: 'Địa chỉ', region: 'Miền', shippedAt: 'Thời gian nhận giao',
};

const fieldValueLabels: Record<string, Record<string, string>> = {
  issueType: {
    CONSUMPTION: 'Xuất sử dụng',
    DAMAGE: 'Hư hỏng',
    DISPOSAL: 'Thanh lý / loại bỏ',
    OTHER: 'Khác',
    MAINTENANCE: 'Bảo trì',
    SALE: 'Bán hàng',
  },
  maintenanceType: {
    PREVENTIVE: 'Bảo trì phòng ngừa',
    CORRECTIVE: 'Sửa chữa / khắc phục',
    INSPECTION: 'Kiểm tra tài sản',
  },
  trackingMode: {
    QUANTITY: 'Theo số lượng',
    LOT: 'Theo lô',
    ASSET: 'Theo từng tài sản',
  },
  itemType: {
    EQUIPMENT: 'Thiết bị',
    TOOL: 'Dụng cụ',
    MATERIAL: 'Vật tư',
    PRODUCT: 'Sản phẩm / Thành phẩm',
  },
  materialKind: {
    FEED: 'Thức ăn cho ong',
    TREATMENT: 'Thuốc & phòng trị bệnh',
    PACKAGING: 'Bao bì & nhãn',
    MAINTENANCE_SUPPLY: 'Vật tư bảo trì',
    CONSUMABLE: 'Vật tư tiêu hao',
    OTHER: 'Khác',
  },
  discrepancyReason: {
    STOCK_COUNT: 'Kiểm kê kho',
    SHRINKAGE: 'Hao hụt',
    DAMAGE: 'Hư hỏng',
    EXPIRED: 'Hết hạn',
    DATA_ENTRY_ERROR: 'Sai sót nhập liệu',
    OTHER: 'Khác',
  },
  finalDecision: {
    REUSE: 'Tiếp tục sử dụng',
    RETIRE: 'Ngừng sử dụng',
    RETURN: 'Trả lại kho',
  },
  codeSource: {
    AUTO: 'Hệ thống tự cấp',
    MANUAL: 'Nhập thủ công',
  },
  resolution: {
    RETURN_TO_SOURCE: 'Trả phần thiếu về kho nguồn',
    WRITE_OFF: 'Ghi nhận hao hụt',
  },
  condition: {
    GOOD: 'Nguyên vẹn',
    DAMAGED: 'Hư hỏng',
  },
  assetCondition: {
    GOOD: 'Nguyên vẹn',
    DAMAGED: 'Hư hỏng',
  },
  receivedCondition: {
    GOOD: 'Nguyên vẹn',
    DAMAGED: 'Hư hỏng',
  },
  roleCodes: {
    ADMIN: 'Quản trị viên',
    FARM_OWNER: 'Chủ trại',
    MAINTENANCE_STAFF: 'Nhân viên bảo trì',
    WAREHOUSE_MANAGER: 'Quản lý kho',
    STORE_MANAGER: 'Quản lý cửa hàng',
    DELIVERY_STAFF: 'Nhân viên giao hàng',
    EMPLOYEE: 'Nhân viên',
    GUEST: 'Khách',
  },
  paymentMethod: {
    COD: 'Thanh toán khi nhận hàng (COD)',
    BANK_TRANSFER: 'Chuyển khoản ngân hàng',
    CASH: 'Tiền mặt',
  },
  paymentStatus: {
    PAID: 'Đã thanh toán',
    UNPAID: 'Chưa thanh toán',
  },
  membershipStatus: {
    ACTIVE: 'Đang hoạt động',
    INACTIVE: 'Ngừng hoạt động',
  },
  region: {
    NORTH: 'Miền Bắc',
    CENTRAL: 'Miền Trung',
    SOUTH: 'Miền Nam',
  },
  result: {
    MATCHED: 'Khớp đơn hàng',
    AMOUNT_MISMATCH: 'Lệch số tiền',
    ORDER_NOT_FOUND: 'Không tìm thấy đơn',
    ORDER_NOT_PAYABLE: 'Đơn chưa sẵn sàng thanh toán',
    ALREADY_PAID: 'Đơn đã thanh toán trước đó',
  },
  provider: {
    SEPAY: 'SePay',
    SIMULATOR: 'Giả lập',
    MANUAL: 'Đối soát thủ công',
  },
};

const UUID_EXACT = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const UUID_INLINE = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi;
const QUANTITY_FIELDS = new Set([
  'quantity', 'actualQuantity', 'systemQuantity', 'quantityOnHand', 'difference',
  'receivedQuantity', 'rejectedQuantity', 'returnedQuantity', 'minStockLevel',
]);
const MONEY_FIELDS = new Set([
  'unitPrice', 'totalAmount', 'shippingFee', 'subtotal', 'total',
  'amount', 'collectedCod', 'purchasePrice', 'fee', 'laborCost', 'materialCost', 'otherCost', 'totalCost',
  'NORTH', 'CENTRAL', 'SOUTH',
]);
const STATUS_FIELDS = new Set([
  'status', 'returnStatus', 'membershipStatus', 'paymentStatus',
  'latestMaintenanceStatus', 'latestMaintenanceReturnStatus',
]);
const DOCUMENT_WRAPPERS = ['receipt', 'issue', 'count', 'transfer', 'asset', 'item', 'record', 'balance'] as const;
const HIDDEN_SNAPSHOT_FIELDS = new Set([
  'id', 'farmId', 'stockReceiptId', 'stockIssueId', 'stockTransferId', 'stockCountId',
  'sourceReceiptItemId', 'sourceIssueItemId', 'qrToken', 'maintenanceRetryEligible',
]);

export type FormatContext =
  | { id: string; name: string }
  | {
      farm?: { id: string; name: string };
      references?: Record<string, string>;
      entityType?: string;
    };

function isFarmRef(context: FormatContext): context is { id: string; name: string } {
  return 'id' in context && 'name' in context && typeof context.id === 'string' && typeof context.name === 'string';
}

function unpackContext(context?: FormatContext): {
  farm?: { id: string; name: string };
  references?: Record<string, string>;
  entityType?: string;
} {
  if (!context) return { farm: undefined, references: undefined, entityType: undefined };
  if (isFarmRef(context)) {
    return { farm: context, references: undefined, entityType: undefined };
  }
  return {
    farm: context.farm,
    references: context.references,
    entityType: context.entityType,
  };
}

export function normalizeEntity(value: string) {
  return value.toUpperCase() === 'MAINTENANCE_RECORD' ? 'MAINTENANCE' : value.toUpperCase();
}
export function actionLabel(value: string) {
  return actionLabels[value.toUpperCase() === 'INSERT' ? 'CREATE' : value.toUpperCase()] ?? value;
}
export function entityLabel(value: string) { return entityLabels[normalizeEntity(value)] ?? value; }
export function statusLabel(value: string | null) { return value ? statusLabels[value] ?? value : 'Đã ghi nhận'; }
export function statusTone(value: string | null): 'success' | 'amber' | 'danger' | 'cream' {
  if (
    value === 'CONFIRMED' || value === 'COMPLETED' || value === 'AVAILABLE' ||
    value === 'ACTIVE' || value === 'PUBLISHED' || value === 'GOOD' || value === 'PAID'
  ) return 'success';
  if (
    value === 'REJECTED' || value === 'CANCELLED' || value === 'LOST' ||
    value === 'DAMAGED' || value === 'FAILED' || value === 'DISCREPANCY' ||
    value === 'INACTIVE' || value === 'RETIRED'
  ) return 'danger';
  if (
    value === 'PENDING_APPROVAL' || value === 'IN_TRANSIT' || value === 'DRAFT' ||
    value === 'COUNTING' || value === 'SCHEDULED' || value === 'IN_PROGRESS' ||
    value === 'ASSIGNED' || value === 'MAINTENANCE' || value === 'UNDER_MAINTENANCE' ||
    value === 'TRANSFER_PENDING' || value === 'PENDING' || value === 'PREPARING' ||
    value === 'SHIPPING' || value === 'OPEN' || value === 'UNPAID'
  ) return 'amber';
  return 'cream';
}
export function formatDateTime(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  return formatApiDateTime(value, value);
}
function canonicalKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
export function snapshotField(snapshot: unknown, key: string): unknown {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  const direct = Object.entries(snapshot).find(([name]) => canonicalKey(name) === key);
  if (direct) return direct[1];
  for (const wrapper of DOCUMENT_WRAPPERS) {
    const value = snapshotField((snapshot as Record<string, unknown>)[wrapper], key);
    if (value !== undefined) return value;
  }
  return undefined;
}
export function getStatus(snapshot: unknown) {
  const status = snapshotField(snapshot, 'status');
  return typeof status === 'string' ? status : null;
}

export function synthesizeReferences(...payloads: unknown[]): Record<string, string> {
  const refs: Record<string, string> = {};
  const setLabel = (id: unknown, code: unknown, name: unknown, prefix = '') => {
    if (typeof id !== 'string' || !UUID_EXACT.test(id) || refs[id]) return;
    const c = typeof code === 'string' && code.trim() ? code.trim() : '';
    const n = typeof name === 'string' && name.trim() ? name.trim() : '';
    const combined = c && n ? `${c} — ${n}` : c || n;
    if (combined) refs[id] = `${prefix}${combined}`;
  };
  const inspectObject = (obj: Record<string, unknown>) => {
    setLabel(obj.id, obj.code ?? obj.assetCode ?? obj.lotCode ?? obj.employeeCode, obj.name ?? obj.fullName);
    setLabel(obj.itemId ?? obj.item_id, obj.itemCode ?? obj.item_code, obj.itemName ?? obj.item_name);
    setLabel(obj.lotId ?? obj.lot_id, obj.lotCode ?? obj.lot_code, undefined);
    setLabel(obj.assetId ?? obj.asset_id, obj.assetCode ?? obj.asset_code, undefined);
    setLabel(obj.warehouseId ?? obj.warehouse_id, obj.warehouseCode ?? obj.warehouse_code, obj.warehouseName ?? obj.warehouse_name);
    setLabel(obj.fromWarehouseId ?? obj.from_warehouse_id, obj.fromWarehouseCode ?? obj.from_warehouse_code, obj.fromWarehouseName ?? obj.from_warehouse_name);
    setLabel(obj.toWarehouseId ?? obj.to_warehouse_id, obj.toWarehouseCode ?? obj.to_warehouse_code, obj.toWarehouseName ?? obj.to_warehouse_name);
    setLabel(obj.returnWarehouseId ?? obj.return_warehouse_id, undefined, obj.returnWarehouseName ?? obj.return_warehouse_name);
    setLabel(obj.locationId ?? obj.currentLocationId ?? obj.current_location_id, obj.locationCode ?? obj.location_code, obj.locationName ?? obj.location_name);
    setLabel(obj.returnLocationId ?? obj.return_location_id, undefined, obj.returnLocationName ?? obj.return_location_name);
    setLabel(obj.supplierId ?? obj.supplier_id, obj.supplierCode ?? obj.supplier_code, obj.supplierName ?? obj.supplier_name);
    setLabel(obj.categoryId ?? obj.category_id, obj.categoryCode ?? obj.category_code, obj.categoryName ?? obj.category_name);
    const unitName = typeof (obj.unitName ?? obj.unit_name) === 'string' ? String(obj.unitName ?? obj.unit_name).trim() : '';
    const unitSymbol = typeof (obj.unitSymbol ?? obj.unit_symbol) === 'string' ? String(obj.unitSymbol ?? obj.unit_symbol).trim() : '';
    if (unitName) {
      setLabel(obj.unitId ?? obj.unit_id, undefined, unitSymbol ? `${unitName} (${unitSymbol})` : unitName);
    }
    setLabel(obj.recipientMemberId ?? obj.recipient_member_id, undefined, obj.recipientName ?? obj.recipient_name);
    setLabel(obj.performedByMemberId ?? obj.performed_by_member_id, undefined, obj.performedByName ?? obj.performed_by_name);
    setLabel(obj.receivedByMemberId ?? obj.received_by_member_id, undefined, obj.receivedByName ?? obj.received_by_name);
    setLabel(obj.inspectedByMemberId ?? obj.inspected_by_member_id, undefined, obj.inspectedByName ?? obj.inspected_by_name);
    setLabel(obj.issuedByMemberId ?? obj.issued_by_member_id, undefined, obj.issuedByName ?? obj.issued_by_name);
  };
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const obj = value as Record<string, unknown>;
    const unwrapped = unwrapSnapshotObject(obj);
    if (unwrapped) inspectObject(unwrapped);
    inspectObject(obj);
    Object.values(obj).forEach(visit);
  };
  payloads.forEach(visit);
  return refs;
}

export function recordLabel(log: AuditLog, references?: Record<string, string>) {
  if (log.entityId && references?.[log.entityId]) {
    const refLabel = references[log.entityId];
    if (refLabel.trim()) return refLabel;
  }
  for (const key of ['receiptCode', 'issueCode', 'transferCode', 'countCode', 'assetCode', 'code', 'name']) {
    const value = snapshotField(log.newData, key) ?? snapshotField(log.oldData, key);
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (log.entityId && /^[\da-f]{8}-/i.test(log.entityId)) {
    const prefix = ({ STOCK_RECEIPT: 'PN', STOCK_ISSUE: 'PX', STOCK_COUNT: 'KK', STOCK_TRANSFER: 'CK', MAINTENANCE_REQUEST: 'MNT', ASSET_TRANSFER_REQUEST: 'ATR' } as Record<string, string>)[normalizeEntity(log.entityType)];
    if (prefix) return `${prefix}-${log.entityId.slice(0, 8)}`;
  }
  return log.entityId ? formatIdentifier(log.entityId) : (normalizeEntity(log.entityType) === 'STORE_SHIPPING_FEES' ? entityLabel(log.entityType) : 'Chưa có mã đối tượng');
}

export function formatIdentifier(value: string) {
  if (!UUID_EXACT.test(value)) {
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

function resolvedFieldFromPath(path: string) {
  const parts = path.split('.');
  const last = parts.at(-1) ?? '';
  if ((/^\d+$/.test(last) || last.startsWith('@')) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return last;
}

export function isStatusFieldPath(path: string) {
  return STATUS_FIELDS.has(resolvedFieldFromPath(path));
}

export function formatMoney(value: number | string) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toLocaleString('vi-VN')} đ`;
}

export function formatValue(value: unknown, path: string, context?: FormatContext) {
  const { farm, references } = unpackContext(context);
  if (value === undefined) return 'Không có trường này';
  if (value === null) return 'Chưa có giá trị';
  const field = resolvedFieldFromPath(path);
  if (field === 'farmId' && value === farm?.id) return farm.name;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string') {
    if (value === '') return '(Trống)';
    const directReference = references?.[value];
    if (directReference) {
      return field === 'lotId' && !directReference.startsWith('Lô ')
        ? `Lô ${directReference}`
        : directReference;
    }
    if (UUID_EXACT.test(value)) {
      if (field === 'farmId' && farm) return 'Trang trại khác';
      return 'Chưa xác định';
    }
    if (
      field === 'status' ||
      field === 'returnStatus' ||
      field === 'latestMaintenanceStatus' ||
      field === 'latestMaintenanceReturnStatus'
    ) {
      return statusLabel(value);
    }
    const mappedEnum = fieldValueLabels[field]?.[value];
    if (mappedEnum) return mappedEnum;
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return formatDateTime(value);
    if (QUANTITY_FIELDS.has(field) && Number.isFinite(Number(value))) return formatQuantity(value);
    if (MONEY_FIELDS.has(field) && value.trim() && Number.isFinite(Number(value))) return formatMoney(value);
    if (references && value.length >= 36 && UUID_INLINE.test(value)) {
      UUID_INLINE.lastIndex = 0;
      return value.replace(UUID_INLINE, (match) => references[match] ?? 'đối tượng đã lưu');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (QUANTITY_FIELDS.has(field)) return formatQuantity(value);
    if (MONEY_FIELDS.has(field)) return formatMoney(value);
    return String(value);
  }
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

export function readableChangeLabel(
  change: { path: string; label: string; before: unknown; after: unknown },
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
  references?: Record<string, string>,
) {
  const parts = change.path.split('.');
  if (parts[0] === 'items' && parts.length >= 3 && (/^\d+$/.test(parts[1]) || parts[1].startsWith('@'))) {
    const index = /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
    const rowId = parts[1].startsWith('@') ? parts[1].slice(1) : null;
    const findLine = (snapshot: unknown) => {
      const items = snapshotField(snapshot, 'items');
      if (!Array.isArray(items)) return undefined;
      if (index !== null) return items[index];
      if (rowId) return items.find((line) => snapshotField(line, 'id') === rowId);
      return undefined;
    };
    const line = findLine(afterSnapshot) ?? findLine(beforeSnapshot);
    const lineItemName = snapshotField(line, 'itemName');
    const lineItemId = snapshotField(line, 'itemId');
    const lineItemCode = snapshotField(line, 'itemCode');
    const resolvedItem =
      (typeof lineItemName === 'string' && lineItemName.trim())
        ? (typeof lineItemCode === 'string' && lineItemCode.trim() ? `${lineItemCode} — ${lineItemName}` : lineItemName)
        : (typeof lineItemId === 'string' && references?.[lineItemId])
          ? references[lineItemId]
          : null;
    if (resolvedItem) {
      const leafField = parts.slice(2).map((segment) => fieldLabels[segment] ?? segment).join(' / ');
      return `Vật tư: ${resolvedItem} • ${leafField}`;
    }
  }
  return change.label;
}

export function visibleChanges(
  changes: Array<{ path: string; label: string; before: unknown; after: unknown }>,
) {
  const filtered = changes.filter((change) => {
    const field = resolvedFieldFromPath(change.path);
    return !HIDDEN_SNAPSHOT_FIELDS.has(field) && field !== 'updatedAt' && field !== 'createdAt';
  });
  return filtered.length > 0 ? filtered : changes;
}

export type SnapshotFieldRow = {
  key: string;
  label: string;
  value: string;
  kind: 'status' | 'text';
  statusTone?: 'success' | 'amber' | 'danger' | 'cream';
};

export type SnapshotLineItem = {
  key: string;
  index: number;
  title: string;
  metrics: Array<{ label: string; value: string; tone?: 'normal' | 'amber' | 'success' | 'danger' }>;
  details: Array<{ label: string; value: string }>;
};

export type PresentedSnapshot = {
  warehouseRoute: { from: string; to: string } | null;
  fields: SnapshotFieldRow[];
  items: SnapshotLineItem[];
};

const FIELD_ORDER = [
  'status', 'returnStatus', 'membershipStatus', 'paymentStatus',
  'receiptCode', 'issueCode', 'transferCode', 'countCode', 'assetCode', 'code', 'name',
  'issueType', 'maintenanceType', 'warehouseId', 'locationId', 'currentLocationId', 'supplierId',
  'receiptDate', 'issueDate', 'transferDate', 'countDate', 'scheduledAt',
  'createdByMemberId', 'requestedByMemberId', 'recipientMemberId', 'assignedToMemberId',
  'confirmedByMemberId', 'dispatchedByMemberId', 'rejectedByMemberId', 'receivedRecordedByMemberId',
  'rejectionReason', 'reason', 'resolution', 'resolutionNote', 'receiptNote', 'note', 'summary',
];

function priorityOf(key: string) {
  const index = FIELD_ORDER.indexOf(key);
  return index === -1 ? FIELD_ORDER.length : index;
}

function unwrapSnapshotObject(snapshot: unknown): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const source = snapshot as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const [rawKey, val] of Object.entries(source)) {
    const key = canonicalKey(rawKey);
    if (
      (DOCUMENT_WRAPPERS as readonly string[]).includes(key) &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      for (const [innerRawKey, innerVal] of Object.entries(val as Record<string, unknown>)) {
        const innerKey = canonicalKey(innerRawKey);
        if (!(innerKey in merged)) merged[innerKey] = innerVal;
      }
      continue;
    }
    merged[key] = val;
  }
  return merged;
}

export function presentSnapshot(snapshot: unknown, context?: FormatContext): PresentedSnapshot {
  const obj = unwrapSnapshotObject(snapshot);
  if (!obj) return { warehouseRoute: null, fields: [], items: [] };
  const localRefs = {
    ...synthesizeReferences(snapshot),
    ...(unpackContext(context).references ?? {}),
  };
  const enrichedContext: FormatContext = {
    ...unpackContext(context),
    references: localRefs,
  };

  let warehouseRoute: { from: string; to: string } | null = null;
  const skipKeys = new Set<string>(HIDDEN_SNAPSHOT_FIELDS);

  // Skip flat companion join strings when the corresponding ID is resolved neatly.
  if (typeof obj.itemId === 'string' && localRefs[obj.itemId]) {
    skipKeys.add('itemCode');
    skipKeys.add('itemName');
  }
  if (typeof obj.currentLocationId === 'string' && localRefs[obj.currentLocationId]) {
    skipKeys.add('locationCode');
    skipKeys.add('locationName');
  }
  if (typeof obj.categoryId === 'string' && localRefs[obj.categoryId]) {
    skipKeys.add('categoryName');
  }
  if (typeof obj.unitId === 'string' && localRefs[obj.unitId]) {
    skipKeys.add('unitName');
    skipKeys.add('unitSymbol');
  }
  if (typeof obj.supplierId === 'string' && localRefs[obj.supplierId]) {
    skipKeys.add('supplierName');
  }
  if (typeof obj.returnWarehouseId === 'string' && localRefs[obj.returnWarehouseId]) {
    skipKeys.add('returnWarehouseName');
  }
  if (typeof obj.returnLocationId === 'string' && localRefs[obj.returnLocationId]) {
    skipKeys.add('returnLocationName');
  }
  if (typeof obj.performedByMemberId === 'string' && localRefs[obj.performedByMemberId]) {
    skipKeys.add('performedByName');
    skipKeys.add('performedByStaff');
  }
  if (typeof obj.receivedByMemberId === 'string' && localRefs[obj.receivedByMemberId]) {
    skipKeys.add('receivedByName');
  }
  if (typeof obj.inspectedByMemberId === 'string' && localRefs[obj.inspectedByMemberId]) {
    skipKeys.add('inspectedByName');
  }
  if (typeof obj.issuedByMemberId === 'string' && localRefs[obj.issuedByMemberId]) {
    skipKeys.add('issuedByName');
  }
  if (typeof obj.locationWarehouseId === 'string' && !localRefs[obj.locationWarehouseId]) {
    skipKeys.add('locationWarehouseId');
  }

  if (obj.fromWarehouseId && obj.toWarehouseId) {
    warehouseRoute = {
      from: formatValue(obj.fromWarehouseId, 'fromWarehouseId', enrichedContext),
      to: formatValue(obj.toWarehouseId, 'toWarehouseId', enrichedContext),
    };
    skipKeys.add('fromWarehouseId');
    skipKeys.add('toWarehouseId');
  } else if (obj.sourceWarehouseId && obj.destinationWarehouseId) {
    warehouseRoute = {
      from: formatValue(obj.sourceWarehouseId, 'sourceWarehouseId', enrichedContext),
      to: formatValue(obj.destinationWarehouseId, 'destinationWarehouseId', enrichedContext),
    };
    skipKeys.add('sourceWarehouseId');
    skipKeys.add('destinationWarehouseId');
  }

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  skipKeys.add('items');

  const fields: SnapshotFieldRow[] = [];
  const sortedEntries = Object.entries(obj).sort(([a], [b]) => priorityOf(a) - priorityOf(b));
  for (const [key, val] of sortedEntries) {
    if (skipKeys.has(key)) continue;
    if (key === 'referenceId' && typeof obj.summary === 'string' && typeof val === 'string' && !localRefs[val]) {
      continue;
    }
    if (Array.isArray(val)) {
      const formatted = val.length === 0
        ? '(Trống)'
        : val.map((item, idx) => formatValue(item, `${key}.${idx}`, enrichedContext)).join(', ');
      fields.push({
        key,
        label: fieldLabels[key] ?? key,
        value: formatted,
        kind: 'text',
      });
      continue;
    }
    if (val && typeof val === 'object') {
      for (const nestedEntry of snapshotEntries(val)) {
        const nestedField = resolvedFieldFromPath(nestedEntry.path);
        if (HIDDEN_SNAPSHOT_FIELDS.has(nestedField)) continue;
        fields.push({
          key: `${key}.${nestedEntry.path}`,
          label: `${fieldLabels[key] ?? key} • ${nestedEntry.label}`,
          value: formatValue(nestedEntry.value, nestedEntry.path, enrichedContext),
          kind: isStatusFieldPath(nestedEntry.path) && typeof nestedEntry.value === 'string' ? 'status' : 'text',
          statusTone: isStatusFieldPath(nestedEntry.path) && typeof nestedEntry.value === 'string' ? statusTone(nestedEntry.value) : undefined,
        });
      }
      continue;
    }

    const formattedValue = formatValue(val, key, enrichedContext);
    const isStatus = STATUS_FIELDS.has(key) && typeof val === 'string';
    fields.push({
      key,
      label: fieldLabels[key] ?? key,
      value: formattedValue,
      kind: isStatus ? 'status' : 'text',
      statusTone: isStatus ? statusTone(String(val)) : undefined,
    });
  }

  const presentedItems: SnapshotLineItem[] = rawItems.map((rawLine, index) => {
    const lineObj = (rawLine && typeof rawLine === 'object' ? rawLine : {}) as Record<string, unknown>;
    const normalizedLine = Object.fromEntries(
      Object.entries(lineObj).map(([k, v]) => [canonicalKey(k), v]),
    );
    const itemName = typeof normalizedLine.itemName === 'string' ? normalizedLine.itemName.trim() : '';
    const itemCode = typeof normalizedLine.itemCode === 'string' ? normalizedLine.itemCode.trim() : '';
    const itemId = typeof normalizedLine.itemId === 'string' ? normalizedLine.itemId : '';
    const unitHint = typeof normalizedLine.unitSymbol === 'string' && normalizedLine.unitSymbol.trim()
      ? normalizedLine.unitSymbol.trim()
      : typeof normalizedLine.unitName === 'string' && normalizedLine.unitName.trim()
        ? normalizedLine.unitName.trim()
        : '';
    const unitSuffix = unitHint ? ` ${unitHint}` : '';

    const title = itemCode && itemName
      ? `${itemCode} — ${itemName}`
      : itemName || (itemId ? localRefs[itemId] : '') || itemCode || `Mặt hàng #${index + 1}`;

    const metrics: SnapshotLineItem['metrics'] = [];
    const hasCount = normalizedLine.systemQuantity !== undefined || normalizedLine.actualQuantity !== undefined;
    if (hasCount) {
      if (normalizedLine.systemQuantity !== undefined && normalizedLine.systemQuantity !== null) {
        metrics.push({ label: 'Hệ thống', value: `${formatQuantity(String(normalizedLine.systemQuantity))}${unitSuffix}` });
      }
      if (normalizedLine.actualQuantity !== undefined && normalizedLine.actualQuantity !== null) {
        metrics.push({ label: 'Thực tế', value: `${formatQuantity(String(normalizedLine.actualQuantity))}${unitSuffix}`, tone: 'amber' });
      }
      const sysNum = Number(normalizedLine.systemQuantity);
      const actNum = Number(normalizedLine.actualQuantity);
      if (
        normalizedLine.systemQuantity !== undefined &&
        normalizedLine.actualQuantity !== undefined &&
        Number.isFinite(sysNum) &&
        Number.isFinite(actNum)
      ) {
        const diff = actNum - sysNum;
        metrics.push({
          label: 'Chênh lệch',
          value: diff === 0 ? 'Khớp' : `${diff > 0 ? '+' : ''}${formatQuantity(diff)}${unitSuffix}`,
          tone: diff === 0 ? 'success' : diff > 0 ? 'amber' : 'danger',
        });
      }
    } else if (normalizedLine.quantity !== undefined && normalizedLine.quantity !== null) {
      metrics.push({ label: 'Số lượng', value: `${formatQuantity(String(normalizedLine.quantity))}${unitSuffix}` });
    }

    if (normalizedLine.receivedQuantity !== undefined && normalizedLine.receivedQuantity !== null) {
      metrics.push({
        label: 'Thực nhận',
        value: `${formatQuantity(String(normalizedLine.receivedQuantity))}${unitSuffix}`,
        tone: 'success',
      });
    }
    if (normalizedLine.unitPrice !== undefined && normalizedLine.unitPrice !== null && Number(normalizedLine.unitPrice) > 0) {
      metrics.push({
        label: 'Đơn giá',
        value: formatMoney(String(normalizedLine.unitPrice)),
      });
    }

    const handled = new Set([
      'id', 'farmId', 'itemId', 'itemCode', 'itemName', 'unitName', 'unitSymbol', 'trackingMode', 'itemImageUrl',
      'stockReceiptId', 'stockIssueId', 'stockTransferId', 'stockCountId',
      'sourceReceiptItemId', 'sourceIssueItemId', 'createdAt', 'updatedAt',
      'systemQuantity', 'actualQuantity', 'quantity', 'receivedQuantity', 'unitPrice',
      'lotNumber',
    ]);
    if (hasCount) handled.add('difference');
    if (typeof normalizedLine.lotId === 'string' && typeof normalizedLine.lotCode === 'string') {
      handled.add('lotCode');
    }
    const details: SnapshotLineItem['details'] = [];
    for (const [k, v] of Object.entries(normalizedLine)) {
      if (handled.has(k) || v === undefined || v === null || v === '') continue;
      if (k === 'lotId' && typeof v === 'string') {
        const lotLabel = typeof normalizedLine.lotCode === 'string' && normalizedLine.lotCode
          ? `Lô ${normalizedLine.lotCode}`
          : formatValue(v, 'lotId', enrichedContext);
        details.push({ label: fieldLabels.lotId, value: lotLabel });
        continue;
      }
      if (k === 'assetId' && typeof normalizedLine.assetCode === 'string' && normalizedLine.assetCode) {
        continue;
      }
      details.push({
        label: fieldLabels[k] ?? k,
        value: formatValue(v, k, enrichedContext),
      });
    }

    return {
      key: typeof normalizedLine.id === 'string' ? normalizedLine.id : String(index),
      index: index + 1,
      title,
      metrics,
      details,
    };
  });

  return {
    warehouseRoute,
    fields,
    items: presentedItems,
  };
}

export function relatedRecordRoute(log: AuditLog) {
  if (!log.entityId || log.action.toUpperCase() === 'DELETE') return null;
  const id = encodeURIComponent(log.entityId);
  switch (normalizeEntity(log.entityType)) {
    case 'STOCK_RECEIPT': return `/receipts/${id}?type=receipt`;
    case 'STOCK_ISSUE': return `/receipts/${id}?type=issue`;
    case 'STOCK_COUNT': return `/counts/${id}`;
    case 'ASSET_TRANSFER_REQUEST': return `/assets/transfer-requests/${id}`;
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

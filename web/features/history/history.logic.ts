import type { AuditLog, HistoryQuery } from "./types/history";

export const HISTORY_ENTITY_LABELS: Record<string, string> = {
  STOCK_RECEIPT: "Phiếu nhập",
  STOCK_ISSUE: "Phiếu xuất",
  STOCK_TRANSFER: "Phiếu điều chuyển",
  STOCK_COUNT: "Phiếu kiểm kê",
  MAINTENANCE_REQUEST: "Yêu cầu bảo trì",
  ASSET_TRANSFER_REQUEST: "Yêu cầu chuyển tài sản",
  ASSET: "Tài sản",
  PERSONNEL: "Nhân sự",
};

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  CANCEL: "Hủy",
  SUBMIT: "Gửi duyệt",
  CONFIRM: "Xác nhận",
  REJECT: "Từ chối",
  ASSET_CREATED: "Tạo tài sản",
  ASSET_METADATA_UPDATED: "Cập nhật thông tin tài sản",
  ASSET_ASSIGNED: "Cấp phát tài sản",
  ASSET_REASSIGNED: "Đổi người nhận tài sản",
  ASSET_USE_STARTED: "Bắt đầu sử dụng",
  ASSET_RETURNED: "Nhận lại tài sản",
  ASSET_TRANSFERRED: "Điều chuyển tài sản",
  ASSET_RETIRED: "Ngừng sử dụng tài sản",
  ASSET_INCIDENT_REPORTED: "Ghi nhận sự cố tài sản",
  ASSET_INCIDENT_STATUS: "Cập nhật xử lý sự cố",
  ASSET_RECOVERED: "Ghi nhận tìm lại tài sản",
  ASSET_MAINTENANCE_SCHEDULED: "Lên lịch bảo trì",
  ASSET_MAINTENANCE_STARTED: "Bắt đầu bảo trì",
  ASSET_MAINTENANCE_COMPLETED: "Hoàn tất bảo trì",
  ASSET_MAINTENANCE_CANCELLED: "Dừng bảo trì",
  PERSONNEL_ADDED: "Thêm nhân sự",
  PERSONNEL_PROFILE_CHANGED: "Cập nhật hồ sơ công việc",
  PERSONNEL_ROLES_CHANGED: "Thay đổi quyền",
  PERSONNEL_WORKPLACES_CHANGED: "Thay đổi nơi làm việc",
  PERSONNEL_STATUS_CHANGED: "Thay đổi trạng thái",
};

export const HISTORY_FIELD_LABELS: Record<string, string> = {
  status: "Trạng thái",
  note: "Ghi chú",
  rejectionReason: "Lý do từ chối",
  reason: "Lý do",
  description: "Mô tả",
  summary: "Nội dung",
  referenceId: "Mã tham chiếu",
  items: "Dòng hàng",
  quantity: "Số lượng",
  actualQuantity: "Số lượng thực tế",
  systemQuantity: "Số lượng sổ sách",
  unitPrice: "Đơn giá",
  warehouseId: "Kho",
  fromWarehouseId: "Kho nguồn",
  toWarehouseId: "Kho đích",
  locationId: "Vị trí",
  fromLocationId: "Vị trí nguồn",
  toLocationId: "Vị trí đích",
  currentLocationId: "Vị trí hiện tại",
  supplierId: "Nhà cung cấp",
  createdByMemberId: "Người tạo",
  confirmedByMemberId: "Người xác nhận",
  assignedToMemberId: "Người giữ tài sản",
  receiptCode: "Mã phiếu nhập",
  receiptDate: "Ngày nhập",
  issueCode: "Mã phiếu xuất",
  issueDate: "Ngày xuất",
  issueType: "Loại phiếu xuất",
  transferCode: "Mã phiếu điều chuyển",
  transferDate: "Ngày điều chuyển",
  countCode: "Mã phiếu kiểm kê",
  countDate: "Ngày kiểm kê",
  assetId: "Tài sản",
  assetCode: "Mã tài sản",
  serialNumber: "Số sê-ri",
  maintenanceType: "Loại bảo trì",
  maintenanceRecordId: "Hồ sơ bảo trì",
  scheduledAt: "Lịch bảo trì",
  createdAt: "Thời gian tạo",
  updatedAt: "Thời gian cập nhật",
  confirmedAt: "Thời gian xác nhận",
  cancelledAt: "Thời gian hủy",
  employeeCode: "Mã nhân viên",
  fullName: "Họ tên",
  email: "Email",
  phone: "Số điện thoại",
  jobTitle: "Chức danh",
  membershipStatus: "Trạng thái thành viên",
  roleCodes: "Quyền",
  warehouseIds: "Nơi làm việc",
};

export function historyEntityIdError(value: string) {
  // Same UUID validation as features/requests/requests.logic.ts.
  return value.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
    ? "Mã đối tượng phải là UUID hợp lệ."
    : null;
}

export function parseHistoryQuery(params: Pick<URLSearchParams, "get">): HistoryQuery {
  const entityType = params.get("entityType")?.trim().toUpperCase() ?? "";
  const action = params.get("action")?.trim().toUpperCase() ?? "";
  const page = params.get("page") ?? "";
  return {
    entityType: Object.hasOwn(HISTORY_ENTITY_LABELS, entityType) ? entityType : "",
    action: Object.hasOwn(HISTORY_ACTION_LABELS, action) ? action : "",
    entityId: params.get("entityId")?.trim() ?? "",
    page: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page) * 20) ? Number(page) : 1,
  };
}

export function changeHistoryFilters(query: HistoryQuery, filters: Omit<HistoryQuery, "page">): HistoryQuery {
  return { ...query, ...filters, page: 1 };
}

export function historyHref(query: HistoryQuery) {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.action) params.set("action", query.action);
  if (query.entityId) params.set("entityId", query.entityId);
  return `/history?${params}`;
}

export function historyErrorMessage(status: number | null, message: string) {
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền xem lịch sử thay đổi.";
  if (status === 404) return "Lịch sử không tồn tại hoặc không thuộc trang trại này.";
  if (status === 409) return `Trạng thái đã thay đổi: ${message}`;
  if (status === 400) return `Dữ liệu không hợp lệ: ${message}`;
  return "Không tải được lịch sử thay đổi. Vui lòng thử lại.";
}

export function historyActorLabel(actor: AuditLog["actor"]) {
  return actor?.name?.trim() || actor?.email?.trim() || "Hệ thống";
}

function jsonValue(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, nested) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
      : nested,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Readable names for ids (from the API's `references`) and Vietnamese labels for coded values. */
export type HistoryFormat = {
  references: Record<string, string>;
  label: (key: string, value: string) => string;
};

const plainFormat: HistoryFormat = { references: {}, label: (_key, value) => value };

function displayValue(key: string, value: unknown, format: HistoryFormat): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (!value) return "(Trống)";
    if (UUID.test(value)) {
      const name = format.references[value];
      return name ? (key === "lotId" ? `Lô ${name}` : name) : "Không xác định";
    }
    return format.label(key, value);
  }
  if (Array.isArray(value))
    return value.length
      ? value.map((entry) => displayValue(key, entry, format)).join(
        value.some((entry) => entry && typeof entry === "object") ? "\n" : ", ",
      )
      : "(Trống)";
  // An object is one line of a document (item, lot, quantities…).
  return Object.entries(value)
    .filter(([, nested]) => nested !== null && nested !== undefined && nested !== "")
    .map(([nestedKey, nested]) => nestedKey.endsWith("Id")
      ? displayValue(nestedKey, nested, format)
      : `${HISTORY_FIELD_LABELS[nestedKey] ?? nestedKey}: ${displayValue(nestedKey, nested, format)}`)
    .join(" · ");
}

export function historyChanges(
  log: Pick<AuditLog, "action" | "oldData" | "newData">,
  format: HistoryFormat = plainFormat,
) {
  const initial = !log.oldData || log.action === "CREATE" || log.action === "ASSET_CREATED";
  const before = initial ? {} : log.oldData ?? {};
  const after = log.newData ?? {};
  const keys = initial ? Object.keys(after) : [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((key) => initial || jsonValue(before[key]) !== jsonValue(after[key]))
    .map((key) => ({
      key,
      before: displayValue(key, before[key], format),
      after: displayValue(key, after[key], format),
    }));
}

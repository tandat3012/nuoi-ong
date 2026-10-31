import type { RequestsQuery, RequestStatus, TransferRequestRow } from "./types/request";
import { WAREHOUSE_MANAGE_ROLES, hasAnyRole } from "../auth/farm-roles.ts";

// These mirror the approver and reload rules in features/stock-documents/stock-document.logic.ts.
function canApproveRequests(roles: readonly string[]) {
  return hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES);
}

export function shouldReloadAfterFailure(status: number | null) {
  return status !== 401 && status !== 403;
}

export const REQUEST_STATUS_LABELS = {
  PENDING_APPROVAL: "Chờ duyệt",
  CONFIRMED: "Đã duyệt",
  REJECTED: "Đã từ chối",
} as const;

export const REQUEST_MAINTENANCE_LABELS = {
  CORRECTIVE: "Sửa chữa",
  INSPECTION: "Kiểm tra",
} as const;

export function requestActions(roles: readonly string[], status: RequestStatus) {
  const review = canApproveRequests(roles) && status === "PENDING_APPROVAL";
  return { approve: review, reject: review };
}

export function assetRequestActions(roles: readonly string[], assetStatus: string) {
  const create = roles.includes("EMPLOYEE") && !canApproveRequests(roles);
  return { maintenance: create, transfer: create && assetStatus === "AVAILABLE" };
}

export function normalizeRequestReason(value: string) {
  const reason = value.trim();
  return reason.length < 3 || reason.length > 1000
    ? { error: "Lý do từ chối phải có từ 3 đến 1000 ký tự." } as const
    : { reason } as const;
}

export function normalizeRequestDescription(value: string) {
  const description = value.trim();
  return description.length < 3 || description.length > 4000
    ? { error: "Mô tả phải có từ 3 đến 4000 ký tự." } as const
    : { description } as const;
}

export function serializeScheduledAt(value: string) {
  const text = value.trim();
  const date = new Date(text);
  const parts = text.split(/[-T:]/).map(Number);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ||
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== parts[0] || date.getMonth() + 1 !== parts[1] ||
    date.getDate() !== parts[2] || date.getHours() !== parts[3] ||
    date.getMinutes() !== parts[4]
  ) return { error: "Hãy chọn ngày và giờ bảo trì hợp lệ." } as const;
  return { scheduledAt: date.toISOString() } as const;
}

export function parseRequestsQuery(
  params: Pick<URLSearchParams, "get">,
  roles: readonly string[],
): RequestsQuery {
  const status = params.get("status");
  const page = params.get("page") ?? "";
  const id = params.get("id") ?? "";
  const validStatus = status === "ALL" || status === "PENDING_APPROVAL" ||
    status === "CONFIRMED" || status === "REJECTED";
  return {
    type: params.get("type") === "transfer" ? "transfer" : "maintenance",
    status: validStatus ? status : canApproveRequests(roles) ? "PENDING_APPROVAL" : "ALL",
    page: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page) * 20)
      ? Number(page) : 1,
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ? id : undefined,
  };
}

export function requestsHref(query: RequestsQuery) {
  const params = new URLSearchParams({
    type: query.type, status: query.status, page: String(query.page),
  });
  if (query.id) params.set("id", query.id);
  return `/requests?${params}`;
}

export function transferDestination(row: Pick<TransferRequestRow,
  "toWarehouseCode" | "toWarehouseName" | "toLocationCode" | "toLocationName"
>) {
  return [
    row.toWarehouseName || row.toWarehouseCode || "Kho chưa xác định",
    row.toLocationName || row.toLocationCode || "Vị trí chưa xác định",
  ].join(" — ");
}

export function requestFailureStatus(failure: unknown): number | null {
  return failure && typeof failure === "object" && "status" in failure &&
    typeof failure.status === "number" ? failure.status : null;
}

export async function runRequestAction(
  perform: () => Promise<unknown>,
  feedback: {
    onChanged: () => void;
    onError: (failure: unknown) => void;
  },
) {
  feedback.onError(null);
  try {
    await perform();
  } catch (failure) {
    // Publish the error before a reload can unmount the action dialog.
    feedback.onError(failure);
    if (shouldReloadAfterFailure(requestFailureStatus(failure))) feedback.onChanged();
    throw failure;
  }
  feedback.onChanged();
}

const CONFLICTS: [RegExp, string][] = [
  [/approve or reject it first/, "Tài sản đang chờ chuyển. Hãy xử lý yêu cầu chuyển trước."],
  [/pending maintenance request/, "Tài sản đã có một yêu cầu bảo trì chờ duyệt."],
  [/pending transfer request/, "Tài sản đã có một yêu cầu chuyển chờ duyệt."],
  [/Only PENDING_APPROVAL/, "Yêu cầu không còn chờ duyệt. Có thể người khác đã xử lý."],
  [/Only AVAILABLE assets can be requested/, "Tài sản không còn sẵn sàng để yêu cầu chuyển."],
  [/Only AVAILABLE assets can be transferred|Asset changed during transfer/,
    "Trạng thái hoặc vị trí tài sản đã thay đổi nên chưa thể duyệt chuyển."],
  [/Asset is not eligible/, "Tài sản đang bảo trì, chờ chuyển, đã mất hoặc ngừng sử dụng nên không thể gửi yêu cầu bảo trì."],
  [/Terminal assets/, "Tài sản đã mất hoặc ngừng sử dụng nên không thể lên lịch bảo trì."],
  [/active maintenance/, "Tài sản đã có lịch bảo trì hoặc đang được bảo trì."],
  [/Asset has no recorded source location/, "Tài sản chưa có vị trí nguồn để chuyển."],
  [/source location is not associated/, "Vị trí nguồn của tài sản chưa thuộc kho nào."],
  [/Asset is already at this location/, "Tài sản đã ở vị trí nhận đã chọn."],
  [/Receiving location must be ACTIVE/,
    "Kho hoặc vị trí nhận đã ngừng hoạt động, hoặc vị trí không thuộc kho đã chọn."],
  [/Receiving location must belong|Receiving location must be active/,
    "Vị trí nhận phải đang hoạt động và thuộc kho đã chọn."],
  [/Warehouse must exist and be active/, "Kho nguồn hoặc kho nhận không còn hoạt động trong trang trại này."],
  [/location must be active|Location must be active/, "Vị trí nguồn hoặc vị trí nhận không còn hoạt động trong trang trại này."],
  [/Asset item must remain active/, "Vật tư của tài sản đã ngừng hoạt động hoặc không còn được theo dõi theo tài sản."],
  [/missing from.*inventory/, "Không tìm thấy tài sản trong tồn kho nguồn. Cần kiểm tra lại tồn kho."],
  [/Receiving.*balance is unavailable/, "Tồn kho nhận chưa sẵn sàng. Cần kiểm tra lại kho nhận."],
  [/TRANSFER_PENDING|pending transfer/, "Tài sản đang chờ chuyển. Hãy xử lý yêu cầu chuyển trước."],
  [/Active farm membership/, "Quyền thành viên trang trại đã thay đổi. Vui lòng tải lại trang."],
];

export function requestErrorMessage(status: number | null, message: string) {
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return /Only farm employees/.test(message)
    ? "Chỉ nhân viên trang trại được gửi yêu cầu này."
    : "Bạn không có quyền thực hiện thao tác này trong trang trại.";
  if (status === 404) return message === "Asset not found"
    ? "Tài sản không tồn tại hoặc không thuộc trang trại này."
    : "Yêu cầu không tồn tại hoặc bạn không có quyền xem.";
  if (status === 409) return CONFLICTS.find(([pattern]) => pattern.test(message))?.[1] ??
    "Trạng thái yêu cầu hoặc dữ liệu liên quan đã thay đổi. Hãy kiểm tra thông tin vừa tải lại.";
  if (status === 400) {
    if (/rejectionReason|Rejection reason/.test(message))
      return "Lý do từ chối phải có từ 3 đến 1000 ký tự.";
    if (/description|Description/.test(message))
      return "Mô tả phải có từ 3 đến 4000 ký tự.";
    if (/scheduledAt/.test(message)) return "Hãy chọn ngày và giờ bảo trì hợp lệ.";
    return "Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.";
  }
  return "Chưa nhận được kết quả. Hãy kiểm tra dữ liệu đã tải lại trước khi thử tiếp.";
}

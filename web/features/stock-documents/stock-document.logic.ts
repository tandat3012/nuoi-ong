export type StockDocumentStatus =
  | "DRAFT"
  | "COUNTING"
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED";

export type StockDocumentKind =
  "stock-receipts" | "stock-issues" | "stock-transfers" | "stock-counts";

export interface StockDocumentViewer {
  roles: readonly string[];
  memberId?: string;
}

export interface StockDocumentState {
  status: StockDocumentStatus;
  createdByMemberId: string | null;
  /** Order-linked issues move with their order (store order screen), never on their own. */
  orderId?: string | null;
}

export function canApproveStockDocuments(roles: readonly string[]) {
  return roles.some((role) => role === "ADMIN" || role === "FARM_OWNER");
}

export function canCreateStockDocuments(roles: readonly string[]) {
  return (
    canApproveStockDocuments(roles) || roles.some((role) => role === "EMPLOYEE")
  );
}

/**
 * Mirrors the API rules: approvers confirm drafts directly and review submitted
 * documents; employees edit, cancel and submit only their own drafts.
 */
export function stockDocumentActions(
  viewer: StockDocumentViewer,
  document: StockDocumentState,
) {
  const approver = canApproveStockDocuments(viewer.roles);
  const own =
    Boolean(viewer.memberId) && document.createdByMemberId === viewer.memberId;
  const ownWriter = canCreateStockDocuments(viewer.roles) && own;
  const draft = document.status === "DRAFT" || document.status === "COUNTING";
  const pending = document.status === "PENDING_APPROVAL";
  return {
    edit: draft && (approver || ownWriter),
    cancel: draft && (approver || ownWriter) && !document.orderId,
    submit: draft && ownWriter && !approver && !document.orderId,
    confirm: approver && (draft || pending),
    reject: approver && pending && !document.orderId,
  };
}

const CONFLICTS: [RegExp, string][] = [
  [
    /Cancel the linked order instead/,
    "Phiếu gắn với đơn hàng: hãy hủy đơn hàng thay vì từ chối phiếu.",
  ],
  [
    /can be submitted/,
    "Phiếu không còn ở trạng thái nháp nên không gửi duyệt được.",
  ],
  [/can be rejected/, "Phiếu không còn chờ duyệt nên không từ chối được."],
  [/can be confirmed/, "Phiếu không còn chờ xác nhận."],
  [/can be cancelled/, "Phiếu không còn ở trạng thái nháp nên không hủy được."],
];

/** Vietnamese message for a failed submit/reject; `null` status means no response. */
export function stockDocumentErrorMessage(
  status: number | null,
  message: string,
) {
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403)
    return /own documents/.test(message)
      ? "Bạn chỉ thao tác được phiếu do chính mình tạo."
      : "Bạn không có quyền thực hiện thao tác này trong trang trại.";
  if (status === 404)
    return "Phiếu không tồn tại hoặc không thuộc trang trại này.";
  if (status === 409)
    return (
      CONFLICTS.find(([pattern]) => pattern.test(message))?.[1] ??
      `Không thể thực hiện: ${message}`
    );
  if (status === 400)
    return /at least one item/.test(message)
      ? "Phiếu chưa có dòng hàng nên chưa gửi duyệt được."
      : /reason/i.test(message)
        ? "Hãy nhập lý do từ chối."
        : `Dữ liệu không hợp lệ: ${message}`;
  return "Chưa nhận được kết quả. Hãy kiểm tra trạng thái phiếu đã tải lại trước khi thử tiếp.";
}

/** Reloads after every answered request (state may have changed), except auth failures. */
export function shouldReloadAfterFailure(status: number | null) {
  return status !== 401 && status !== 403;
}

export function normalizeRejectionReason(value: string) {
  const reason = value.trim();
  if (!reason) return { error: "Hãy nhập lý do từ chối." } as const;
  if (reason.length > 4000)
    return { error: "Lý do từ chối tối đa 4000 ký tự." } as const;
  return { reason } as const;
}

export function stockDocumentQueryId(params: Pick<URLSearchParams, "get">) {
  const id = params.get("id") ?? "";
  // Same UUID validation as features/requests/requests.logic.ts.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id : null;
}

export function stockDocumentHref(
  pathname: string,
  params: Pick<URLSearchParams, "toString">,
  id: string | null,
) {
  const next = new URLSearchParams(params.toString());
  if (id) next.set("id", id);
  else next.delete("id");
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

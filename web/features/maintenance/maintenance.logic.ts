import {
  hasAnyRole,
  MAINTENANCE_WORK_ROLES,
  WAREHOUSE_MANAGE_ROLES,
} from "../auth/farm-roles.ts";
export function formatMaintenanceCost(value: string): string {
  const [whole, ...fraction] = value.replaceAll(".", "").split(",");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction.length ? "," + fraction.join(",") : "")
  );
}
export function maintenanceCostValue(value: string): string {
  return value.replaceAll(".", "").replace(",", ".");
}

export type MaintenanceWorkflow = {
  status: string;
  returnStatus: string | null;
  receivedAt?: string | null;
};
export const MAINTENANCE_STATUSES: Record<string, string> = {
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang bảo trì bên ngoài",
  RECEIVED: "Chờ nghiệm thu",
  COMPLETED: "Bảo trì đạt",
  FAILED: "Bảo trì không thành công",
  CANCELLED: "Đã hủy",
};
export const MAINTENANCE_TYPES: Record<string, string> = {
  PREVENTIVE: "Bảo dưỡng định kỳ",
  CORRECTIVE: "Sửa chữa",
  INSPECTION: "Kiểm tra",
};
export const RETURN_STATUSES: Record<string, string> = {
  PENDING_APPROVAL: "Chờ duyệt nhập kho",
  CONFIRMED: "Đã nhập lại kho",
  REJECTED: "Phiếu nhập bị từ chối",
};
export function maintenanceActions(
  record: MaintenanceWorkflow,
  roles: readonly string[],
): string[] {
  const worker = hasAnyRole(roles, MAINTENANCE_WORK_ROLES);
  const manager = hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES);
  if (record.returnStatus === "PENDING_APPROVAL")
    return manager ? ["return-receipt/approve", "return-receipt/reject"] : [];
  if (record.status === "SCHEDULED")
    return [
      ...(worker ? ["start"] : []),
      ...(worker || manager ? ["cancel"] : []),
    ];
  if (!worker) return [];
  if (record.status === "IN_PROGRESS") return ["receive"];
  if (record.status === "RECEIVED") return ["complete"];
  // Legacy completed records have no actual receipt and cannot use the new return flow.
  if (
    ["COMPLETED", "FAILED"].includes(record.status) &&
    record.receivedAt &&
    (!record.returnStatus || record.returnStatus === "REJECTED")
  )
    return ["return-receipt"];
  return [];
}
export function maintenanceNextStep(
  record: MaintenanceWorkflow,
  roles: readonly string[],
): string {
  if (record.returnStatus === "PENDING_APPROVAL")
    return hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES)
      ? "Kiểm tra kết quả và duyệt nhập lại kho."
      : "Chờ quản lý kho duyệt phiếu nhập lại.";
  if (record.returnStatus === "CONFIRMED")
    return record.status === "FAILED"
      ? "Đã nhập kho · Thiết bị chưa được phép sử dụng."
      : "Đã nhập kho · Thiết bị sẵn sàng sử dụng.";
  if (record.returnStatus === "REJECTED")
    return "Nhân viên bảo trì cần chỉnh phiếu và gửi lại.";
  if (record.status === "SCHEDULED")
    return hasAnyRole(roles, MAINTENANCE_WORK_ROLES)
      ? "Chọn đơn vị và ngày hẹn trả để gửi thiết bị."
      : "Chờ nhân viên bảo trì gửi thiết bị.";
  if (record.status === "IN_PROGRESS")
    return "Nhân viên bảo trì xác nhận khi nhận lại thiết bị.";
  if (record.status === "RECEIVED")
    return "Nhân viên bảo trì kiểm tra và ghi kết quả nghiệm thu.";
  if (["COMPLETED", "FAILED"].includes(record.status) && record.receivedAt)
    return "Nhân viên bảo trì lập phiếu nhập lại kho.";
  return record.status === "CANCELLED"
    ? "Lịch đã hủy · Không phát sinh nhập lại kho."
    : "Hồ sơ lịch sử bảo trì.";
}
export function maintenanceDate(value: string | null, withTime = true): string {
  if (!value) return "Chưa đặt lịch";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value.length === 10 ? value + "T00:00:00+07:00" : value));
}
export function maintenanceCountdown(day: string, now: number): string {
  const days = Math.ceil(
    (Date.parse(day + "T00:00:00+07:00") - now) / 86400000,
  );
  return days < 0
    ? `Quá hạn ${-days} ngày`
    : days === 0
      ? "Đến hạn hôm nay"
      : `Còn ${days} ngày`;
}

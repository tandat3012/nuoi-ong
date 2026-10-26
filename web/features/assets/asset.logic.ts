import type { AssetFilters, AssetStatus } from "./types/asset";

export function canWriteAssets(roles: readonly string[]) {
  return roles.some((role) => role === "ADMIN" || role === "FARM_OWNER");
}

export function assetActions(status: AssetStatus) {
  if (status === "LOST") return ["recover"] as const;
  if (status === "RETIRED" || status === "MAINTENANCE") return [] as const;
  return [
    "assign",
    ...(status === "ASSIGNED" ? ["start-use" as const] : []),
    "incidents",
    "maintenance",
    ...(status === "AVAILABLE" ? ["transfer" as const, "retire" as const] : []),
  ] as const;
}

export function changeAssetFilters(
  filters: AssetFilters,
  change: Partial<AssetFilters>,
): AssetFilters {
  const next = { ...filters, ...change, page: 1 };
  if ("warehouseId" in change) next.locationId = undefined;
  return next;
}

export function canReturnAsset(roles: readonly string[], status: AssetStatus) {
  return (
    canWriteAssets(roles) && (status === "ASSIGNED" || status === "IN_USE")
  );
}

export function validAssetIdentity(value: string, byCode: boolean) {
  return byCode
    ? value.trim().length > 0 && [...value].length <= 100
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
}

export function formatAssetPrice(value: string | null) {
  if (value === null) return "—";
  const [whole, fraction] = value.split(".");
  return `${BigInt(whole).toLocaleString("vi-VN")}${fraction ? `,${fraction}` : ""} ₫`;
}

export function formatAssetDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function assetError(
  error: unknown,
  write = false,
): { message: string; reloadRequired: boolean } {
  const status =
    error && typeof error === "object" && "status" in error ? error.status : 0;
  if (status === 401)
    return {
      message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      reloadRequired: false,
    };
  if (status === 403)
    return {
      message: "Bạn không có quyền truy cập tài sản trong trang trại này.",
      reloadRequired: write,
    };
  if (status === 404)
    return {
      message: "Tài sản không có trong trang trại đang chọn.",
      reloadRequired: write,
    };
  if (write && status === 409)
    return {
      message:
        "Không thể lưu: dữ liệu trùng, trạng thái hoặc thông tin liên quan đã thay đổi. Tải lại tài sản để kiểm tra.",
      reloadRequired: true,
    };
  if (status === 400)
    return {
      message: "Dữ liệu không hợp lệ. Kiểm tra lại thông tin đã nhập.",
      reloadRequired: false,
    };
  if (write)
    return {
      message:
        "Chưa xác định được thao tác đã hoàn tất hay chưa. Hãy tải lại dữ liệu trước khi thử lại.",
      reloadRequired: true,
    };
  return {
    message: "Không thể tải dữ liệu. Vui lòng thử lại.",
    reloadRequired: false,
  };
}

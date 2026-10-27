import type { StoreProductStatus } from "./types/store-admin";

export const STORE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const STORE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const storeStatusLabels: Record<StoreProductStatus, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đang bán",
  ARCHIVED: "Lưu trữ",
};

export function canManageStore(roles: readonly string[]) {
  return roles.some((role) => role === "ADMIN" || role === "FARM_OWNER");
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns an error message, or null when the file can be uploaded. */
export function validateStoreImage(file: { type: string; size: number }) {
  if (!STORE_IMAGE_TYPES.includes(file.type))
    return "Chỉ nhận ảnh JPEG, PNG hoặc WebP.";
  if (file.size > STORE_IMAGE_MAX_BYTES) return "Ảnh tối đa 10MB.";
  return null;
}

export function moveItem<T>(list: readonly T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function storeAdminError(error: unknown): string {
  if (!error || typeof error !== "object" || !("status" in error))
    return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
  const { status } = error;
  const message = "message" in error ? String(error.message) : "";
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403)
    return "Chỉ quản trị viên hoặc chủ trang trại sở hữu kho bán hàng được quản trị cửa hàng.";
  if (status === 404) return "Dữ liệu không tồn tại hoặc đã bị xóa.";
  if (status === 409)
    return "Slug đã tồn tại hoặc vật tư đã gắn với quy cách bán khác.";
  if (status === 413) return "Ảnh tối đa 10MB.";
  if (status === 502) return "Không tải được ảnh lên Cloudinary. Vui lòng thử lại.";
  if (status === 503) return "Cửa hàng chưa được cấu hình kho bán.";
  if (status === 400) return "Dữ liệu không hợp lệ: " + message;
  return "Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.";
}

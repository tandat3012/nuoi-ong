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

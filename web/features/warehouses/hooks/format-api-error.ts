import { ApiError } from '@/shared/api/client';

export function formatWarehouseApiError(
  error: unknown,
  writing = false,
): string {
  if (!(error instanceof ApiError)) {
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403)
    return 'Bạn không có quyền thực hiện thao tác này trong trang trại.';
  if (error.status === 404)
    return 'Kho không tồn tại hoặc không còn khả dụng trong trang trại.';
  if (error.status === 409) {
    return error.message.includes('WAREHOUSE_NOT_EMPTY')
      ? 'Không thể vô hiệu hóa kho vì kho vẫn còn tồn kho hoặc tài sản.'
      : 'Mã kho đã tồn tại trong trang trại. Vui lòng chọn mã khác.';
  }
  if (error.status === 400) return `Dữ liệu không hợp lệ: ${error.message}`;
  if (writing) {
    return 'Chưa xác nhận được kết quả lưu. Hãy tải lại danh sách trước khi gửi lại.';
  }
  return 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.';
}

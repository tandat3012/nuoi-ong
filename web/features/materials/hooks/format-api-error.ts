import { ApiError } from '@/shared/api/client';

export function formatApiError(error: unknown, writing = false): string {
  if (!(error instanceof ApiError))
    return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403)
    return 'Bạn không có quyền thực hiện thao tác này trong trang trại.';
  if (error.status === 404)
    return 'Vật tư không tồn tại hoặc không còn khả dụng trong trang trại.';
  if (error.status === 409) {
    return error.message.includes('Tracking mode')
      ? 'Không thể đổi phương thức theo dõi vì vật tư đã có dữ liệu tồn kho hoặc lô.'
      : 'Mã vật tư, mã vạch hoặc hồ sơ đã tồn tại. Vui lòng kiểm tra lại.';
  }
  if (error.status === 400) return 'Dữ liệu không hợp lệ: ' + error.message;
  if (writing)
    return 'Chưa xác nhận được kết quả lưu. Hãy kiểm tra lại danh sách trước khi gửi lại để tránh tạo trùng.';
  return 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.';
}

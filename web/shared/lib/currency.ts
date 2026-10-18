/**
 * Tiện ích định dạng tiền tệ cho ứng dụng Nuôi Ong / Mộc Ong Storefront.
 */

/**
 * Định dạng số tiền sang chuỗi hiển thị chuẩn tiền tệ Việt Nam Đồng (VND).
 *
 * @param amount - Số tiền cần định dạng (đơn vị: đồng / VND). Ví dụ: 250000 -> "250.000 ₫".
 *                 Không tự động chuyển đổi giá trị rỗng/null/undefined sang 0 để tránh hiển thị sai lệch giá.
 * @returns Chuỗi tiền tệ đã định dạng theo locale 'vi-VN' (ví dụ: "250.000 ₫"),
 *          hoặc `null` nếu giá trị đầu vào là `null`, `undefined` hoặc `NaN`.
 */
export function formatVndCurrency(amount: number | null | undefined): string | null {
  if (amount == null || typeof amount !== 'number' || Number.isNaN(amount)) {
    return null;
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

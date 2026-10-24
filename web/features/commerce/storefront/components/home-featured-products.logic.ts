import type { StorefrontProduct } from '@/features/commerce/products/types/product';

export type ScrollBoundaries = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

/**
 * Lọc danh sách sản phẩm theo mã danh mục đã chọn.
 * Khi categoryId là 'all' hoặc rỗng, trả về toàn bộ danh sách sản phẩm.
 */
export function filterProductsByCategory(
  products: readonly StorefrontProduct[],
  categoryId: string,
): readonly StorefrontProduct[] {
  if (!categoryId || categoryId === 'all') {
    return products;
  }
  return products.filter((product) => product.category.slug === categoryId);
}

/**
 * Tính toán ranh giới cuộn (Scroll Boundaries) cho carousel.
 * Xác định chính xác khi nào nút Previous và Next cần bị vô hiệu hóa.
 *
 * @param scrollLeft Vị trí cuộn hiện tại từ lề trái
 * @param clientWidth Chiều rộng khung nhìn thấy của container
 * @param scrollWidth Tổng chiều rộng có thể cuộn của container
 * @param tolerance Ngưỡng dung sai sub-pixel để tránh lỗi làm tròn số thực
 */
export function computeScrollBoundaries(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  tolerance = 2,
): ScrollBoundaries {
  // Khi tổng nội dung nằm vừa khít trong khung nhìn (không có thanh cuộn)
  if (scrollWidth <= clientWidth + tolerance) {
    return { canScrollLeft: false, canScrollRight: false };
  }

  const canScrollLeft = scrollLeft > tolerance;
  const canScrollRight = scrollLeft + clientWidth < scrollWidth - tolerance;

  return { canScrollLeft, canScrollRight };
}

/**
 * Tính toán bước nhảy cuộn tối ưu theo chiều rộng khung nhìn hiện tại.
 * Đảm bảo cuộn mượt mà theo trang nội dung trên cả điện thoại, máy tính bảng và màn hình lớn.
 */
export function calculateScrollStep(clientWidth: number): number {
  if (clientWidth <= 0) return 300;
  // Cuộn khoảng 75-80% chiều rộng khung nhìn, tối thiểu 260px (bằng 1 thẻ sản phẩm)
  return Math.max(260, Math.floor(clientWidth * 0.75));
}

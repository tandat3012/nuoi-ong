import type { StorefrontProductRating } from '../types/product';

export type ProductCardRatingInfo = {
  score: number;
  reviewCount: number;
  fillPercentages: number[];
  ariaLabel: string;
};

/**
 * Xác định trạng thái chiết khấu của sản phẩm.
 * Chỉ hợp lệ khi giá gốc là số hữu hạn và lớn hơn giá bán hiện tại.
 */
export function computeDiscountState(
  price: number,
  originalPrice?: number,
): { hasDiscount: boolean } {
  const hasDiscount =
    typeof originalPrice === 'number' &&
    Number.isFinite(originalPrice) &&
    originalPrice > price;

  return { hasDiscount };
}

/**
 * Tính toán tỷ lệ tô màu cho 5 ngôi sao đánh giá (0-100% cho mỗi sao)
 * và nhãn trợ năng tương ứng. Trả về null nếu sản phẩm không có rating.
 */
export function getProductCardRating(
  rating?: StorefrontProductRating,
): ProductCardRatingInfo | null {
  if (!rating || typeof rating.score !== 'number' || Number.isNaN(rating.score)) {
    return null;
  }

  const score = Math.max(0, Math.min(5, rating.score));
  const reviewCount =
    typeof rating.reviewCount === 'number' && rating.reviewCount >= 0
      ? rating.reviewCount
      : 0;

  // Tính toán phần trăm hiển thị cho từng ngôi sao từ 0 đến 4 (tổng 5 sao)
  // Ví dụ: score = 4.9 -> [100, 100, 100, 100, 90]
  const fillPercentages = Array.from({ length: 5 }, (_, index) => {
    const starFill = Math.max(0, Math.min(1, score - index));
    return Math.round(starFill * 100);
  });

  return {
    score,
    reviewCount,
    fillPercentages,
    ariaLabel: `Đánh giá ${score} trên 5 sao từ ${reviewCount} lượt đánh giá`,
  };
}

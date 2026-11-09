import type {
  StorefrontProduct,
  StorefrontProductRating,
} from '../types/product';
import { formatVndCurrency } from '@/shared/lib/currency';

export type ProductCardRatingInfo = {
  score: number;
  reviewCount: number;
  fillPercentages: number[];
  ariaLabel: string;
};

/**
 * Xác định số lượng quy cách bán của sản phẩm từ `variantCount` hoặc mảng `variants`.
 */
export function resolveProductVariantCount(
  product: Pick<StorefrontProduct, 'variantCount' | 'variants'>,
): number {
  if (
    typeof product.variantCount === 'number' &&
    Number.isInteger(product.variantCount) &&
    product.variantCount >= 1
  ) {
    return product.variantCount;
  }
  if (Array.isArray(product.variants) && product.variants.length >= 1) {
    return product.variants.length;
  }
  return 1;
}

/**
 * Định dạng giá hiển thị trên thẻ sản phẩm (hỗ trợ khoảng giá khi có nhiều quy cách khác giá).
 */
export function formatProductCardPriceRange(
  price: number,
  maxPrice?: number,
): string | null {
  const minFormatted = formatVndCurrency(price);
  if (!minFormatted) return null;
  if (
    typeof maxPrice === 'number' &&
    Number.isSafeInteger(maxPrice) &&
    maxPrice > price
  ) {
    const maxFormatted = formatVndCurrency(maxPrice);
    if (maxFormatted) {
      return `${minFormatted} – ${maxFormatted}`;
    }
  }
  return minFormatted;
}

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

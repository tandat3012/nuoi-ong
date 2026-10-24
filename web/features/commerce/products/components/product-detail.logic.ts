import type {
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontProductImage,
  StorefrontProductVariant,
} from '../types/product';

export interface DetailDiscountState {
  hasDiscount: boolean;
  savings: number;
  discountPercentage: number;
}

export function computeDetailDiscount(
  price: number,
  originalPrice?: number,
): DetailDiscountState {
  if (
    originalPrice === undefined ||
    !Number.isFinite(originalPrice) ||
    !Number.isFinite(price) ||
    originalPrice <= price ||
    price < 0
  ) {
    return {
      hasDiscount: false,
      savings: 0,
      discountPercentage: 0,
    };
  }

  const savings = originalPrice - price;
  const discountPercentage = Math.round((savings / originalPrice) * 100);

  return {
    hasDiscount: true,
    savings,
    discountPercentage,
  };
}

export function validateAndClampQuantity(
  value: number | string,
  purchaseLimit?: number,
  min = 1,
): number {
  let parsed: number;

  if (typeof value === 'number') {
    parsed = Number.isInteger(value) ? value : Math.floor(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return min;
    }
    parsed = parseInt(trimmed, 10);
  } else {
    return min;
  }

  if (isNaN(parsed) || parsed < min) {
    return min;
  }

  if (
    purchaseLimit !== undefined &&
    Number.isFinite(purchaseLimit) &&
    purchaseLimit >= min &&
    parsed > purchaseLimit
  ) {
    return purchaseLimit;
  }

  return parsed;
}

export function filterRelatedProducts(
  currentId: string,
  currentSlug: string,
  products: StorefrontProduct[],
  limit = 4,
): StorefrontProduct[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const filtered = products.filter(
    (product) => product.id !== currentId && product.slug !== currentSlug,
  );

  return filtered.slice(0, Math.max(0, limit));
}

export type DetailTabKey = 'description' | 'specifications' | 'usage' | 'reviews';

export interface DetailTabItem {
  id: DetailTabKey;
  label: string;
}

export function getAvailableDetailTabs(
  detail: Pick<
    StorefrontProductDetail,
    'description' | 'specifications' | 'usageGuidance' | 'reviews'
  >,
): DetailTabItem[] {
  const tabs: DetailTabItem[] = [];

  if (detail.description && detail.description.trim().length > 0) {
    tabs.push({ id: 'description', label: 'Mô tả' });
  }

  if (Array.isArray(detail.specifications) && detail.specifications.length > 0) {
    tabs.push({ id: 'specifications', label: 'Thông số kỹ thuật' });
  }

  if (detail.usageGuidance && detail.usageGuidance.trim().length > 0) {
    tabs.push({ id: 'usage', label: 'Hướng dẫn sử dụng' });
  }

  if (Array.isArray(detail.reviews) && detail.reviews.length > 0) {
    tabs.push({ id: 'reviews', label: 'Đánh giá' });
  }

  return tabs;
}

export interface ActiveProductSnapshot {
  price: number;
  originalPrice?: number;
  inStock: boolean;
  sku?: string;
  image?: StorefrontProductImage;
}

export function resolveActiveProductSnapshot(
  product: StorefrontProductDetail,
  selectedVariant?: StorefrontProductVariant,
): ActiveProductSnapshot {
  if (!selectedVariant) {
    return {
      price: product.price,
      originalPrice: product.originalPrice,
      inStock: product.inStock,
      sku: product.sku,
      image: product.image,
    };
  }

  return {
    price: selectedVariant.price ?? NaN,
    originalPrice: selectedVariant.originalPrice,
    inStock: selectedVariant.inStock === true,
    sku: selectedVariant.sku ?? product.sku,
    image: selectedVariant.image ?? product.image,
  };
}

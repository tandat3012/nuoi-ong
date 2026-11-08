import type {
  StorefrontItemType,
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontProductImage,
  StorefrontProductSpecification,
  StorefrontProductVariant,
  StorefrontTrackingMode,
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
  availability?: StorefrontProductVariant['availability'];
  sku?: string;
  image?: StorefrontProductImage;
  unitName?: string;
  unitSymbol?: string | null;
  quantityStep?: string;
  itemType?: StorefrontItemType | null;
  trackingMode?: StorefrontTrackingMode | null;
  warrantyMonths?: number | null;
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
      availability: product.availability,
      sku: product.sku,
      image: product.image,
      unitName: product.unitName,
      unitSymbol: product.unitSymbol,
      itemType: product.itemType,
      trackingMode: product.trackingMode,
      warrantyMonths: product.warrantyMonths,
    };
  }

  return {
    price: selectedVariant.price ?? NaN,
    originalPrice: selectedVariant.originalPrice,
    inStock: selectedVariant.inStock === true,
    availability: selectedVariant.availability,
    sku: selectedVariant.sku ?? product.sku,
    image: selectedVariant.image ?? product.image,
    unitName:
      selectedVariant.unitName !== undefined
        ? selectedVariant.unitName
        : product.unitName,
    unitSymbol:
      selectedVariant.unitSymbol !== undefined
        ? selectedVariant.unitSymbol
        : product.unitSymbol,
    quantityStep: selectedVariant.quantityStep,
    itemType:
      selectedVariant.itemType !== undefined
        ? selectedVariant.itemType
        : product.itemType,
    trackingMode:
      selectedVariant.trackingMode !== undefined
        ? selectedVariant.trackingMode
        : product.trackingMode,
    warrantyMonths:
      selectedVariant.warrantyMonths !== undefined
        ? selectedVariant.warrantyMonths
        : product.warrantyMonths,
  };
}

const ITEM_TYPE_LABELS: Record<StorefrontItemType, string> = {
  MATERIAL: 'Vật tư & Nông sản ngành ong',
  EQUIPMENT: 'Thiết bị nuôi ong chuyên dụng',
  TOOL: 'Dụng cụ & Phụ kiện ngành ong',
};

const TRACKING_MODE_LABELS: Record<StorefrontTrackingMode, string> = {
  LOT: 'Quản lý theo lô (FEFO) — Xuất theo thứ tự hạn dùng gần nhất còn hiệu lực, loại trừ lô hết hạn',
  ASSET: 'Quản lý theo từng cá thể thiết bị (Mã tài sản / Serial riêng)',
  QUANTITY: 'Kiểm định số lượng & quy cách tại kho bán hàng trước khi đóng gói',
};

export function resolveProductQualityBadge(
  snapshot: Pick<
    ActiveProductSnapshot,
    'itemType' | 'trackingMode' | 'warrantyMonths'
  >,
): string | null {
  if (
    typeof snapshot.warrantyMonths === 'number' &&
    snapshot.warrantyMonths > 0
  ) {
    return `Bảo hành chính hãng ${snapshot.warrantyMonths} tháng`;
  }
  if (snapshot.trackingMode === 'LOT') {
    return 'Kiểm soát chất lượng theo lô (FEFO) · Cam kết lô còn hạn dùng';
  }
  if (snapshot.trackingMode === 'ASSET') {
    return 'Thiết bị định danh mã tài sản & số Serial riêng';
  }
  return null;
}

export function buildProductSpecifications(
  product: StorefrontProductDetail,
  selectedVariant?: StorefrontProductVariant,
): StorefrontProductSpecification[] {
  if (
    Array.isArray(product.specifications) &&
    product.specifications.length > 0
  ) {
    return product.specifications;
  }

  const snapshot = resolveActiveProductSnapshot(product, selectedVariant);
  const hasMetadata = Boolean(
    snapshot.itemType ||
      snapshot.trackingMode ||
      snapshot.unitName ||
      (Array.isArray(product.variants) && product.variants.length > 0),
  );
  if (!hasMetadata) return [];

  const specs: StorefrontProductSpecification[] = [];
  if (product.category?.name) {
    specs.push({ name: 'Danh mục', value: product.category.name });
  }
  if (snapshot.itemType && ITEM_TYPE_LABELS[snapshot.itemType]) {
    specs.push({
      name: 'Phân loại hàng hóa',
      value: ITEM_TYPE_LABELS[snapshot.itemType],
    });
  }
  if (selectedVariant?.name) {
    specs.push({ name: 'Quy cách đang chọn', value: selectedVariant.name });
  } else if (Array.isArray(product.variants) && product.variants.length > 0) {
    specs.push({
      name: 'Các quy cách cung cấp',
      value: product.variants.map((v) => v.name).join(', '),
    });
  }
  if (snapshot.unitName) {
    const symbolSuffix =
      snapshot.unitSymbol &&
      snapshot.unitSymbol.toLowerCase() !== snapshot.unitName.toLowerCase()
        ? ` (${snapshot.unitSymbol})`
        : '';
    specs.push({
      name: 'Đơn vị tính',
      value: `${snapshot.unitName}${symbolSuffix}`,
    });
  }
  if (snapshot.trackingMode && TRACKING_MODE_LABELS[snapshot.trackingMode]) {
    specs.push({
      name: 'Phương thức quản lý & Truy xuất',
      value: TRACKING_MODE_LABELS[snapshot.trackingMode],
    });
  }
  if (
    typeof snapshot.warrantyMonths === 'number' &&
    snapshot.warrantyMonths > 0
  ) {
    specs.push({
      name: 'Chính sách bảo hành',
      value: `Bảo hành chính hãng ${snapshot.warrantyMonths} tháng kể từ ngày giao hàng hoàn tất`,
    });
  } else if (
    snapshot.itemType === 'EQUIPMENT' ||
    snapshot.itemType === 'TOOL'
  ) {
    specs.push({
      name: 'Chính sách hậu mãi',
      value: 'Kiểm tra kỹ thuật khi nhận hàng · Hỗ trợ sửa chữa dịch vụ tại trại',
    });
  } else if (snapshot.trackingMode === 'LOT') {
    specs.push({
      name: 'Cam kết chất lượng',
      value: 'Chỉ xuất bán các lô còn hạn sử dụng · Đổi trả nếu lỗi bao bì vận chuyển',
    });
  }
  return specs;
}

export function resolveProductUsageGuidance(
  product: StorefrontProductDetail,
  selectedVariant?: StorefrontProductVariant,
): string | undefined {
  if (product.usageGuidance && product.usageGuidance.trim().length > 0) {
    return product.usageGuidance;
  }

  const snapshot = resolveActiveProductSnapshot(product, selectedVariant);
  if (snapshot.trackingMode === 'LOT') {
    return 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp. Đậy kín nắp sau mỗi lần sử dụng. Sản phẩm được quản lý và xuất kho theo nguyên tắc FEFO (xuất lô có hạn sử dụng sớm nhất còn hiệu lực trước và tự động loại trừ các lô hết hạn), quý khách vui lòng kiểm tra tem lô và hạn dùng trên bao bì khi nhận hàng.';
  }
  if (snapshot.itemType === 'EQUIPMENT' || snapshot.trackingMode === 'ASSET') {
    return 'Vệ sinh sạch thiết bị trước và sau mỗi đợt quay mật hoặc khai thác tại trại. Đặt thiết bị trên bề mặt phẳng, khô ráo và kiểm tra các khớp truyền động định kỳ. Vui lòng lưu giữ mã đơn hàng và mã tài sản / số Serial để được hỗ trợ bảo hành, đổi mới hoặc sửa chữa chính hãng.';
  }
  if (snapshot.itemType === 'TOOL') {
    return 'Kiểm tra quy cách và phụ kiện ngay khi nhận hàng. Vệ sinh sạch sáp ong, keo ong bám trên dụng cụ sau khi thao tác tại đàn và bảo quản nơi khô thoáng để duy trì độ bền của gỗ, kim loại và lưới bảo hộ.';
  }
  if (snapshot.itemType === 'MATERIAL') {
    return 'Sử dụng đúng định lượng và quy cách khuyến nghị theo mùa vụ nuôi ong. Bảo quản nơi khô thoáng, tránh ẩm ướt và kiểm tra tình trạng đóng gói trước khi đưa vào sử dụng tại trại.';
  }
  return undefined;
}

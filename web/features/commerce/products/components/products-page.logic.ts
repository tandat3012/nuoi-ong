export type ProductSortOption = 'price_asc' | 'price_desc';

export interface ProductsQueryCriteria {
  page?: number;
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSortOption;
}

export interface ProductsQueryValidationResult {
  isValid: boolean;
  criteria: ProductsQueryCriteria;
  error?: string;
}

/**
 * Xây dựng URL danh sách sản phẩm từ các tiêu chí tìm kiếm, lọc và phân trang.
 * Tự động loại bỏ các tham số mặc định (page=1, q rỗng, v.v.) để giữ URL gọn gàng.
 */
export function buildProductsHref(
  criteria: ProductsQueryCriteria,
  overrides?: Partial<ProductsQueryCriteria>,
): string {
  const merged = { ...criteria, ...overrides };
  const query = new URLSearchParams();

  if (merged.page !== undefined && merged.page > 1) {
    query.set('page', String(merged.page));
  }
  if (merged.category) {
    query.set('category', merged.category);
  }
  if (merged.q !== undefined && merged.q.trim().length > 0) {
    query.set('q', merged.q.trim());
  }
  if (merged.minPrice !== undefined && merged.minPrice !== null) {
    query.set('minPrice', String(merged.minPrice));
  }
  if (merged.maxPrice !== undefined && merged.maxPrice !== null) {
    query.set('maxPrice', String(merged.maxPrice));
  }
  if (merged.sort === 'price_asc' || merged.sort === 'price_desc') {
    query.set('sort', merged.sort);
  }

  const qs = query.toString();
  return qs ? `/products?${qs}` : '/products';
}

/**
 * Xây dựng đường dẫn phân trang và bộ lọc danh mục cho trang danh sách sản phẩm.
 * Tương thích ngược với các caller truyền (page, category) hoặc (page, filters).
 */
export function buildPageHref(
  pageNumber: number,
  categoryOrFilters?: string | Omit<ProductsQueryCriteria, 'page'>,
): string {
  if (typeof categoryOrFilters === 'string') {
    return buildProductsHref({ page: pageNumber, category: categoryOrFilters });
  }
  return buildProductsHref({
    ...(categoryOrFilters ?? {}),
    page: pageNumber,
  });
}

/**
 * Phân tích và kiểm tra tính hợp lệ của các tham số query từ URL theo contract backend.
 */
export function parseAndValidateProductsQuery(raw: {
  page?: string | string[];
  category?: string | string[];
  q?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  sort?: string | string[];
}): ProductsQueryValidationResult {
  const criteria: ProductsQueryCriteria = {};

  // 1. Kiểm tra tham số bị lặp lại (mảng) đối với các tham số tìm kiếm/lọc mới
  if (
    Array.isArray(raw.q) ||
    Array.isArray(raw.minPrice) ||
    Array.isArray(raw.maxPrice) ||
    Array.isArray(raw.sort)
  ) {
    return {
      isValid: false,
      criteria,
      error: 'Tham số tìm kiếm hoặc lọc không hợp lệ do bị lặp lại trong URL.',
    };
  }

  // 2. Parse category (nếu có)
  if (typeof raw.category === 'string' && raw.category) {
    criteria.category = raw.category;
  }

  // 3. Parse page
  if (typeof raw.page === 'string') {
    const pageNum = Number(raw.page);
    if (Number.isInteger(pageNum) && pageNum >= 1) {
      criteria.page = pageNum;
    }
  }

  // 4. Validate từ khóa tìm kiếm (q)
  if (raw.q !== undefined) {
    if (typeof raw.q !== 'string') {
      return {
        isValid: false,
        criteria,
        error: 'Từ khóa tìm kiếm không hợp lệ.',
      };
    }
    const trimmed = raw.q.trim();
    if (trimmed.length > 100) {
      return {
        isValid: false,
        criteria,
        error: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.',
      };
    }
    if (trimmed.length > 0) {
      criteria.q = trimmed;
    }
  }

  // 5. Validate giá tối thiểu (minPrice)
  if (raw.minPrice !== undefined && raw.minPrice !== '') {
    if (typeof raw.minPrice !== 'string' || !/^[0-9]+$/.test(raw.minPrice)) {
      return {
        isValid: false,
        criteria,
        error: 'Giá tối thiểu phải là số nguyên VNĐ hợp lệ (chỉ gồm chữ số).',
      };
    }
    const min = Number(raw.minPrice);
    if (!Number.isSafeInteger(min) || min < 0) {
      return {
        isValid: false,
        criteria,
        error: 'Giá tối thiểu vượt quá giới hạn hệ thống hỗ trợ.',
      };
    }
    criteria.minPrice = min;
  }

  // 6. Validate giá tối đa (maxPrice)
  if (raw.maxPrice !== undefined && raw.maxPrice !== '') {
    if (typeof raw.maxPrice !== 'string' || !/^[0-9]+$/.test(raw.maxPrice)) {
      return {
        isValid: false,
        criteria,
        error: 'Giá tối đa phải là số nguyên VNĐ hợp lệ (chỉ gồm chữ số).',
      };
    }
    const max = Number(raw.maxPrice);
    if (!Number.isSafeInteger(max) || max < 0) {
      return {
        isValid: false,
        criteria,
        error: 'Giá tối đa vượt quá giới hạn hệ thống hỗ trợ.',
      };
    }
    criteria.maxPrice = max;
  }

  // 7. Validate quan hệ khoảng giá: minPrice <= maxPrice
  if (
    criteria.minPrice !== undefined &&
    criteria.maxPrice !== undefined &&
    criteria.minPrice > criteria.maxPrice
  ) {
    return {
      isValid: false,
      criteria,
      error: 'Khoảng giá không hợp lệ: Giá tối thiểu không được lớn hơn giá tối đa.',
    };
  }

  // 8. Validate tùy chọn sắp xếp (sort)
  if (raw.sort !== undefined && raw.sort !== '') {
    if (raw.sort !== 'price_asc' && raw.sort !== 'price_desc') {
      return {
        isValid: false,
        criteria,
        error: 'Tùy chọn sắp xếp không hợp lệ (chỉ chấp nhận price_asc hoặc price_desc).',
      };
    }
    criteria.sort = raw.sort;
  }

  return {
    isValid: true,
    criteria,
  };
}

/**
 * Kiểm tra dữ liệu nhập liệu nháp cho bộ lọc khoảng giá tại client.
 */
export function validatePriceDraft(
  minStr: string,
  maxStr: string,
): {
  isValid: boolean;
  min?: number;
  max?: number;
  error?: string;
} {
  const cleanMin = minStr.trim();
  const cleanMax = maxStr.trim();

  let minVal: number | undefined;
  let maxVal: number | undefined;

  if (cleanMin !== '') {
    if (!/^[0-9]+$/.test(cleanMin)) {
      return {
        isValid: false,
        error: 'Giá tối thiểu chỉ được chứa các chữ số.',
      };
    }
    const n = Number(cleanMin);
    if (!Number.isSafeInteger(n) || n < 0) {
      return {
        isValid: false,
        error: 'Giá tối thiểu vượt quá giới hạn an toàn.',
      };
    }
    minVal = n;
  }

  if (cleanMax !== '') {
    if (!/^[0-9]+$/.test(cleanMax)) {
      return {
        isValid: false,
        error: 'Giá tối đa chỉ được chứa các chữ số.',
      };
    }
    const n = Number(cleanMax);
    if (!Number.isSafeInteger(n) || n < 0) {
      return {
        isValid: false,
        error: 'Giá tối đa vượt quá giới hạn an toàn.',
      };
    }
    maxVal = n;
  }

  if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
    return {
      isValid: false,
      error: 'Giá tối thiểu không được lớn hơn giá tối đa.',
    };
  }

  return { isValid: true, min: minVal, max: maxVal };
}

/**
 * Định dạng chuỗi hiển thị khoảng giá đã áp dụng cho thẻ badge bộ lọc.
 */
export function formatAppliedPriceRange(min?: number, max?: number): string {
  const formatVnd = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);

  if (min !== undefined && max !== undefined) {
    if (min === max) {
      return formatVnd(min);
    }
    return `${formatVnd(min)} – ${formatVnd(max)}`;
  }
  if (min !== undefined) {
    return `Từ ${formatVnd(min)}`;
  }
  if (max !== undefined) {
    return `Đến ${formatVnd(max)}`;
  }
  return '';
}


/**
 * Lấy tên hiển thị của danh mục đã chọn dựa trên danh sách cấu hình.
 * Trả về "Tất cả sản phẩm" khi không có danh mục nào được chọn.
 */
export function getCategoryDisplayName(
  categorySlug?: string,
  categories?: readonly { slug: string; name: string }[],
): string {
  if (!categorySlug) {
    return 'Tất cả sản phẩm';
  }
  const found = categories?.find((c) => c.slug === categorySlug);
  return found?.name ?? categorySlug;
}

/**
 * Giới hạn số trang hợp lệ dựa trên tổng số trang do API trả về.
 * Đảm bảo số trang tối thiểu là 1 và không vượt quá tổng số trang.
 */
export function clampPageNumber(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  if (page < 1) return 1;
  if (page > safeTotal) return safeTotal;
  return page;
}

/**
 * Trả về tiêu đề và phần mô tả giới thiệu phù hợp theo danh mục và từ khóa tìm kiếm.
 */
export function getListingHeadingAndDescription(
  categorySlug?: string,
  categoryName?: string,
  subtitle?: string,
  keyword?: string,
): { heading: string; description: string } {
  if (keyword) {
    return {
      heading: `Kết quả tìm kiếm: "${keyword}"`,
      description: categorySlug
        ? `Lọc trong danh mục ${categoryName || categorySlug}`
        : 'Tất cả sản phẩm phù hợp với từ khóa tìm kiếm.',
    };
  }

  if (!categorySlug) {
    return {
      heading: 'Tất cả sản phẩm',
      description:
        'Chọn điều tốt nhất cho đàn ong — vật tư chất lượng, thiết bị bền bỉ và mật ong nguyên chất.',
    };
  }

  return {
    heading: categoryName || 'Sản phẩm',
    description:
      subtitle ||
      'Sản phẩm chất lượng cao phục vụ và đồng hành cùng nghề nuôi ong.',
  };
}

/**
 * Tính toán danh sách các nút phân trang hiển thị (bao gồm dấu ba chấm nếu số trang lớn).
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ];
}

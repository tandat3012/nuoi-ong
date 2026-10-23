import type { StorefrontProduct } from '../types/product';

/**
 * Tập dữ liệu mẫu (Development Fixtures) cho sản phẩm nổi bật trên storefront.
 *
 * Bộ dữ liệu gồm 4 trường hợp điển hình:
 * 1. Sản phẩm có huy hiệu ưu đãi ("Bán chạy"), có giá gốc giảm (originalPrice) và đánh giá sao đầy đủ.
 * 2. Sản phẩm có huy hiệu phần trăm giảm giá ("-13%"), giá gốc và đánh giá sao.
 * 3. Sản phẩm có tên dài (kiểm thử căn chỉnh chiều cao tiêu đề đồng đều min-h & line-clamp).
 * 4. Sản phẩm nguyên giá (không có originalPrice) và không có đánh giá sao (kiểm thử chống layout shift).
 */
export const STOREFRONT_FEATURED_PRODUCTS: readonly StorefrontProduct[] = [
  {
    id: 'prod-mat-ong-hoa-ca-phe',
    slug: 'mat-ong-hoa-ca-phe-nguyen-chat',
    name: 'Mật ong hoa cà phê nguyên chất',
    category: {
      id: 'mat-ong',
      name: 'Mật ong thiên nhiên',
      slug: 'mat-ong',
    },
    price: 185000,
    originalPrice: 220000,
    badge: 'Bán chạy',
    rating: {
      score: 4.9,
      reviewCount: 128,
    },
    inStock: true,
  },
  {
    id: 'prod-thung-nuoi-ong-go-thong',
    slug: 'thung-nuoi-ong-go-thong-10-cau',
    name: 'Thùng nuôi ong gỗ thông 10 cầu',
    category: {
      id: 'tai-san',
      name: 'Thùng nuôi ong',
      slug: 'tai-san',
    },
    price: 450000,
    originalPrice: 520000,
    badge: '-13%',
    rating: {
      score: 4.8,
      reviewCount: 86,
    },
    inStock: true,
  },
  {
    id: 'prod-may-quay-mat-inox',
    slug: 'may-quay-mat-inox-3-cau',
    name: 'Máy quay mật inox 3 cầu tiêu chuẩn xuất khẩu truyền động êm ái',
    category: {
      id: 'thiet-bi',
      name: 'Máy quay mật',
      slug: 'thiet-bi',
    },
    price: 2850000,
    originalPrice: 3200000,
    badge: '-11%',
    rating: {
      score: 4.9,
      reviewCount: 54,
    },
    inStock: true,
  },
  {
    id: 'prod-duong-ong-tinh-luyen',
    slug: 'duong-ong-tinh-luyen-cao-cap',
    name: 'Đường ong tinh luyện cao cấp',
    category: {
      id: 'vat-tu',
      name: 'Thức ăn ong',
      slug: 'vat-tu',
    },
    price: 325000,
    // Không giảm giá, không có đánh giá (thử nghiệm cả 2 trường hợp khuyết dữ liệu)
    badge: 'Bán chạy',
    inStock: true,
  },
] as const;

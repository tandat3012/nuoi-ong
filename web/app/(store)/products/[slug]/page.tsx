import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, AlertCircle, RotateCcw } from 'lucide-react';
import { getProductStore } from '@/features/commerce/products/api/product.api';
import { ProductGallery } from '@/features/commerce/products/components/product-gallery';
import { ProductDetailSummary } from '@/features/commerce/products/components/product-detail-summary';
import { ProductDetailInfo } from '@/features/commerce/products/components/product-detail-info';
import { ProductRelatedProducts } from '@/features/commerce/products/components/product-related-products';

// Request-level cache to avoid duplicate network fetches between generateMetadata and page render
const getCachedProduct = cache(async (slug: string) => {
  return getProductStore(slug);
});

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { title: 'Không tìm thấy sản phẩm' };
  }

  try {
    const result = await getCachedProduct(slug);
    if (!result?.data) {
      return { title: 'Không tìm thấy sản phẩm' };
    }
    const product = result.data;
    return {
      title: `${product.name} | Mộc Ong`,
      description: product.description || `Chi tiết sản phẩm ${product.name} tại Mộc Ong.`,
      openGraph: {
        title: `${product.name} | Mộc Ong`,
        description: product.description,
        images: product.image?.src ? [{ url: product.image.src, alt: product.image.alt }] : undefined,
      },
    };
  } catch {
    return { title: 'Sản phẩm | Mộc Ong' };
  }
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

  // 1. Kiểm tra định dạng slug hợp lệ
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    notFound();
  }

  let productResult;
  let fetchError: Error | null = null;

  try {
    productResult = await getCachedProduct(slug);
  } catch (error) {
    fetchError = error instanceof Error ? error : new Error('Lỗi máy chủ không xác định');
  }

  // 2. Xử lý sự cố máy chủ / API outage — phân biệt rạch ròi với 404
  if (fetchError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav
          aria-label="Đường dẫn trang"
          className="mb-6 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          <Link href="/products" className="transition-colors hover:text-foreground">
            Sản phẩm
          </Link>
        </nav>

        <div
          role="alert"
          aria-live="assertive"
          className="w-full rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center sm:p-12 my-8"
        >
          <AlertCircle className="mx-auto size-10 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-base font-semibold text-foreground sm:text-lg">
            Không thể tải thông tin sản phẩm
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Hệ thống đang gặp gián đoạn tạm thời hoặc không thể kết nối đến máy chủ dữ liệu. Vui lòng thử lại sau giây lát.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href=""
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <span>Tải lại trang</span>
            </a>
            <Link
              href="/products"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              Quay lại danh sách sản phẩm
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Không tìm thấy sản phẩm -> 404
  if (!productResult || !productResult.data) {
    notFound();
  }

  const product = productResult.data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Breadcrumb điều hướng */}
      <nav
        aria-label="Đường dẫn trang"
        className="mb-6 sm:mb-8 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Trang chủ
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        <Link
          href={`/products?category=${product.category.slug}`}
          className="transition-colors hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-md" aria-current="page">
          {product.name}
        </span>
      </nav>

      {/* Bố cục 2 cột chính: Gallery bên trái, Summary bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-start">
        <ProductGallery
          productName={product.name}
          image={product.image}
          images={product.images}
        />
        <ProductDetailSummary product={product} />
      </div>

      {/* Khối thông tin chi tiết: Mô tả / Thông số / Hướng dẫn */}
      <ProductDetailInfo product={product} />

      {/* Sản phẩm liên quan cùng danh mục */}
      <ProductRelatedProducts
        categorySlug={product.category.slug}
        currentProductId={product.id}
        currentProductSlug={product.slug}
      />
    </main>
  );
}

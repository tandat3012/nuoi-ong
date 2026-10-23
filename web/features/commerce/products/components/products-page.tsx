import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  PackageOpen,
} from 'lucide-react';
import { getProductsStore } from '../api/product.api';
import { getAllCategoriesStore } from '../../categories/api/category.api';
import { ProductCard } from './product-card';
import { ProductsSidebar } from './products-sidebar';
import { ProductsMobileFilter } from './products-mobile-filter';
import { ProductsSortSelect } from './products-sort-select';
import { ProductsActiveFilters } from './products-active-filters';
import {
  type ProductsQueryCriteria,
  buildProductsHref,
  getListingHeadingAndDescription,
  getPaginationItems,
} from './products-page.logic';
import { STOREFRONT_CONFIG } from '@/features/commerce/storefront/config/storefront-config';
import { cn } from '@/shared/lib/utils';

export interface ProductsPageProps {
  criteria: ProductsQueryCriteria;
  validationError?: string;
}

export async function ProductsPage({
  criteria,
  validationError,
}: ProductsPageProps) {
  const { category, q, sort } = criteria;
  const page = criteria.page ?? 1;

  const [categoriesResult, productsResult] = await Promise.allSettled([
    getAllCategoriesStore(),
    validationError ? Promise.resolve(null) : getProductsStore(criteria),
  ]);
  const categories =
    categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
  const categoriesError = categoriesResult.status === 'rejected';
  const categoryItem = category
    ? categories.find((c) => c.slug === category)
    : undefined;
  const selectedCategoryName = categoryItem?.name ?? category;
  const { heading, description } = getListingHeadingAndDescription(
    category,
    selectedCategoryName,
    category
      ? STOREFRONT_CONFIG.categories.presentationBySlug[category]?.subtitle
      : undefined,
    q,
  );

  // 1. Xử lý trường hợp URL trực tiếp chứa tham số lọc/tìm kiếm không hợp lệ
  if (validationError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav
          aria-label="Đường dẫn trang"
          className="mb-6 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground/50"
            aria-hidden="true"
          />
          <Link
            href="/products"
            className="transition-colors hover:text-foreground"
          >
            Sản phẩm
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2d241e] dark:text-foreground sm:text-4xl">
            Tất cả sản phẩm
          </h1>
        </header>

        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <ProductsSidebar
            categories={categories}
            categoriesError={categoriesError}
            criteria={criteria}
          />

          <div
            role="alert"
            aria-live="assertive"
            className="w-full flex-1 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center sm:p-12"
          >
            <AlertCircle
              className="mx-auto size-10 text-destructive"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-base font-semibold text-foreground sm:text-lg">
              Bộ lọc không hợp lệ
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              {validationError}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span>Đặt lại bộ lọc</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (productsResult.status === 'rejected' || !productsResult.value) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Breadcrumb khi xảy ra lỗi */}
        <nav
          aria-label="Đường dẫn trang"
          className="mb-6 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground/50"
            aria-hidden="true"
          />
          <Link
            href="/products"
            className="transition-colors hover:text-foreground"
          >
            Sản phẩm
          </Link>
          {category && (
            <>
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
              <span
                className="font-semibold text-foreground"
                aria-current="page"
              >
                {selectedCategoryName}
              </span>
            </>
          )}
        </nav>

        {/* Tiêu đề trang */}
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2d241e] dark:text-foreground sm:text-4xl">
            {heading}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5c5249] dark:text-muted-foreground sm:text-base">
            {description}
          </p>
        </header>

        {/* Bố cục 2 cột giữ vững khung trang khi lỗi kết nối */}
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <ProductsSidebar
            categories={categories}
            categoriesError={categoriesError}
            criteria={criteria}
          />

          <div
            role="alert"
            aria-live="assertive"
            className="w-full flex-1 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center sm:p-12"
          >
            <AlertCircle
              className="mx-auto size-10 text-destructive"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-base font-semibold text-foreground sm:text-lg">
              Không thể tải danh sách sản phẩm
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Đã xảy ra lỗi khi kết nối đến máy chủ. Vui lòng tải lại trang hoặc thử lại sau.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={buildProductsHref(criteria)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span>Tải lại trang</span>
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                Xem tất cả sản phẩm
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { data: products, page: pageInfo } = productsResult.value;
  const lastPage = Math.max(1, pageInfo.totalPages);

  // Chuyển hướng an toàn nếu số trang vượt quá giới hạn tối đa mà vẫn giữ nguyên mọi bộ lọc
  if (page > lastPage) {
    redirect(buildProductsHref(criteria, { page: lastPage }));
  }

  const paginationItems = getPaginationItems(
    pageInfo.number,
    pageInfo.totalPages,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb chuẩn SEO & hỗ trợ tiếp cận */}
      <nav
        aria-label="Đường dẫn trang"
        className="mb-6 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Trang chủ
        </Link>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground/50"
          aria-hidden="true"
        />
        {!category && !q ? (
          <span className="font-semibold text-foreground" aria-current="page">
            Tất cả sản phẩm
          </span>
        ) : (
          <Link
            href="/products"
            className="transition-colors hover:text-foreground"
          >
            Sản phẩm
          </Link>
        )}
        {category && (
          <>
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground/50"
              aria-hidden="true"
            />
            <span
              className={cn(
                'font-semibold',
                !q ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-current={!q ? 'page' : undefined}
            >
              {selectedCategoryName}
            </span>
          </>
        )}
        {q && (
          <>
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground/50"
              aria-hidden="true"
            />
            <span className="font-semibold text-foreground" aria-current="page">
              Tìm kiếm: &ldquo;{q}&rdquo;
            </span>
          </>
        )}
      </nav>

      {/* Header giới thiệu trang */}
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2d241e] dark:text-foreground sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5c5249] dark:text-muted-foreground sm:text-base">
          {description}
        </p>
      </header>

      {/* Khung nội dung chính: Cột danh mục máy tính (Sidebar) và Danh sách sản phẩm */}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        {/* Sidebar danh mục và bộ lọc giá cho Desktop */}
        <ProductsSidebar
          categories={categories}
          categoriesError={categoriesError}
          criteria={criteria}
        />

        {/* Vùng hiển thị kết quả sản phẩm */}
        <div className="w-full flex-1">
          {/* Thanh công cụ: đếm sản phẩm, bộ lọc di động và chọn sắp xếp */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <p className="text-sm font-medium text-muted-foreground">
              <span className="font-semibold text-foreground">
                {pageInfo.totalItems}
              </span>{' '}
              sản phẩm
            </p>

            <div className="flex max-w-full flex-wrap items-center gap-2 sm:gap-3">
              {/* Tùy chọn sắp xếp giá */}
              <ProductsSortSelect currentSort={sort} />

              {/* Nút lọc danh mục & giá trên thiết bị di động */}
              <ProductsMobileFilter
                categories={categories}
                categoriesError={categoriesError}
                criteria={criteria}
                selectedCategoryName={selectedCategoryName}
              />
            </div>
          </div>

          {/* Dải hiển thị các bộ lọc đang kích hoạt */}
          <ProductsActiveFilters
            criteria={criteria}
            categoryName={selectedCategoryName}
          />

          {/* Hiển thị danh sách sản phẩm hoặc trạng thái trống */}
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
              <PackageOpen
                className="mx-auto size-12 text-muted-foreground/50"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-base font-semibold text-foreground sm:text-lg">
                Không tìm thấy sản phẩm phù hợp
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                {q
                  ? `Không có sản phẩm nào khớp với từ khóa "${q}" và các tiêu chí lọc đã chọn.`
                  : 'Không có sản phẩm nào phù hợp với khoảng giá hoặc danh mục đã chọn.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/products"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  <span>Xóa tất cả bộ lọc</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isDetailImplemented={true}
                />
              ))}
            </div>
          )}

          {/* Phân trang đồng bộ phong cách Mộc Ong */}
          {pageInfo.totalPages > 1 && (
            <nav
              aria-label="Phân trang sản phẩm"
              className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
            >
              <p className="text-xs text-muted-foreground sm:text-sm">
                Trang{' '}
                <span className="font-semibold text-foreground">
                  {pageInfo.number}
                </span>{' '}
                /{' '}
                <span className="font-semibold text-foreground">
                  {pageInfo.totalPages}
                </span>{' '}
                ({pageInfo.totalItems} sản phẩm)
              </p>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Nút Trang trước */}
                {pageInfo.number > 1 ? (
                  <Link
                    href={buildProductsHref(criteria, {
                      page: pageInfo.number - 1,
                    })}
                    aria-label="Chuyển đến trang trước"
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:text-sm"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Trang trước</span>
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-9 select-none items-center justify-center gap-1 rounded-xl border border-border/50 bg-card/50 px-3 text-xs font-medium text-muted-foreground/40 cursor-not-allowed sm:text-sm"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Trang trước</span>
                  </span>
                )}

                {/* Các nút số trang và dấu ba chấm */}
                <div className="flex items-center gap-1">
                  {paginationItems.map((item, idx) => {
                    if (item === 'ellipsis') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="inline-flex size-9 items-center justify-center text-xs text-muted-foreground"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      );
                    }

                    const isCurrent = item === pageInfo.number;
                    if (isCurrent) {
                      return (
                        <span
                          key={`page-${item}`}
                          aria-current="page"
                          className="inline-flex size-9 items-center justify-center rounded-xl bg-store-category-selected text-xs font-semibold text-store-category-selected-foreground shadow-2xs sm:text-sm"
                        >
                          {item}
                        </span>
                      );
                    }

                    return (
                      <Link
                        key={`page-${item}`}
                        href={buildProductsHref(criteria, { page: item })}
                        aria-label={`Chuyển đến trang ${item}`}
                        className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:text-sm"
                      >
                        {item}
                      </Link>
                    );
                  })}
                </div>

                {/* Nút Trang sau */}
                {pageInfo.number < pageInfo.totalPages ? (
                  <Link
                    href={buildProductsHref(criteria, {
                      page: pageInfo.number + 1,
                    })}
                    aria-label="Chuyển đến trang sau"
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:text-sm"
                  >
                    <span className="hidden sm:inline">Trang sau</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-9 select-none items-center justify-center gap-1 rounded-xl border border-border/50 bg-card/50 px-3 text-xs font-medium text-muted-foreground/40 cursor-not-allowed sm:text-sm"
                  >
                    <span className="hidden sm:inline">Trang sau</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                )}
              </div>
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { PaginatedResponse } from '@/shared/api/contracts';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { getProductsStore } from '../api/product.api';
import type { StorefrontProduct } from '../types/product';
import { ProductCard } from './product-card';

export async function ProductsPage({
  page,
  category,
}: {
  page: number;
  category?: string;
}) {
  let result: PaginatedResponse<StorefrontProduct>;

  try {
    result = await getProductsStore(page, 20, category);
  } catch {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-6 font-serif text-3xl font-bold">Sản phẩm</h1>
        <ErrorAlert message="Không tải được sản phẩm. Vui lòng tải lại trang." />
      </main>
    );
  }

  const { data: products, page: pageInfo } = result;
  const pageHref = (number: number) => {
    const query = new URLSearchParams({ page: String(number) });
    if (category) query.set('category', category);
    return `/products?${query}`;
  };

  const lastPage = Math.max(1, pageInfo.totalPages);
  if (page > lastPage) redirect(pageHref(lastPage));

  const linkClassName =
    'inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Sản phẩm
          </h1>
          {category && (
            <p className="mt-2 text-sm text-muted-foreground">
              Danh mục: {products[0]?.category.name ?? category}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {pageInfo.totalItems} sản phẩm
          </p>
        </div>
        {category && (
          <Link href="/products" className={linkClassName}>
            Xem tất cả sản phẩm
          </Link>
        )}
      </header>

      {products.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Chưa có sản phẩm phù hợp.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {pageInfo.totalPages > 1 && (
        <nav
          aria-label="Phân trang sản phẩm"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
        >
          <p className="text-sm text-muted-foreground">
            Trang {pageInfo.number} / {pageInfo.totalPages}
          </p>
          <div className="flex gap-2">
            {pageInfo.number > 1 && (
              <Link
                href={pageHref(pageInfo.number - 1)}
                className={linkClassName}
              >
                Trang trước
              </Link>
            )}
            {pageInfo.number < pageInfo.totalPages && (
              <Link
                href={pageHref(pageInfo.number + 1)}
                className={linkClassName}
              >
                Trang sau
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}

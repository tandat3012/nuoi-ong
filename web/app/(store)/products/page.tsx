import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductsPage } from '@/features/commerce/products/components/products-page';

export const metadata: Metadata = { title: 'Sản phẩm' };

export default async function StoreProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    category?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const page = Number(query.page ?? '1');
  const category = query.category || undefined;

  if (
    Array.isArray(query.page) ||
    !Number.isSafeInteger(page * 20) ||
    !Number.isInteger(page) ||
    page < 1 ||
    (category !== undefined &&
      (typeof category !== 'string' ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)))
  ) {
    notFound();
  }

  return (
    <Suspense
      key={`${page}:${category ?? ''}`}
      fallback={
        <p role="status" className="px-4 py-12 text-center">
          Đang tải sản phẩm…
        </p>
      }
    >
      <ProductsPage page={page} category={category} />
    </Suspense>
  );
}
